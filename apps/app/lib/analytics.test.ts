import { describe, expect, it } from 'vitest';
import { buildBootstrapPayload, homeCurrencyForLocale, homeCurrencyForTimezone } from './analyticsProfile';
import { shouldRecordAppOpen } from './analyticsGuard';
import {
  SESSION_IDLE_MS,
  isStoredSession,
  newSession,
  sessionBackground,
  sessionColdStart,
  sessionEnd,
  sessionForeground,
  sessionPhoto,
  sessionScreen,
} from './sessionState';

describe('app analytics guards', () => {
  it('records one authenticated app open per user per JS session', () => {
    expect(shouldRecordAppOpen(null)).toBe(false);
    expect(shouldRecordAppOpen('user-a')).toBe(true);
    expect(shouldRecordAppOpen('user-a')).toBe(false);
    expect(shouldRecordAppOpen('user-b')).toBe(true);
  });

  it('builds bootstrap payload with app platform metadata', () => {
    expect(
      buildBootstrapPayload({
        timezone: 'Asia/Singapore',
        locale: 'en-SG',
        platform: 'android',
        appVersion: '0.1.0',
      }),
    ).toEqual({
      anchored_timezone: 'Asia/Singapore',
      home_currency: 'SGD',
      platform: 'android',
      app_version: '0.1.0',
    });
  });

  // 6 Sep 2026 — the founder's own account: anchored_timezone "Asia/Singapore"
  // beside home_currency "USD", because currency came from the locale alone and
  // his emulator reported en-US. The locale describes the KEYBOARD; the
  // timezone describes the PLACE, and the place is what decides what you spend.
  //
  // Currency is stamped onto every filed expense, so this is wrong DATA in the
  // ledger, not a wrong symbol on a screen.
  it('takes the currency from the timezone when the locale disagrees', () => {
    expect(
      buildBootstrapPayload({
        timezone: 'Asia/Singapore',
        locale: 'en-US', // a phone or emulator set to US English, physically in SG
        platform: 'android',
        appVersion: '0.1.0',
      }).home_currency,
    ).toBe('SGD');
  });

  it('falls back to the locale for a timezone nobody mapped, and never gets worse', () => {
    // Adding a better answer must never replace a right one with a guess.
    expect(
      buildBootstrapPayload({
        timezone: 'Africa/Nairobi',
        locale: 'en-GB',
        platform: 'ios',
        appVersion: '0.1.0',
      }).home_currency,
    ).toBe('GBP');
    expect(homeCurrencyForTimezone('Africa/Nairobi')).toBeNull();
    expect(homeCurrencyForTimezone(undefined)).toBeNull();
  });

  it('derives a conservative home currency from locale region', () => {
    expect(homeCurrencyForLocale('en-SG')).toBe('SGD');
    expect(homeCurrencyForLocale('en-US')).toBe('USD');
    expect(homeCurrencyForLocale('en-GB')).toBe('GBP');
    expect(homeCurrencyForLocale('en-AU')).toBe('AUD');
    expect(homeCurrencyForLocale('en')).toBe('USD');
  });
});

// z8v0kmr81a — a session is open → ≥30-min background gap, not open →
// any background. 3 opens / 21 ends on one account before this.
describe('mobile session semantics (z8v0kmr81a)', () => {
  const T0 = 1_760_000_000_000;
  const min = (n: number) => n * 60_000;

  it('a short background gap RESUMES the session — no end, no new open', () => {
    let s = newSession(T0);
    s = sessionScreen(s, 'chat', T0 + min(1));
    s = sessionBackground(s, T0 + min(2));
    const r = sessionForeground(s, T0 + min(2) + SESSION_IDLE_MS - 1);
    expect(r.end).toBeNull();
    expect(r.opened).toBe(false);
    expect(r.session.opened_at).toBe(T0); // same session, same clock start
    expect(r.session.backgrounded_at).toBeNull();
    expect(r.session.screens).toEqual(['chat']);
  });

  it('a gap of 30 minutes or more ENDS the stored session and opens a new one', () => {
    let s = newSession(T0);
    s = sessionScreen(s, 'chat', T0 + min(1));
    s = sessionPhoto(s, T0 + min(3));
    s = sessionBackground(s, T0 + min(5));
    const r = sessionForeground(s, T0 + min(5) + SESSION_IDLE_MS);
    expect(r.end).not.toBeNull();
    expect(r.opened).toBe(true);
    expect(r.session.opened_at).toBe(T0 + min(5) + SESSION_IDLE_MS);
    expect(r.session.photos).toBe(0);
    // The duration is the time the user HAD the app open — to the moment it
    // went to the background, never to the moment the end is posted.
    expect(sessionEnd(r.end!)).toEqual({ session_duration_seconds: 300, photos_sent_count: 1, screens_viewed: 1 });
  });

  it('a cold start with a stored session ends it first — the app died holding it', () => {
    let s = newSession(T0);
    s = sessionScreen(s, 'chat', T0 + min(1));
    s = sessionScreen(s, 'board', T0 + min(4));
    // Killed while foregrounded: no background stamp. Duration runs to the
    // last thing the app was seen doing, not to the next launch a day later.
    const r = sessionColdStart(s, T0 + min(60 * 24));
    expect(r.end).toBe(s);
    expect(r.opened).toBe(true);
    expect(sessionEnd(s)).toEqual({ session_duration_seconds: 240, photos_sent_count: 0, screens_viewed: 2 });
    expect(sessionColdStart(null, T0).end).toBeNull();
  });

  it('a second background without a foreground keeps the FIRST stamp', () => {
    let s = sessionBackground(newSession(T0), T0 + min(1));
    s = sessionBackground(s, T0 + min(20));
    expect(s.backgrounded_at).toBe(T0 + min(1));
    // …so 20 minutes later still counts as a 30-minute gap from when the user left.
    expect(sessionForeground(s, T0 + min(31)).end).not.toBeNull();
  });

  it('foreground without ever leaving is a no-op', () => {
    const s = newSession(T0);
    expect(sessionForeground(s, T0 + min(90))).toEqual({ end: null, session: s, opened: false });
  });

  it('screens dedupe, photos count, and a blank screen is ignored', () => {
    let s = newSession(T0);
    s = sessionScreen(s, 'chat', T0);
    s = sessionScreen(s, 'chat', T0);
    s = sessionScreen(s, '', T0);
    s = sessionPhoto(sessionPhoto(s, T0), T0);
    expect(s.screens).toEqual(['chat']);
    expect(s.photos).toBe(2);
    expect(sessionEnd(newSession(T0)).screens_viewed).toBe(1); // the server schema's floor
  });

  it('only a well-formed stored record is trusted — a corrupt file is a fresh start', () => {
    expect(isStoredSession(newSession(T0))).toBe(true);
    expect(isStoredSession(null)).toBe(false);
    expect(isStoredSession({ opened_at: 'yesterday' })).toBe(false);
    expect(isStoredSession({ ...newSession(T0), backgrounded_at: 'x' })).toBe(false);
  });
});

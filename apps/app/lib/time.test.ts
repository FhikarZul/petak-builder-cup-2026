// Timezone-anchored display (1 Sep 2026 ruling). Node's Intl is full-ICU, so
// these run everywhere; Hermes falls back to device-local on unknown zones,
// which the tz=null cases here also pin.
import { describe, expect, it } from 'vitest';
import { dayKeyInTz, draftDateline, hhmmInTz, isValidTimezone, labelForDayKey, timezoneChoices } from './time';

// 31 Aug 2026 16:30 UTC — 31 Aug 23:30 in Kolkata (+5:30), 1 Sep 00:30 in Singapore (+8).
const ISO = '2026-08-31T16:30:00.000Z';

describe('dayKeyInTz', () => {
  it('renders the calendar date in the anchored zone', () => {
    expect(dayKeyInTz(ISO, 'Asia/Kolkata')).toBe('2026-08-31');
    expect(dayKeyInTz(ISO, 'Asia/Singapore')).toBe('2026-09-01');
    expect(dayKeyInTz(ISO, 'UTC')).toBe('2026-08-31');
  });

  it('null zone falls back to the device-local date string', () => {
    expect(dayKeyInTz(ISO, null)).toBe(new Date(ISO).toDateString());
  });

  it('an unsupported zone degrades to device-local instead of crashing', () => {
    expect(dayKeyInTz(ISO, 'Mars/Olympus_Mons')).toBe(new Date(ISO).toDateString());
  });
});

describe('labelForDayKey', () => {
  it('keeps historical toDateString labels when no zone is set', () => {
    const key = new Date(ISO).toDateString();
    expect(labelForDayKey(key, null)).toBe(key);
  });

  it('formats a YYYY-MM-DD zone key back into the same label shape', () => {
    expect(labelForDayKey('2026-09-01', 'Asia/Singapore')).toBe('Tue Sep 01 2026');
  });
});

describe('hhmmInTz', () => {
  it('renders the clock in the anchored zone', () => {
    expect(hhmmInTz(ISO, 'Asia/Kolkata')).toBe('22:00');
    expect(hhmmInTz(ISO, 'Asia/Singapore')).toBe('00:30');
    expect(hhmmInTz(ISO, 'UTC')).toBe('16:30');
  });

  it('null zone matches the device-local HH:MM', () => {
    const d = new Date(ISO);
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(hhmmInTz(ISO, null)).toBe(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  });
});

describe('timezoneChoices + isValidTimezone', () => {
  it('returns IANA zones including the ones the product cares about', () => {
    const zones = timezoneChoices();
    expect(zones).toContain('Asia/Singapore');
    expect(zones).toContain('UTC');
    expect(zones.length).toBeGreaterThan(50);
  });

  it('validates real zones and rejects junk', () => {
    expect(isValidTimezone('Asia/Jakarta')).toBe(true);
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
  });
});

// Run C #66 / Run A #52: Milo's weekly draft is served with the raw ISO week
// as its dateline, and the app rendered it verbatim — so the card read
// "2026-W34" where the drawing reads "Week of 17 Aug" (parity ledger PAR-A52,
// PAR-C66). This is a display fix: the server contract is unchanged.
describe('draftDateline', () => {
  it('reads an ISO week as the Monday it starts on', () => {
    expect(draftDateline('2026-W34')).toBe('Week of 17 Aug');
    expect(draftDateline('2026-W35')).toBe('Week of 24 Aug');
  });

  // ISO week 1 is the week containing the first Thursday, so it routinely
  // starts in the PREVIOUS calendar year. 2026-W01 begins 29 Dec 2025.
  it('handles weeks that straddle the year boundary', () => {
    expect(draftDateline('2026-W01')).toBe('Week of 29 Dec');
    expect(draftDateline('2026-W53')).toBe('Week of 28 Dec');
  });

  // Never improvise: anything that is not an ISO week rides exactly as served,
  // so a server contract change shows up as itself rather than as a wrong date.
  it('passes through anything that is not an ISO week', () => {
    expect(draftDateline('Week of 17 Aug')).toBe('Week of 17 Aug');
    expect(draftDateline('2026-08-17')).toBe('2026-08-17');
    expect(draftDateline('')).toBe('');
  });
});

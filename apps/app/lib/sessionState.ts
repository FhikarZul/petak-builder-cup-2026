// z8v0kmr81a (18 Sep 2026) — what a mobile session IS.
//
// `app_session_ended` posted on every AppState → 'background': 3 opens and
// 21 ends on one account, most of them a few seconds long. A notification
// glance, a switch to the camera roll and back, a phone call — each ended a
// "session". Canon calls the verb "explicit mobile session duration"; a
// duration that resets every time the screen dims is not one.
//
// A session runs from the open until a background gap of at least 30 minutes
// (PostHog's own idle rule, so the number here and the number there agree).
// A short gap resumes the same session; a long gap ends the stored one — with
// the duration the user actually had — and opens a new one. A cold start
// with a stored session ends that first: the app was killed or crashed, and
// the duration ran to the last moment it was seen.
//
// PURE. Storage and the network live in analytics.ts; this file decides.

export const SESSION_IDLE_MS = 30 * 60_000;

export interface StoredSession {
  /** Epoch ms the session opened. */
  opened_at: number;
  /** Epoch ms of the last foreground activity (screen, photo, background). */
  last_active_at: number;
  /** Epoch ms the app went to the background, null while foregrounded. */
  backgrounded_at: number | null;
  photos: number;
  screens: string[];
}

export interface SessionEnd {
  session_duration_seconds: number;
  photos_sent_count: number;
  screens_viewed: number;
}

export function newSession(now: number): StoredSession {
  return { opened_at: now, last_active_at: now, backgrounded_at: null, photos: 0, screens: [] };
}

export function sessionScreen(s: StoredSession, screen: string, now: number): StoredSession {
  if (!screen) return s;
  return { ...s, last_active_at: now, screens: s.screens.includes(screen) ? s.screens : [...s.screens, screen] };
}

export function sessionPhoto(s: StoredSession, now: number): StoredSession {
  return { ...s, last_active_at: now, photos: s.photos + 1 };
}

export function sessionBackground(s: StoredSession, now: number): StoredSession {
  // A second background without a foreground between keeps the FIRST stamp:
  // the gap is measured from when the user actually left.
  return { ...s, last_active_at: now, backgrounded_at: s.backgrounded_at ?? now };
}

/** The end payload for a session that is over. Duration runs to the moment
 *  the app went to the background, or — killed while foregrounded — to the
 *  last thing it was seen doing. Never the moment the end is posted. */
export function sessionEnd(s: StoredSession): SessionEnd {
  const endedAt = s.backgrounded_at ?? s.last_active_at;
  return {
    session_duration_seconds: Math.max(0, Math.round((endedAt - s.opened_at) / 1000)),
    photos_sent_count: s.photos,
    screens_viewed: Math.max(1, s.screens.length),
  };
}

export interface Resume {
  /** The session that is over and must be posted, if any. */
  end: StoredSession | null;
  /** The session now running. */
  session: StoredSession;
  /** True when `session` is a NEW open — the client `app_opened` fires. */
  opened: boolean;
}

/** AppState → 'active' from the background. */
export function sessionForeground(s: StoredSession, now: number): Resume {
  if (s.backgrounded_at === null) return { end: null, session: s, opened: false }; // never left
  if (now - s.backgrounded_at >= SESSION_IDLE_MS) return { end: s, session: newSession(now), opened: true };
  return { end: null, session: { ...s, backgrounded_at: null, last_active_at: now }, opened: false };
}

/** The JS bundle starting: a stored session is one the app died holding. */
export function sessionColdStart(stored: StoredSession | null, now: number): Resume {
  return { end: stored, session: newSession(now), opened: true };
}

export function isStoredSession(v: unknown): v is StoredSession {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.opened_at === 'number' &&
    typeof o.last_active_at === 'number' &&
    (o.backgrounded_at === null || typeof o.backgrounded_at === 'number') &&
    typeof o.photos === 'number' &&
    Array.isArray(o.screens)
  );
}

import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { apiFetch } from './api';
import { shouldRecordAppOpen } from './analyticsGuard';
import { buildBootstrapPayload } from './analyticsProfile';
import {
  isStoredSession,
  newSession,
  sessionBackground,
  sessionColdStart,
  sessionEnd,
  sessionForeground,
  sessionPhoto,
  sessionScreen,
  type StoredSession,
} from './sessionState';

// z8v0kmr81a — the running session, and its copy on disk. The disk copy is
// what survives a kill: the next launch ends it with the duration the user
// actually had. Same storage choice as the outbox (expo-file-system ships
// with expo; nothing new).
let session: StoredSession = newSession(Date.now());
const sessionFile = new File(Paths.document, 'petak-session.json');
let sessionEndInFlight = false;

export function appPlatform(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export function appVersion(): string {
  return (
    (Constants.expoConfig?.version as string | undefined) ??
    Constants.nativeAppVersion ??
    'unknown'
  );
}

export function bootstrapPayload(): {
  anchored_timezone: string;
  home_currency: string;
  platform: 'android' | 'ios';
  app_version: string;
} {
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  return buildBootstrapPayload({
    timezone: resolved.timeZone,
    locale: resolved.locale,
    platform: appPlatform(),
    appVersion: appVersion(),
  });
}

export async function bootstrapAuthenticatedUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    await apiFetch('/v1/bootstrap', {
      method: 'POST',
      body: JSON.stringify(bootstrapPayload()),
    });
    return true;
  } catch {
    // Bootstrap gates the main screen; the layout retries without crashing.
    return false;
  }
}

export async function recordAuthenticatedAppOpen(userId: string | null | undefined): Promise<void> {
  if (!shouldRecordAppOpen(userId)) return;
  try {
    await apiFetch('/v1/attribution/app-open', {
      method: 'POST',
      body: JSON.stringify({ platform: appPlatform(), app_version: appVersion() }),
    });
  } catch {
    // Analytics must never block the app.
  }
}

export function noteScreenViewed(screen: string): void {
  session = sessionScreen(session, screen, Date.now());
}

export function notePhotoSentForSession(): void {
  session = sessionPhoto(session, Date.now());
}

function readStoredSession(): StoredSession | null {
  try {
    if (!sessionFile.exists) return null;
    const parsed: unknown = JSON.parse(sessionFile.textSync());
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null; // a corrupt file is a fresh start, never a crash
  }
}

function writeStoredSession(s: StoredSession | null): void {
  try {
    if (s === null) {
      if (sessionFile.exists) sessionFile.delete();
      return;
    }
    if (!sessionFile.exists) sessionFile.create({ overwrite: true });
    sessionFile.write(JSON.stringify(s));
  } catch {
    // Best-effort: losing the disk copy costs one session's duration, nothing else.
  }
}

async function postSessionEnd(ended: StoredSession): Promise<void> {
  if (sessionEndInFlight) return;
  sessionEndInFlight = true;
  try {
    await apiFetch('/v1/attribution/session-ended', {
      method: 'POST',
      body: JSON.stringify({ ...sessionEnd(ended), platform: appPlatform() }),
    });
  } catch {
    // Analytics must never block app lifecycle transitions.
  } finally {
    sessionEndInFlight = false;
  }
}

/** The JS bundle started. A session the app died holding is ended first,
 *  with the duration it actually had; then this launch's session begins. */
export async function recordAppColdStart(): Promise<void> {
  const r = sessionColdStart(readStoredSession(), Date.now());
  session = r.session;
  writeStoredSession(session);
  if (r.end) await postSessionEnd(r.end);
}

/** AppState → 'background'. Nothing is posted: the session is not over, it
 *  is stamped and saved. Whether it ended is decided when the user returns. */
export function recordAppBackgrounded(): void {
  session = sessionBackground(session, Date.now());
  writeStoredSession(session);
}

/** AppState → 'active'. A gap under 30 minutes resumes; a longer one ends
 *  the stored session and opens a new one. Returns true when a NEW session
 *  opened, so the caller fires the client `app_opened` for it. */
export async function recordAppForegrounded(): Promise<boolean> {
  const r = sessionForeground(session, Date.now());
  session = r.session;
  writeStoredSession(session);
  if (r.end) await postSessionEnd(r.end);
  return r.opened;
}

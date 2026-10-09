// Time display in the user's anchored timezone (founder ruling 1 Sep 2026:
// timezone is a setting, not bootstrap inference). Instants are stored in
// UTC; these helpers only change how they are READ. Every helper degrades to
// the device timezone when no setting exists or the zone is unsupported —
// a wrong-looking clock never crashes the feed.

/** Calendar day of an instant in `tz`, as YYYY-MM-DD (or the device-local
 *  Date.toDateString() when tz is null — the historical label format). */
export function dayKeyInTz(iso: string, tz: string | null): string {
  const d = new Date(iso);
  if (!tz) return d.toDateString();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return d.toDateString();
  }
}

/** Human label for a dayKey produced by dayKeyInTz. */
export function labelForDayKey(key: string, tz: string | null): string {
  if (!tz) return key; // already a Date.toDateString()
  const [y, m, d] = key.split('-').map(Number);
  // Noon construction dodges every DST edge; toDateString keeps the exact
  // historical label shape the feed has always shown.
  return new Date(y, m - 1, d, 12).toDateString();
}

/** HH:MM of an instant in `tz` (device-local when tz is null). */
export function hhmmInTz(iso: string, tz: string | null): string {
  const d = new Date(iso);
  if (!tz) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('hour')}:${get('minute')}`;
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

/** True when the runtime can actually render in this zone. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const FALLBACK_ZONES = [
  'UTC',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Kuala_Lumpur',
  'Asia/Bangkok',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Australia/Perth',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Pacific/Auckland',
];

/** Every IANA zone the runtime knows, or the curated fallback when the Intl
 *  enumeration API is unavailable (older Hermes builds). 'UTC' is prepended:
 *  supportedValuesOf omits it, but it is a legitimate user choice. */
export function timezoneChoices(): string[] {
  let zones: string[];
  try {
    const values = Intl.supportedValuesOf('timeZone') as string[];
    zones = values.length > 0 ? values : FALLBACK_ZONES;
  } catch {
    zones = FALLBACK_ZONES;
  }
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

/** Milo's weekly draft is served with the raw ISO week as its dateline
 *  ("2026-W34"). Run C #66 and Run A #52 draw it as the Monday the week starts
 *  on — "Week of 17 Aug". This is a DISPLAY fix: the server contract is
 *  unchanged, so a future richer dateline needs no coordination here.
 *
 *  ISO week 1 is the week containing the first Thursday of the year, which is
 *  the same as the week containing 4 January. That week routinely starts in the
 *  PREVIOUS calendar year — 2026-W01 begins 29 Dec 2025 — so the Monday is
 *  computed by stepping back from 4 Jan rather than counting forward from 1 Jan.
 *
 *  Anything that is not an ISO week rides exactly as served: if the server
 *  contract changes, the card shows the new value plainly instead of a
 *  confidently wrong date. */
export function draftDateline(dateline: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(dateline);
  if (!m) return dateline;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return dateline;
  const jan4 = new Date(year, 0, 4);
  // Monday-indexed weekday: Mon = 0 … Sun = 6.
  const jan4Weekday = (jan4.getDay() + 6) % 7;
  const monday = new Date(year, 0, 4 - jan4Weekday + (week - 1) * 7);
  const day = monday.getDate();
  const month = monday.toLocaleDateString('en-GB', { month: 'short' });
  return `Week of ${day} ${month}`;
}

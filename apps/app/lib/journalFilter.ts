// Mira's dashboard: the summary, the filters and the search (6 Sep 2026).
//
// Founder approved building this after comparing the shipped screen against the
// Run B drawings: Penny's dashboard matched, Milo's was nearly there, and
// Mira's was a flat list where the drawing has a "How you've felt" summary,
// range chips, emotion chips with counts, a search box, and "Show raw" per
// entry. The screen's own header comment had recorded the gap since 28 Aug.
//
// The logic lives here, not in the screen, because it is the part with edges:
// what a range means at a day boundary, what an emotion count includes, and
// what a search matches. The screen renders; this decides.
//
// It filters what the endpoint already returned rather than asking the server
// again. `/v1/neighbours/mira/journal` sends up to 200 entries already grouped
// by the user's own day — the grouping is the server's because the day boundary
// is the user's anchored timezone, which the client does not own. Re-deriving
// days here would silently regress that.
import { dayLabel, localDayKey, type JournalDay, type JournalEntry } from './dashboard';
import { dayKeyInTz } from './time';

export type JournalRange = 'day' | 'week' | 'month' | 'year' | 'custom' | 'all';
export interface JournalWindow { from: string; to: string }

export const JOURNAL_RANGES = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
] as const;

/** C75 calendar periods through `today`: Monday, month start, or January 1.
 *  `today` is passed in rather than read from the clock so the boundary is
 *  testable and so the caller can use the user's day, not the device's. */
export function withinRange(days: JournalDay[], range: JournalRange, today: string, custom?: JournalWindow): JournalDay[] {
  if (range === 'all') return days; // legacy callers; the screen offers Custom
  if (range === 'custom') {
    if (!custom || custom.from > custom.to) return [];
    return days.filter(d => d.day >= custom.from && d.day <= custom.to);
  }
  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(end)) return days; // an unreadable date filters nothing away
  const anchor = new Date(end);
  const first = range === 'day' ? end
    : range === 'week' ? end - ((anchor.getUTCDay() + 6) % 7) * 86_400_000
    : Date.UTC(anchor.getUTCFullYear(), range === 'month' ? anchor.getUTCMonth() : 0, 1);
  return days.filter((d) => {
    const at = Date.parse(`${d.day}T00:00:00Z`);
    return !Number.isNaN(at) && at >= first && at <= end;
  });
}

/** How many entries carry each feeling, most-used first.
 *
 *  Entries with NO emotion are counted by nobody. C95 makes null a real
 *  answer — "she does not label a feeling she cannot see" — so inventing an
 *  "unlabelled" chip would put a number on the one thing she declined to say. */
export function emotionCounts(days: JournalDay[]): { emotion: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const d of days) {
    for (const e of d.entries) {
      if (!e.emotion) continue;
      tally.set(e.emotion, (tally.get(e.emotion) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .map(([emotion, count]) => ({ emotion, count }))
    .sort((a, b) => b.count - a.count || a.emotion.localeCompare(b.emotion));
}

/** Only the entries carrying this feeling; every day that still has one. */
export function byEmotion(days: JournalDay[], emotion: string | null): JournalDay[] {
  if (!emotion) return days;
  return days
    .map((d) => ({ ...d, entries: d.entries.filter((e) => e.emotion === emotion) }))
    .filter((d) => d.entries.length > 0);
}

/** Search across BOTH what she read and what you wrote.
 *
 *  Searching only the cleaned line would fail to find a word the cleaning
 *  changed, and the raw is the version the user actually remembers typing —
 *  C95 keeps both precisely because neither replaces the other. */
export function searchJournal(days: JournalDay[], query: string): JournalDay[] {
  const q = query.trim().toLowerCase();
  if (!q) return days;
  const hit = (e: JournalEntry): boolean =>
    (e.scene ?? '').toLowerCase().includes(q) || (e.raw ?? '').toLowerCase().includes(q);
  return days.map((d) => ({ ...d, entries: d.entries.filter(hit) })).filter((d) => d.entries.length > 0);
}

/** "4 days · 11 thoughts", as drawn. Counted from what is ON SCREEN, so it
 *  always describes what the reader can actually see. */
export function journalSummary(days: JournalDay[]): string {
  const entries = days.reduce((n, d) => n + d.entries.length, 0);
  if (entries === 0) return 'Nothing here yet';
  return `${days.length} ${days.length === 1 ? 'day' : 'days'} · ${entries} ${entries === 1 ? 'thought' : 'thoughts'}`;
}

/** Everything the screen shows, in one place so the order cannot drift:
 *  range, then feeling, then search. */
export function applyJournalFilters(
  days: JournalDay[],
  opts: { range: JournalRange; emotion: string | null; query: string; today: string; custom?: JournalWindow },
): JournalDay[] {
  return searchJournal(byEmotion(withinRange(days, opts.range, opts.today, opts.custom), opts.emotion), opts.query);
}

/** The settings timezone owns the day; a stale journal entry is never a clock. */
export function journalToday(now: Date, timezone: string | null): string {
  const anchored = dayKeyInTz(now.toISOString(), timezone);
  return /^\d{4}-\d{2}-\d{2}$/.test(anchored) ? anchored : localDayKey(now);
}

export function journalDayLabel(day: string, today: string): string {
  return dayLabel(day, new Date(`${today}T12:00:00`));
}

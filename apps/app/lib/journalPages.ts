import type { JournalDay } from './dashboard';

export interface JournalPage { days: JournalDay[]; next_cursor?: string | null }

/** Publish a complete snapshot so local search/counts never treat a partial page as all history. */
export async function collectJournalPages(
  fetchPage: (cursor: string | null) => Promise<JournalPage>,
  signal?: AbortSignal,
): Promise<{ days: JournalDay[] }> {
  const days = new Map<string, JournalDay>();
  const entryIds = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    if (signal?.aborted) throw new Error('Journal request cancelled');
    const page = await fetchPage(cursor);
    if (signal?.aborted) throw new Error('Journal request cancelled');
    for (const day of page.days) {
      let merged = days.get(day.day);
      if (!merged) { merged = { day: day.day, entries: [] }; days.set(day.day, merged); }
      for (const entry of day.entries) {
        if (entryIds.has(entry.id)) continue;
        entryIds.add(entry.id);
        merged.entries.push(entry);
      }
    }
    cursor = page.next_cursor ?? null;
    if (cursor && cursors.has(cursor)) throw new Error('Repeated journal cursor');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return { days: [...days.values()] };
}

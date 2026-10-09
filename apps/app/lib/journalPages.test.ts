import { expect, it, vi } from 'vitest';
import { collectJournalPages, type JournalPage } from './journalPages';
import { searchJournal, emotionCounts } from './journalFilter';
const entry = (id: string) => ({ id, at: '2026-09-22T01:00:00Z', scene: `memory ${id}`, raw: null, emotion: 'good', photo_id: null });
it('loads beyond 200 and joins split days so search and mood counts include older entries', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ days: [{ day: '2026-09-22', entries: Array.from({ length: 200 }, (_, i) => entry(String(i))) }], next_cursor: '199' })
    .mockResolvedValueOnce({ days: [{ day: '2026-09-22', entries: [entry('200')] }], next_cursor: null });
  const result = await collectJournalPages(fetch);
  expect(fetch.mock.calls).toEqual([[null], ['199']]);
  expect(result.days).toHaveLength(1);
  expect(result.days[0].entries).toHaveLength(201);
  expect(searchJournal(result.days, 'memory 200')[0].entries[0].id).toBe('200');
  expect(emotionCounts(result.days)).toContainEqual({ emotion: 'good', count: 201 });
});
it('does not return a partial success when a later page fails', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ days: [], next_cursor: 'next' }).mockRejectedValueOnce(new Error('offline'));
  await expect(collectJournalPages(fetch)).rejects.toThrow('offline');
});
it('stops a repeated cursor rather than looping or silently truncating', async () => {
  await expect(collectJournalPages(async () => ({ days: [], next_cursor: 'same' }))).rejects.toThrow('cursor');
});
it('honours cancellation between pages', async () => {
  const controller = new AbortController();
  const fetch = vi.fn(async (): Promise<JournalPage> => { controller.abort(); return { days: [], next_cursor: 'next' }; });
  await expect(collectJournalPages(fetch, controller.signal)).rejects.toThrow('cancelled');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('accepts a legacy single-page response during rolling deployment', async () => {
  expect(await collectJournalPages(async () => ({ days: [] }))).toEqual({ days: [] });
});

import { describe, expect, it } from 'vitest';
import {
  journalToday,
  journalDayLabel,
  applyJournalFilters,
  byEmotion,
  emotionCounts,
  journalSummary,
  searchJournal,
  withinRange,
} from './journalFilter';
import type { JournalDay } from './dashboard';

const entry = (id: string, over: Partial<JournalDay['entries'][number]> = {}) =>
  ({ id, at: '2026-09-06T10:00:00Z', scene: 'a quiet morning', raw: null, emotion: null, photo_id: null, ...over }) as JournalDay['entries'][number];

const days: JournalDay[] = [
  { day: '2026-09-06', entries: [entry('a', { emotion: 'reflective' }), entry('b', { emotion: 'good' })] },
  { day: '2026-09-01', entries: [entry('c', { emotion: 'reflective' })] },
  { day: '2026-08-20', entries: [entry('d', { emotion: 'low', scene: 'the sea was quiet', raw: 'the see was quiet' })] },
  { day: '2025-11-02', entries: [entry('e')] },
];

describe('the range chips', () => {
  it('a week starts Monday and includes today', () => {
    // Off-by-one here would silently hide today's entries, which are the ones
    // a reader is most likely to be looking for.
    expect(withinRange(days, 'week', '2026-09-06').map((d) => d.day)).toEqual(['2026-09-06', '2026-09-01']);
  });

  it('month and year start at their calendar boundaries; legacy All remains unfiltered', () => {
    expect(withinRange(days, 'month', '2026-09-06').map((d) => d.day)).toEqual(['2026-09-06', '2026-09-01']);
    // January 1 excludes last year's November even though it is <365 days ago.
    expect(withinRange(days, 'year', '2026-09-06')).toHaveLength(3);
    expect(withinRange(days, 'all', '2026-09-06')).toHaveLength(4);
  });

  it('an unreadable date filters nothing away rather than emptying the screen', () => {
    // A blank journal is indistinguishable from a broken one, and the second
    // is the worse thing to show.
    expect(withinRange(days, 'week', 'not-a-date')).toHaveLength(4);
  });
});

describe('the feeling chips', () => {
  it('counts each feeling, most-used first', () => {
    expect(emotionCounts(days)).toEqual([
      { emotion: 'reflective', count: 2 },
      { emotion: 'good', count: 1 },
      { emotion: 'low', count: 1 },
    ]);
  });

  it('counts nothing for an entry she did not label', () => {
    // C95: null is a real answer — "she does not label a feeling she cannot
    // see". An "unlabelled" chip would put a number on the one thing she
    // deliberately declined to say.
    expect(emotionCounts([{ day: '2026-09-06', entries: [entry('x')] }])).toEqual([]);
  });

  it('filtering by a feeling drops the days that have none left', () => {
    const out = byEmotion(days, 'reflective');
    expect(out.map((d) => d.day)).toEqual(['2026-09-06', '2026-09-01']);
    expect(out[0].entries.map((e) => e.id)).toEqual(['a']);
  });
});

describe('searching your thoughts', () => {
  it('matches what she read AND what you wrote', () => {
    // Searching only the cleaned line would miss a word the cleaning changed —
    // and the raw is the version you remember typing. C95 keeps both because
    // neither replaces the other.
    expect(searchJournal(days, 'the sea').map((d) => d.day)).toEqual(['2026-08-20']);
    expect(searchJournal(days, 'the see').map((d) => d.day)).toEqual(['2026-08-20']);
  });

  it('is case-insensitive, and an empty query is not a filter', () => {
    // three days carry the default scene "a quiet morning"
    expect(searchJournal(days, 'QUIET MORNING')).toHaveLength(3);
    expect(searchJournal(days, '   ')).toHaveLength(4);
  });
});

describe('the summary line', () => {
  it('counts what is ON SCREEN, so it always describes what can be seen', () => {
    expect(journalSummary(days)).toBe('4 days · 5 thoughts');
    expect(journalSummary(byEmotion(days, 'good'))).toBe('1 day · 1 thought');
    expect(journalSummary([])).toBe('Nothing here yet');
  });
});

describe('the filters compose in one fixed order', () => {
  it('range, then feeling, then search', () => {
    const out = applyJournalFilters(days, { range: 'month', emotion: 'reflective', query: 'quiet', today: '2026-09-06' });
    expect(out.map((d) => d.day)).toEqual(['2026-09-06', '2026-09-01']);
    expect(out.flatMap((d) => d.entries.map((e) => e.id))).toEqual(['a', 'c']);
  });

  it('a filter that matches nothing empties the screen without throwing', () => {
    expect(applyJournalFilters(days, { range: 'week', emotion: 'angry', query: '', today: '2026-09-06' })).toEqual([]);
  });
});


describe('custom journal windows', () => {
  it('includes both chosen dates and excludes entries outside the window', () => {
    expect(withinRange(days, 'custom', '2026-09-19', { from: '2026-08-20', to: '2026-09-01' }).map(d => d.day))
      .toEqual(['2026-09-01', '2026-08-20']);
  });
  it('composes a custom window with feeling and raw-text search', () => {
    expect(applyJournalFilters(days, { range: 'custom', today: '2026-09-19', custom: { from: '2026-08-20', to: '2026-09-01' }, emotion: 'low', query: 'the see' })
      .flatMap(d => d.entries.map(e => e.id))).toEqual(['d']);
  });
  it('does not turn missing or reversed custom bounds into all history', () => {
    expect(withinRange(days, 'custom', '2026-09-19')).toEqual([]);
    expect(withinRange(days, 'custom', '2026-09-19', { from: '2026-09-01', to: '2026-08-20' })).toEqual([]);
  });
});

it('anchors the current journal day to the configured timezone, not stale entries', () => {
  expect(journalToday(new Date('2026-09-18T17:00:00Z'), 'Asia/Singapore')).toBe('2026-09-19');
  expect(withinRange(days, 'day', journalToday(new Date('2026-09-18T17:00:00Z'), 'Asia/Singapore'))).toEqual([]);
  expect(journalDayLabel('2026-09-19', '2026-09-19')).toBe('Today');
  expect(journalDayLabel('2026-09-18', '2026-09-19')).toBe('Yesterday');
});

it.each([
  ['week', ['2026-09-14', '2026-09-19']],
  ['month', ['2026-09-01', '2026-09-13', '2026-09-14', '2026-09-19']],
  ['year', ['2026-01-01', '2026-08-31', '2026-09-01', '2026-09-13', '2026-09-14', '2026-09-19']],
] as const)('C75 %s starts at its calendar boundary and ends today', (range, expected) => {
  const rows = ['2025-12-31', '2026-01-01', '2026-08-31', '2026-09-01', '2026-09-13', '2026-09-14', '2026-09-19', '2026-09-20']
    .map(day => ({ day, entries: [entry(day)] }));
  expect(withinRange(rows, range, '2026-09-19').map(d => d.day)).toEqual(expected);
});

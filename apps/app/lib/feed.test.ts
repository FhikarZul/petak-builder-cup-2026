// C63 — the merged feed's pure bits. groupByDay is kept out of the render so
// it can be tested here and the feed never re-derives dates while scrolling.
import { describe, expect, it } from 'vitest';
import {
  boardTargetIndex,
  groupByDay,
  mergeFeedHead,
  pickerRows,
  type FeedMessage,
  type FeedPage,
} from './feed';

// Built RELATIVE to NOW so the test is timezone-independent — toDateString()
// is local, and a fixed UTC fixture flips day near midnight in +08:00.
const NOW = new Date('2026-08-27T12:00:00.000Z');
const DAY = 86_400_000;
const at = (daysAgo: number, hour = 0) =>
  new Date(NOW.getTime() - daysAgo * DAY + hour * 3_600_000).toISOString();

function msg(neighbour: string, iso: string, body = 'x'): FeedMessage {
  return {
    id: `${neighbour}-${iso}`,
    neighbour,
    role: 'assistant',
    body,
    state: 'sent',
    created_at: iso,
    photo_id: null,
    content_type: null,
    ref_message_id: null,
    blocks: null,
  };
}

describe('groupByDay', () => {
  it('labels today and yesterday by name, older days by date', () => {
    const older = at(2);
    const groups = groupByDay([msg('penny', older), msg('milo', at(1)), msg('penny', at(0))], NOW);
    expect(groups.map((g) => g.day)).toEqual([new Date(older).toDateString(), 'Yesterday', 'Today']);
  });

  it('keeps consecutive messages from one day in ONE group, in order', () => {
    const groups = groupByDay(
      [msg('milo', at(0, -6)), msg('penny', at(0, -3)), msg('penny', at(0, -1)), msg('milo', at(0))],
      NOW,
    );
    expect(groups).toHaveLength(1);
    // Run A #7's interleave survives grouping — including the two neighbours
    // answering the same photo at 21:17 and 21:18.
    expect(groups[0].messages.map((m) => m.neighbour)).toEqual(['milo', 'penny', 'penny', 'milo']);
  });

  it('an empty feed groups to nothing', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });

  it('anchors day buckets to the user timezone (1 Sep 2026 ruling)', () => {
    // 31 Aug 2026 16:30 UTC is 31 Aug 22:00 in Kolkata but 1 Sep 00:30 in
    // Singapore. `now` is pinned so "Today" is deterministic everywhere.
    const edge = '2026-08-31T16:30:00.000Z';
    const later = '2026-09-01T01:00:00.000Z';
    const now = new Date('2026-09-01T12:00:00.000Z');
    const kolkata = groupByDay([msg('penny', edge), msg('milo', later)], now, 'Asia/Kolkata');
    expect(kolkata.map((g) => g.day)).toEqual(['Yesterday', 'Today']);
    const singapore = groupByDay([msg('penny', edge), msg('milo', later)], now, 'Asia/Singapore');
    expect(singapore).toHaveLength(1); // both messages are "Today" in +08:00
    expect(singapore[0].day).toBe('Today');
  });
});

describe('pickerRows (#32 — waiting photos, grouped by day, three per row)', () => {
  const p = (iso: string) => ({ created_at: iso });

  it('groups by day and chunks each day into rows of three', () => {
    const rows = pickerRows(
      [p(at(0, -1)), p(at(0, -2)), p(at(0, -3)), p(at(0, -4)), p(at(1))],
      NOW,
    );
    expect(rows.map((r) => (r.kind === 'day' ? r.label : `row:${r.tiles.length}`))).toEqual([
      'Today',
      'row:3',
      'row:1',
      'Yesterday',
      'row:1',
    ]);
  });

  it('never starts a row before its day header', () => {
    const rows = pickerRows([p(at(2)), p(at(0))], NOW);
    expect(rows[0].kind).toBe('day');
    expect(rows[2].kind).toBe('day');
  });

  it('an empty queue lays out to nothing', () => {
    expect(pickerRows([], NOW)).toEqual([]);
  });
});

describe('Run A #33 — boardTargetIndex', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('finds a target mid-list at its exact index', () => {
    expect(boardTargetIndex(list, 'b')).toBe(1);
  });

  it('finds a target first and last (boundary positions)', () => {
    expect(boardTargetIndex(list, 'a')).toBe(0);
    expect(boardTargetIndex(list, 'c')).toBe(list.length - 1);
  });

  it('returns null when the target is absent (the page-back / degrade decision rides on this)', () => {
    expect(boardTargetIndex(list, 'z')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(boardTargetIndex([], 'a')).toBeNull();
  });
});

describe('mergeFeedHead', () => {
  const page = (messages: FeedMessage[], cursor: string | null, hasMore: boolean): FeedPage => ({
    messages,
    cursor,
    has_more: hasMore,
  });

  it('updates known messages and adds new head messages without dropping loaded history', () => {
    const old = msg('penny', at(2), 'old');
    const changed = msg('milo', at(1), 'queued');
    const newest = msg('mira', at(0), 'new');
    const current = {
      pages: [page([changed], changed.id, true), page([old], old.id, false)],
      pageParams: [null, changed.id],
    };

    const merged = mergeFeedHead(current, page([{ ...changed, body: 'sent' }, newest], changed.id, true));

    expect(merged.pages).toHaveLength(2);
    expect(merged.pageParams).toEqual(current.pageParams);
    expect(merged.pages[0].messages.map((message) => message.body)).toEqual(['sent', 'new']);
    expect(merged.pages[1].messages).toEqual([old]);
  });

  it('initializes an empty infinite-query cache from the fresh head', () => {
    const fresh = page([msg('ollie', at(0))], null, false);
    expect(mergeFeedHead(undefined, fresh)).toEqual({ pages: [fresh], pageParams: [null] });
  });
});

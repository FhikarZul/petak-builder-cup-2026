// C63 — the merged feed's PURE bits. Kept out of lib/thread.ts, which imports
// react-query, so these stay unit-testable in a node environment — the same
// split as lib/send.ts vs lib/outbox.ts.
import type { ThreadMessage } from './thread';
import { dayKeyInTz, labelForDayKey } from './time';

/** A feed message is a thread message plus the neighbour it belongs to. That
 *  attribution is the head, the "name · role" line and the 2px domain rule —
 *  never navigation (C63). */
export interface FeedMessage extends ThreadMessage {
  neighbour: string;
}

export interface FeedPage {
  messages: FeedMessage[];
  cursor: string | null;
  has_more: boolean;
}

export interface FeedInfiniteData {
  pages: FeedPage[];
  pageParams: unknown[];
}

/** Merge one freshly fetched newest page into the loaded infinite history.
 * Existing page boundaries and cursors stay intact, so a head refresh cannot
 * create a pagination gap. New messages join page zero; known messages are
 * updated wherever they already live. */
export function mergeFeedHead(
  current: FeedInfiniteData | undefined,
  fresh: FeedPage,
): FeedInfiniteData {
  if (!current || current.pages.length === 0) {
    return { pages: [fresh], pageParams: [null] };
  }

  const freshById = new Map(fresh.messages.map((message) => [message.id, message]));
  const knownIds = new Set(current.pages.flatMap((page) => page.messages.map((message) => message.id)));
  const pages = current.pages.map((page) => ({
    ...page,
    messages: page.messages.map((message) => freshById.get(message.id) ?? message),
  }));
  const additions = fresh.messages.filter((message) => !knownIds.has(message.id));
  if (additions.length > 0) {
    pages[0] = {
      ...pages[0],
      messages: [...pages[0].messages, ...additions].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    };
  }

  return { pages, pageParams: current.pageParams };
}

/** Day buckets for the feed's dividers ("Today", "Yesterday", then dated).
 *  Pure on purpose: the feed never re-derives dates while rendering.
 *  `tz` is the user's anchored timezone (null = device timezone). */
export function groupByDay(
  messages: FeedMessage[],
  now = new Date(),
  tz: string | null = null,
): { day: string; messages: FeedMessage[] }[] {
  const out: { day: string; messages: FeedMessage[] }[] = [];
  const todayKey = dayKeyInTz(now.toISOString(), tz);
  const yesterdayKey = dayKeyInTz(new Date(now.getTime() - 86_400_000).toISOString(), tz);
  for (const m of messages) {
    const key = dayKeyInTz(m.created_at, tz);
    const label =
      key === todayKey ? 'Today' : key === yesterdayKey ? 'Yesterday' : labelForDayKey(key, tz);
    const last = out[out.length - 1];
    if (last && last.day === label) last.messages.push(m);
    else out.push({ day: label, messages: [m] });
  }
  return out;
}

/**
 * Run A #32's picker layout: waiting photos grouped by DAY, each day's tiles
 * chunked into rows of three. Pure so the grouping is tested and the screen
 * never re-derives dates while scrolling.
 *
 * The 27 Aug founder ruling is why tiles carry no content label: naming what
 * is in a photo means READING it, which is the credit the queue is protecting.
 * The photo itself is the label, and the user zooms for detail.
 */
export function pickerRows<T extends { created_at: string }>(
  photos: T[],
  now = new Date(),
  perRow = 3,
): ({ kind: 'day'; label: string } | { kind: 'row'; tiles: T[] })[] {
  const out: ({ kind: 'day'; label: string } | { kind: 'row'; tiles: T[] })[] = [];
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
  let current: string | null = null;
  let run: T[] = [];
  const flush = () => {
    for (let i = 0; i < run.length; i += perRow) out.push({ kind: 'row', tiles: run.slice(i, i + perRow) });
    run = [];
  };
  for (const p of photos) {
    const key = new Date(p.created_at).toDateString();
    const label = key === today ? 'Today' : key === yesterday ? 'Yesterday' : key;
    if (label !== current) {
      flush();
      out.push({ kind: 'day', label });
      current = label;
    }
    run.push(p);
  }
  flush();
  return out;
}

/**
 * Run A #33 — the board's "Answer in chat" scroll-back. The position of the
 * target (the task's origin message) inside the flattened, oldest-first feed,
 * or null while it is beyond the loaded pages. The screen pages backward
 * until this finds it; null after the last page means the message is gone and
 * the entry degrades to plain navigation.
 */
export function boardTargetIndex(messages: { id: string }[], targetId: string): number | null {
  const i = messages.findIndex((m) => m.id === targetId);
  return i === -1 ? null : i;
}

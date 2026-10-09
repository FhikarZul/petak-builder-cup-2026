// @mentions (plan §5, PURE — the unit-test target). Composer state is a
// segment array (text | mention); serialize to wire text and parse back for
// bubble rendering. Canon: @ is a plain-name SHORTCUT, never syntax — the
// wire form is "@Name" in otherwise ordinary text, and the server treats it
// as such. "Mira, what did I write in March?" works identically without it.
import { NEIGHBOURS, NEIGHBOUR_ORDER, type NeighbourId } from './neighbours';

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; neighbour: NeighbourId };

/** Segments → wire text. A mention serializes as "@Name". */
export function serializeSegments(segments: Segment[]): string {
  return segments
    .map((s) => (s.kind === 'mention' ? `@${NEIGHBOURS[s.neighbour].name}` : s.text))
    .join('');
}

/** A photo carries the same addressing words as a text turn. Keeping the
 * mentions in the wire caption lets the server take the direct-address path
 * without inventing a second photo-only routing contract. */
export function serializePhotoDraft(chips: NeighbourId[], text: string): string {
  const caption = text.trim();
  return serializeSegments([
    ...chips.map((neighbour): Segment => ({ kind: 'mention', neighbour })),
    ...(caption ? [{ kind: 'text', text: `${chips.length > 0 ? ' ' : ''}${caption}` } as Segment] : []),
  ]);
}

// Match "@Name" only when it is exactly a display name (not a prefix of a
// longer word — "@Miranda" stays plain text). Longest name first so no
// shorter name ever wins a prefix.
const MENTION_RE = new RegExp(
  `@(${NEIGHBOUR_ORDER.map((id) => NEIGHBOURS[id].name)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?![A-Za-z])`,
  'g',
);

const NAME_TO_ID: Record<string, NeighbourId> = Object.fromEntries(
  NEIGHBOUR_ORDER.map((id) => [NEIGHBOURS[id].name, id]),
);

/** Wire text → segments. Unknown @words remain plain text. */
export function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_RE)) {
    const at = match.index;
    if (at > last) segments.push({ kind: 'text', text: text.slice(last, at) });
    segments.push({ kind: 'mention', neighbour: NAME_TO_ID[match[1]] });
    last = at + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

/**
 * @-picker order (plan §5): the picker lists your residents — most-talked-to
 * first, GET /v1/threads ordering as the proxy — with Ollie ALWAYS present
 * (he routes; an empty street still has a front door). Tally is never
 * surfaced in P0; unknown/duplicate ids are dropped.
 */
export function orderPicker(recentFirst: string[], residents: string[]): NeighbourId[] {
  const residentSet = new Set(
    residents.filter((id): id is NeighbourId => {
      const neighbour = NEIGHBOURS[id as NeighbourId];
      return Boolean(neighbour?.p0 && id !== 'tally');
    }),
  );
  const seen = new Set<NeighbourId>();
  const ordered: NeighbourId[] = [];
  for (const id of recentFirst) {
    const nid = id as NeighbourId;
    if (residentSet.has(nid) && !seen.has(nid)) {
      seen.add(nid);
      ordered.push(nid);
    }
  }
  for (const id of residents) {
    const nid = id as NeighbourId;
    if (residentSet.has(nid) && !seen.has(nid)) {
      seen.add(nid);
      ordered.push(nid);
    }
  }
  if (!seen.has('ollie')) ordered.push('ollie');
  return ordered;
}

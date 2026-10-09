// When a reply's quote block earns its place.
//
// A reply carries `ref_message_id` (C19) naming what it is about, and the app
// renders that as a quote block above the body. The reference is real data and
// stays — but SHOWING it is only useful when it disambiguates.
//
// Found in the 4 Sep E2E: every reply quoted the message rendered immediately
// above it, so each turn printed the same sentence twice, one screen apart, and
// the thread grew at double rate. That is the founder's first objective —
// "neighbour having too many bubbles at the same time is cluttering" — and it
// was the default shape rather than an edge case.

/**
 * True when the quote block should render.
 *
 * The rule is one line: show it unless the thing being quoted is already the
 * previous row on screen. A reply to the message directly above needs no
 * quote — the user is looking at it. A reply reaching further back does.
 *
 * `prevMessageId` is the message rendered immediately BEFORE this reply in
 * reading order, or null when this is the first row.
 */
export function shouldShowQuote(refMessageId: string | null, prevMessageId: string | null): boolean {
  if (!refMessageId) return false;
  return refMessageId !== prevMessageId;
}

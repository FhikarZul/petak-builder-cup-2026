// lib/swipe.ts — SwipeToReference's trigger decision (components/chat/rows.tsx).
// PURE module, node environment.
//
// Swipe right to mark a message for reply must fire on EVERY content row and
// win over scroll hesitation, but never hijack vertical scrolling: a low
// horizontal activation offset and a generous vertical fail band let the
// gesture claim a deliberate rightward drag early, while the 64px travel
// threshold keeps taps and scroll drift from pinning.

/** The pan gesture's tuning, shared by every feed row wrapper. */
export const SWIPE_TO_REFERENCE = {
  activeOffsetX: 12,
  failOffsetY: [-24, 24] as [number, number],
  triggerDx: 64,
} as const;

/** The pin fires on a decisive rightward travel, never on a tap or drift. */
export function swipeTriggersPin(translationX: number): boolean {
  return translationX > SWIPE_TO_REFERENCE.triggerDx;
}

// z8v0kmqxf5 (11 Sep 2026) — the founder: "when i mark a respond by swiping
// right, i cant see the animation (i.e. the message Move), make the animation
// so it feels like marking".
//
// He was exactly right and the cause was that there was no animation code at
// all: SwipeToReference read translationX ONCE, on release, and fired a
// callback. The row was a plain View throughout and could not move at any
// point in the gesture.
//
// A gesture with no feedback cannot teach itself. With nothing moving there is
// also nothing to say WHERE the 64px threshold is, so a short swipe silently
// does nothing and reads identically to a broken feature. The travel and the
// mark fix discoverability and the threshold together.

/** How far the row may travel, however hard you pull. */
export const SWIPE_MAX_TRAVEL = 96;
/** Past the threshold the row RESISTS — the gesture is already committed, and
 *  continuing to track the finger 1:1 would just look like a drag. */
const RESISTANCE = 0.25;

/**
 * Where the row sits for a given finger travel. PURE.
 *
 * Rightward only: this gesture means one thing, and a leftward drag must leave
 * the row alone rather than hint at an action that does not exist.
 */
export function swipeTravel(translationX: number): number {
  if (translationX <= 0) return 0;
  const trigger = SWIPE_TO_REFERENCE.triggerDx;
  if (translationX <= trigger) return translationX;
  return Math.min(SWIPE_MAX_TRAVEL, trigger + (translationX - trigger) * RESISTANCE);
}

/**
 * How far through the gesture we are, 0 → 1. PURE.
 *
 * The mark in the gutter fills with this, so the threshold stops being
 * invisible: at 1 the swipe will pin, and the user can see that before letting
 * go rather than discovering it afterwards.
 */
export function swipeProgress(translationX: number): number {
  if (translationX <= 0) return 0;
  return Math.min(1, translationX / SWIPE_TO_REFERENCE.triggerDx);
}

// The neighbour picker's horizontal swipe (invite.tsx). Found 5 Sep 2026: the
// picker had a NEXT chevron and no previous one, and no gesture at all — so a
// carousel of three could only be walked one way, and going back meant cycling
// forward twice. A row of faces invites a swipe; not answering one reads as
// broken.
//
// Tuned like the reply swipe but symmetric, and with a shorter travel: this is
// a small horizontal strip with nothing to scroll past, so a decisive flick
// should not have to cross the same distance as a gesture that competes with a
// scrolling feed.
export const SWIPE_TO_BROWSE = {
  activeOffsetX: [-12, 12] as [number, number],
  failOffsetY: [-24, 24] as [number, number],
  triggerDx: 48,
} as const;

/**
 * Which way a browse swipe went, if it went anywhere.
 *
 * Swiping LEFT moves forward — the content travels left the way a page turns,
 * so the next face arrives from the right. Getting this backwards is the most
 * common way a carousel feels wrong.
 */
export function browseDirection(translationX: number): 'next' | 'prev' | null {
  if (translationX <= -SWIPE_TO_BROWSE.triggerDx) return 'next';
  if (translationX >= SWIPE_TO_BROWSE.triggerDx) return 'prev';
  return null;
}

/** Step through a list, wrapping at both ends. An unknown id starts at 0, so a
 *  stale selection can never strand the picker. */
export function stepThrough<T>(items: readonly T[], current: T, direction: 'next' | 'prev'): T {
  if (items.length === 0) return current;
  const at = items.indexOf(current);
  const from = at === -1 ? 0 : at;
  const delta = direction === 'next' ? 1 : -1;
  return items[(from + delta + items.length) % items.length];
}

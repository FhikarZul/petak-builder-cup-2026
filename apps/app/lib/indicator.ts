// App slice 2 (plan §8, mirror #78) — the working indicator, PURE (the
// unit-test target). Always the LAST item in the thread, indented to the
// bubble column; the only moving parts are the lit pane and the three dots,
// both on a 1.05s STEP cycle — no easing, no fade, no sliding. The sprite
// never animates and never appears in the line; a queued photo shows
// NO indicator (waiting is not working).
import type { ActivityKind, NeighbourId } from './neighbours';

export const INDICATOR_CYCLE_MS = 1050; // the #78 step cycle
export const INDICATOR_TICK_MS = 175; // six steps per cycle (gcd of the phases)
export const INDICATOR_PHASES = 6;
export const INDICATOR_INDENT_PX = 40; // the bubble column
export const DOT_STAGGER_TICKS = 2; // 350ms between dots

// z8v0kmqxf6 (11 Sep 2026) — the founder, for the FOURTH time: "the indicator
// (i.e. chat respond - the neighbour is responding) i am not getting it".
//
// Three previous tickets closed on this symptom (internal-reference, internal-reference,
// internal-reference) and it kept coming back, because the search was for a call site
// that forgot to announce itself. It was never that. Two things, both here.
//
// 1. THE LINE STARTS INVISIBLE. `indicatorFrame(0)` returns pane DIM: the pane
//    is dim for its cycle's first half and lit for the second, so mounting at
//    phase 0 means 525ms of near-nothing. Measured from the founder's own
//    messages, a typed turn takes about ONE SECOND end to end (23:57:07 →
//    23:57:08). So the indicator spent the first half of every turn at its
//    dimmest and then vanished. Starting LIT costs nothing and is the whole
//    difference between "not getting it" and seeing it.
export const INDICATOR_START_PHASE = 3; // the first LIT step of the cycle

// 2. AND IT MUST SURVIVE ONE FULL BLINK. Founder ruling, 11 Sep: hold it, then
//    name it. A line that appears and disappears inside one cycle never
//    completes the animation that makes it read as work.
//
//    The floor is exactly one cycle. Turns run about 1,000ms and the cycle is
//    1,050ms, so in practice this outlives the reply by tens of milliseconds —
//    small enough that the line never reads as "still working" after an answer
//    has landed. That overlap is the honest cost of the ruling, and it is
//    bounded on purpose: a longer floor would make the line lie.
export const INDICATOR_MIN_VISIBLE_MS = INDICATOR_CYCLE_MS;

/** How much longer the line must stay, given when it started. PURE. */
export function remainingHold(startedAt: number, now: number): number {
  const elapsed = now - startedAt;
  if (!Number.isFinite(elapsed) || elapsed >= INDICATOR_MIN_VISIBLE_MS) return 0;
  // Clamped at BOTH ends. A clock that jumped backwards (a device time change,
  // a resumed app) would otherwise compute a wait LONGER than the cycle and
  // strand the line on screen after the reply — the exact failure this floor
  // exists to avoid, arriving by the back door.
  return Math.min(INDICATOR_MIN_VISIBLE_MS, Math.max(0, INDICATOR_MIN_VISIBLE_MS - elapsed));
}

export interface IndicatorFrame {
  paneLit: boolean;
  dots: [boolean, boolean, boolean];
}

/**
 * One step of the cycle (mirror pk-pane/pk-dot, steps(1,end)): the pane is
 * dim for its cycle's first half and lit for the second; each dot runs the
 * same cycle offset 350ms (two ticks) after the last. Discrete steps only —
 * the component advances `phase` on a plain interval, never an easing.
 */
export function indicatorFrame(phase: number): IndicatorFrame {
  const p = ((phase % INDICATOR_PHASES) + INDICATOR_PHASES) % INDICATOR_PHASES;
  const lit = (offsetTicks: number) =>
    (p - offsetTicks + INDICATOR_PHASES) % INDICATOR_PHASES >= INDICATOR_PHASES / 2;
  return {
    paneLit: lit(0),
    dots: [lit(0), lit(DOT_STAGGER_TICKS), lit(2 * DOT_STAGGER_TICKS)],
  };
}

/** A neighbour with a turn in flight — one line each, in start order. */
export interface WorkingNeighbour {
  id: NeighbourId;
  kind: ActivityKind;
  startedAt: number;
  /** Overlapping sends to the same neighbour keep ONE line. */
  count: number;
  /** Every send this line has ever folded in. Only ever grows, so
   *  `total - count + 1` is WHICH one is in hand — #78's "the fifth one".
   *  `count` alone cannot say that: it only knows how many are left. */
  total: number;
}

/** #78: which send this line is working on now, 1-based. */
export function ordinalOf(w: WorkingNeighbour): number {
  return w.total - w.count + 1;
}

/** A send started: append in start order, or fold into the existing line. */
export function noteSendStart(
  list: WorkingNeighbour[],
  id: NeighbourId,
  kind: ActivityKind,
  at: number,
): WorkingNeighbour[] {
  const i = list.findIndex((w) => w.id === id);
  if (i >= 0) {
    return list.map((w, j) => (j === i ? { ...w, count: w.count + 1, total: w.total + 1 } : w));
  }
  return [...list, { id, kind, startedAt: at, count: 1, total: 1 }];
}

/** A send settled: the line leaves only when its last send has. */
export function noteSendEnd(list: WorkingNeighbour[], id: NeighbourId): WorkingNeighbour[] {
  return list
    .map((w) => (w.id === id ? { ...w, count: w.count - 1 } : w))
    .filter((w) => w.count > 0);
}

/**
 * Row order for the inverted list: the indicator is always LAST in the
 * thread (data[0] renders at the bottom), and the lines read in start order
 * top-to-bottom — so the data array takes them in reverse start order.
 */
export function indicatorRowOrder(list: WorkingNeighbour[]): WorkingNeighbour[] {
  return [...list].reverse();
}

/** A photo that is uploaded and filed, waiting on the extraction pipeline —
 * the window where the server is finding the right neighbour. Founder ruling,
 * 2 Sep 2026: keep the user aware of the WORKING ("Ollie's finding the right
 * neighbour"), but Ollie never narrates in chat. The line is Ollie's 'route'
 * activity; it lives only while at least one sent photo has no server twin
 * yet, and never duplicates a real route line already showing for a text
 * send. */
export function photoRoutingLine(
  captures: { state: string; duplicate?: boolean }[],
  alreadyRouting: boolean,
  now: number,
): WorkingNeighbour | null {
  if (alreadyRouting) return null;
  // A DUPLICATE has no work in flight. The gate short-circuits identical bytes
  // straight to 'accepted' (capture.ts afterCreate) with no PUT, no message and
  // no extraction — so cardState reports 'sent' while nothing is coming. Left
  // in, the line spins "Ollie's finding the right neighbour" forever, for a
  // neighbour who was never called (found 4 Sep).
  return captures.some((c) => c.state === 'sent' && !c.duplicate)
    ? { id: 'ollie', kind: 'route', startedAt: now, count: 1, total: 1 }
    : null;
}

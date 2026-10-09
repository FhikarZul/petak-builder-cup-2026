// lib/swipe.ts — the swipe-to-reference trigger decision. PURE module, node env.
import { describe, expect, it } from 'vitest';
import { SWIPE_MAX_TRAVEL, SWIPE_TO_REFERENCE, browseDirection, stepThrough, swipeProgress, swipeTravel, swipeTriggersPin } from './swipe';

describe('SWIPE_TO_REFERENCE tuning', () => {
  it('activates on a shallow horizontal drag (wins over scroll hesitation)', () => {
    expect(SWIPE_TO_REFERENCE.activeOffsetX).toBeLessThanOrEqual(12);
  });
  it('tolerates a generous vertical band before failing to the scroll view', () => {
    expect(SWIPE_TO_REFERENCE.failOffsetY).toEqual([-24, 24]);
  });
});

describe('swipeTriggersPin', () => {
  it('fires past the 64px travel threshold', () => {
    expect(swipeTriggersPin(65)).toBe(true);
    expect(swipeTriggersPin(120)).toBe(true);
  });
  it('never fires on a tap, a drift, or a leftward swipe', () => {
    expect(swipeTriggersPin(0)).toBe(false);
    expect(swipeTriggersPin(64)).toBe(false);
    expect(swipeTriggersPin(20)).toBe(false);
    expect(swipeTriggersPin(-80)).toBe(false);
  });
});

// The picker had a NEXT chevron and no previous one, and no gesture — a
// carousel of three walkable one way only (found 5 Sep 2026).
describe('browsing the neighbour picker', () => {
  it('swiping LEFT moves forward, the way a page turns', () => {
    expect(browseDirection(-60)).toBe('next');
    expect(browseDirection(60)).toBe('prev');
  });

  it('ignores a drift or a tap', () => {
    expect(browseDirection(0)).toBeNull();
    expect(browseDirection(-20)).toBeNull();
    expect(browseDirection(47)).toBeNull();
  });

  it('wraps at BOTH ends — the old cycle could only wrap forward', () => {
    const ids = ['penny', 'milo', 'mira'] as const;
    expect(stepThrough(ids, 'mira', 'next')).toBe('penny');
    expect(stepThrough(ids, 'penny', 'prev')).toBe('mira');
    expect(stepThrough(ids, 'penny', 'next')).toBe('milo');
    expect(stepThrough(ids, 'milo', 'prev')).toBe('penny');
  });

  it('a stale selection starts at the beginning rather than stranding the picker', () => {
    expect(stepThrough(['penny', 'milo'] as const, 'tally' as never, 'next')).toBe('milo');
  });
});

// z8v0kmqxf5 — the row must MOVE. There was no animation code at all: the
// gesture read translationX once on release and fired a callback.
describe('swipeTravel — where the row sits during the gesture', () => {
  it('tracks the finger 1:1 up to the trigger', () => {
    expect(swipeTravel(0)).toBe(0);
    expect(swipeTravel(30)).toBe(30);
    expect(swipeTravel(SWIPE_TO_REFERENCE.triggerDx)).toBe(SWIPE_TO_REFERENCE.triggerDx);
  });

  it('resists past the trigger — the gesture is already committed', () => {
    const past = swipeTravel(SWIPE_TO_REFERENCE.triggerDx + 40);
    expect(past).toBeGreaterThan(SWIPE_TO_REFERENCE.triggerDx);
    expect(past).toBeLessThan(SWIPE_TO_REFERENCE.triggerDx + 40);
  });

  it('never travels further than the cap, however hard you pull', () => {
    expect(swipeTravel(10_000)).toBe(SWIPE_MAX_TRAVEL);
  });

  it('a LEFTWARD drag leaves the row alone — this gesture means one thing', () => {
    expect(swipeTravel(-50)).toBe(0);
    expect(swipeTravel(-10_000)).toBe(0);
  });
});

describe('swipeProgress — the threshold made visible', () => {
  it('runs 0 to 1 across the trigger distance', () => {
    expect(swipeProgress(0)).toBe(0);
    expect(swipeProgress(SWIPE_TO_REFERENCE.triggerDx / 2)).toBeCloseTo(0.5);
    expect(swipeProgress(SWIPE_TO_REFERENCE.triggerDx)).toBe(1);
  });

  it('clamps at 1 — past the threshold there is nothing more to promise', () => {
    expect(swipeProgress(SWIPE_TO_REFERENCE.triggerDx * 3)).toBe(1);
  });

  it('reaches 1 exactly where the pin fires, so the mark never lies', () => {
    // One pixel under the trigger: full mark, but swipeTriggersPin is false.
    // That is the ONLY disagreement, it is sub-pixel, and erring this way means
    // the mark never shows full for a swipe that would not pin by a wide margin.
    expect(swipeProgress(SWIPE_TO_REFERENCE.triggerDx + 1)).toBe(1);
    expect(swipeTriggersPin(SWIPE_TO_REFERENCE.triggerDx + 1)).toBe(true);
  });

  it('a leftward drag promises nothing', () => {
    expect(swipeProgress(-40)).toBe(0);
  });
});

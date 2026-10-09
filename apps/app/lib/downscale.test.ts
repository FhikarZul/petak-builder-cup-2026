import { describe, expect, it } from 'vitest';
import { LONG_EDGE_CAP, targetSize } from './downscale';

describe('targetSize — the pre-upload downscale decision', () => {
  it('a 12MP phone photo comes down to the cap, keeping its shape', () => {
    const out = targetSize({ width: 4032, height: 3024 })!;
    expect(Math.max(out.width, out.height)).toBe(LONG_EDGE_CAP);
    // aspect ratio preserved to within a rounded pixel
    expect(out.width / out.height).toBeCloseTo(4032 / 3024, 2);
  });

  it('portrait is handled by the LONG edge, not the width', () => {
    const out = targetSize({ width: 3024, height: 4032 })!;
    expect(out.height).toBe(LONG_EDGE_CAP);
    expect(out.width).toBe(1536);
  });

  it('a tall receipt keeps its full width proportionally — the case that must not break', () => {
    // A thermal receipt shot fills the frame vertically. Its LINE ITEMS are
    // what Penny reads, so this is the one place too small is a correctness
    // bug rather than a quality one.
    const out = targetSize({ width: 1200, height: 6000 })!;
    expect(out.height).toBe(LONG_EDGE_CAP);
    expect(out.width).toBe(410);
  });

  it('never upscales — a small image is left completely alone', () => {
    expect(targetSize({ width: 800, height: 600 })).toBeNull();
    expect(targetSize({ width: LONG_EDGE_CAP, height: 100 })).toBeNull();
  });

  it('unknown dimensions cannot supply a resize decision before decoding', () => {
    expect(targetSize({ width: 0, height: 0 })).toBeNull();
    expect(targetSize({ width: Number.NaN, height: 100 })).toBeNull();
    expect(targetSize({ width: Number.POSITIVE_INFINITY, height: 100 })).toBeNull();
  });

  it('the cap is overridable, so a future ruling is one number', () => {
    const out = targetSize({ width: 4000, height: 2000 }, 1000)!;
    expect(out).toEqual({ width: 1000, height: 500 });
  });
});

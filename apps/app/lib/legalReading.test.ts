import { describe, expect, it } from 'vitest';
import { SCROLL_END_SLOP, canAcceptLegal, hasReachedEnd } from './legalGate';

describe('a document counts as read only when it has been read', () => {
  const viewportHeight = 600;

  it('the top of a long document is not the end', () => {
    expect(hasReachedEnd({ viewportHeight, contentHeight: 2000, scrollOffset: 0 })).toBe(false);
    expect(hasReachedEnd({ viewportHeight, contentHeight: 2000, scrollOffset: 900 })).toBe(false);
  });

  it('the bottom of a long document is', () => {
    expect(hasReachedEnd({ viewportHeight, contentHeight: 2000, scrollOffset: 1400 })).toBe(true);
  });

  it('near enough the bottom counts — a device that bounces must not lock the button', () => {
    expect(hasReachedEnd({ viewportHeight, contentHeight: 2000, scrollOffset: 1400 - SCROLL_END_SLOP + 1 })).toBe(true);
    expect(hasReachedEnd({ viewportHeight, contentHeight: 2000, scrollOffset: 1400 - SCROLL_END_SLOP - 40 })).toBe(false);
  });

  it('a document shorter than the screen is already read', () => {
    // The case that would strand Accept forever on a tall phone: nothing to
    // scroll means no scroll event ever arrives.
    expect(hasReachedEnd({ viewportHeight, contentHeight: 300, scrollOffset: 0 })).toBe(true);
    expect(hasReachedEnd({ viewportHeight, contentHeight: viewportHeight, scrollOffset: 0 })).toBe(true);
  });

  it('decides nothing before the view has been laid out', () => {
    // Guessing "read" from a zero-height measurement would hand the accept
    // button away for free, which is the bug this whole change exists to fix.
    expect(hasReachedEnd({ viewportHeight: 0, contentHeight: 0, scrollOffset: 0 })).toBe(false);
  });
});

describe('accept needs both documents', () => {
  it('is refused until both have been read', () => {
    expect(canAcceptLegal({ terms: false, privacy: false })).toBe(false);
    expect(canAcceptLegal({ terms: true, privacy: false })).toBe(false);
    expect(canAcceptLegal({ terms: false, privacy: true })).toBe(false);
  });

  it('is allowed once both have', () => {
    expect(canAcceptLegal({ terms: true, privacy: true })).toBe(true);
  });
});

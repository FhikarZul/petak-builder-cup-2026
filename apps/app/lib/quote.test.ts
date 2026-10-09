import { describe, expect, it } from 'vitest';
import { shouldShowQuote } from './quote';

describe('shouldShowQuote', () => {
  // The 4 Sep E2E case: every reply quoted the message directly above it, so
  // the same sentence appeared twice one screen apart on every turn.
  it('hides the quote when it is the row directly above', () => {
    expect(shouldShowQuote('m1', 'm1')).toBe(false);
  });

  // The case the quote exists for — a reply reaching past what is on screen.
  it('shows the quote when the reply reaches further back', () => {
    expect(shouldShowQuote('m1', 'm7')).toBe(true);
  });

  it('shows the quote when there is no previous row', () => {
    expect(shouldShowQuote('m1', null)).toBe(true);
  });

  it('shows nothing when the reply references nothing', () => {
    expect(shouldShowQuote(null, 'm1')).toBe(false);
    expect(shouldShowQuote(null, null)).toBe(false);
  });
});

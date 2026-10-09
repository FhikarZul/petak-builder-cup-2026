// Your rules (3 Sep 2026) — pure helpers behind the "Your rules" screen.
// C15/C68: the list shows where every rule came from.
import { describe, expect, it } from 'vitest';
import { ruleLine, sourceWord } from './rules';

describe('ruleLine', () => {
  it('joins pattern, category, and subcategory', () => {
    expect(ruleLine({ pattern: 'swimming', category: 'Children', subcategory: 'tuition' })).toBe(
      'swimming → Children · tuition',
    );
  });

  it('omits the subcategory when null', () => {
    expect(ruleLine({ pattern: 'swimming', category: 'Children', subcategory: null })).toBe(
      'swimming → Children',
    );
  });
});

describe('sourceWord', () => {
  it('names the provenance of every source', () => {
    expect(sourceWord('confirmation')).toBe('from a confirmation');
    expect(sourceWord('correction')).toBe('from a correction');
    expect(sourceWord('stated')).toBe('your words');
  });
});

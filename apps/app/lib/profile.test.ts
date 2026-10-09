// The user's card (3 Sep 2026) — pure chip helpers behind the Your details
// "Your card" section. Mirrors apps/server/src/profile/profile.ts.
import { describe, expect, it } from 'vitest';
import {
  addChip,
  addMember,
  cardSummary,
  EMPTY_PROFILE,
  readStoredProfile,
  preferredName,
  removeChip,
  removeMember,
} from './profile';

describe('addChip', () => {
  it('appends a trimmed value', () => {
    expect(addChip([], 'Alyssa')).toEqual(['Alyssa']);
    expect(addChip(['Alyssa'], '  Nut allergy  ')).toEqual(['Alyssa', 'Nut allergy']);
  });

  it('returns the list unchanged on a case-variant duplicate', () => {
    const list = ['Alyssa'];
    expect(addChip(list, 'alyssa')).toBe(list);
    expect(addChip(list, 'ALYSSA')).toBe(list);
  });

  it('returns the list unchanged on blank input', () => {
    const list = ['Alyssa'];
    expect(addChip(list, '   ')).toBe(list);
    expect(addChip(list, '')).toBe(list);
  });
});

describe('removeChip', () => {
  it('removes by value, case-insensitively', () => {
    expect(removeChip(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
    expect(removeChip(['a', 'B', 'c'], 'b')).toEqual(['a', 'c']);
    // Value-based, not positional: a render-time index goes stale while a
    // mutation is in flight; the tapped chip's value never does.
    expect(removeChip(['b', 'c'], 'b')).toEqual(['c']);
  });

  it('is a no-op for a value not in the list', () => {
    expect(removeChip(['a', 'b'], 'z')).toEqual(['a', 'b']);
  });
});

describe('addMember', () => {
  it('appends a member with a trimmed name and nullable note', () => {
    expect(addMember([], 'Alyssa', 'wife')).toEqual([{ name: 'Alyssa', note: 'wife' }]);
    expect(addMember([], '  Ben  ', null)).toEqual([{ name: 'Ben', note: null }]);
  });

  it('treats a blank note as null', () => {
    expect(addMember([], 'Alyssa', '   ')).toEqual([{ name: 'Alyssa', note: null }]);
  });

  it('returns the list unchanged on a case-variant duplicate name', () => {
    const list = [{ name: 'Alyssa', note: 'wife' }];
    expect(addMember(list, 'alyssa', 'spouse')).toBe(list);
  });

  it('returns the list unchanged on a blank name', () => {
    const list = [{ name: 'Alyssa', note: null }];
    expect(addMember(list, '  ', 'spouse')).toBe(list);
  });
});

describe('removeMember', () => {
  it('removes by name, case-insensitively', () => {
    const list = [
      { name: 'Alyssa', note: 'wife' },
      { name: 'Ben', note: null },
      { name: 'Cleo', note: 'cat' },
    ];
    expect(removeMember(list, 'ben')).toEqual([
      { name: 'Alyssa', note: 'wife' },
      { name: 'Cleo', note: 'cat' },
    ]);
    // The mid-flight case: the server still shows [Alyssa, Ben, Cleo] after
    // Alyssa's removal is queued; tapping rendered "Ben" must remove Ben.
    expect(removeMember(removeMember(list, 'Alyssa'), 'Ben')).toEqual([{ name: 'Cleo', note: 'cat' }]);
  });

  it('is a no-op for a name not in the list', () => {
    const list = [{ name: 'Alyssa', note: null }];
    expect(removeMember(list, 'Ben')).toEqual(list);
  });
});

describe('cardSummary', () => {
  it('counts display name, household members, and constraints', () => {
    expect(
      cardSummary({
        display_name: 'Steven',
        household: [{ name: 'Alyssa', note: null }],
        constraints: ['Nut allergy'],
      }),
    ).toBe('3 on your card');
  });

  it('pins the empty-card copy verbatim', () => {
    expect(cardSummary(EMPTY_PROFILE)).toBe('Your card is empty — neighbours will ask, or add things here.');
    expect(
      cardSummary({ display_name: null, household: [], constraints: [] }),
    ).toBe('Your card is empty — neighbours will ask, or add things here.');
  });
});

describe('readStoredProfile', () => {
  it('fills absent lists without losing the saved display name', () => {
    const stored = { display_name: 'Steven' };
    const profile = readStoredProfile(stored);
    expect(cardSummary(profile)).toBe('1 on your card');
    expect(profile).toEqual({ display_name: 'Steven', household: [], constraints: [] });
    expect(stored).toEqual({ display_name: 'Steven' });
  });
  it('preserves valid members and constraints from an incomplete card', () => {
    expect(readStoredProfile({ household: [{ name: 'Alyssa' }], constraints: ['Nut allergy'] })).toEqual({
      display_name: null, household: [{ name: 'Alyssa', note: null }], constraints: ['Nut allergy'],
    });
  });
  it.each([null, undefined, 42, [], { household: null, constraints: {} }])('renders malformed stored values safely: %j', (stored) => {
    expect(cardSummary(readStoredProfile(stored))).toBe(cardSummary(EMPTY_PROFILE));
  });
  it('keeps valid fields when neighbouring stored fields are malformed', () => {
    expect(readStoredProfile({ display_name: 'Steven', household: [null, { name: 'Alyssa', note: 42 }], constraints: [null, 'Nut allergy'] })).toEqual({
      display_name: 'Steven', household: [{ name: 'Alyssa', note: null }], constraints: ['Nut allergy'],
    });
  });
});

describe('preferredName', () => {
  it('uses the chosen name before signed-in identity', () => {
    expect(preferredName('Steven', { full_name: 'Steven Salim Lim' })).toBe('Steven');
  });
  it('falls back through signed-in names and email without inventing a saved preference', () => {
    expect(preferredName(null, { full_name: 'Steven Salim Lim' })).toBe('Steven Salim Lim');
    expect(preferredName('', { full_name: ' ', name: 'Steven' })).toBe('Steven');
    expect(preferredName(null, { full_name: 42 }, 'steven@example.invalid')).toBe('steven');
    expect(preferredName(null, {})).toBeNull();
  });
  it('does not confuse a household person with the user name', () => {
    const profile = readStoredProfile({ household: [{ name: 'Alyssa' }] });
    expect(preferredName(profile.display_name, { name: 'Steven' })).toBe('Steven');
    expect(profile.display_name).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { pronouns, possessive, NEIGHBOURS, type NeighbourId } from './neighbours';

// PAR-B09: the Moving out screen (Run B #9) hardcoded she/her, so Milo's copy
// read "Her records stay" and "She leaves at the end of the period you have
// paid for". A screen about one named neighbour must speak about that
// neighbour.
describe('pronouns', () => {
  it('gives Milo and Ollie masculine forms', () => {
    for (const id of ['milo', 'ollie'] as NeighbourId[]) {
      expect(pronouns(id)).toEqual({ subject: 'he', object: 'him', possessive: 'his' });
    }
  });

  it('gives Penny, Mira and Tally feminine forms', () => {
    for (const id of ['penny', 'mira', 'tally'] as NeighbourId[]) {
      expect(pronouns(id)).toEqual({ subject: 'she', object: 'her', possessive: 'her' });
    }
  });

  // Every neighbour must resolve — a missing case would silently fall through
  // to a default and misgender someone on their own screen.
  it('covers every neighbour in the cast', () => {
    for (const id of Object.keys(NEIGHBOURS) as NeighbourId[]) {
      const p = pronouns(id);
      expect(p.subject).toMatch(/^(he|she|they)$/);
      expect(p.object).toMatch(/^(him|her|them)$/);
      expect(p.possessive).toMatch(/^(his|her|their)$/);
    }
  });

  // possessive() is the capitalised form used mid-sentence on evidence cards
  // ("His count, not mine"); it must agree with pronouns().
  it('agrees with the existing possessive() helper', () => {
    for (const id of Object.keys(NEIGHBOURS) as NeighbourId[]) {
      expect(possessive(id).toLowerCase()).toBe(pronouns(id).possessive);
    }
  });
});

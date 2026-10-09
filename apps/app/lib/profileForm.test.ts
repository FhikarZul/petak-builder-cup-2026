import { describe, expect, it } from 'vitest';
import { PROFILE_FIELDS, hasAnything, parseBirthdate, specsFor, toProfilePayload, validateDraft } from './profileForm';

// 6 Sep 2026, founder approved: ask Milo's numbers in one go.
describe("Milo's one-go form", () => {
  it('keeps the server order, and weight stays LAST', () => {
    // C47 put weight last deliberately, after some trust is built. A form shows
    // everything at once, so the ordering survives as emphasis rather than
    // sequence — but it has to survive.
    const specs = specsFor(['birthdate', 'sex', 'height', 'weight']);
    expect(specs.map((s) => s.key)).toEqual(['birthdate', 'sex', 'height', 'weight']);
    expect(specs[specs.length - 1].key).toBe('weight');
  });

  it('every field keeps its one-clause reason (C47)', () => {
    // A form makes these easy to drop — four labels and a Submit would be a
    // smaller screen and a worse one.
    for (const spec of Object.values(PROFILE_FIELDS)) {
      expect(spec.reason.length, `${spec.key} has no reason`).toBeGreaterThan(15);
    }
  });

  it('ignores a field the server did not ask for', () => {
    expect(specsFor(['weight', 'shoe_size']).map((s) => s.key)).toEqual(['weight']);
  });

  it('sends only what was filled — an empty box is a skip, not an error', () => {
    expect(toProfilePayload({ weight: '75' })).toEqual({ weight_kg: 75 });
    expect(toProfilePayload({})).toEqual({});
    expect(hasAnything({})).toBe(false);
    expect(hasAnything({ height: '' })).toBe(false);
    expect(hasAnything({ height: '170' })).toBe(true);
  });

  it('maps to the shapes the server actually accepts', () => {
    expect(
      toProfilePayload({ birthdate: '1984-12-14', sex: 'Male', height: '163', weight: '75' }),
    ).toEqual({ birth_date: '1984-12-14', sex: 'male', height_cm: 163, weight_kg: 75 });
  });

  // 8 Sep 2026 (internal-reference) — the founder typed his birthdate the way a person
  // writes it, the form's strict YYYY-MM-DD regex dropped it SILENTLY, and
  // Milo's confirmation said "birthdate not said". A form that eats a filled
  // field with no error reads as broken, because it is.
  describe('a birthdate the way a person writes it', () => {
    it('parses natural forms to ISO', () => {
      expect(parseBirthdate('1984-12-14')).toBe('1984-12-14');
      expect(parseBirthdate('14 Dec 1984')).toBe('1984-12-14');
      expect(parseBirthdate('14 December 1984')).toBe('1984-12-14');
      expect(parseBirthdate('14 dec 1984')).toBe('1984-12-14');
      expect(parseBirthdate('14/12/1984')).toBe('1984-12-14'); // day-first, SEA convention
      expect(parseBirthdate('14-12-1984')).toBe('1984-12-14');
      expect(parseBirthdate('  14 Dec 1984  ')).toBe('1984-12-14');
    });

    it('rejects what is not a date, an impossible date, or the future', () => {
      expect(parseBirthdate('tomorrow')).toBeNull();
      expect(parseBirthdate('1984')).toBeNull();
      expect(parseBirthdate('31/02/1984')).toBeNull(); // February has no 31st
      expect(parseBirthdate('12/14/1984')).toBeNull(); // no 14th month — not a day-first date
      expect(parseBirthdate('14/12/2084')).toBeNull(); // the future is not a birthday
      expect(parseBirthdate('')).toBeNull();
    });

    it('submits a natural birthdate instead of dropping it', () => {
      expect(toProfilePayload({ birthdate: '14 Dec 1984' })).toEqual({ birth_date: '1984-12-14' });
      expect(toProfilePayload({ birthdate: '14/12/1984' })).toEqual({ birth_date: '1984-12-14' });
    });

    it('a filled field that cannot be parsed is an ERROR, never a silent drop', () => {
      const v = validateDraft({ birthdate: 'next week', weight: '75' });
      expect(v.errors.birthdate).toBeTruthy();
      expect(v.payload).toEqual({ weight_kg: 75 }); // the good field still reads clean
      expect(validateDraft({ birthdate: 'next week' }).payload).toEqual({});
      // the button reflects RAW input, so a bad date alone still lets you tap
      // and be told why — a dead button with no explanation is how we got here
      expect(hasAnything({ birthdate: 'next week' })).toBe(true);
    });

    it('junk numbers are errors too — explained, not swallowed', () => {
      expect(validateDraft({ height: 'tall' }).errors.height).toBeTruthy();
      expect(validateDraft({ weight: '900' }).errors.weight).toBeTruthy();
      expect(validateDraft({ height: 'tall', weight: '75' }).payload).toEqual({ weight_kg: 75 });
      expect(validateDraft({}).errors).toEqual({});
    });
  });
});

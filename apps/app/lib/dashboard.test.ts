// Run B #3 / C90 — the honesty rules on Milo's dashboard, as pure functions.
// The screen is not the test target; these three rules are, because each one
// is a place the surface could quietly invent something.
import { describe, expect, it } from 'vitest';
import {
  agoWords,
  burnNote,
  allowanceWords,
  categoryLabel,
  categorySubLabel,
  coinKindLabel,
  coinsInPhotos,
  coinsWorthLine,
  countWord,
  customFieldLabel,
  dayLabel,
  deviationBars,
  deviationLabel,
  emotionChip,
  knockOn,
  knocksOnCount,
  logDayLabel,
  miloLogGroups,
  miloLogRow,
  miloLogSummaryLine,
  miloLogTypeChips,
  energyTargetLine,
  logSummaryLine,
  mealStripParts,
  miloMacroNote,
  miloMacroRows,
  parseCustomDate,
  parseQuietTime,
  polylineSegments,
  quietHoursWords,
  rangeSub,
  signedCoins,
  categoryShare,
  money,
  paceNote,
  pennyTodayDelta,
  togglePennyMetricFilter,
  readingText,
  trendText,
  visitsWord,
  youFacts,
  type PennyBudget,
} from './dashboard';

describe('Penny Today metric grid', () => {
  it('states whether today is more or less than yesterday', () => {
    expect(pennyTodayDelta(42, 30, 'SGD')).toBe('SGD 12.00 more spent today');
    expect(pennyTodayDelta(20, 30, 'SGD')).toBe('SGD 10.00 less spent today');
  });

  it('toggles subset tiles back to All', () => {
    expect(togglePennyMetricFilter('all', 'groceries')).toBe('groceries');
    expect(togglePennyMetricFilter('groceries', 'groceries')).toBe('all');
    expect(togglePennyMetricFilter('photos', 'groceries')).toBe('groceries');
  });
});

describe('Milo energy target clarity', () => {
  it('labels an objective calorie target separately from estimated burn', () => {
    expect(energyTargetLine(1338)).toBe('Target 1,338 kcal · Out is estimated burn');
    expect(energyTargetLine(null)).toBeNull();
  });
});

describe('Milo meal grouping', () => {
  it('keeps six receipt items together while retaining individual macro rows', () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({ id: `item-${i}`, kind: 'meal',
      payload: { dish: `Dish ${i}`, calories: 100, protein_g: 5, carbs_g: 10, fat_g: 4 },
      created_at: '2026-09-22T08:00:00.000Z', has_photo: true, photo_id: 'one-receipt',
      meal_group_id: 'one-extraction', superseded_by: null,
    }));
    const rows = miloLogGroups(entries as never, new Date('2026-09-22T12:00:00.000Z'))[0].rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(6);
    expect(rows[0].energy).toBe('+600 kcal');
    expect(rows[0].macros).toContainEqual({ label: 'Protein', value: '30g' });
    expect(miloLogTypeChips(entries as never).map(c => [c.key, c.count])).toEqual([
      ['all', 1], ['food', 1], ['body', 0], ['photos', 1],
    ]);
    expect(miloLogTypeChips([...entries, { ...entries[0], id: 'other', meal_group_id: 'another-meal' }] as never)[1].count).toBe(2);
  });

  it('shows one meal row for multiple projections from one extraction', () => {
    const base = (id: string, dish: string, calories: number) => ({
      id, kind: 'meal', payload: { dish, calories, protein_g: 10, carbs_g: 20, fat_g: 5 },
      created_at: '2026-09-18T08:00:00.000Z', has_photo: true, photo_id: 'photo-1',
      meal_group_id: 'extraction-1', superseded_by: null,
    });
    const groups = miloLogGroups([base('a', 'Eggs', 200), base('b', 'Toast', 100)] as never, new Date('2026-09-18T12:00:00.000Z'));
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].title).toBe('Meal · 2 items');
    expect(groups[0].rows[0].energy).toBe('+300 kcal');
    expect(groups[0].rows[0].items).toEqual([
      { id: 'a', title: 'Eggs', energy: '+200 kcal', detail: null, macros: [{ label: 'Protein', value: '10g' }, { label: 'Carbs', value: '20g' }, { label: 'Fat', value: '5g' }] },
      { id: 'b', title: 'Toast', energy: '+100 kcal', detail: null, macros: [{ label: 'Protein', value: '10g' }, { label: 'Carbs', value: '20g' }, { label: 'Fat', value: '5g' }] },
    ]);
  });
});

describe('C90 — the inputs a target came from', () => {
  it('shows all four when they were all answered', () => {
    expect(youFacts({ age: 34, sex: 'male', height_cm: 172, weight_kg: 80 }).map((f) => f.value)).toEqual([
      '34 yrs',
      'male',
      '172 cm',
      '80 kg',
    ]);
  });

  it('C97 shows derived age only, never birthdate', () => {
    const facts = youFacts({ age: 36, sex: 'male', height_cm: 172, weight_kg: 80 });
    expect(facts[0]).toEqual({ label: 'Age', value: '36 yrs', said: true });
    expect(facts.map((f) => f.label)).not.toContain('Birthdate');
  });

  it('a skipped field reads "not said" — never a guess, never a blank', () => {
    // The whole point of asking rather than assuming (C90) is undone if the
    // dashboard prints the assumption as though it were an answer.
    const facts = youFacts({ age: null, sex: null, height_cm: 172, weight_kg: null });
    expect(facts.map((f) => f.value)).toEqual(['not said', 'not said', '172 cm', 'not said']);
    expect(facts.map((f) => f.said)).toEqual([false, false, true, false]);
  });

  it('an unrecognised sex value is not printed back at the user', () => {
    expect(youFacts({ age: null, sex: 'other', height_cm: null, weight_kg: null })[1]).toEqual({
      label: 'Sex',
      value: 'not said',
      said: false,
    });
  });
});

describe('C73/C89 — the burn line names the assumptions it is standing on', () => {
  const base = { bmr: 1627, tdee: 1952, activity_factor: 1.2 };

  it('both assumed: both are named', () => {
    const note = burnNote({ ...base, sex_assumed: true, activity_assumed: true });
    expect(note).toContain('1,627 kcal');
    expect(note).toContain('not measured');
    expect(note).toContain('has not asked your sex');
    expect(note).toContain('desk job');
  });

  it('sex stated, activity assumed: only the activity is named', () => {
    const note = burnNote({ ...base, sex_assumed: false, activity_assumed: true });
    expect(note).not.toContain('sex');
    expect(note).toContain('desk job');
  });

  it('nothing assumed: no disclaimer at all', () => {
    // A generic "this is an estimate" on a number the user fully specified
    // would be noise, and it would make the real warnings easier to ignore.
    const note = burnNote({ ...base, sex_assumed: false, activity_assumed: false });
    expect(note).not.toContain('assumes');
    expect(note).toContain('not measured'); // still true: BMR is a formula
  });
});

describe('C92 — the body series, and what two numbers are allowed to mean', () => {
  const now = new Date('2026-08-28T09:00:00.000Z');
  const kg = (value: number, at: string) => ({ value, unit: 'kg' as const, at });

  it('reads a weight and a percentage the way they were said', () => {
    expect(readingText(kg(74.2, now.toISOString()))).toBe('74.2 kg');
    expect(readingText({ value: 21.4, unit: 'percent', at: now.toISOString() })).toBe('21.4%');
    // Never converted: the record says what the user's scale said.
    expect(readingText({ value: 164, unit: 'lb', at: now.toISOString() })).toBe('164 lb');
  });

  it('one reading is not a trend', () => {
    expect(trendText({ latest: kg(74.2, now.toISOString()), previous: null }, now)).toBeNull();
  });

  it('two readings in different units are never subtracted', () => {
    // 164 lb and 74.2 kg are the same weight, but the RECORDS were never in
    // the same terms — a delta here would be arithmetic on something that
    // does not exist.
    const series = {
      latest: kg(74.2, now.toISOString()),
      previous: { value: 164, unit: 'lb' as const, at: '2026-08-27T09:00:00.000Z' },
    };
    expect(trendText(series, now)).toBeNull();
  });

  it('a fall, a rise, and NO change — all three are real answers', () => {
    const yesterday = '2026-08-27T09:00:00.000Z';
    expect(trendText({ latest: kg(74.2, now.toISOString()), previous: kg(74.5, yesterday) }, now)).toEqual({
      icon: 'arrow_downward',
      text: '0.3 kg since yesterday',
    });
    expect(trendText({ latest: kg(74.8, now.toISOString()), previous: kg(74.5, yesterday) }, now)).toEqual({
      icon: 'arrow_upward',
      text: '0.3 kg since yesterday',
    });
    // Zero is NOT "no trend": "no change since yesterday" is an answer.
    expect(trendText({ latest: kg(74.5, now.toISOString()), previous: kg(74.5, yesterday) }, now)).toEqual({
      icon: 'trending_flat',
      text: 'no change since yesterday',
    });
  });

  it('says roughly when, in the words a person would use', () => {
    // A scale reading is a morning, not a timestamp.
    expect(agoWords('2026-08-28T06:00:00.000Z', now)).toBe('today');
    expect(agoWords('2026-08-27T09:00:00.000Z', now)).toBe('yesterday');
    expect(agoWords('2026-08-25T09:00:00.000Z', now)).toBe('3 days ago');
    expect(agoWords('2026-08-20T09:00:00.000Z', now)).toBe('last week');
    expect(agoWords('2026-08-07T09:00:00.000Z', now)).toBe('3 weeks ago');
    expect(agoWords('2026-06-12T09:00:00.000Z', now)).toBe('June');
  });
});

describe("Run B #4 — Penny's honesty rules", () => {
  const budget = (over: Partial<PennyBudget> = {}): PennyBudget => ({
    amount: 1800,
    currency: 'SGD',
    spent: 1240,
    left: 560,
    expected: 1180,
    delta: -60,
    per_day_left: 62,
    days_left: 9,
    spent_pct: 68.9,
    expected_pct: 65.6,
    ...over,
  });

  it('an uncategorised entry is WAITING ON A NAME, not "Uncategorised"', () => {
    // C39: it is not a category, it is a question Penny has not had answered.
    expect(categoryLabel(null)).toBe('Waiting on a name');
    expect(categoryLabel('Groceries')).toBe('Groceries');
  });

  it('a filing names "category · subcategory"; a null subcategory changes nothing', () => {
    // 3 Sep 2026 — subcategory is optional; the common case is null.
    expect(categorySubLabel('Children', 'tuition')).toBe('Children · tuition');
    expect(categorySubLabel('Children', null)).toBe('Children');
    // No category at all is still waiting on a word (C39).
    expect(categorySubLabel(null, null)).toBe('Waiting on a name');
  });

  it('money is shown in the currency it was recorded in, never converted', () => {
    // D3: no FX table at P0, so a converted figure is one Penny cannot defend.
    expect(money('SGD', 1240)).toBe('SGD 1,240.00');
    expect(money('USD', 8.4)).toBe('USD 8.40');
  });

  it('the pace note states the position and stops', () => {
    // C06: no praise for being under, no warning for being over. Being over
    // your own pace is information, not a telling-off.
    expect(paceNote(budget())).toBe('SGD 60.00 over the even mark · 9 days left');
    expect(paceNote(budget({ delta: 120 }))).toBe('SGD 120.00 under the even mark · 9 days left');
    expect(paceNote(budget({ delta: 0 }))).toBe('Exactly on the mark · 9 days left');
    expect(paceNote(budget({ delta: 0, days_left: 1 }))).toBe('Exactly on the mark · 1 day left');
  });

  it('category shares are a share of what is SHOWN, and never exceed 100', () => {
    const rows = [
      { category: 'Groceries', entries: 4, total: 96 },
      { category: 'Eating out', entries: 3, total: 60.2 },
      { category: null, entries: 1, total: 31 },
    ];
    const total = rows.reduce((a, r) => a + r.total, 0);
    const shares = rows.map((r) => categoryShare(r, total));
    expect(shares.every((s) => s >= 0 && s <= 100)).toBe(true);
    expect(Math.round(shares.reduce((a, b) => a + b, 0))).toBe(100);
  });

  it('an empty ledger divides by nothing', () => {
    expect(categoryShare({ category: 'x', entries: 0, total: 0 }, 0)).toBe(0);
  });
});

describe("Run B #2 — Mira's dateline", () => {
  const now = new Date(2026, 7, 28, 9, 0, 0); // 28 Aug 2026, local

  it('names today and yesterday, and dates everything else', () => {
    // A journal is read by WHEN. "3 days ago" makes the reader do arithmetic
    // to find a Tuesday; a date does not.
    expect(dayLabel('2026-08-28', now)).toBe('Today');
    expect(dayLabel('2026-08-27', now)).toBe('Yesterday');
    expect(dayLabel('2026-08-25', now)).toContain('25 August');
    expect(dayLabel('2026-08-25', now)).toContain('Tuesday');
  });

  it('crosses a month boundary without confusing itself', () => {
    const firstOfMonth = new Date(2026, 8, 1, 9, 0, 0);
    expect(dayLabel('2026-09-01', firstOfMonth)).toBe('Today');
    expect(dayLabel('2026-08-31', firstOfMonth)).toBe('Yesterday');
  });
});

describe("Run B #3 — Milo's meals strip", () => {
  it('shows count, lower-case meal times, and the best rated meal when present', () => {
    expect(
      mealStripParts({
        entries: 3,
        meal_times: ['08:10', '12:45', '19:20'],
        best_rated: { dish: 'chicken rice', rating: 3 },
      }),
    ).toEqual({
      left: '3 meals · 8:10 am · 12:45 pm · 7:20 pm',
      right: 'Best rated: chicken rice 3/5',
    });
  });

  it('keeps the right half absent when nothing is rated', () => {
    expect(mealStripParts({ entries: 1, meal_times: ['08:10'] })).toEqual({
      left: '1 meal · 8:10 am',
      right: null,
    });
  });

  it("formats the server's ISO meal times, not only HH:MM fixtures", () => {
    const localDinner = new Date(2026, 7, 28, 19, 20).toISOString();
    expect(mealStripParts({ entries: 1, meal_times: [localDinner] })?.left).toBe('1 meal · 7:20 pm');
  });

  it('does not render for zero meals', () => {
    expect(mealStripParts({ entries: 0, meal_times: [] })).toBeNull();
  });
});

describe("Run B #8 — Milo's log rows", () => {
  const now = new Date('2026-08-28T10:00:00');

  it('formats a meal from the meal payload, including calories, macros, rating, and why', () => {
    expect(
      miloLogRow({
        id: 'meal-1',
        kind: 'meal',
        created_at: '2026-08-28T00:10:00.000Z',
        has_photo: true,
        payload: {
          dish: 'chicken rice',
          description: 'hawker lunch',
          portion: 'one plate',
          calories: 620,
          protein_g: 30,
          carbs_g: 70,
          fat_g: 18,
          rating: 4,
          rating_why: 'Good protein; skin pushed fat up.',
        },
      }),
    ).toMatchObject({
      type: 'food',
      icon: 'restaurant',
      title: 'chicken rice',
      subtitle: '620 kcal · 30g P / 70g C / 18g F',
      energy: '+620 kcal',
      hasPhoto: true,
      detail: 'hawker lunch · one plate',
      rating: 4,
      ratingWhy: 'Good protein; skin pushed fat up.',
      macros: [
        { label: 'Protein', value: '30g' },
        { label: 'Carbs', value: '70g' },
        { label: 'Fat', value: '18g' },
      ],
    });
  });

  it('formats a body reading without inventing energy or macros', () => {
    expect(
      miloLogRow({
        id: 'body-1',
        kind: 'body',
        created_at: '2026-08-28T02:00:00.000Z',
        has_photo: false,
        payload: { metric: 'body_fat', value: 22.4, unit: '%' },
      }),
    ).toMatchObject({
      type: 'body',
      icon: 'monitor_weight',
      title: 'Body fat',
      subtitle: '22.4%',
      energy: null,
      macros: [],
      reading: '22.4%',
    });
  });

  it('groups active rows by local day and skips superseded/voided rows', () => {
    const groups = miloLogGroups(
      [
        { id: 'new', kind: 'body', created_at: '2026-08-28T02:00:00.000Z', has_photo: false, payload: { metric: 'weight', value: 74.2, unit: 'kg' } },
        { id: 'old', kind: 'meal', created_at: '2026-08-27T02:00:00.000Z', has_photo: true, payload: { dish: 'toast' } },
        { id: 'skip-1', kind: 'meal', created_at: '2026-08-27T01:00:00.000Z', has_photo: true, superseded_by: 'new', payload: { dish: 'draft' } },
        { id: 'skip-2', kind: 'meal', created_at: '2026-08-27T00:00:00.000Z', has_photo: true, voided: true, payload: { dish: 'undo' } },
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(['Today · Fri 28 Aug', 'Thu 27 Aug']);
    expect(groups.map((g) => g.rows.map((r) => r.id))).toEqual([['new'], ['old']]);
  });

  it('counts type chips over active rows only', () => {
    expect(
      miloLogTypeChips([
        { id: 'a', kind: 'meal', created_at: '2026-08-28T02:00:00.000Z', has_photo: true, payload: {} },
        { id: 'b', kind: 'body', created_at: '2026-08-28T01:00:00.000Z', has_photo: false, payload: {} },
        { id: 'c', kind: 'meal', created_at: '2026-08-28T00:00:00.000Z', has_photo: true, voided: true, payload: {} },
      ]).map((c) => [c.key, c.count]),
    ).toEqual([
      ['all', 2],
      ['food', 1],
      ['body', 1],
      ['photos', 1],
    ]);
  });

  it('keeps the summary absent on a paginated page', () => {
    expect(miloLogSummaryLine(2, null)).toBe('2 entries');
    expect(miloLogSummaryLine(2, 'next')).toBeNull();
  });
});

describe('Run B #15–#17 — the wallet says what you have, never what you might lose', () => {
  it('coins read as photos WITH the hedge intact', () => {
    // The hedge lives in the screen's copy; the number is what this owns.
    expect(coinsInPhotos(380)).toBe(38);
    expect(coinsInPhotos(5)).toBe(0); // never rounds up into a photo you cannot buy
  });

  // PAR-B15 — this line had been rewritten to state the rate ("10 coins is one
  // photo") on the reasoning that a bare "38 photos" would name a plan the user
  // never made. The approved drawing does not say a bare "38 photos"; it says
  // "38 photos, if that is what you spend them on" — the hedge was already
  // there. Pinned as a function so the next edit has to argue with a test.
  it('the coins hero sub-line is the drawn one, hedge included', () => {
    expect(coinsWorthLine(380)).toBe('38 photos, if that is what you spend them on');
    expect(coinsWorthLine(5)).toBe('0 photos, if that is what you spend them on');
    expect(coinsWorthLine(12_340)).toBe('1,234 photos, if that is what you spend them on');
  });

  it('every ledger kind has words, and an unshipped kind still says something true', () => {
    // A screen that prints "referral_credit" has failed at its only job.
    expect(coinKindLabel('purchase_pack')).toBe('Bought');
    expect(coinKindLabel('kept_credits')).toBe('Exchanged for credits');
    expect(coinKindLabel('referral_credit')).toBe('Someone settled in');
    expect(coinKindLabel('some_future_kind')).toBe('some future kind');
  });

  it('signs use the real minus, not a hyphen', () => {
    expect(signedCoins(200)).toBe('+200');
    expect(signedCoins(-50)).toBe('−50');
  });

  it("the allowance says what is yours and what the street added", () => {
    // The second half is what makes inviting someone legible as widening the
    // street rather than a bill.
    expect(allowanceWords({ used: 3, cap: 15, base: 5, from_neighbours: 10, paid_residents: 1 }, ['Mira'])).toEqual({
      left: '12 of 15',
      because: '5 yours, 10 from Mira living here.',
    });
    expect(
      allowanceWords({ used: 0, cap: 25, base: 5, from_neighbours: 20, paid_residents: 2 }, ['Mira', 'Milo']).because,
    ).toBe('5 yours, 20 from 2 neighbours living here.');
  });

  it('with nobody paying there is no second sentence to say', () => {
    // The free petak adds no allowance (C05), so inventing "0 from the street"
    // would be noise about a thing that has not happened.
    expect(allowanceWords({ used: 9, cap: 10, base: 10, from_neighbours: 0, paid_residents: 0 }, ['Ollie'])).toEqual({
      left: '1 of 10',
      because: null,
    });
  });

  it('an overspent day never reads as negative', () => {
    expect(allowanceWords({ used: 12, cap: 10, base: 10, from_neighbours: 0, paid_residents: 0 }, []).left).toBe(
      '0 of 10',
    );
  });
});

describe('Run B #11/#12 — settings say what the app is DOING', () => {
  it('a subject nobody has touched is ON, because that is the behaviour', () => {
    // C49: absent = on. A switch drawn off for a user who is receiving knocks
    // would be lying about what the app is doing.
    expect(knockOn(null, 'penny')).toBe(true);
    expect(knockOn({ notifications: { subjects: {} } }, 'penny')).toBe(true);
    expect(knockOn({ notifications: { subjects: { penny: false } } }, 'penny')).toBe(false);
    // One neighbour off does not turn the others off.
    expect(knockOn({ notifications: { subjects: { penny: false } } }, 'milo')).toBe(true);
  });

  it('the count is over who actually LIVES here', () => {
    // A count that includes someone who has not moved in is a count of nothing.
    const bag = { notifications: { subjects: { penny: false } } };
    expect(knocksOnCount(bag, ['penny', 'milo', 'mira', 'ollie'])).toBe('3 of 4 on');
    expect(knocksOnCount(bag, ['penny', 'ollie'])).toBe('1 of 2 on');
  });

  it('quiet hours read as a sentence, and default when never set', () => {
    expect(quietHoursWords(null)).toBe('Nothing knocks between 22:00 and 07:00.');
    expect(quietHoursWords({ quiet_hours: { start: '23:30', end: '06:15' } })).toBe(
      'Nothing knocks between 23:30 and 06:15.',
    );
  });

  it('parseQuietTime normalises a good time into canonical HH:MM', () => {
    expect(parseQuietTime('22:00')).toBe('22:00');
    expect(parseQuietTime('7:05')).toBe('07:05'); // single-digit hour pads
    expect(parseQuietTime('07:05 ')).toBe('07:05'); // stray whitespace trims
  });

  it('parseQuietTime rejects what the server would 400', () => {
    expect(parseQuietTime('24:00')).toBeNull(); // hour past 23
    expect(parseQuietTime('22:60')).toBeNull(); // minute past 59
    expect(parseQuietTime('ten')).toBeNull(); // not a time at all
    expect(parseQuietTime('2200')).toBeNull(); // no colon
    expect(parseQuietTime('')).toBeNull(); // empty
  });
});

describe('C45 — the emotion chip, fixed at five', () => {
  it('gives each of C45\'s FIVE an icon and a word', () => {
    // "The emotion set is FIXED AT FIVE: Good · Hopeful · Reflective ·
    // Stressed · Low. A sixth emotion is a canon PR, not a tag." (C45)
    //
    // It shipped as C95's seven — glad/calm/tired/low/anxious/angry/mixed —
    // which C95 itself marks "DRAFT (founder wordsmiths); the SHAPE is what is
    // ruled". The code took the draft for canon.
    for (const [key, label] of [
      ['good', 'Good'],
      ['hopeful', 'Hopeful'],
      ['reflective', 'Reflective'],
      ['stressed', 'Stressed'],
      ['low', 'Low'],
    ] as const) {
      expect(emotionChip(key)?.label).toBe(label);
      expect(emotionChip(key)?.icon).toBeTruthy();
    }
  });

  it('is exactly five — a sixth is a canon PR, not a tag', () => {
    const sixth = ['calm', 'tired', 'anxious', 'angry', 'mixed', 'glad'];
    const labels = new Set(sixth.map((e) => emotionChip(e)?.label));
    // Every legacy word maps INTO the five; none of them adds a sixth label.
    for (const l of labels) {
      if (l) expect(['Good', 'Hopeful', 'Reflective', 'Stressed', 'Low']).toContain(l);
    }
  });

  it('still reads an entry stored with C95\'s draft word', () => {
    // Mapped for DISPLAY, never re-tagged: re-tagging would rewrite what Mira
    // recorded about somebody's day — the same objection C95 makes about a
    // cleaned version replacing the raw.
    expect(emotionChip('glad')?.label).toBe('Good');
    expect(emotionChip('tired')?.label).toBe('Low');
    expect(emotionChip('anxious')?.label).toBe('Stressed');
  });

  it('maps anger without ever writing that judgement down', () => {
    // `angry` has no home among the five, and deciding a person's anger was
    // "stress" is a judgement about their feeling (C96 — she never names the
    // feeling back). Display-only mapping means it is never stored.
    expect(emotionChip('angry')?.label).toBe('Stressed');
  });

  it('null is a real answer and renders nothing', () => {
    expect(emotionChip(null)).toBeNull();
  });

  it('a feeling the app has no words for renders nothing, never the raw token', () => {
    // The ledger may gain an emotion before the app ships copy for it.
    expect(emotionChip('wistful')).toBeNull();
  });
});

// --- Run B #4, sub-slice B (plans/2026-08-28-penny-charts-series.md) ---
// The chart maths and the header words: each is a place the surface could
// quietly invent something, so each mirrors the drawing's computation and is
// pinned here. The components only render what these return.

describe('deviationBars — the daily-spend card mirrors the drawn maths (:2720-2729)', () => {
  it('a known series gives exact devs, worst-normalised heights, and the 3px floor', () => {
    const bars = deviationBars(
      [
        { day: '2026-08-24', total: 40 },
        { day: '2026-08-25', total: 60 },
        { day: '2026-08-26', total: 50 },
      ],
      50,
    );
    expect(bars.map((b) => b.dev)).toEqual([-10, 10, 0]);
    expect(bars.map((b) => b.over)).toEqual([false, true, false]);
    // worst = 10 → both ±10 bars take the full 56px (heightPct 1); the zero
    // deviation floors at 3px but draws no bar (neither over nor under).
    expect(bars.map((b) => b.heightPct)).toEqual([1, 1, 3 / 56]);
  });

  it('a single-day series has worst = 0 — the drawing’s `|| 1` guard holds, no crash', () => {
    const bars = deviationBars([{ day: '2026-08-12', total: 42.1 }], 42.1);
    expect(bars).toHaveLength(1);
    expect(bars[0].dev).toBe(0);
    expect(bars[0].over).toBe(false);
    expect(bars[0].heightPct).toBe(3 / 56); // the floor, via the guard
  });
});

describe('deviationLabel — the per-bar words (:2725)', () => {
  it('positive / negative / zero read + / − / ±, with the drawing’s minus sign', () => {
    expect(deviationLabel(12.4)).toBe('+12.40');
    expect(deviationLabel(-12.4)).toBe('−12.40'); // U+2212, not a hyphen
    expect(deviationLabel(0)).toBe('±0.00');
  });
});

describe('polylineSegments — the running-total line as rotated Views (:2617-2618)', () => {
  it('a level pair: one flat segment, angle exactly 0°', () => {
    const segments = polylineSegments(
      [
        { day: '2026-08-01', total: 0 },
        { day: '2026-08-02', total: 0 },
      ],
      100,
      60,
      10,
    );
    expect(segments).toEqual([{ x: 50, y: 60, length: 50, angleDeg: 0 }]);
  });

  it('a 3-4-5 climb: exact length and angle — RN’s y grows DOWN, so rising spend is negative', () => {
    const [s] = polylineSegments(
      [
        { day: '2026-08-01', total: 0 },
        { day: '2026-08-02', total: 8 },
      ],
      60,
      60,
      10,
    );
    expect(s.x).toBe(30);
    expect(s.y).toBe(40);
    expect(s.length).toBe(50); // √(30² + 40²)
    expect(s.angleDeg).toBeCloseTo(-53.1301, 4);
  });

  it('a falling line is the mirror image', () => {
    const [s] = polylineSegments(
      [
        { day: '2026-08-01', total: 8 },
        { day: '2026-08-02', total: 0 },
      ],
      60,
      60,
      10,
    );
    expect(s.length).toBe(50);
    expect(s.angleDeg).toBeCloseTo(53.1301, 4);
  });

  it('a vertical step is 90° — width 0 collapses the columns and the angle maths still holds', () => {
    const [s] = polylineSegments(
      [
        { day: '2026-08-01', total: 0 },
        { day: '2026-08-02', total: 10 },
      ],
      0,
      60,
      10,
    );
    expect(s.length).toBe(50);
    expect(s.angleDeg).toBe(-90);
  });

  it('three points make two segments; a single point makes none and does not crash', () => {
    const segments = polylineSegments(
      [
        { day: '2026-08-01', total: 0 },
        { day: '2026-08-02', total: 5 },
        { day: '2026-08-03', total: 5 },
      ],
      90,
      60,
      10,
    );
    expect(segments).toHaveLength(2);
    expect(segments[1].angleDeg).toBe(0); // level across the plateau
    expect(polylineSegments([{ day: '2026-08-01', total: 5 }], 90, 60, 10)).toEqual([]);
  });
});

describe('rangeSub — the header words derive from the SAME window the server filtered by (C75)', () => {
  it('today names the weekday and the date', () => {
    expect(rangeSub({ from: '2026-08-12', to: '2026-08-12' }, 'today')).toBe('Wed · 12 Aug');
  });

  it('week and month read day–day month', () => {
    expect(rangeSub({ from: '2026-08-06', to: '2026-08-12' }, 'week')).toBe('6–12 Aug');
    expect(rangeSub({ from: '2026-08-01', to: '2026-08-12' }, 'month')).toBe('1–12 Aug');
  });

  it('a window that crosses a month says both months — the label may not disagree with the window', () => {
    expect(rangeSub({ from: '2026-08-31', to: '2026-09-05' }, 'week')).toBe('31 Aug – 5 Sep');
  });

  it('year reads month – month year', () => {
    expect(rangeSub({ from: '2026-01-01', to: '2026-08-12' }, 'year')).toBe('Jan – Aug 2026');
  });
});

describe('visitsWord (:2611)', () => {
  it('one visit is singular, the rest plural', () => {
    expect(visitsWord(1)).toBe('1 visit');
    expect(visitsWord(4)).toBe('4 visits');
  });
});

describe("logDayLabel — the log's day dividers (the drawing's dayLabelFor)", () => {
  const now = new Date('2026-08-12T15:00:00');

  it('today is named, with its date beside it', () => {
    expect(logDayLabel('2026-08-12', now)).toBe('Today · Wed 12 Aug');
  });

  it('any other day is "Wed 12 Aug" — no "yesterday", no arithmetic for the reader', () => {
    expect(logDayLabel('2026-08-11', now)).toBe('Tue 11 Aug');
  });
});

describe('logSummaryLine — no quiet partial sums (the 28i rule)', () => {
  it('count and a whole-set total read "N entries · $total"', () => {
    expect(logSummaryLine(12, 42.1, 'SGD')).toBe('12 entries · SGD 42.10');
    expect(logSummaryLine(1, 8, 'SGD')).toBe('1 entry · SGD 8.00');
  });

  it('a paginated page drops the money half but keeps the window-wide count', () => {
    expect(logSummaryLine(57, null, 'SGD')).toBe('57 entries');
  });

  it('no honest count (a searched page that paginated) → the line is not drawn', () => {
    expect(logSummaryLine(null, null, 'SGD')).toBeNull();
  });
});


// --- Run B #5 — the custom range's typed dates (plans/2026-08-28-custom-date-ranges.md) ---
// The parser is where a typed date could quietly change what it "means", so
// the accepted set is pinned here. `today` is injected, never read from a
// clock, so the future-date check is pure.

describe("parseCustomDate — the custom range's typed dates, normalised before the fetch", () => {
  const today = '2026-08-12';

  it('accepts canonical ISO verbatim', () => {
    expect(parseCustomDate('2026-07-01', today)).toBe('2026-07-01');
  });

  it('accepts a 3-letter month name, day first', () => {
    expect(parseCustomDate('1 jul 2026', today)).toBe('2026-07-01');
  });

  it('accepts a full month name', () => {
    expect(parseCustomDate('12 August 2026', today)).toBe('2026-08-12');
  });

  it('accepts any letter case', () => {
    expect(parseCustomDate('1 JUL 2026', today)).toBe('2026-07-01');
  });

  it('accepts day/month/year slashes', () => {
    expect(parseCustomDate('1/7/2026', today)).toBe('2026-07-01');
  });

  it('reads two-digit years as 20xx', () => {
    expect(parseCustomDate('1/7/26', today)).toBe('2026-07-01');
  });

  it('ignores stray and collapsed whitespace', () => {
    expect(parseCustomDate('  1  Jul  2026 ', today)).toBe('2026-07-01');
  });

  it('rejects impostor dates the round-trip exposes', () => {
    expect(parseCustomDate('2026-02-30', today)).toBeNull(); // Feb has no 30th
    expect(parseCustomDate('31/2/26', today)).toBeNull();
    expect(parseCustomDate('13/13/2026', today)).toBeNull(); // month 13
  });

  it('rejects shapes outside the accepted set', () => {
    expect(parseCustomDate('1-7-2026', today)).toBeNull(); // dashes, unpadded, year last
    expect(parseCustomDate('tomorrow', today)).toBeNull();
    expect(parseCustomDate('', today)).toBeNull();
  });

  it('rejects month-first — "july 1 2026" is not a drawn or accepted form', () => {
    // The drawn field reads "1 Jul 2026" (day first, :855-857), and that is
    // the only named-month shape the sheet accepts; widening what a typed
    // date means is a ruling (§4.4), not an edit.
    expect(parseCustomDate('july 1 2026', today)).toBeNull();
  });

  it('rejects a 2-letter month prefix — "ju" would be ambiguous', () => {
    // Minimum 3 letters, so "jun"/"jul" stay distinct.
    expect(parseCustomDate('1 ju 2026', today)).toBeNull();
  });

  it('rejects a future date (fork 5’s client half — the server re-checks the anchor)', () => {
    expect(parseCustomDate('2026-08-13', today)).toBeNull();
    expect(parseCustomDate('2026-08-12', today)).toBe('2026-08-12'); // today itself is fine
  });
});

describe('customFieldLabel — the drawn field words (:855-857)', () => {
  it('reads "1 Jul 2026" from a canonical day', () => {
    expect(customFieldLabel('2026-07-01')).toBe('1 Jul 2026');
  });
});

describe('rangeSub for custom — the drawn cross-month words (:2693, fork 8)', () => {
  it('custom falls into the week/month branch: "1 Jul – 12 Aug"', () => {
    expect(rangeSub({ from: '2026-07-01', to: '2026-08-12' }, 'custom')).toBe('1 Jul – 12 Aug');
  });
});

describe('Milo macro rows + commentary (Run B #3)', () => {
  const baseToday = {
    calories: 1630,
    protein_g: 70,
    carbs_g: 191,
    fat_g: 63,
    entries: 3,
    meal_times: [],
    targets: { calories: 1700, protein_g: 130, carbs_g: 190, fat_g: 60 },
  };

  it('shows value / target and a progress bar for each macro', () => {
    const rows = miloMacroRows(baseToday as Parameters<typeof miloMacroRows>[0]);
    expect(rows.map((r) => ({ label: r.label, value: r.value, target: r.target, pct: r.pct }))).toEqual([
      { label: 'Energy', value: 1630, target: 1700, pct: 96 },
      { label: 'Protein', value: 70, target: 130, pct: 54 },
      { label: 'Carbs', value: 191, target: 190, pct: 100 },
      { label: 'Fat', value: 63, target: 60, pct: 100 },
    ]);
  });

  it('flags under, over and on-target with icons/colours', () => {
    const rows = miloMacroRows(baseToday as Parameters<typeof miloMacroRows>[0]);
    expect(rows.map((r) => r.stateIcon)).toEqual(['arrow_downward', 'arrow_downward', 'task_alt', 'arrow_upward']);
    expect(rows.map((r) => r.stateColor)).toEqual(['textSecondary', 'textSecondary', 'success', 'warning']);
  });

  it('returns "No target" state when targets are absent', () => {
    const noTargets = { ...baseToday, targets: undefined };
    const rows = miloMacroRows(noTargets as Parameters<typeof miloMacroRows>[0]);
    expect(rows.every((r) => r.target === null && r.stateIcon === 'task_alt')).toBe(true);
  });

  it('composes a note that names the biggest gap and any overshoots', () => {
    expect(miloMacroNote(baseToday as Parameters<typeof miloMacroNote>[0])).toBe(
      'Protein is the gap — 60 g short. Fat ran 3 g over.',
    );
  });

  it('notes when everything is on target', () => {
    const onTarget = { ...baseToday, calories: 1700, protein_g: 130, carbs_g: 190, fat_g: 60 };
    expect(miloMacroNote(onTarget as Parameters<typeof miloMacroNote>[0])).toBe('Everything is on target today.');
  });
});

// Founder ruling, 5 Sep 2026. The same table the server pins in
// copy/numbers.test.ts — two packages, one voice, and a drift between them
// shows up here as a failure rather than as two subtly different neighbours.
describe('counts in a sentence', () => {
  it('spells one to ten and stops there', () => {
    expect([0, 1, 4, 10].map(countWord)).toEqual(['zero', 'one', 'four', 'ten']);
    expect(countWord(11)).toBe('11');
    expect(countWord(14)).toBe('14');
  });

  it('leaves anything that is not a plain whole count alone', () => {
    expect(countWord(2.5)).toBe('2.5');
    expect(countWord(-1)).toBe('-1');
  });
});

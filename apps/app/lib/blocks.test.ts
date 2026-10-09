// lib/blocks.ts — plan §9: narrowing per kind, unknown-kind drop,
// malformed-block resilience. PURE module, node environment.
import { describe, expect, it } from 'vitest';
import { parseBlock, parseBlocks } from './blocks';

describe('parseBlock — one per kind, server-shaped (apps/server/src/blocks.ts)', () => {
  it('narrows entry_card', () => {
    expect(
      parseBlock({
        kind: 'entry_card',
        neighbour: 'penny',
        entry_id: 'e1',
        entry_kind: 'expense',
        title: 'Cold Storage',
        chips: ['evidence'],
        honesty: 'estimate',
      }),
    ).toEqual({
      kind: 'entry_card',
      neighbour: 'penny',
      entryId: 'e1',
      entryKind: 'expense',
      title: 'Cold Storage',
      chips: ['evidence'],
      honesty: 'estimate',
    });
  });

  it('narrows entry_card with null title/honesty and empty chips', () => {
    expect(
      parseBlock({
        kind: 'entry_card',
        neighbour: 'milo',
        entry_id: 'e2',
        entry_kind: 'meal',
        title: null,
        chips: [],
        honesty: null,
      }),
    ).toEqual({
      kind: 'entry_card',
      neighbour: 'milo',
      entryId: 'e2',
      entryKind: 'meal',
      title: null,
      chips: [],
      honesty: null,
    });
  });

  it('narrows task_actions', () => {
    expect(parseBlock({ kind: 'task_actions', task_id: 't1', labels: ['Yes, do that', 'Keep asking'] })).toEqual({
      kind: 'task_actions',
      taskId: 't1',
      labels: ['Yes, do that', 'Keep asking'],
    });
  });

  it('narrows undo', () => {
    expect(parseBlock({ kind: 'undo', task_id: 't9' })).toEqual({ kind: 'undo', taskId: 't9' });
  });

  it('narrows visitor', () => {
    expect(parseBlock({ kind: 'visitor', from: 'ollie' })).toEqual({ kind: 'visitor', from: 'ollie' });
  });

  it('narrows queue_note (app slice 3, server-shaped: apps/server/src/blocks.ts)', () => {
    expect(parseBlock({ kind: 'queue_note', read_today: 5, waiting: 4 })).toEqual({
      kind: 'queue_note',
      readToday: 5,
      waiting: 4,
    });
  });

  it('narrows coins, including the DRAFT null amount', () => {
    expect(parseBlock({ kind: 'coins', amount: 25, label: 'first filing' })).toEqual({
      kind: 'coins',
      amount: 25,
      label: 'first filing',
    });
    expect(parseBlock({ kind: 'coins', amount: null, label: 'Coins added' })).toEqual({
      kind: 'coins',
      amount: null,
      label: 'Coins added',
    });
  });

  it('narrows page and draft', () => {
    expect(parseBlock({ kind: 'page', title: null, dateline: '2026-08-25' })).toEqual({
      kind: 'page',
      title: null,
      dateline: '2026-08-25',
    });
    expect(parseBlock({ kind: 'draft', title: 'Next week', dateline: '2026-W34' })).toEqual({
      kind: 'draft',
      title: 'Next week',
      dateline: '2026-W34',
    });
  });

  it('narrows objective_table, old null as-built', () => {
    expect(
      parseBlock({
        kind: 'objective_table',
        old: null,
        new: { calories: 2350, protein_g: 110 },
        working: 'Resting burn 1,650…',
      }),
    ).toEqual({
      kind: 'objective_table',
      old: null,
      new: { calories: 2350, protein_g: 110 },
      working: 'Resting burn 1,650…',
    });
  });
});

describe('parseBlock — unknown kinds and malformed shapes drop silently', () => {
  it('drops unknown kinds (forward-compatible)', () => {
    expect(parseBlock({ kind: 'confetti', amount: 99 })).toBeNull();
    expect(parseBlock({ kind: 'rating_card' })).toBeNull();
  });

  it('drops non-records and missing/extra-typed fields', () => {
    expect(parseBlock(null)).toBeNull();
    expect(parseBlock('entry_card')).toBeNull();
    expect(parseBlock(42)).toBeNull();
    expect(parseBlock(['entry_card'])).toBeNull();
    expect(parseBlock({ kind: 'undo' })).toBeNull(); // no task_id
    expect(parseBlock({ kind: 'task_actions', task_id: 't1', labels: [] })).toBeNull(); // no labels
    expect(parseBlock({ kind: 'task_actions', task_id: 't1', labels: ['ok', 3] })).toBeNull();
    expect(parseBlock({ kind: 'coins', amount: '25', label: 'x' })).toBeNull(); // amount not a number
    expect(parseBlock({ kind: 'page', title: 'x' })).toBeNull(); // no dateline
    expect(
      parseBlock({ kind: 'entry_card', neighbour: 'penny', entry_id: 'e1', entry_kind: 'expense' }),
    ).toBeNull(); // no title/chips fields at all
    expect(parseBlock({ kind: 'visitor', from: 7 })).toBeNull();
    expect(parseBlock({ kind: 'queue_note', read_today: '5', waiting: 4 })).toBeNull(); // not a number
    expect(parseBlock({ kind: 'queue_note', read_today: 5 })).toBeNull(); // no waiting
    expect(parseBlock({ kind: 'objective_table', old: 'x', new: null, working: null })).toBeNull();
  });
});

describe('parseBlocks — the message payload', () => {
  it('passes null and non-arrays through as no blocks', () => {
    expect(parseBlocks(null)).toEqual([]);
    expect(parseBlocks(undefined)).toEqual([]);
    expect(parseBlocks({ kind: 'undo', task_id: 't1' })).toEqual([]);
    expect(parseBlocks('[]')).toEqual([]);
  });

  it('keeps the good, drops the bad, preserves order', () => {
    expect(
      parseBlocks([
        { kind: 'confetti' },
        { kind: 'visitor', from: 'ollie' },
        { kind: 'undo' },
        { kind: 'coins', amount: null, label: 'Coins added' },
      ]),
    ).toEqual([
      { kind: 'visitor', from: 'ollie' },
      { kind: 'coins', amount: null, label: 'Coins added' },
    ]);
  });
});

describe('chips block (#50 + the small-chips bucket)', () => {
  it('parses semantic tokens', () => {
    expect(parseBlock({ kind: 'chips', tokens: ['linked_automatically', 'settings_link_plates'] })).toEqual({
      kind: 'chips',
      tokens: ['linked_automatically', 'settings_link_plates'],
    });
  });

  it('an empty or malformed chips block drops, like any other', () => {
    expect(parseBlock({ kind: 'chips', tokens: [] })).toBeNull();
    expect(parseBlock({ kind: 'chips' })).toBeNull();
    expect(parseBlock({ kind: 'chips', tokens: 'nope' })).toBeNull();
  });

  it('an UNKNOWN token still parses — the server may ship ahead of the app', () => {
    // parseBlock keeps the token; MessageChips is what declines to render it,
    // so a new chip never breaks an old client.
    expect(parseBlock({ kind: 'chips', tokens: ['not_a_chip_yet'] })).toEqual({
      kind: 'chips',
      tokens: ['not_a_chip_yet'],
    });
  });
});

describe('first-run move-in picker', () => {
  it('accepts only the three P0 move-in choices in server order', () => {
    expect(parseBlock({ kind: 'move_in_picker', neighbours: ['penny', 'mira', 'milo'] })).toEqual({
      kind: 'move_in_picker',
      neighbours: ['penny', 'mira', 'milo'],
    });
    expect(parseBlock({ kind: 'move_in_picker', neighbours: ['penny', 'tally'] })).toBeNull();
  });

  it('accepts a SINGLE neighbour — Ollie offers one empty room, never the whole street (internal-reference)', () => {
    // The first-run picker carries all three, and the parser grew up assuming
    // exactly that. An empty-room address (internal-reference) rides ONE name — the
    // neighbour Ollie just sold — and the length-3 check dropped the block
    // silently, so his offer had no button. Verified on the emulator: the
    // reply rendered, the invite did not.
    expect(parseBlock({ kind: 'move_in_picker', neighbours: ['penny'] })).toEqual({
      kind: 'move_in_picker',
      neighbours: ['penny'],
    });
    // …but the constraints that are not about count still hold.
    expect(parseBlock({ kind: 'move_in_picker', neighbours: [] })).toBeNull();
    expect(parseBlock({ kind: 'move_in_picker', neighbours: ['penny', 'penny'] })).toBeNull();
    expect(parseBlock({ kind: 'move_in_picker', neighbours: ['tally'] })).toBeNull();
  });
});

describe('category_pill block (#23 — tap the category)', () => {
  it('parses the merchant and the current category', () => {
    expect(parseBlock({ kind: 'category_pill', merchant: 'FairPrice', category: 'Groceries' })).toEqual({
      kind: 'category_pill',
      merchant: 'FairPrice',
      category: 'Groceries',
    });
  });

  it('drops when either half is missing — a pill that cannot name the merchant is useless', () => {
    expect(parseBlock({ kind: 'category_pill', merchant: 'FairPrice' })).toBeNull();
    expect(parseBlock({ kind: 'category_pill', category: 'Groceries' })).toBeNull();
    expect(parseBlock({ kind: 'category_pill', merchant: '', category: 'Groceries' })).toBeNull();
  });
});

describe('W5 — the structured answers', () => {
  const pace = {
    kind: 'pace_mark',
    spent: 1240,
    budget: 1800,
    currency: 'SGD',
    days_left: 9,
    per_day_left: 62.22,
    spent_pct: 68.89,
    expected_pct: 70,
  };

  it('pace_mark carries the two percentages the bar and its mark are drawn from', () => {
    expect(parseBlock(pace)).toEqual(pace);
  });

  it('pace_mark drops when ANY figure is missing — a half-drawn bar would mislead', () => {
    for (const key of ['spent', 'budget', 'days_left', 'per_day_left', 'spent_pct', 'expected_pct']) {
      const broken: Record<string, unknown> = { ...pace };
      delete broken[key];
      expect(parseBlock(broken)).toBeNull();
    }
    expect(parseBlock({ ...pace, currency: '' })).toBeNull();
    // a STRING number is not a number — the server computes, the app draws
    expect(parseBlock({ ...pace, spent: '1240' })).toBeNull();
  });

  it('spend_table keeps row order as the server sent it — the server decides rank, not the app', () => {
    const block = {
      kind: 'spend_table',
      label: '4–10 Aug',
      currency: 'SGD',
      rows: [
        { category: 'Groceries', total: 96 },
        { category: 'Eating out', total: 60.2 },
      ],
      total: 156.2,
    };
    expect(parseBlock(block)).toEqual(block);
  });

  it('spend_table drops on a malformed row — never renders a partial table', () => {
    const base = { kind: 'spend_table', label: '4–10 Aug', currency: 'SGD', total: 96 };
    expect(parseBlock({ ...base, rows: [{ category: 'Groceries' }] })).toBeNull();
    expect(parseBlock({ ...base, rows: [{ total: 96 }] })).toBeNull();
    expect(parseBlock({ ...base, rows: 'Groceries 96' })).toBeNull();
  });

  it('day_close: the verdict is a WORD from a closed set — never a colour (C15/C54)', () => {
    const block = {
      kind: 'day_close',
      rows: [
        { label: 'Calories', value: 1644, target: 1700, unit: '', verdict: 'on_target' },
        { label: 'Protein', value: 67, target: 150, unit: 'g', verdict: 'short' },
      ],
    };
    expect(parseBlock(block)).toEqual(block);
    // anything outside the set is refused rather than guessed at
    expect(
      parseBlock({ kind: 'day_close', rows: [{ label: 'Calories', value: 1, target: 2, unit: '', verdict: 'red' }] }),
    ).toBeNull();
  });

  it('day_close with no rows is nothing to say — it drops rather than draw an empty close-out', () => {
    expect(parseBlock({ kind: 'day_close', rows: [] })).toBeNull();
  });

  it('receipt_detail carries the filed receipt facts', () => {
    const block = {
      kind: 'receipt_detail',
      entry_id: 'e-r1',
      merchant: 'Cold Storage',
      category: 'Groceries',
      amount: 87.45,
      currency: 'SGD',
      at: '2026-09-01T10:30:00.000Z',
      date: '2026-09-01',
      items_total: 82.45,
      printed_total: 87.45,
      line_items: [
        { name: 'Milk', quantity: 2, unit_price: 3.5, amount: 7 },
        { name: 'Bread', quantity: null, unit_price: null, amount: 2.5 },
      ],
      question: 'Anything missing?',
    };
    expect(parseBlock(block)).toEqual({
      kind: 'receipt_detail',
      chips: [],
      honesty: null,
      entryId: 'e-r1',
      merchant: 'Cold Storage',
      category: 'Groceries',
      amount: 87.45,
      currency: 'SGD',
      at: '2026-09-01T10:30:00.000Z',
      date: '2026-09-01',
      itemsTotal: 82.45,
      printedTotal: 87.45,
      lineItems: [
        { name: 'Milk', quantity: 2, unitPrice: 3.5, amount: 7 },
        { name: 'Bread', quantity: null, unitPrice: null, amount: 2.5 },
      ],
      question: 'Anything missing?',
    });
  });

  it('receipt_detail preserves Yuu tender evidence, printed gross, net and included GST', () => {
    const parsed = parseBlock({ kind: 'receipt_detail', entry_id: 'yuu', merchant: 'Shop',
      amount: 9.53, currency: 'SGD', at: '2026-09-16T10:00:00Z', printed_total: 17.05,
      gross_amount: 17.05, redeemed_amount: 7.52,
      payments: [{ kind: 'loyalty_redemption', label: 'Yuu redemption', amount: 7.52 },
        { kind: 'card', label: 'Card', amount: 9.53 }],
      adjustments: [{ kind: 'tax', label: 'GST', amount: 1.41, included_in_items: true }],
    });
    expect(parsed).toMatchObject({ amount: 9.53, printedTotal: 17.05, grossAmount: 17.05, redeemedAmount: 7.52,
      payments: [{ kind: 'loyalty_redemption', label: 'Yuu redemption', amount: 7.52 },
        { kind: 'card', label: 'Card', amount: 9.53 }],
      adjustments: [{ kind: 'tax', label: 'GST', amount: 1.41, includedInItems: true }],
    });
  });

  it('receipt_detail retains unreadable tender amounts and refuses malformed breakdowns', () => {
    const base = { kind: 'receipt_detail', entry_id: 'yuu', amount: 0, currency: 'SGD', at: '2026-09-16T10:00:00Z' };
    expect(parseBlock({ ...base, payments: [{ kind: 'card', label: null, amount: null }],
      gross_amount: 0, redeemed_amount: 0 })).toMatchObject({ amount: 0, grossAmount: 0, redeemedAmount: 0,
      payments: [{ kind: 'card', label: null, amount: null }] });
    expect(parseBlock({ ...base, payments: [{ kind: 'points_balance', label: 'Balance', amount: 500 }] }))
      .toMatchObject({ payments: null });
    expect(parseBlock({ ...base, payments: [{ kind: 'card', label: 'Card', amount: -1 }] }))
      .toMatchObject({ payments: null });
    expect(parseBlock({ ...base, adjustments: [{ kind: 'tax', amount: Number.NaN }] }))
      .toMatchObject({ adjustments: null });
  });

  it('receipt_detail tolerates absent optional fields', () => {
    expect(
      parseBlock({
        kind: 'receipt_detail',
        entry_id: 'e-r2',
        merchant: null,
        category: null,
        amount: 12,
        currency: 'SGD',
        at: '2026-09-01T10:30:00.000Z',
        date: null,
        items_total: null,
        printed_total: null,
        line_items: null,
        question: null,
      }),
    ).toMatchObject({
      kind: 'receipt_detail',
      entryId: 'e-r2',
      merchant: null,
      category: null,
      amount: 12,
      currency: 'SGD',
      lineItems: null,
    });
  });

  it('receipt_detail drops malformed line items rather than showing a partial receipt', () => {
    const base = {
      kind: 'receipt_detail',
      entry_id: 'e-r3',
      merchant: 'X',
      category: null,
      amount: 10,
      currency: 'SGD',
      at: '2026-09-01T10:30:00.000Z',
      date: null,
      items_total: null,
      printed_total: null,
      question: null,
    };
    expect(parseBlock({ ...base, line_items: [{ name: 'Y', amount: 5 }] })).toMatchObject({
      lineItems: [{ name: 'Y', amount: 5 }],
    });
    expect(parseBlock({ ...base, line_items: [{ name: 'Y' }] })).toMatchObject({ lineItems: null });
  });

  it('meal_detail carries the filed meal facts and macros', () => {
    const block = {
      kind: 'meal_detail',
      entry_id: 'e-m1',
      dish: 'Char kway teow',
      portion: '~1 plate, ~350g',
      calories: 710,
      protein_g: 18,
      carbs_g: 92,
      fat_g: 28,
      rating: 4,
      rating_why: 'A filling plate, mostly carbs and oil.',
      at: '2026-09-01T12:30:00.000Z',
      question: null,
    };
    expect(parseBlock(block)).toEqual({
      kind: 'meal_detail',
      chips: [],
      honesty: null,
      entryId: 'e-m1',
      dish: 'Char kway teow',
      portion: '~1 plate, ~350g',
      calories: 710,
      protein_g: 18,
      carbs_g: 92,
      fat_g: 28,
      rating: 4,
      rating_why: 'A filling plate, mostly carbs and oil.',
      at: '2026-09-01T12:30:00.000Z',
      question: null,
    });
  });

  it('meal_detail tolerates missing macros and asks for them', () => {
    expect(
      parseBlock({
        kind: 'meal_detail',
        entry_id: 'e-m2',
        dish: 'Laksa',
        portion: null,
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        rating: null,
        rating_why: null,
        at: '2026-09-01T12:30:00.000Z',
        question: 'What was in it, and how big was the portion?',
      }),
    ).toMatchObject({
      kind: 'meal_detail',
      entryId: 'e-m2',
      dish: 'Laksa',
      calories: null,
      question: 'What was in it, and how big was the portion?',
    });
  });

  it('meal_detail drops when the required facts are missing', () => {
    const base = {
      kind: 'meal_detail',
      dish: 'Char kway teow',
      portion: null,
      calories: 710,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      rating: null,
      rating_why: null,
      question: null,
    };
    expect(parseBlock({ ...base, entry_id: undefined, at: '2026-09-01T12:30:00.000Z' })).toBeNull();
    expect(parseBlock({ ...base, entry_id: 'e-m3', at: undefined })).toBeNull();
    expect(parseBlock({ ...base, entry_id: 'e-m3', at: '2026-09-01T12:30:00.000Z', dish: 7 })).toBeNull();
  });
});

describe('C85 — the cost chips (#13)', () => {
  it('carries the numbers the server computed', () => {
    expect(parseBlock({ kind: 'cost_chips', credits: 3, photos: 3, entries: 1 })).toEqual({
      kind: 'cost_chips',
      credits: 3,
      photos: 3,
      entries: 1,
    });
  });

  it('entries defaults to one — a sectioned receipt is always ONE entry', () => {
    expect(parseBlock({ kind: 'cost_chips', credits: 2, photos: 2 })).toMatchObject({ entries: 1 });
  });

  it('a cost with no number is not a cost — it drops rather than render a blank', () => {
    expect(parseBlock({ kind: 'cost_chips', photos: 3 })).toBeNull();
    expect(parseBlock({ kind: 'cost_chips', credits: 3 })).toBeNull();
    expect(parseBlock({ kind: 'cost_chips', credits: 0, photos: 3 })).toBeNull();
    expect(parseBlock({ kind: 'cost_chips', credits: '3', photos: 3 })).toBeNull();
  });
});

describe('#70 — the referenced entry inside an ask', () => {
  const full = {
    kind: 'referenced_entry',
    photo_id: 'p-1',
    filed_by: 'penny',
    title: 'Maxwell',
    amount: 8.4,
    currency: 'S$',
    at: '2026-08-28T11:14:00.000Z',
  };

  it('narrows the whole row', () => {
    expect(parseBlock(full)).toEqual({
      kind: 'referenced_entry',
      photoId: 'p-1',
      filedBy: 'penny',
      title: 'Maxwell',
      amount: 8.4,
      currency: 'S$',
      at: '2026-08-28T11:14:00.000Z',
    });
  });

  it('every fact except WHO is optional — the row states what is known', () => {
    // A receipt with no merchant read, or an entry with no photo behind it,
    // still tells the user who filed it and when. Padding the gaps with
    // placeholder text would be inventing a record.
    expect(parseBlock({ kind: 'referenced_entry', filed_by: 'penny', photo_id: null, title: null, amount: null, currency: null, at: null })).toEqual({
      kind: 'referenced_entry',
      photoId: null,
      filedBy: 'penny',
      title: null,
      amount: null,
      currency: null,
      at: null,
    });
  });

  it('drops when the filer is missing or a field is the wrong type', () => {
    expect(parseBlock({ ...full, filed_by: undefined })).toBeNull();
    expect(parseBlock({ ...full, amount: '8.40' })).toBeNull();
    expect(parseBlock({ ...full, at: 1 })).toBeNull();
  });
});

describe("C95 — the reflection's feeling rides its page", () => {
  it('carries the emotion when the server counted one', () => {
    expect(parseBlock({ kind: 'page', title: null, dateline: '2026-08-28', emotion: 'good' })).toEqual({
      kind: 'page',
      title: null,
      dateline: '2026-08-28',
      emotion: 'good',
    });
  });

  it('a day with nothing readable carries null — a real answer, not a missing one', () => {
    expect(parseBlock({ kind: 'page', title: null, dateline: '2026-08-28', emotion: null })).toMatchObject({
      emotion: null,
    });
  });

  it('a page from before C95 has no emotion key at all, and still parses', () => {
    // Blocks are stored, never re-derived: every reflection written before
    // today is emotion-less forever, and it must not drop off the thread.
    expect(parseBlock({ kind: 'page', title: null, dateline: '2026-08-25' })).toEqual({
      kind: 'page',
      title: null,
      dateline: '2026-08-25',
    });
  });
});


describe('Run C #71 — the reverse lookup (receipt_plates)', () => {
  // The exact §1.3 wire JSON: Penny's answer to "show me the food photos for
  // the maxwell bill", one plate linked by Milo.
  const wire = {
    kind: 'receipt_plates',
    receipt_photo_id: 'rp-1',
    receipt_entry_id: 're-1',
    filed_by: 'milo',
    plates: [
      {
        photo_id: 'pp-1',
        entry_id: 'pe-1',
        dish: 'Char kway teow',
        calories: 710,
        at: '2026-08-11T12:04:00Z',
      },
    ],
  };

  it('narrows the wire JSON — snake_case in, camelCase out', () => {
    expect(parseBlock(wire)).toEqual({
      kind: 'receipt_plates',
      receiptPhotoId: 'rp-1',
      receiptEntryId: 're-1',
      filedBy: 'milo',
      plates: [
        {
          photoId: 'pp-1',
          entryId: 'pe-1',
          dish: 'Char kway teow',
          calories: 710,
          at: '2026-08-11T12:04:00Z',
        },
      ],
    });
  });

  it('null dish/calories are preserved — the row states what is known, never pads', () => {
    expect(
      parseBlock({
        ...wire,
        plates: [{ photo_id: 'pp-2', entry_id: 'pe-2', dish: null, calories: null, at: '2026-08-11T12:04:00Z' }],
      }),
    ).toEqual({
      kind: 'receipt_plates',
      receiptPhotoId: 'rp-1',
      receiptEntryId: 're-1',
      filedBy: 'milo',
      plates: [{ photoId: 'pp-2', entryId: 'pe-2', dish: null, calories: null, at: '2026-08-11T12:04:00Z' }],
    });
  });

  it('malformed drops silently, and parseBlocks still yields the sibling blocks', () => {
    const malformed = [
      { ...wire, plates: 'Char kway teow' }, // plates not an array
      { ...wire, plates: [{ photo_id: 'pp-1', dish: null, calories: null, at: '2026-08-11T12:04:00Z' }] }, // row missing entry_id
      { ...wire, plates: [] }, // empty plates — nothing to draw
      { kind: 'receipt_plates', receipt_photo_id: 'rp-1', filed_by: 'milo', plates: wire.plates }, // missing receipt_entry_id
    ];
    for (const bad of malformed) {
      expect(parseBlock(bad)).toBeNull();
      // the block decorates, never replaces: siblings survive the drop
      expect(parseBlocks([bad, { kind: 'visitor', from: 'ollie' }])).toEqual([
        { kind: 'visitor', from: 'ollie' },
      ]);
    }
  });
});

// #62/#63 (PAR-C62/C63) — the server picks ONE card, and `chips`/`honesty`
// lived only on the entry-card branch. A receipt-only meal, the exact case #62
// draws, therefore showed no estimate strip and no evidence chip: not missing,
// unreachable. Both detail cards now carry the same two fields, so the user
// never has to know which branch the server took.
describe('detail cards carry the entry card\'s honesty', () => {
  it('parses chips and honesty on a meal_detail', () => {
    expect(
      parseBlock({
        kind: 'meal_detail',
        entry_id: 'e1',
        dish: 'char kway teow',
        portion: null,
        calories: 620,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        rating: null,
        rating_why: null,
        at: '2026-09-05T00:00:00Z',
        question: null,
        chips: ['evidence'],
        honesty: 'estimate',
      }),
    ).toMatchObject({ kind: 'meal_detail', chips: ['evidence'], honesty: 'estimate' });
  });

  it('defaults to no chips and no honesty when the server sends neither', () => {
    expect(
      parseBlock({
        kind: 'meal_detail',
        entry_id: 'e1',
        dish: 'toast',
        portion: null,
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        rating: null,
        rating_why: null,
        at: '2026-09-05T00:00:00Z',
        question: null,
      }),
    ).toMatchObject({ chips: [], honesty: null });
  });

  it('ignores an honesty value it does not know, rather than passing it through', () => {
    const b = parseBlock({
      kind: 'receipt_detail',
      entry_id: 'e2',
      merchant: 'FairPrice',
      category: 'Groceries',
      amount: 12.5,
      currency: 'SGD',
      at: '2026-09-05T00:00:00Z',
      date: null,
      items_total: null,
      printed_total: null,
      line_items: null,
      question: null,
      honesty: 'wildly-unsure',
    });
    expect(b).toMatchObject({ kind: 'receipt_detail', honesty: null });
  });
});

// z8v0kmrnvj: persisted cards also pass through this parser.
it.each(['memory', 'meal', 'body'])('does not describe a %s as missing a receipt', entryKind => {
  const block = parseBlock({ kind: 'entry_card', neighbour: entryKind === 'memory' ? 'mira' : 'milo', entry_id: 'entry', entry_kind: entryKind, title: null, chips: ['no_receipt', 'own_photo'], honesty: null });
  expect(block).toMatchObject({ chips: ['own_photo'] });
});
it('retains missing-receipt provenance for an expense', () => {
  expect(parseBlock({ kind: 'entry_card', neighbour: 'penny', entry_id: 'expense', entry_kind: 'expense', title: null, chips: ['no_receipt'], honesty: null })).toMatchObject({ chips: ['no_receipt'] });
});

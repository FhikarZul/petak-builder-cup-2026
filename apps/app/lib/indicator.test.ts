// lib/indicator.ts + the #78 sentence map — plan §9: line ordering and the
// timing constants. PURE module, node environment.
import { describe, expect, it } from 'vitest';
import { DOT_STAGGER_TICKS, INDICATOR_MIN_VISIBLE_MS, INDICATOR_START_PHASE, remainingHold, INDICATOR_CYCLE_MS, INDICATOR_INDENT_PX, INDICATOR_PHASES, INDICATOR_TICK_MS, indicatorFrame, indicatorRowOrder, noteSendEnd, noteSendStart, ordinalOf, photoRoutingLine, type WorkingNeighbour } from './indicator';
import { activityLine } from './neighbours';

describe('the 1.05s step cycle (#78)', () => {
  it('pins the timing constants — no easing, discrete steps only', () => {
    expect(INDICATOR_CYCLE_MS).toBe(1050);
    expect(INDICATOR_TICK_MS).toBe(175);
    expect(INDICATOR_PHASES).toBe(6);
    expect(INDICATOR_PHASES * INDICATOR_TICK_MS).toBe(INDICATOR_CYCLE_MS);
    expect(DOT_STAGGER_TICKS * INDICATOR_TICK_MS).toBe(350); // the dot stagger
    expect(INDICATOR_INDENT_PX).toBe(40); // the bubble column
  });

  it('the pane is dim for the first half of its cycle, lit for the second', () => {
    const lit = [0, 1, 2, 3, 4, 5].map((p) => indicatorFrame(p).paneLit);
    expect(lit).toEqual([false, false, false, true, true, true]);
  });

  it('the dots chase 350ms apart, each lit for its own second half', () => {
    const dots = [0, 1, 2, 3, 4, 5].map((p) => indicatorFrame(p).dots);
    expect(dots).toEqual([
      [false, true, false], // phase 0
      [false, true, true], // phase 1
      [false, false, true], // phase 2
      [true, false, true], // phase 3
      [true, false, false], // phase 4
      [true, true, false], // phase 5
    ]);
  });

  it('wraps the cycle (and tolerates negative phases)', () => {
    expect(indicatorFrame(6)).toEqual(indicatorFrame(0));
    expect(indicatorFrame(1051)).toEqual(indicatorFrame(1));
    expect(indicatorFrame(-1)).toEqual(indicatorFrame(5));
  });
});

describe('one line per working neighbour, start order', () => {
  it('appends in start order and folds repeat sends into the one line', () => {
    let w: WorkingNeighbour[] = [];
    w = noteSendStart(w, 'penny', 'text', 100);
    w = noteSendStart(w, 'milo', 'text', 200);
    w = noteSendStart(w, 'penny', 'text', 300);
    expect(w.map((x) => x.id)).toEqual(['penny', 'milo']);
    expect(w[0]).toMatchObject({ id: 'penny', startedAt: 100, count: 2 });
  });

  it('the line leaves only when its last send has', () => {
    let w: WorkingNeighbour[] = [];
    w = noteSendStart(w, 'penny', 'text', 100);
    w = noteSendStart(w, 'penny', 'text', 200);
    w = noteSendEnd(w, 'penny');
    expect(w).toHaveLength(1);
    w = noteSendEnd(w, 'penny');
    expect(w).toHaveLength(0);
  });

  it('inverted-list order: the lines read in start order top-to-bottom', () => {
    let w: WorkingNeighbour[] = [];
    w = noteSendStart(w, 'penny', 'text', 100);
    w = noteSendStart(w, 'milo', 'text', 200);
    expect(indicatorRowOrder(w).map((x) => x.id)).toEqual(['milo', 'penny']);
  });
});

describe('the #78 sentence patterns (plan §8)', () => {
  it('maps the slice-1 verbs on, dots drawn never typed', () => {
    expect(activityLine('mira', 'text')).toBe("Mira's writing");
    expect(activityLine('penny', 'photo')).toBe("Penny's reading the photo");
    expect(activityLine('mira', 'lookup')).toBe("Mira's looking");
    for (const line of [activityLine('mira', 'text'), activityLine('penny', 'photo')]) {
      expect(line).not.toContain('…');
      expect(line).not.toContain('...');
    }
  });

  it('"Ollie\'s finding the right neighbour" ships as drawn (flagged conflict)', () => {
    expect(activityLine('ollie', 'route')).toBe("Ollie's finding the right neighbour");
  });
});

describe('photoRoutingLine — aware of the work, without Ollie narrating (2 Sep 2026)', () => {
  const sent = { state: 'sent' };
  const picked = { state: 'picked' };
  const failed = { state: 'failed' };

  it('a filed photo waiting on extraction shows Ollie finding the right neighbour', () => {
    const line = photoRoutingLine([sent], false, 1000);
    expect(line).toEqual({ id: 'ollie', kind: 'route', startedAt: 1000, count: 1, total: 1 });
  });

  it('a photo still uploading (picked) or failed shows nothing — waiting is not working', () => {
    expect(photoRoutingLine([picked], false, 1000)).toBeNull();
    expect(photoRoutingLine([failed], false, 1000)).toBeNull();
  });

  it('never duplicates a route line a text send already opened', () => {
    expect(photoRoutingLine([sent], true, 1000)).toBeNull();
  });

  it('gone the moment no sent photo remains (the server twin reconciled it)', () => {
    expect(photoRoutingLine([], false, 1000)).toBeNull();
  });
});

// Run C #78 draws "Penny's reading the fifth one" and the founder ruled 4 Sep
// that the ordinal is the half worth building: it makes a nine-photo batch feel
// alive and, unlike "reading the receipt", it needs no read — so C66 is
// satisfied. The drawn sentences that NAME a photo's contents stay unbuilt.
describe('the ordinal (#78)', () => {
  it('counts which send is in hand, not how many are left', () => {
    // Nine photos to Penny: total stays 9, count falls as each settles.
    let list = [] as ReturnType<typeof noteSendStart>;
    for (let i = 0; i < 9; i += 1) list = noteSendStart(list, 'penny', 'photo', 1000 + i);
    expect(list[0].total).toBe(9);
    expect(ordinalOf(list[0])).toBe(1);

    for (let i = 0; i < 4; i += 1) list = noteSendEnd(list, 'penny');
    expect(list[0].count).toBe(5);
    expect(ordinalOf(list[0])).toBe(5); // "the fifth one"
  });

  it('names the ordinal only when more than one was sent', () => {
    expect(activityLine('penny', 'photo', 1)).toBe("Penny's reading the photo");
    expect(activityLine('penny', 'photo', 5)).toBe("Penny's reading the fifth one");
    expect(activityLine('penny', 'photo')).toBe("Penny's reading the photo");
  });

  it('spells the ordinal out, and stays legible past ten', () => {
    expect(activityLine('penny', 'photo', 2)).toBe("Penny's reading the second one");
    expect(activityLine('penny', 'photo', 10)).toBe("Penny's reading the tenth one");
    expect(activityLine('penny', 'photo', 11)).toBe("Penny's reading the 11th one");
    expect(activityLine('penny', 'photo', 23)).toBe("Penny's reading the 23rd one");
  });

  // C66: the ordinal rides only the photo line. A lookup or a text turn has no
  // "one" to be the nth of.
  it('never puts an ordinal on a non-photo line', () => {
    expect(activityLine('mira', 'lookup', 5)).toBe("Mira's looking");
    expect(activityLine('mira', 'text', 5)).toBe("Mira's writing");
  });
});


// The founder's 4 Sep two-phase ruling has a second half the ordinal did not
// cover: once intent IS known, the line becomes the responsible neighbour's
// named action — "Milo is counting" rather than a generic read.
//
// Run C #78's sentence list gives verbs for exactly two neighbours: "Penny's
// reading the receipt" and "Milo's counting the plate". The NOUNS are blocked
// by C66 (naming a photo's contents needs the read), the VERBS are not. So the
// verbs ship and the nouns do not, and no verb is invented for anyone the
// drawing does not name.
describe('the named action (#78, second phase)', () => {
  it('gives Milo the drawn verb, not a generic read', () => {
    expect(activityLine('milo', 'photo')).toBe("Milo's counting it");
  });

  it('leaves Penny reading, as drawn', () => {
    expect(activityLine('penny', 'photo')).toBe("Penny's reading the photo");
  });

  // #78 names no photo verb for Mira or Tally. Inventing one would be putting
  // words in a neighbour's mouth that no drawing approved.
  it('invents no verb for a neighbour the drawing does not name', () => {
    expect(activityLine('mira', 'photo')).toBe("Mira's reading the photo");
    expect(activityLine('tally', 'photo')).toBe("Tally's reading the photo");
  });

  // The ordinal is Penny's drawn batch case and outranks the verb: "the fifth
  // one" is the thing that makes a nine-photo wait legible.
  it('keeps the ordinal ahead of the named verb', () => {
    expect(activityLine('milo', 'photo', 5)).toBe("Milo's reading the fifth one");
  });

  it('still routes through Ollie in the first phase', () => {
    expect(activityLine('ollie', 'route')).toBe("Ollie's finding the right neighbour");
  });
});

// Found 4 Sep: re-sending a photo already in the account left "Ollie's finding
// the right neighbour" spinning indefinitely. The duplicate gate short-circuits
// identical bytes straight to 'accepted' — no PUT, no message, no extraction —
// so cardState reports 'sent' while nothing is on its way and nothing ever
// arrives to clear the line.
describe('photoRoutingLine and the duplicate gate', () => {
  it('shows the line for a photo genuinely in flight', () => {
    expect(photoRoutingLine([{ state: 'sent' }], false, 1000)).not.toBeNull();
  });

  it('shows NO line for a byte-duplicate', () => {
    expect(photoRoutingLine([{ state: 'sent', duplicate: true }], false, 1000)).toBeNull();
  });

  it('still shows the line when a real send sits beside a duplicate', () => {
    const r = photoRoutingLine([{ state: 'sent', duplicate: true }, { state: 'sent' }], false, 1000);
    expect(r?.id).toBe('ollie');
  });
});

// z8v0kmqxf6 — the FOURTH report of "I don't see the indicator". Three earlier
// tickets closed on the same symptom by patching call sites. It was never a
// call site.
describe('the line is visible at all', () => {
  it('mounts LIT — phase 0 is the pane at its dimmest', () => {
    // The original mount phase. Half a cycle of near-nothing, on a turn that
    // lasts about one cycle in total.
    expect(indicatorFrame(0).paneLit).toBe(false);
    expect(indicatorFrame(INDICATOR_START_PHASE).paneLit).toBe(true);
  });

  it('the start phase is the FIRST lit step, not just any lit one', () => {
    expect(indicatorFrame(INDICATOR_START_PHASE - 1).paneLit).toBe(false);
  });
});

describe('remainingHold — one full blink, and no longer', () => {
  it('holds the rest of the cycle when the turn was faster', () => {
    expect(remainingHold(1_000, 1_000)).toBe(INDICATOR_MIN_VISIBLE_MS);
    expect(remainingHold(1_000, 1_000 + 300)).toBe(INDICATOR_MIN_VISIBLE_MS - 300);
  });

  it('holds nothing once a full cycle has already passed', () => {
    expect(remainingHold(1_000, 1_000 + INDICATOR_MIN_VISIBLE_MS)).toBe(0);
    expect(remainingHold(1_000, 1_000 + 60_000)).toBe(0);
  });

  it('a clock that went backwards holds the full cycle, never a negative wait', () => {
    expect(remainingHold(2_000, 1_000)).toBe(INDICATOR_MIN_VISIBLE_MS);
  });

  it('the floor is exactly one cycle — a longer hold would make the line lie', () => {
    // The line says a neighbour is WORKING. Holding it well past the reply
    // would say that after the answer had already arrived.
    expect(INDICATOR_MIN_VISIBLE_MS).toBe(INDICATOR_CYCLE_MS);
  });
});

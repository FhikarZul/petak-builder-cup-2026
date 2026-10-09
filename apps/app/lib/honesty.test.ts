// lib/honesty.ts — plan §9: the honesty-strip template formatting, the
// trail-derived state, and the sheet's provenance/time lines. PURE module,
// node environment.
import { describe, expect, it } from 'vitest';
import {
  TRAIL_FOOTER,
  objectiveStripText,
  parseServerDate,
  stripFromTrail,
  stripIcon,
  stripText,
  trailSourceLine,
  trailTimeLine,
  trailValueLabel,
  type TrailVersion,
} from './honesty';

describe('parseServerDate — pg-text fallback (the Hermes Invalid Date crash)', () => {
  it('parses ISO 8601 directly', () => {
    expect(parseServerDate('2026-08-30T19:28:34.591Z').toISOString()).toBe('2026-08-30T19:28:34.591Z');
  });

  it('parses Postgres text timestamps Hermes rejects', () => {
    expect(parseServerDate('2026-08-30 19:28:34.591328+00').toISOString()).toBe('2026-08-30T19:28:34.591Z');
    expect(parseServerDate('2026-08-30 19:28:34+00').toISOString()).toBe('2026-08-30T19:28:34.000Z');
  });
});

describe('stripText — the three exact templates (plan §3)', () => {
  it('edited: "Was <old> · edited <time> · <provenance>. Counts now."', () => {
    expect(
      stripText({ state: 'edited', old: '$26.40', time: '18:20', provenance: 'you told me in chat' }),
    ).toBe('Was $26.40 · edited 18:20 · you told me in chat. Counts now.');
  });

  it('estimate: the fixed line, never fielded', () => {
    expect(stripText({ state: 'estimate' })).toBe(
      'Estimated from the bill · a plate photo would settle it. Counts until then.',
    );
  });

  it('refined: "Earlier read <value> · refined by your plate photo. Stays visible, does not count."', () => {
    expect(stripText({ state: 'refined', value: '~620 kcal' })).toBe(
      'Earlier read ~620 kcal · refined by your plate photo. Stays visible, does not count.',
    );
  });

  it('icon per state — icon + text only', () => {
    expect(stripIcon('edited')).toBe('edit_note');
    expect(stripIcon('estimate')).toBe('receipt_long');
    expect(stripIcon('refined')).toBe('history');
  });
});

describe('objectiveStripText — #73 (plan §6)', () => {
  it('names the old objective when the block carries it', () => {
    expect(objectiveStripText('lean out by December', '9:12')).toBe(
      'Objective was lean out by December · changed 9:12, you told me in chat. The old targets stop counting from today, not backwards.',
    );
  });

  it('returns no amendment strip for a first derivation', () => {
    expect(objectiveStripText(null, '9:12')).toBeNull();
  });
});

describe('stripFromTrail — the card derives its state from the versions', () => {
  const v = (id: string, source: TrailVersion['source'], created_at: string, value = {}): TrailVersion => ({
    id,
    source,
    created_at,
    value,
  });

  it('your word over an older version → edited, with the before value', () => {
    expect(
      stripFromTrail(
        [
          v('n', 'you_said', '2026-08-08T18:20:00.000Z'),
          v('o', 'photo_read', '2026-08-08T19:41:00.000Z', { amount: 26.4, currency: 'USD' }),
        ],
        null,
      ),
    ).toEqual({
      state: 'edited',
      old: '$26.40',
      time: expect.stringMatching(/^\d{2}:\d{2}$/),
      provenance: 'you told me in chat',
    });
  });

  it('a photo read over an older version → refined', () => {
    expect(
      stripFromTrail(
        [
          v('n', 'photo_read', '2026-08-08T13:06:00.000Z', { calories: 710 }),
          v('o', 'photo_read', '2026-08-08T12:41:00.000Z', { calories: 620 }),
        ],
        null,
      ),
    ).toEqual({ state: 'refined', value: '620 kcal' });
  });

  it('a lone provisional version → estimate from the block', () => {
    expect(stripFromTrail([v('n', 'photo_read', '2026-08-08T12:41:00.000Z')], 'estimate')).toEqual({
      state: 'estimate',
    });
  });

  it('a lone ordinary version → no strip; an unfetched trail keeps the block hint', () => {
    expect(stripFromTrail([v('n', 'photo_read', '2026-08-08T12:41:00.000Z')], null)).toBeNull();
    expect(stripFromTrail(undefined, 'estimate')).toEqual({ state: 'estimate' });
    expect(stripFromTrail(undefined, null)).toBeNull();
  });
});

describe('the sheet lines (#61)', () => {
  it('footer is the exact line', () => {
    expect(TRAIL_FOOTER).toBe(
      'The photo is kept as it was read. Editing the number never edits the photo.',
    );
  });

  it('provenance per source', () => {
    expect(trailSourceLine('you_said')).toBe('You told me in chat');
    expect(trailSourceLine('photo_read')).toBe('Read from your photo');
  });

  it('time line: today vs a named day', () => {
    const now = new Date(2026, 7, 26, 20, 0); // 26 Aug 2026, local
    const today = new Date(2026, 7, 26, 18, 20).toISOString();
    const earlier = new Date(2026, 7, 8, 19, 41).toISOString();
    expect(trailTimeLine(today, now)).toBe('18:20, today');
    expect(trailTimeLine(earlier, now)).toBe('19:41, Sat 8 Aug');
  });

  it('value labels: money, calories, name, fallback', () => {
    expect(trailValueLabel({ amount: 83.42, currency: 'SGD' })).toBe('S$83.42');
    expect(trailValueLabel({ amount: 62.4, currency: 'USD' })).toBe('$62.40');
    expect(trailValueLabel({ calories: 710 })).toBe('710 kcal');
    expect(trailValueLabel({ metric: 'weight', value: 76, unit: 'kg' })).toBe('76 kg');
    expect(trailValueLabel({ metric: 'body_fat', value: 24, unit: 'percent' })).toBe('24%');
    expect(trailValueLabel({ merchant: 'Cold Storage' })).toBe('Cold Storage');
    expect(trailValueLabel({})).toBe('the earlier read');
  });
});

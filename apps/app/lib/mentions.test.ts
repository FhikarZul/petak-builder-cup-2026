// lib/mentions.ts — plan §9: round-trip, chip parse, picker ordering with
// Ollie pinned. PURE module, node environment.
import { describe, expect, it } from 'vitest';
import { orderPicker, parseSegments, serializePhotoDraft, serializeSegments, type Segment } from './mentions';

describe('mentions serialize/parse round-trip', () => {
  it('round-trips a leading mention plus text', () => {
    const segments: Segment[] = [
      { kind: 'mention', neighbour: 'mira' },
      { kind: 'text', text: ' what did I write in March?' },
    ];
    const wire = serializeSegments(segments);
    expect(wire).toBe('@Mira what did I write in March?');
    expect(parseSegments(wire)).toEqual(segments);
  });

  it('round-trips text before and after a mention', () => {
    const segments: Segment[] = [
      { kind: 'text', text: 'tell ' },
      { kind: 'mention', neighbour: 'penny' },
      { kind: 'text', text: ' the taxi was $18' },
    ];
    expect(parseSegments(serializeSegments(segments))).toEqual(segments);
  });

  it('round-trips multiple mentions', () => {
    const segments: Segment[] = [
      { kind: 'mention', neighbour: 'ollie' },
      { kind: 'text', text: ' ' },
      { kind: 'mention', neighbour: 'milo' },
      { kind: 'text', text: ' lunch was huge' },
    ];
    expect(serializeSegments(segments)).toBe('@Ollie @Milo lunch was huge');
    expect(parseSegments(serializeSegments(segments))).toEqual(segments);
  });

  it('parses a plain name in a sentence as TEXT, not a mention (canon: no symbol needed)', () => {
    expect(parseSegments('Mira, what did I write in March?')).toEqual([
      { kind: 'text', text: 'Mira, what did I write in March?' },
    ]);
  });

  it('keeps an unknown @word as plain text', () => {
    expect(parseSegments('@Miranda says hi')).toEqual([{ kind: 'text', text: '@Miranda says hi' }]);
  });

  it('parses no segments from empty text', () => {
    expect(parseSegments('')).toEqual([]);
  });
});

describe('orderPicker', () => {
  it('orders current residents most-talked-to first, then residents without threads', () => {
    expect(orderPicker(['milo', 'ollie'], ['ollie', 'penny', 'milo'])).toEqual(['milo', 'ollie', 'penny']);
  });

  it('pins Ollie even when he has no thread', () => {
    expect(orderPicker(['penny', 'milo'], ['penny', 'milo'])).toEqual(['penny', 'milo', 'ollie']);
    expect(orderPicker([], [])).toEqual(['ollie']);
  });

  it('never surfaces a non-resident, Tally, or unknown id', () => {
    expect(orderPicker(['milo', 'tally', 'penny', 'nobody'], ['penny'])).toEqual(['penny', 'ollie']);
  });

  it('dedupes repeated ids', () => {
    expect(orderPicker(['penny', 'penny', 'ollie', 'ollie'], ['ollie', 'penny', 'penny'])).toEqual(['penny', 'ollie']);
  });
});

describe('serializePhotoDraft', () => {
  it('keeps an explicit address with the photo caption', () => {
    expect(serializePhotoDraft(['mira'], 'the balcony last night')).toBe('@Mira the balcony last night');
  });

  it('keeps multiple addresses and permits a captionless photo', () => {
    expect(serializePhotoDraft(['penny', 'milo'], '')).toBe('@Penny@Milo');
    expect(serializePhotoDraft([], '')).toBe('');
  });
});

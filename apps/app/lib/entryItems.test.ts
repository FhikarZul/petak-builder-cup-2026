import { describe, expect, it } from 'vitest';
import { entryBreakdown } from './entryItems';

// PAR-B04. Contract v7 has been putting line_items on the payload since 1 Sep;
// nothing read them back out.
describe('entryBreakdown', () => {
  const items = [
    { name: 'Milk', quantity: 2, unit_price: 3.2, amount: 6.4 },
    { name: 'Bread', quantity: 1, unit_price: 2.05, amount: 2.05 },
  ];

  it('reads the items and sums them', () => {
    const b = entryBreakdown({ line_items: items, amount: 8.45 })!;
    expect(b.items).toHaveLength(2);
    expect(b.itemsTotal).toBeCloseTo(8.45);
    expect(b.mismatch).toBe(false);
  });

  // The whole reason the printed total is kept separately: a receipt often
  // holds something its line items do not explain.
  it('flags a receipt whose items do not explain its total', () => {
    const b = entryBreakdown({ line_items: items, printed_total: 9.35 })!;
    expect(b.printedTotal).toBe(9.35);
    expect(b.mismatch).toBe(true);
  });

  // Money is never compared exactly — floating point makes that a lie.
  it('does not call a rounding difference a mismatch', () => {
    const b = entryBreakdown({ line_items: [{ name: 'A', amount: 0.1 }, { name: 'B', amount: 0.2 }], amount: 0.3 })!;
    expect(b.mismatch).toBe(false);
  });

  // Null, not an empty breakdown: the row's chevron appears only when
  // something is behind it, so an affordance never opens onto nothing.
  it('returns null when there is nothing to show', () => {
    expect(entryBreakdown({ amount: 12 })).toBeNull();
    expect(entryBreakdown({ line_items: [] })).toBeNull();
    expect(entryBreakdown({ line_items: 'not an array' })).toBeNull();
  });

  // A blank row with a number beside it is not information.
  it('drops lines that are not lines', () => {
    const b = entryBreakdown({
      line_items: [{ name: 'Real', amount: 5 }, { name: '', amount: 3 }, { name: 'No amount' }],
      amount: 5,
    })!;
    expect(b.items.map((i) => i.name)).toEqual(['Real']);
  });

  it('survives a payload shaped nothing like a receipt', () => {
    expect(entryBreakdown({})).toBeNull();
    expect(entryBreakdown({ line_items: [null, 7, 'x'] })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { completeWindowTotal, expenseTotal } from './expenseTotal';
describe('complete home-currency expense totals', () => {
  it('sums server-valued home, foreign charge and automatic estimate amounts', () => {
    expect(expenseTotal([
      { reporting_amount: 10, reporting_currency: 'SGD' },
      { reporting_amount: 27.1, reporting_currency: 'SGD' },
      { reporting_amount: 7.3, reporting_currency: 'SGD' },
    ], 'SGD')).toBe(44.4);
  });
  it('uses server valuation even when a same-currency original differs', () => {
    const entry = { payload: { amount: 10, currency: 'SGD', home_amount: 11, home_currency: 'SGD' }, reporting_amount: 11, reporting_currency: 'SGD' };
    expect(expenseTotal([entry], 'SGD')).toBe(11);
  });
  it('suppresses partial totals for missing or stale reporting evidence', () => {
    expect(expenseTotal([{ reporting_amount: null, reporting_currency: 'SGD' }], 'SGD')).toBeNull();
    expect(expenseTotal([{ reporting_amount: 27.1, reporting_currency: 'SGD' }], 'IDR')).toBeNull();
    expect(expenseTotal([{}], 'SGD')).toBeNull();
  });
  it('preserves zero and refunds, but rejects nonfinite amounts', () => {
    expect(expenseTotal([{ reporting_amount: 0, reporting_currency: 'SGD' }, { reporting_amount: -5, reporting_currency: 'SGD' }], 'SGD')).toBe(-5);
    expect(expenseTotal([{ reporting_amount: NaN, reporting_currency: 'SGD' }], 'SGD')).toBeNull();
    expect(expenseTotal([], 'SGD')).toBe(0);
  });
});

describe('monthly hero completeness', () => {
  it('hides unresolved zero or partial home totals', () => {
    expect(completeWindowTotal({ window_total: 0, fx: { unconverted_entries: 1 } })).toBeUndefined();
    expect(completeWindowTotal({ window_total: 27.1, fx: { unconverted_entries: 1 } })).toBeUndefined();
    expect(completeWindowTotal({ window_total: 27.1, other_currencies: ['USD'] })).toBeUndefined();
  });
  it('keeps genuine zero and complete server valuations', () => {
    expect(completeWindowTotal({ window_total: 0, fx: { unconverted_entries: 0 } })).toBe(0);
    expect(completeWindowTotal({ window_total: 27.1, fx: { unconverted_entries: 0 } })).toBe(27.1);
  });
});

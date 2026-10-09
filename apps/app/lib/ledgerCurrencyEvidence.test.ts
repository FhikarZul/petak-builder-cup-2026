import { describe, expect, it } from 'vitest';
import { ledgerCurrencyEvidence } from './ledgerCurrencyEvidence';
const payload = { amount: 21.8, currency: 'USD', fx_estimate: { amount: 28.1, currency: 'SGD', rate_date: '2026-09-20' } };
const entry = { payload, reporting_amount: 28.1, reporting_currency: 'SGD', valuation_estimated: true };
describe('ledger currency evidence', () => {
  it('keeps the receipt and server estimate with reference provenance', () => {
    expect(ledgerCurrencyEvidence(entry, 'SGD')).toEqual([
      { label: 'Printed total', currency: 'USD', amount: 21.8 },
      { label: 'Home estimate', currency: 'SGD', amount: 28.1, provenance: 'Reference rate · 2026-09-20' },
    ]);
  });
  it('uses the confirmed bank charge despite pending evidence and an older quote', () => {
    expect(ledgerCurrencyEvidence({ ...entry, reporting_amount: 29, valuation_estimated: false, payload: { ...payload, home_amount: 29, home_currency: 'SGD', home_amount_source: 'statement', pending_payment_evidence: { amount: 31 } } }, 'SGD')[1]).toEqual({ label: 'Bank charged', currency: 'SGD', amount: 29, provenance: 'Read from your payment screenshot' });
  });
  it('does not revive a stale quote when the server says unavailable', () => {
    expect(ledgerCurrencyEvidence({ ...entry, reporting_amount: null }, 'SGD')[1]).toEqual({ label: 'Home estimate unavailable' });
  });
  it('rejects cached valuation after a home currency change and keeps the old actual as evidence', () => {
    const changed = { ...entry, payload: { ...payload, home_amount: 29, home_currency: 'SGD' } };
    expect(ledgerCurrencyEvidence(changed, 'AUD')).toEqual([
      { label: 'Printed total', currency: 'USD', amount: 21.8 },
      { label: 'Bank charged', currency: 'SGD', amount: 29, provenance: 'You told me' },
      { label: 'Home estimate unavailable' },
    ]);
    expect(ledgerCurrencyEvidence({ ...changed, reporting_amount: 33, reporting_currency: 'AUD' }, 'AUD')[2]).toMatchObject({ label: 'Home estimate', amount: 33, currency: 'AUD', provenance: 'Reference rate' });
  });
  it('retains the bank charge when switching back before reporting refreshes', () => {
    const changed = { ...entry, reporting_currency: 'AUD', reporting_amount: 33, payload: { ...payload, home_amount: 29, home_currency: 'SGD', home_amount_source: 'statement' } };
    expect(ledgerCurrencyEvidence(changed, 'SGD')).toEqual([
      { label: 'Printed total', currency: 'USD', amount: 21.8 },
      { label: 'Bank charged', currency: 'SGD', amount: 29, provenance: 'Read from your payment screenshot' },
      { label: 'Home estimate unavailable' },
    ]);
  });
  it('does not invent a conversion for same-currency purchases', () => {
    expect(ledgerCurrencyEvidence({ payload: { amount: 12, currency: 'SGD' }, reporting_amount: 12, reporting_currency: 'SGD', valuation_estimated: false }, 'SGD')).toEqual([]);
  });
  it.each([0, -5])('retains server zero/refund values (%s)', (amount) => {
    expect(ledgerCurrencyEvidence({ ...entry, reporting_amount: amount }, 'SGD')[1]).toMatchObject({ amount });
  });
  it('labels supplied rates as estimates', () => {
    expect(ledgerCurrencyEvidence({ ...entry, payload: { ...payload, home_amount: 28.1, home_currency: 'SGD', home_amount_basis: 'rate' } }, 'SGD')[1]).toMatchObject({ label: 'Home estimate', provenance: 'Your exchange rate' });
  });
});

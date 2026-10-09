import type { LedgerEntry } from './thread';

export interface CurrencyEvidenceRow {
  label: string;
  currency?: string;
  amount?: number;
  provenance?: string;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Presentation only: the server owns valuation, including quote freshness. */
export function ledgerCurrencyEvidence(entry: Pick<LedgerEntry, 'payload' | 'reporting_amount' | 'reporting_currency' | 'valuation_estimated'>, homeCurrency: string): CurrencyEvidenceRow[] {
  const p = entry.payload;
  const original = finite(p.gross_amount) ? p.gross_amount : finite(p.printed_total) ? p.printed_total : p.amount;
  if (!finite(original) || typeof p.currency !== 'string') return [];
  const saved = finite(p.home_amount) && typeof p.home_currency === 'string';
  if (p.currency === homeCurrency && !saved) return [];
  const rows: CurrencyEvidenceRow[] = [{ label: 'Printed total', currency: p.currency, amount: original }];
  const rate = p.home_amount_basis === 'rate';
  const savedProvenance = rate ? 'Your exchange rate' : p.home_amount_source === 'statement' ? 'Read from your payment screenshot' : 'You told me';
  const reportingAvailable = entry.reporting_currency === homeCurrency && finite(entry.reporting_amount);
  // A Settings change never renames or discards the actual bank settlement.
  if (saved && (p.home_currency !== homeCurrency || (!rate && !reportingAvailable))) rows.push({ label: rate ? 'Home estimate' : 'Bank charged', currency: p.home_currency as string, amount: p.home_amount as number, provenance: savedProvenance });
  if (!reportingAvailable || !finite(entry.reporting_amount)) {
    rows.push({ label: 'Home estimate unavailable' });
    return rows;
  }
  const actual = saved && p.home_currency === homeCurrency && !rate && entry.valuation_estimated === false;
  const estimate = p.fx_estimate && typeof p.fx_estimate === 'object' ? p.fx_estimate as Record<string, unknown> : null;
  const date = estimate?.currency === homeCurrency && estimate.amount === entry.reporting_amount && typeof estimate.rate_date === 'string' ? estimate.rate_date : null;
  rows.push({
    label: actual ? 'Bank charged' : 'Home estimate', currency: homeCurrency, amount: entry.reporting_amount,
    provenance: actual || (saved && p.home_currency === homeCurrency && rate) ? savedProvenance : date ? `Reference rate · ${date}` : 'Reference rate',
  });
  return rows;
}

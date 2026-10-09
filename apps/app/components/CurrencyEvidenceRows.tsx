// Currency evidence rows for Penny's receipt cards. The receipt stays in the
// printed currency; the second row explains the home-currency value and its
// provenance instead of silently replacing the original number.
import { StyleSheet, Text, View } from 'react-native';
import type { Theme } from '../lib/theme';
import type { CurrencyEvidenceRow } from '../lib/ledgerCurrencyEvidence';

function money(currency: string, amount: number): string {
  const prefix = currency === 'SGD' ? 'S$' : `${currency} `;
  return `${prefix}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function finite(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }

export function CurrencyEvidenceRows({ payload, t }: { payload: Record<string, unknown>; t: Theme }) {
  const originalAmount = finite(payload.gross_amount) ? payload.gross_amount
    : finite(payload.printed_total) ? payload.printed_total : finite(payload.amount) ? payload.amount : null;
  const originalCurrency = typeof payload.currency === 'string' ? payload.currency : null;
  const homeCurrency = typeof payload.home_currency === 'string' ? payload.home_currency : null;
  const homeAmount = finite(payload.home_amount) ? payload.home_amount : null;
  const estimate = (payload.fx_estimate && typeof payload.fx_estimate === 'object') ? payload.fx_estimate as Record<string, unknown> : null;
  const estimateAmount = estimate && finite(estimate.amount) ? estimate.amount : null;
  const estimateCurrency = estimate && typeof estimate.currency === 'string' ? estimate.currency : null;
  if (originalAmount === null || !originalCurrency) return null;
  const actual = homeAmount !== null && homeCurrency && homeCurrency !== originalCurrency;
  const fallbackEstimate = !actual && estimateAmount !== null && estimateCurrency && estimateCurrency !== originalCurrency;
  if (!actual && !fallbackEstimate) return null;
  const shownCurrency = actual ? homeCurrency! : estimateCurrency!;
  const shownAmount = actual ? homeAmount! : estimateAmount!;
  const isRate = payload.home_amount_basis === 'rate';
  const label = actual && !isRate ? 'Bank charged' : 'Home estimate';
  const provenance = actual && !isRate
    ? (payload.home_amount_source === 'statement' ? 'Read from your payment screenshot' : 'You told me')
    : isRate ? 'Your exchange rate' : (typeof estimate?.rate_date === 'string' ? `Reference rate · ${estimate.rate_date}` : 'Reference rate');
  return <CurrencyEvidenceList rows={[
    { label: 'Printed total', currency: originalCurrency, amount: originalAmount },
    { label, currency: shownCurrency, amount: shownAmount, provenance },
  ]} t={t} />;
}

/** Shared approved receipt-row presentation; callers own their evidence policy. */
export function CurrencyEvidenceList({ rows, t }: { rows: CurrencyEvidenceRow[]; t: Theme }) {
  if (!rows.length) return null;
  return (
    <View style={[styles.rows, { borderTopColor: t.color.borderStructure }]}>
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}`} style={{ gap: 8 }}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: index === 0 ? t.color.textSecondary : t.color.textPrimary, fontFamily: index === 0 ? t.typography.textSmall.fontFamily : t.typography.textBody.fontFamily }]}>{row.label}</Text>
            {row.currency && row.amount !== undefined ? <Text style={[styles.value, { color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily }]}>{money(row.currency, row.amount)}</Text> : null}
          </View>
          {row.provenance ? <Text style={[styles.provenance, { color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily }]}>{row.provenance}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13 },
  value: { fontSize: 14 },
  provenance: { fontSize: 12 },
});

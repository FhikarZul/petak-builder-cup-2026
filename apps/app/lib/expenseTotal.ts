/** Sum the server's valuation of a fully loaded expense list.
 * Missing/stale reporting evidence suppresses the total, not the entry.
 * Original currency amounts remain available on each receipt.
 */
export function expenseTotal(rows: { reporting_amount?: number | null; reporting_currency?: string }[], currency: string): number | null {
  let total = 0;
  for (const row of rows) {
    if (row.reporting_currency !== currency || typeof row.reporting_amount !== 'number' || !Number.isFinite(row.reporting_amount)) return null;
    total += row.reporting_amount;
  }
  return Math.round(total * 100) / 100;
}

/** A server window total is partial while any receipt lacks a home value. */
export function completeWindowTotal(summary: { window_total: number; fx?: { unconverted_entries: number }; other_currencies?: string[] }): number | undefined {
  if ((summary.fx?.unconverted_entries ?? 0) > 0 || (summary.other_currencies?.length ?? 0) > 0) return undefined;
  return Number.isFinite(summary.window_total) ? summary.window_total : undefined;
}

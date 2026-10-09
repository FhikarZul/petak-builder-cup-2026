import type { ReceiptDetailBlock, ReceiptLineItem } from './blocks';

/** Display the evidence; payment tenders never change the item subtotal. */
export function receiptBreakdown(block: ReceiptDetailBlock) {
  const itemsTotal = block.itemsTotal ?? (block.lineItems?.reduce((sum, item) => sum + item.amount, 0) ?? null);
  const gross = block.printedTotal ?? block.grossAmount ?? block.amount;
  const adjustments = block.adjustments ?? [];
  const adjusted = itemsTotal === null ? null : itemsTotal + adjustments
    .filter(a => a.includedInItems !== true)
    .reduce((sum, a) => sum + a.amount, 0);
  const equal = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);
  const mismatch = itemsTotal !== null && !equal(itemsTotal, gross) && adjusted !== null && !equal(adjusted, gross);
  const paymentNames = {cash: 'Cash', card: 'Card', loyalty_redemption: 'Loyalty redemption', other: 'Other payment'};
  const rows: ReceiptLineItem[] = [
    ...adjustments.filter(a => a.label?.trim()).map(a => ({
      name: `${a.label}${a.includedInItems === true ? ' · included' : ''}`,
      amount: a.amount, quantity: null, unitPrice: null,
    })),
    ...(block.payments ?? []).filter(p => p.amount !== null).map(p => ({
      name: p.label?.trim() || paymentNames[p.kind], amount: p.amount!, quantity: null, unitPrice: null,
    })),
  ];
  return { itemsTotal, mismatch, rows };
}

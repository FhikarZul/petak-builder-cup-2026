import { describe, expect, it } from 'vitest';
import { parseBlock, type ReceiptDetailBlock } from './blocks';
import { receiptBreakdown } from './receiptBreakdown';

const receipt = (data: Record<string, unknown>) => parseBlock({ kind: 'receipt_detail', entry_id: 'receipt',
  amount: 9.53, currency: 'SGD', at: '2026-09-16T10:00:00Z', ...data }) as ReceiptDetailBlock;

describe('receipt breakdown presentation', () => {
  it('shows printed GST and tenders without interpreting redeemed money as an item discrepancy', () => {
    const block = receipt({ items_total: 17.05, gross_amount: 17.05, redeemed_amount: 7.52,
      payments: [{ kind: 'loyalty_redemption', label: 'Yuu redemption', amount: 7.52 }, { kind: 'card', label: 'Card', amount: 9.53 }],
      adjustments: [{ kind: 'tax', label: 'GST', amount: 1.41, included_in_items: true }] });
    expect(receiptBreakdown(block)).toEqual({ itemsTotal: 17.05, mismatch: false, rows: [
      { name: 'GST · included', amount: 1.41, quantity: null, unitPrice: null },
      { name: 'Yuu redemption', amount: 7.52, quantity: null, unitPrice: null },
      { name: 'Card', amount: 9.53, quantity: null, unitPrice: null },
    ] });
    expect(block.amount).toBe(9.53);
  });
  it('accounts for printed discounts without treating included GST as an extra charge', () => {
    expect(receiptBreakdown(receipt({ items_total: 20, printed_total: 17.05,
      adjustments: [{ kind: 'discount', label: 'Discount', amount: -2.95, included_in_items: false },
        { kind: 'tax', label: 'GST', amount: 1.41, included_in_items: true }] })).mismatch).toBe(false);
    expect(receiptBreakdown(receipt({ items_total: 30, printed_total: 17.05 })).mismatch).toBe(true);
  });
  it('keeps zero redemption payments visible and never turns unreadable tender into zero', () => {
    const rows = receiptBreakdown(receipt({ amount: 0, payments: [
      { kind: 'card', label: 'Card', amount: 0 }, { kind: 'cash', label: 'Cash', amount: null },
      { kind: 'other', label: null, amount: 1 },
    ] })).rows;
    expect(rows).toEqual([{ name: 'Card', amount: 0, quantity: null, unitPrice: null }, {name:'Other payment',amount:1,quantity:null,unitPrice:null}]);
  });
});

it('keeps reconciled tenders visible when the model cannot read their labels', () => {
  const block=receipt({gross_amount:17.05,redeemed_amount:7.52,payments:[
    {kind:'loyalty_redemption',label:null,amount:7.52},{kind:'card',label:null,amount:9.53},
  ]});
  expect(receiptBreakdown(block).rows.map(row=>[row.name,row.amount])).toEqual([
    ['Loyalty redemption',7.52],['Card',9.53],
  ]);
});

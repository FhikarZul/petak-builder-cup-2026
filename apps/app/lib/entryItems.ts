// Penny's expandable log row (Run B #4, fork 8 in delta 28t — PAR-B04).
//
// Extraction contract v7 put `line_items` on the expense payload, and the
// entries endpoint serves the payload whole, so the data has been on the
// device and unread since 1 Sep. This reads it back out.
//
// The SHAPE is deliberately the receipt-detail card's, not a new one. That
// card already solves the same problem — item rows, quantity × unit price,
// items subtotal against printed total, and a note when the two disagree —
// and it was itself built without a drawing. Two idioms for one job would be
// worse than one borrowed idiom, and the delta asks for a drawn ruling on it.
import type { ReceiptLineItem } from './blocks';

export interface EntryBreakdown {
  items: ReceiptLineItem[];
  /** Sum of the items. Null when there are none to sum. */
  itemsTotal: number | null;
  /** What the receipt itself printed, when the extraction captured it. */
  printedTotal: number | null;
  /** The two disagree by more than rounding — the receipt held something the
   *  items do not explain (a service charge, a discount, a missed line). */
  mismatch: boolean;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Read a ledger entry's payload into a breakdown, or null when there is
 * nothing to show.
 *
 * Null rather than an empty breakdown on purpose: the row's chevron appears
 * only when there is something behind it, so a typed entry (C20) and a receipt
 * whose extraction found no items both stay flat. An affordance that opens
 * onto nothing is worse than no affordance.
 */
export function entryBreakdown(payload: Record<string, unknown>): EntryBreakdown | null {
  const raw = payload.line_items;
  const items: ReceiptLineItem[] = Array.isArray(raw)
    ? raw
        .map((r) => {
          const o = (r ?? {}) as Record<string, unknown>;
          const amount = num(o.amount);
          const name = typeof o.name === 'string' ? o.name.trim() : '';
          // A line with no amount cannot be shown against a total, and a line
          // with no name is not a line — both are dropped rather than rendered
          // as a blank row with a number beside it.
          if (amount === null || name.length === 0) return null;
          return { name, quantity: num(o.quantity), unitPrice: num(o.unit_price), amount };
        })
        .filter((x): x is ReceiptLineItem => x !== null)
    : [];

  const printedTotal = num(payload.printed_total) ?? num(payload.amount);
  if (items.length === 0) return null;

  const itemsTotal = items.reduce((s, i) => s + i.amount, 0);
  return {
    items,
    itemsTotal,
    printedTotal,
    // Half a cent, the same tolerance the receipt-detail card uses — floating
    // point makes exact equality a lie on money.
    mismatch: printedTotal !== null && Math.abs(itemsTotal - printedTotal) > 0.005,
  };
}

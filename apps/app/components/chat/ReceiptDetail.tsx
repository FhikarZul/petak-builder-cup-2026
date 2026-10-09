// Run B #6 — the receipt detail card Penny shows after filing a receipt.
// Every number is from the ledger; this component only draws.
import { StyleSheet, Text, View } from 'react-native';
import type { ReceiptDetailBlock, ReceiptLineItem } from '../../lib/blocks';
import { receiptBreakdown } from '../../lib/receiptBreakdown';
import { parseServerDate } from '../../lib/honesty';
import type { Theme } from '../../lib/theme';
import { DetailCardFooter } from './DetailCardFooter';
import { CurrencyEvidenceRows } from '../CurrencyEvidenceRows';

function money(currency: string, n: number): string {
  const prefix = currency === 'SGD' ? 'S$' : `${currency} `;
  return `${prefix}${n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTimeLabel(iso: string): string {
  const d = parseServerDate(iso);
  const day = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} · ${time}`;
}

function LineRow({ item, currency, t }: { item: ReceiptLineItem; currency: string; t: Theme }) {
  const qty = item.quantity ?? 1;
  const meta = item.unitPrice !== null ? `${qty} × ${money(currency, item.unitPrice)}` : qty > 1 ? `${qty}` : null;
  return (
    <View style={styles.lineRow}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontSize: 14,
          }}
        >
          {item.name}
        </Text>
        {meta ? (
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
            }}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          color: t.color.textPrimary,
          fontFamily: t.typography.textBody.fontFamily,
          fontSize: 14,
        }}
      >
        {money(currency, item.amount)}
      </Text>
    </View>
  );
}

export function ReceiptDetail({ block, t }: { block: ReceiptDetailBlock; t: Theme }) {
  const { itemsTotal, mismatch, rows: evidenceRows } = receiptBreakdown(block);
  const hasBreakdown =
    (block.lineItems && block.lineItems.length > 0) ||
    block.itemsTotal !== null ||
    block.printedTotal !== null || evidenceRows.length > 0;

  return (
    <View style={[styles.card, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceCard }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 15,
            }}
          >
            {block.merchant ?? 'Receipt'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
              }}
            >
              {dateTimeLabel(block.at)}
            </Text>
            {block.category ? (
              <View style={[styles.categoryChip, { borderColor: t.color.borderStructure }]}>
                <Text
                  style={{
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 11,
                  }}
                >
                  {block.category}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontSize: 16,
          }}
        >
          {money(block.currency, block.amount)}
        </Text>
      </View>

      <CurrencyEvidenceRows
        payload={{
          amount: block.amount,
          currency: block.currency,
          printed_total: block.printedTotal,
          gross_amount: block.grossAmount,
          home_amount: block.homeAmount,
          home_currency: block.homeCurrency,
          home_amount_basis: block.homeAmountBasis,
          home_amount_source: block.homeAmountSource,
          fx_estimate: block.fxEstimate,
        }}
        t={t}
      />

      {hasBreakdown ? (
        <View style={[styles.breakdown, { borderTopColor: t.color.borderStructure }]}>
          {block.lineItems?.map((item, i) => (
            <LineRow key={i} item={item} currency={block.currency} t={t} />
          ))}
          {itemsTotal !== null && (block.lineItems?.length ?? 0) > 0 ? (
            <View style={[styles.totalRow, { borderTopColor: t.color.borderStructure }]}>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12,
                }}
              >
                Items subtotal
              </Text>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontSize: 14,
                }}
              >
                {money(block.currency, itemsTotal)}
              </Text>
            </View>
          ) : null}
          {block.printedTotal !== null ? (
            <View style={styles.totalRow}>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12,
                }}
              >
                Printed total
              </Text>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontSize: 14,
                }}
              >
                {money(block.currency, block.printedTotal)}
              </Text>
            </View>
          ) : null}
          {evidenceRows.map((item, i) => (
            <LineRow key={`evidence-${i}`} item={item} currency={block.currency} t={t} />
          ))}
          {mismatch ? (
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
                marginTop: 4,
              }}
            >
              The printed total differs from the item subtotal.
            </Text>
          ) : null}
        </View>
      ) : null}

      {block.question ? (
        <View style={[styles.question, { borderTopColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
            }}
          >
            {block.question}
          </Text>
        </View>
      ) : null}
      <DetailCardFooter chips={block.chips} honesty={block.honesty} t={t} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  breakdown: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  question: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
});

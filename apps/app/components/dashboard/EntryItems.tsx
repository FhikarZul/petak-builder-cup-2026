// The expanded half of a Penny log row (Run B #4, fork 8 — PAR-B04).
//
// Contract v7 has put `line_items` on the payload since 1 Sep and nothing
// showed them. The LAYOUT here is deliberately the receipt-detail card's, not
// a new one: that card already solves this exact problem, and two idioms for
// one job would be worse than one borrowed idiom. Delta 28t asks for a drawn
// ruling on the expanded row, and this is the honest stand-in until it lands.
import { StyleSheet, Text, View } from 'react-native';
import { money } from '../../lib/dashboard';
import type { EntryBreakdown } from '../../lib/entryItems';
import type { ReceiptLineItem } from '../../lib/blocks';
import type { Theme } from '../../lib/theme';

function LineRow({ item, currency, t }: { item: ReceiptLineItem; currency: string; t: Theme }) {
  const qty = item.quantity ?? 1;
  // Quantity alone when there is no unit price — "2" says more than "2 × ?",
  // and nothing at all when there is only one of the thing.
  const meta =
    item.unitPrice !== null ? `${qty} × ${money(currency, item.unitPrice)}` : qty > 1 ? `${qty}` : null;
  return (
    <View style={styles.line}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 13 }}
        >
          {item.name}
        </Text>
        {meta ? (
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 11.5 }}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          color: t.color.textPrimary,
          fontFamily: t.typography.textBody.fontFamily,
          fontSize: 13,
          fontVariant: ['tabular-nums'],
        }}
      >
        {money(currency, item.amount)}
      </Text>
    </View>
  );
}

export function EntryItems({
  breakdown,
  currency,
  t,
}: {
  breakdown: EntryBreakdown;
  currency: string;
  t: Theme;
}) {
  return (
    <View style={[styles.wrap, { backgroundColor: t.color.surfaceInset, borderTopColor: t.color.borderStructure }]}>
      {breakdown.items.map((item, i) => (
        <LineRow key={`${item.name}-${i}`} item={item} currency={currency} t={t} />
      ))}
      <View style={[styles.totals, { borderTopColor: t.color.borderStructure }]}>
        <Text style={{ flex: 1, color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
          Items subtotal
        </Text>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontSize: 13,
            fontVariant: ['tabular-nums'],
          }}
        >
          {breakdown.itemsTotal !== null ? money(currency, breakdown.itemsTotal) : ''}
        </Text>
      </View>
      {breakdown.mismatch && breakdown.printedTotal !== null ? (
        <>
          <View style={styles.totals}>
            <Text style={{ flex: 1, color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
              Printed total
            </Text>
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 13,
                fontVariant: ['tabular-nums'],
              }}
            >
              {money(currency, breakdown.printedTotal)}
            </Text>
          </View>
          {/* Stated, never resolved. The receipt is the record; the app does
              not know which side is wrong and must not imply that it does. */}
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 11.5,
              lineHeight: 17,
            }}
          >
            The items do not add up to the printed total. Both are kept as read.
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  totals: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 0, paddingTop: 2 },
});

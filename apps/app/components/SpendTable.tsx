// The week table — canon's "tables in replies: bordered card with column
// header row and a Copy action". The drawing puts the currency in the HEADER
// ("4–10 Aug · SGD") and leaves the row numbers bare, so this never
// re-attaches a symbol per row. Every figure is computed server-side (W5).
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SpendTableBlock } from '../lib/blocks';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';

const amount = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Tab-separated, header included — what a spreadsheet expects on paste. */
function asText(block: SpendTableBlock): string {
  const lines = [`${block.label} · ${block.currency}`];
  for (const row of block.rows) lines.push(`${row.category}\t${amount(row.total)}`);
  lines.push(`Total\t${amount(block.total)}`);
  return lines.join('\n');
}

export function SpendTable({ block, t }: { block: SpendTableBlock; t: Theme }) {
  // The label says what happened; it returns to "Copy" so the control never
  // reads as a permanent state (the button says what it does, then what it did).
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(asText(block));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.card, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceCard }]}>
      <View style={[styles.header, { borderBottomColor: t.color.borderStructure }]}>
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textLabel.fontFamily,
            fontWeight: '500',
            fontSize: 11,
            letterSpacing: 0.88,
            textTransform: 'uppercase',
            flexShrink: 1,
          }}
        >
          {`${block.label} · ${block.currency}`}
        </Text>
        <Pressable
          onPress={copy}
          accessibilityRole="button"
          accessibilityLabel={`Copy the ${block.label} table`}
          hitSlop={8}
          style={styles.copy}
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={15} color={t.color.interactive} />
          <Text
            style={{
              color: t.color.interactive,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 12,
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      {block.rows.map((row) => (
        <View key={row.category} style={styles.row}>
          <Text
            style={{
              flex: 1,
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 13.5,
            }}
          >
            {row.category}
          </Text>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 13.5,
              fontVariant: ['tabular-nums'],
            }}
          >
            {amount(row.total)}
          </Text>
        </View>
      ))}

      <View style={[styles.row, styles.total, { borderTopColor: t.color.borderStructure }]}>
        <Text
          style={{
            flex: 1,
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '500',
            fontSize: 13.5,
          }}
        >
          Total
        </Text>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '500',
            fontSize: 13.5,
            fontVariant: ['tabular-nums'],
          }}
        >
          {amount(block.total)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 6, borderWidth: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6 },
  total: { borderTopWidth: 1 },
});

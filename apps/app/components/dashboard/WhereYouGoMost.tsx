// Run B #4 (sub-slice B) — "Where you go most": the merchant rows drawn at
// :980-993. The server ranks them (fork 2: visits desc, ties by total desc,
// then name asc — the heading is about frequency, so a total-first sort would
// make it lie) and null/empty merchants never arrive (fork 3: a place needs
// a name). This component only renders what it is given.
import { StyleSheet, Text, View } from 'react-native';
import { money, visitsWord, type MerchantRow } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

export function WhereYouGoMost({
  merchants,
  currency,
  t,
}: {
  merchants: MerchantRow[];
  currency: string;
  t: Theme;
}) {
  return (
    <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
      <View style={styles.headRow}>
        <Icon name="store" size={16} color={t.color.textSecondary} />
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textLabel.fontFamily,
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.9,
            textTransform: 'uppercase',
          }}
        >
          Where you go most
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {merchants.map((m) => (
          <View key={m.merchant} style={[styles.row, { borderBottomColor: t.color.borderStructure }]}>
            <Text
              numberOfLines={1}
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 14,
                flex: 1,
                minWidth: 0,
              }}
            >
              {m.merchant}
            </Text>
            <View style={styles.figures}>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 13,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {visitsWord(m.visits)}
              </Text>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontWeight: '500',
                  fontSize: 15,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {money(currency, m.total)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  figures: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
});

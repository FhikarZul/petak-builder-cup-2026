// Run B #4 — "Where it went": the user's own categories, with their share.
//
// C43: categories are BORN from spending, never picked from a list — so this
// is a record of what happened, not a budget by category, and there are no
// per-category limits anywhere in it.
//
// The null group is "Waiting on a name" (C39), and it sorts last: it is not a
// category, it is a question Penny has not had answered yet.
import { StyleSheet, Text, View } from 'react-native';
import { categoryLabel, categoryShare, money, type CategoryRow } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

export function WhereItWent({ rows, currency, t }: { rows: CategoryRow[]; currency: string; t: Theme }) {
  const total = rows.reduce((acc, r) => acc + r.total, 0);
  return (
    <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
      <View style={styles.headRow}>
        <Icon name="donut_small" size={16} color={t.color.textPrimary} />
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
          Where it went
        </Text>
      </View>
      {rows.length === 0 ? (
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          Nothing here yet. Snap a receipt and I'll file it — your categories start the moment you spend something.
        </Text>
      ) : (
        rows.map((row) => {
          const share = categoryShare(row, total);
          const waiting = row.category === null;
          return (
            <View key={row.category ?? '__waiting'} style={styles.row}>
              <View style={styles.rowTop}>
                <Text
                  numberOfLines={1}
                  style={{
                    // The waiting group is quieter: it is a loose end, not a
                    // finding, and nothing about it should read as a total.
                    color: waiting ? t.color.textSecondary : t.color.textPrimary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontSize: 14,
                    flex: 1,
                  }}
                >
                  {categoryLabel(row.category)}
                </Text>
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 14,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {money(currency, row.total)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: t.color.surfaceInset }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${share}%`, backgroundColor: waiting ? t.color.borderStructure : t.color.domainMoney },
                  ]}
                />
              </View>
              <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 11.5 }}>
                {`${row.entries} ${row.entries === 1 ? 'entry' : 'entries'} · ${share}%`}
                {row.other_currencies ? ` · plus ${row.other_currencies.join(', ')}` : ''}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { gap: 5 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
});

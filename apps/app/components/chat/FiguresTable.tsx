// #66 — the weekly draft's figures.
//
// The draft drew a table and shipped PROSE ONLY, so the week's numbers existed
// on the server, were handed to the model, and reached the user only if it
// chose to repeat them. A record that depends on a paraphrase is not a record.
//
// Values are numerals and stay numerals: they are the record, and a record is
// read by scanning. The 5 Sep ruling spells counts in a SENTENCE — this is a
// table, which is the opposite case.
import { StyleSheet, Text, View } from 'react-native';
import type { FiguresBlock } from '../../lib/blocks';
import type { Theme } from '../../lib/theme';

export function FiguresTable({ block, t }: { block: FiguresBlock; t: Theme }) {
  return (
    <View style={[styles.card, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceCard }]}>
      {block.rows.map((row, i) => (
        <View
          key={`${row.label}-${i}`}
          style={[
            styles.row,
            i > 0 ? { borderTopWidth: 1, borderTopColor: t.color.borderStructure } : null,
          ]}
        >
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 13,
              flex: 1,
            }}
          >
            {row.label}
          </Text>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 14,
            }}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
});

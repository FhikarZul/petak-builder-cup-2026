// Milo's day close-out. C15/C54: semantics are ICON AND TEXT ONLY — never a
// fill, never a border, never a semantic hue on the surface. The icon carries
// the colour and the words carry the meaning, so the row still reads with
// colour vision absent. The verdict arrives as a WORD from the server; this
// component owns the glyph and the phrasing.
import { StyleSheet, Text, View } from 'react-native';
import type { DayCloseBlock, DayCloseRow } from '../lib/blocks';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';

function verdictParts(verdict: DayCloseRow['verdict'], t: Theme): { icon: string; color: string; word: string } {
  switch (verdict) {
    case 'on_target':
      return { icon: 'check', color: t.color.success, word: 'on target' };
    case 'over':
      return { icon: 'close', color: t.color.error, word: 'over' };
    default:
      return { icon: 'close', color: t.color.error, word: 'short' };
  }
}

export function DayClose({ block, t }: { block: DayCloseBlock; t: Theme }) {
  return (
    <View style={styles.rows}>
      {block.rows.map((row) => {
        const v = verdictParts(row.verdict, t);
        return (
          <View key={row.label} style={styles.row}>
            <Icon name={v.icon} size={18} color={v.color} />
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 14,
                flexShrink: 1,
              }}
            >
              {`${row.label} `}
              <Text style={{ fontVariant: ['tabular-nums'] }}>
                {`${row.value.toLocaleString('en-US')} / ${row.target.toLocaleString('en-US')}${row.unit}`}
              </Text>
              {` — ${v.word}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 4, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

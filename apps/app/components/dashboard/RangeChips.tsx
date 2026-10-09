// Run B #4 (sub-slice B, plans/2026-08-28-penny-charts-series.md) — the range
// chip row drawn at :847-851: ink-filled when selected, bordered when not,
// 36px tall. It only changes which window you are READING (C39: a dashboard
// never authors work).
//
// The shape is generic on purpose — Milo and Mira draw the same row — but
// nothing wires them to it yet; that is their own slice.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '../../lib/theme';

export interface RangeChipOption {
  key: string;
  label: string;
}

export function RangeChips({
  options,
  value,
  onChange,
  t,
}: {
  options: readonly RangeChipOption[];
  value: string;
  onChange: (key: string) => void;
  t: Theme;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.key)}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: t.color.ink }
                : { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure, borderWidth: 1 },
            ]}
          >
            <Text
              style={{
                color: selected ? t.color.kapur : t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 13,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 36, paddingHorizontal: 12, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});

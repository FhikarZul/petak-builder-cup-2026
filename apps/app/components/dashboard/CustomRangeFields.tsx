// Run B #5 — the drawn custom-range fields row (:853-859), rendered ONLY
// when the Custom chip is active (the drawing's sc-if): two 44px bordered
// fields, calendar_today icon + "1 Jul 2026" · "to" · icon + "12 Aug 2026".
//
// The drawing draws them STATIC — nothing in the file opens anything — but
// they are the only drawn thing that can open the editor, so each is a
// Pressable that edits its own end (fork 2, recorded in the 28u delta; the
// editor sheet itself is undrawn and flagged for redraw).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { customFieldLabel } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';

export function CustomRangeFields({
  from,
  to,
  onEdit,
  t,
}: {
  from: string;
  to: string;
  onEdit: (field: 'from' | 'to') => void;
  t: Theme;
}) {
  const field = (which: 'from' | 'to', day: string, label: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onEdit(which)}
      style={[styles.field, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}
    >
      <Icon name="calendar_today" size={18} color={t.color.textSecondary} />
      <Text
        style={{
          color: t.color.textPrimary,
          fontFamily: t.typography.textBody.fontFamily,
          fontSize: 14,
          fontVariant: ['tabular-nums'],
        }}
      >
        {customFieldLabel(day)}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {field('from', from, 'From date')}
      <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>
        to
      </Text>
      {field('to', to, 'To date')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
});

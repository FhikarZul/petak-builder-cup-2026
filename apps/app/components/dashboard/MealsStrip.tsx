// Run B #3 — "N meals · times" + the best rated meal.
//
// This is a strip, not a card: the drawn surface places it between the macro
// boxes and the log, as a compact summary of the log that follows.
import { StyleSheet, Text, View } from 'react-native';
import { mealStripParts, type MiloToday } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

export function MealsStrip({ today, t }: { today: MiloToday; t: Theme }) {
  const parts = mealStripParts(today);
  if (!parts) return null;

  return (
    <View style={[styles.strip, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
      <View style={styles.left}>
        <Icon name="restaurant" size={17} color={t.color.textSecondary} />
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 12.5,
            fontVariant: ['tabular-nums'],
            flexShrink: 1,
          }}
        >
          {parts.left}
        </Text>
      </View>
      {parts.right ? (
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 12,
            fontVariant: ['tabular-nums'],
            flexShrink: 1,
          }}
        >
          {parts.right}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  left: { flexGrow: 1, flexShrink: 1, flexBasis: '60%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
});

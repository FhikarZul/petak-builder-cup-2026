// Placeholder screen (plan §1/§3): this slice is the skeleton ONLY. Renders
// the token page background, the screen's name, and the Run A/B moment
// numbers it will implement. No invented UI — screen detail waits for design
// batches 5–8.
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';

export function PlaceholderScreen({ name, moments }: { name: string; moments: string }) {
  const t = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <Text
        style={{
          color: t.color.textPrimary,
          fontFamily: t.typography.textH3.fontFamily,
          fontSize: t.typography.textH3.fontSize,
        }}
      >
        {name}
      </Text>
      <Text
        style={{
          color: t.color.textSecondary,
          fontFamily: t.typography.textSmall.fontFamily,
          fontSize: t.typography.textSmall.fontSize,
        }}
      >
        {moments}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
});

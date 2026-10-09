import { Pressable, Text, View } from 'react-native';
import type { Theme } from '../../lib/theme';

export function DashboardLoadError({ label, hasData, retrying, onRetry, t }: {
  label: string; hasData: boolean; retrying: boolean; onRetry: () => void; t: Theme;
}) {
  return <View accessibilityLiveRegion="polite" style={{ padding: 14, gap: 8, borderWidth: 1, borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceCard }}>
    <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14, lineHeight: 22 }}>
      {hasData ? `Could not refresh ${label}. Available data is shown below.` : `Could not load ${label}.`}
    </Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: retrying }} disabled={retrying} onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={{ color: t.color.interactive, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>{retrying ? 'Trying again…' : 'Try again'}</Text>
    </Pressable>
  </View>;
}

import { Pressable, Text, View } from 'react-native';
import type { PreferenceSaveState } from '../lib/preferenceSave';
import type { Theme } from '../lib/theme';

export function PreferenceSaveNotice({ state, onRetry, t }: {
  state: PreferenceSaveState; onRetry: () => void; t: Theme;
}) {
  if (state.status === 'idle') return null;
  const saving = state.status === 'saving';
  return (
    <View style={{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
      backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }}>
      <Text accessibilityLiveRegion="polite" style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>
        {saving ? `Saving ${state.change.label}…` : `Could not confirm that ${state.change.label} saved.`}
      </Text>
      {!saving ? <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>Try again</Text>
      </Pressable> : null}
    </View>
  );
}

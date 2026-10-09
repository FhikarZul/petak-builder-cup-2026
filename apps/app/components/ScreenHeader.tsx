// Standard sub-page header (Run B non-chat screens): back arrow + Pixelify
// Sans title, with an optional right action. Used by every drawer screen that
// is not the chat home and does not already ship its own neighbour header.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../lib/theme';
import { openDrawerViaOpener, resolveBack } from '../lib/drawerHistory';
import { Icon } from './Icon';

export function ScreenHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const t = useTheme();
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    // Drawer routes are siblings with no native back stack: a screen opened
    // FROM the drawer returns TO the drawer (reopened); everything else walks
    // the recorded click path (founder rulings, 1–2 Sep 2026).
    const res = resolveBack();
    if (res.kind === 'drawer') {
      // Founder, 3 Sep 2026: the drawer reopens ON TOP of chat. Navigate home
      // first — otherwise the drawer sits over the screen just backed out of,
      // and closing it strands the user there with no way back to chat.
      router.replace('/');
      openDrawerViaOpener();
      return;
    }
    if (res.href) router.push(res.href as never);
    else router.replace('/');
  };

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={handleBack} hitSlop={10}>
        <Icon name="arrow_back" size={24} color={t.color.textPrimary} />
      </Pressable>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: t.color.textPrimary,
          fontFamily: t.typography.fontDisplay,
          fontSize: 24,
        }}
      >
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  right: {
    flexShrink: 0,
  },
});

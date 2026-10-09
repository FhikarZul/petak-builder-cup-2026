// Run B #3 — the dashboard header: back arrow, head avatar, name · role word,
// and the forum icon that returns you to the thread. The 2px domain rule
// under it is the neighbour's accent at FULL strength, which C03 allows here
// because it is a rule, not body copy on an accent.
//
// The forum icon goes to `/` and nowhere else: C63 made chat ONE merged feed,
// so there is no per-neighbour thread to open.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { NEIGHBOURS, type NeighbourId } from '../../lib/neighbours';
import { openDrawerViaOpener, resolveBack } from '../../lib/drawerHistory';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

export function DashboardHeader({ id, t }: { id: NeighbourId; t: Theme }) {
  const n = NEIGHBOURS[id];
  const goBack = () => {
    // Same back rule as ScreenHeader: drawer-origin screens return to the
    // drawer; everything else walks the click path (founder rulings).
    const res = resolveBack();
    if (res.kind === 'drawer') {
      // Reopen the drawer ON TOP of chat (see ScreenHeader) — never over the
      // screen just backed out of.
      router.replace('/');
      openDrawerViaOpener();
      return;
    }
    if (res.href) router.push(res.href as never);
    else router.replace('/');
  };
  return (
    <View style={{ borderBottomColor: t.color[n.domain], borderBottomWidth: 2 }}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} hitSlop={8}>
          <Icon name="arrow_back" size={22} color={t.color.textPrimary} />
        </Pressable>
        <Image source={n.head} style={styles.head} accessibilityIgnoresInvertColors />
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '500',
            fontSize: 15,
          }}
        >
          {n.name}
        </Text>
        <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>
          {`· ${n.roleWord}`}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Talk to ${n.name}`}
          onPress={() => router.replace('/')}
          hitSlop={8}
        >
          <Icon name="forum" size={22} color={t.color.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  head: { width: 28, height: 28, borderRadius: 14 },
});

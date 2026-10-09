// Drawer (Run B #5): everything that isn't chat lives behind the drawer.
// Route names follow the Run B screen list. The drawer's visual detail —
// neighbour rows, empty-petak strip, "Invite a neighbour" vanishing once all
// eight domains are filled — is rendered by DrawerContent.tsx.
//
// 1 Sep 2026 founder ruling: back follows the CLICK PATH. Drawer routes are
// siblings with no native back stack, so this layout records each visited
// route (lib/drawerHistory) and the hardware back button walks it backwards,
// same as the header arrows in ScreenHeader/DashboardHeader.
import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { router, useSegments } from 'expo-router';
import { DrawerContent } from '../../components/DrawerContent';
import { isDrawerOpen, openDrawerViaOpener, recordDrawerVisit, resolveBack } from '../../lib/drawerHistory';

export default function DrawerLayout() {
  const segments = useSegments() as string[];
  // Segment path under the drawer group; 'index' (bare or explicit) is chat.
  const routeName =
    segments[0] === '(drawer)' ? segments.slice(1).filter((s) => s !== 'index').join('/') || 'index' : null;

  useEffect(() => {
    if (routeName) recordDrawerVisit(routeName);
  }, [routeName]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // An open drawer closes itself — stay out of its way.
      if (isDrawerOpen()) return false;
      if (!routeName || routeName === 'index') return false; // chat: default behavior
      // Same rule as the header arrows: drawer-origin screens return to the
      // drawer; everything else walks the click path.
      const res = resolveBack();
      if (res.kind === 'drawer') {
        // Reopen the drawer ON TOP of chat (see ScreenHeader): navigate home
        // first so closing the drawer lands on chat, not on the screen just
        // backed out of (founder, 3 Sep 2026).
        router.replace('/');
        openDrawerViaOpener();
        return true;
      }
      if (res.href) router.push(res.href as never);
      else router.replace('/');
      return true;
    });
    return () => sub.remove();
  }, [routeName]);

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { width: 308 },
        // The custom drawer renders every item; hide the default generated list
        // so routes are not duplicated.
        drawerItemStyle: { display: 'none' },
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'The street' }} />
      <Drawer.Screen name="board" options={{ title: "Ollie's board" }} />
      <Drawer.Screen name="dashboards/penny" options={{ title: 'Penny' }} />
      <Drawer.Screen name="dashboards/milo" options={{ title: 'Milo' }} />
      <Drawer.Screen name="dashboards/mira" options={{ title: 'Mira' }} />
      <Drawer.Screen name="wallet/coins" options={{ title: 'Petak Coins' }} />
      <Drawer.Screen name="wallet/photo-credits" options={{ title: 'Photo credits' }} />
      <Drawer.Screen name="wallet/referral" options={{ title: 'Referral' }} />
      <Drawer.Screen name="household/index" options={{ title: 'Your neighbours' }} />
      <Drawer.Screen name="household/moving-out" options={{ title: 'Moving out' }} />
      <Drawer.Screen name="invite" options={{ title: 'Invite a neighbour' }} />
      {/* QA-11: who-stays is a placeholder (Run B #10) and has no reachable UI in
          the custom drawer. Keep it out of the navigator until billing+design land. */}
      <Drawer.Screen name="settings/index" options={{ title: 'Settings' }} />
      <Drawer.Screen name="settings/notifications" options={{ title: 'Notifications' }} />
      <Drawer.Screen name="settings/your-details" options={{ title: 'Your details' }} />
      <Drawer.Screen name="settings/your-rules" options={{ title: 'Your rules' }} />
      <Drawer.Screen name="settings/tell-ollie" options={{ title: 'Tell Ollie' }} />
      <Drawer.Screen name="settings/told-ollie" options={{ title: "What you've told me" }} />
      <Drawer.Screen name="settings/delete" options={{ title: 'Delete everything' }} />
    </Drawer>
  );
}

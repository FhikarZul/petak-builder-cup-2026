import { preferredName } from '../lib/profile';
// Drawer content (Run B #5) — the single source of drawer truth.
//
// The drawing is the approved surface. Every label here is either canon-backed
// or intentionally matches the drawing while the data behind it is pending:
// - The price is deliberately ABSENT (C60, parity ledger PAR-B05). The drawing
//   quotes the C25 street price beside "Who lives here", but no billing exists,
//   so printing a number nothing can charge invents a fact — and it undercut
//   the household screen, which already refuses to show the same card. The
//   number itself lives only in canon/product/economy.md; this file points.
// - Neighbour status lines follow the drawing, not the generic roleWord, because
//   the drawer's job is to tell you what each neighbour is doing right now —
//   except the WORD itself, which is C14's fixed set. Mira is "mind"; the
//   drawing's "reflection" is a banned substitute and is being redrawn.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from 'expo-router/drawer';
import { Icon } from './Icon';
import { NEIGHBOURS, type NeighbourId } from '../lib/neighbours';
import { REFERRAL_COINS } from '../lib/dashboard';
import { useSession, supabase } from '../lib/supabase';
import { useStreet, useWallet, useQueuedPhotos, useSettings } from '../lib/thread';
import { setDrawerOpen, markDrawerOrigin, registerDrawerOpener } from '../lib/drawerHistory';
import { useTheme } from '../lib/theme';
import coinStack from '../../../packages/assets/sprites/coin_stack.png';

export function DrawerContent(props: DrawerContentComponentProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  // The hardware-back handler in the drawer layout must know when the drawer
  // is open (back then closes the drawer, never navigates underneath it),
  // and back handlers elsewhere reopen the drawer via this registered opener.
  // The typed helpers omit addListener; the runtime supports drawerOpen/Close.
  useEffect(() => {
    const navigation = props.navigation as unknown as {
      addListener: (event: string, cb: () => void) => () => void;
      openDrawer: () => void;
    };
    registerDrawerOpener(() => navigation.openDrawer());
    const open = navigation.addListener('drawerOpen', () => setDrawerOpen(true));
    const close = navigation.addListener('drawerClose', () => setDrawerOpen(false));
    return () => {
      open();
      close();
    };
  }, [props.navigation]);

  const session = useSession();
  const street = useStreet();
  const settings = useSettings();
  const wallet = useWallet();
  const queued = useQueuedPhotos();

  const email = session?.user?.email ?? null;
  const name = preferredName(settings.data?.settings?.profile?.display_name, session?.user?.user_metadata);
  const initial = (name ?? email ?? '?').slice(0, 1).toUpperCase();

  const coins = wallet.data?.coins ?? street.data?.coins ?? 0;
  const residents = street.data?.residents ?? [];
  const residentSet = new Set(residents.map((r) => r.neighbour));
  const queuedCount = queued.data?.length ?? 0;

  const navigate = (path: string) => {
    // The drawer is where the user was: a back press from the destination
    // returns here, reopened (founder ruling, 2 Sep 2026).
    markDrawerOrigin(path);
    // Close the drawer first so the next open starts clean and the user sees
    // the destination animate in.
    props.navigation.closeDrawer();
    // `as any` because expo-router's typed routes do not cover every drawer
    // destination in one union; runtime routing is correct.
    router.push(path as any);
  };

  const onLogout = async () => {
    props.navigation.closeDrawer();
    await supabase.auth.signOut();
  };

  return (
    <View style={[styles.root, { backgroundColor: t.color.surfacePage, borderRightColor: t.color.borderEmphasis, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.color.borderStructure }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your details"
          onPress={() => navigate('/(drawer)/settings/your-details')}
          style={styles.headerLeft}
        >
          <View
            style={[
              styles.avatar,
              { borderColor: t.color.borderEmphasis, backgroundColor: t.color.surfaceCard },
            ]}
          >
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 16,
              }}
            >
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1, width: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 15,
              }}
            >
              {name ?? 'You'}
            </Text>
            {email ? (
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12,
                }}
              >
                {email}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Petak Coins"
          onPress={() => navigate('/(drawer)/wallet/coins')}
          style={[
            styles.coinBadge,
            { borderColor: t.color.borderEmphasis, backgroundColor: t.color.surfaceCard },
          ]}
        >
          <Image source={coinStack} style={styles.coinIcon} accessibilityIgnoresInvertColors />
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 13,
              fontVariant: ['tabular-nums'],
              flexShrink: 0,
            }}
          >
            {coins.toLocaleString('en-US')}
          </Text>
          <Icon name="chevron_right" size={16} color={t.color.textSecondary} />
        </Pressable>
      </View>

      {/* The scroll view's own default adds `insets.top + 12` of top padding;
          the root View already handles the top inset for the header, so
          overriding it here keeps the section label tight under the header. */}
      <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1, paddingTop: 4 }}>
        {/* YOUR NEIGHBOURS */}
        <Text
          style={[
            styles.sectionLabel,
            {
              color: t.color.textSecondary,
              fontFamily: t.typography.textLabel.fontFamily,
            },
          ]}
        >
          Your neighbours
        </Text>

        <View style={styles.neighbourList}>
          {/* Only provisioned neighbours appear in the drawer. Ollie is the
              concierge and is always present; everyone else must be a resident
              on /v1/street or they are simply not listed. */}
          {(['ollie', 'penny', 'mira', 'milo'] as NeighbourId[])
            .filter((id) => id === 'ollie' || residentSet.has(id))
            .map((id) => {
            const n = NEIGHBOURS[id];
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={n.name}
                // Ollie's surface is the board (canon/product/dashboard.md:
                // "Ollie's board gives every resident an identical card") —
                // there is no dashboards/ollie route, and sending him there
                // was an unmatched route (founder, 3 Sep 2026).
                onPress={() => navigate(id === 'ollie' ? '/(drawer)/board' : `/(drawer)/dashboards/${id}`)}
                style={styles.neighbourRow}
              >
                <View
                  style={[
                    styles.headWrap,
                    {
                      borderColor: t.color.borderStructure,
                      backgroundColor: t.color.kapur,
                    },
                  ]}
                >
                  <Image source={n.head} style={styles.head} accessibilityIgnoresInvertColors />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
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
                  <Text
                    style={{
                      color: t.color.textSecondary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontSize: 12.5,
                    }}
                  >
                    {statusLine(id, queuedCount)}
                  </Text>
                </View>
                <Icon name="chevron_right" size={20} color={t.color.textSecondary} />
              </Pressable>
            );
          })}

          {/* Invite-a-neighbour row — shown while any invitable P0 neighbour is
              not yet resident. Tapping it opens the invite page (the Run B #6
              neighbour profile with the quick switcher). */}
          {(['penny', 'mira', 'milo'] as NeighbourId[]).some((id) => !residentSet.has(id)) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invite a neighbour"
              onPress={() => navigate('/(drawer)/invite')}
              style={styles.neighbourRow}
            >
              <View
                style={[
                  styles.emptyHead,
                  { borderColor: t.color.batu, backgroundColor: t.color.surfaceInset },
                ]}
              >
                <Icon name="add" size={22} color={t.color.interactive} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: t.color.interactive,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 15,
                  }}
                >
                  Invite a neighbour
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </DrawerContentScrollView>

      {/* Bottom actions — pad by the system navigation inset so the Log out
          row stays reachable above Android's gesture bar / iOS home indicator. */}
      <View style={[styles.bottom, { borderTopColor: t.color.borderStructure, paddingBottom: insets.bottom + 16 }]}>
        <ActionRow
          icon="home_work"
          title="Your neighbours"
          sub="Who lives here"
          onPress={() => navigate('/(drawer)/household')}
          t={t}
        />
        <ActionRow
          icon="redeem"
          title="Bring a friend"
          sub={`${REFERRAL_COINS} coins each`}
          onPress={() => navigate('/(drawer)/wallet/referral')}
          t={t}
        />
        <ActionRow
          icon="settings"
          title="Settings"
          onPress={() => navigate('/(drawer)/settings')}
          t={t}
        />

        <View style={[styles.logoutBorder, { borderTopColor: t.color.borderStructure }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            onPress={onLogout}
            style={styles.actionRow}
          >
            <Icon name="logout" size={22} color={t.color.textPrimary} />
            <Text
              style={{
                flex: 1,
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 15,
              }}
            >
              Log out
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function statusLine(id: NeighbourId, queuedCount: number): string {
  // Ollie is the front door and is always drawn as present. Every other
  // neighbour listed here is a resident, so no "away" branch is needed.
  if (id === 'ollie') return 'your concierge — keeps the whole board';
  if (id === 'penny') {
    return queuedCount > 0 ? `money · ${queuedCount} pending photos` : 'money';
  }
  if (id === 'milo') return 'body';
  if (id === 'mira') return 'mind';
  return '';
}

function ActionRow({
  icon,
  title,
  sub,
  onPress,
  t,
}: {
  icon: string;
  title: string;
  sub?: string;
  onPress: () => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionRow}>
      <Icon name={icon} size={22} color={t.color.textPrimary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontSize: 15,
          }}
        >
          {title}
        </Text>
        {sub ? (
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12.5,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron_right" size={20} color={t.color.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderRightWidth: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    marginRight: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 44,
    width: 82,
    paddingHorizontal: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  coinIcon: {
    width: 18,
    height: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  neighbourList: {
    flexDirection: 'column',
  },
  neighbourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  headWrap: {
    width: 44,
    height: 44,
    borderWidth: 1,
    overflow: 'hidden',
  },
  head: {
    width: '100%',
    height: '100%',
  },
  emptyHead: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  logoutBorder: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});

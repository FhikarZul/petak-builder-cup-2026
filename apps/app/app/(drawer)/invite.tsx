// Invite a neighbour — the neighbour profile page (Run B #6), not a list.
// Founder ruling, 3 Sep 2026: the page IS the drawing — a quick-switcher
// strip of headshots under the header, one full profile at a time (hero,
// what they do, their voice, what they can & can't see), and the invite
// action at the bottom. The chat feed's move-in block keeps the compact
// MoveInPicker; this page and that picker share the same PROFILE copy.
//
// Beta (same ruling): on QA builds every neighbour moves in free — see
// lib/beta.ts. Prod keeps the free-petak gate until billing ships (P1).
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { PROFILE, type MoveInId } from '../../components/MoveInPicker';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../components/Icon';
import { SWIPE_TO_BROWSE, browseDirection, stepThrough } from '../../lib/swipe';
import { apiFetch } from '../../lib/api';
import { BETA_OPEN_STREET } from '../../lib/beta';
import { parseServerDate } from '../../lib/honesty';
import { NEIGHBOURS } from '../../lib/neighbours';
import { refreshFeedHead, useStreet } from '../../lib/thread';
import { useTheme } from '../../lib/theme';

// Canon order, minus Ollie (always resident — the front door is never
// invited) and Tally (C23: absent until the community play).
const PICKABLE: MoveInId[] = ['penny', 'milo', 'mira'];

const GRID = 28;
const HERO_HEIGHT = 152;

export default function InviteScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const street = useStreet();
  const { width } = useWindowDimensions();
  const residents = street.data?.residents ?? [];
  const residentMap = new Map(residents.map((r) => [r.neighbour, r]));
  const [selectedId, setSelectedId] = useState<MoveInId>(
    () => PICKABLE.find((id) => !residentMap.has(id)) ?? 'penny',
  );
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const neighbour = NEIGHBOURS[selectedId];
  const profile = PROFILE[selectedId];
  const resident = residentMap.get(selectedId);
  const he = selectedId === 'milo';
  const position = PICKABLE.indexOf(selectedId) + 1;

  // Found 5 Sep 2026: this walked one way only. A row of faces invites a swipe
  // and there was no gesture at all, and the header carried a NEXT chevron with
  // no previous — so going back meant cycling forward twice through a carousel
  // of three. Both directions now, by arrow and by swipe.
  const browse = (direction: 'next' | 'prev') => {
    setError(null);
    setSelectedId(stepThrough(PICKABLE, selectedId, direction));
  };
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(SWIPE_TO_BROWSE.activeOffsetX)
    .failOffsetY(SWIPE_TO_BROWSE.failOffsetY)
    .onEnd((e) => {
      const d = browseDirection(e.translationX);
      if (d) browse(d);
    });

  const invite = async () => {
    if (moving || resident) return;
    setMoving(true);
    setError(null);
    try {
      await apiFetch(`/v1/neighbours/${selectedId}/move-in`, { method: 'POST' });
      await Promise.all([qc.invalidateQueries({ queryKey: ['street'] }), refreshFeedHead(qc)]);
      // Stay on the page — the profile flips to "Moved in", which is the
      // confirmation. Back returns to the drawer (the origin) or click path.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not invite this neighbour.');
    } finally {
      setMoving(false);
    }
  };

  // The price line tells the truth in each world: the free petak while it is
  // open, the beta while subscriptions don't exist, and the honest "arrives
  // with launch" otherwise (C60 — never invent a price).
  const priceLine = resident
    ? null
    : residents.length === 0
      ? `Free as your first neighbour · ${he ? 'his' : 'her'} skills, dashboard and photo filing, all included`
      : BETA_OPEN_STREET
        ? `Free during the beta · adds ${he ? 'his' : 'her'} skills, dashboard, and +10 photos a day`
        : `Adds ${he ? 'his' : 'her'} skills, dashboard, and +10 photos a day · subscriptions arrive with launch`;
  const canInvite = !resident && (residents.length === 0 || BETA_OPEN_STREET);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title={neighbour.name} />
      {street.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.color.textSecondary} />
        </View>
      ) : (
        <>
          {/* Quick neighbour switcher (Run B #6): headshots, the current one
              ringed in ink, the rest dimmed; the counter and chevron page
              through the street. */}
          <View style={[styles.switcher, { borderBottomColor: t.color.borderStructure }]}>
            {PICKABLE.map((id) => {
              const active = id === selectedId;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${NEIGHBOURS[id].name}`}
                  onPress={() => {
                    setError(null);
                    setSelectedId(id);
                  }}
                >
                  <Image
                    source={NEIGHBOURS[id].head}
                    style={[
                      styles.switchHead,
                      {
                        borderColor: active ? t.color.borderEmphasis : t.color.borderStructure,
                        borderWidth: active ? 2 : 1,
                        opacity: active ? 1 : 0.55,
                      },
                    ]}
                    accessibilityIgnoresInvertColors
                  />
                </Pressable>
              );
            })}
            <View style={{ flex: 1 }} />
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
              }}
            >
              {`${position} of ${PICKABLE.length}`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous neighbour"
              onPress={() => browse('prev')}
              hitSlop={8}
            >
              <Icon name="chevron_left" size={22} color={t.color.interactive} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next neighbour"
              onPress={() => browse('next')}
              hitSlop={8}
            >
              <Icon name="chevron_right" size={22} color={t.color.interactive} />
            </Pressable>
          </View>

          {/* The swipe covers the PROFILE, not just the head strip: the faces
              are small targets and the card is what the user is looking at.
              failOffsetY keeps vertical scrolling untouched. */}
          <GestureDetector gesture={swipe}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Hero: domain tint over the page, the petak grid behind, the
                full-body sprite, and the 2px ink rule under it all. */}
            <View style={[styles.hero, { borderBottomColor: t.color.borderEmphasis }]}>
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: t.color[neighbour.domain], opacity: 0.12 }]}
                pointerEvents="none"
              />
              {Array.from({ length: Math.ceil(width / GRID) + 1 }, (_, i) => (
                <View
                  key={`v${i}`}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: i * GRID,
                    top: 0,
                    bottom: 0,
                    width: StyleSheet.hairlineWidth,
                    backgroundColor: t.color.batu,
                    opacity: 0.4,
                  }}
                />
              ))}
              {Array.from({ length: Math.ceil(HERO_HEIGHT / GRID) + 1 }, (_, i) => (
                <View
                  key={`h${i}`}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: i * GRID,
                    left: 0,
                    right: 0,
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: t.color.batu,
                    opacity: 0.4,
                  }}
                />
              ))}
              <Image
                source={profile.body}
                style={styles.heroSprite}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <View style={styles.heroCopy}>
                <Text
                  style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 32 }}
                >
                  {neighbour.name}
                </Text>
                <Text
                  style={{
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textLabel.fontFamily,
                    fontSize: 11,
                    fontWeight: '500',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    marginTop: 6,
                    marginBottom: 8,
                  }}
                >
                  {neighbour.roleWord}
                </Text>
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 13.5,
                    lineHeight: 21,
                  }}
                >
                  {profile.long}
                </Text>
              </View>
            </View>

            <View style={styles.sections}>
              <View>
                <Label t={t}>{`What ${he ? 'he' : 'she'} does`}</Label>
                <View style={{ gap: 6 }}>
                  {profile.does.map((line) => (
                    <Text
                      key={line}
                      style={{
                        color: t.color.textPrimary,
                        fontFamily: t.typography.textBody.fontFamily,
                        fontSize: 14.5,
                        lineHeight: 22.5,
                      }}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
                <View style={styles.quotes}>
                  {profile.quotes.map((line) => (
                    <Text
                      key={line}
                      style={[
                        styles.quote,
                        {
                          color: t.color.textPrimary,
                          backgroundColor: t.color.surfaceCard,
                          borderColor: t.color.borderStructure,
                          fontFamily: t.typography.textSmall.fontFamily,
                        },
                      ]}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              </View>

              <View>
                <Label t={t}>{`${he ? 'His' : 'Her'} voice`}</Label>
                <View style={styles.voiceRow}>
                  <Image source={neighbour.head} style={styles.voiceHead} accessibilityIgnoresInvertColors />
                  <Text
                    style={{
                      flex: 1,
                      color: t.color.textPrimary,
                      backgroundColor: t.color.surfaceCard,
                      borderWidth: 1,
                      borderColor: t.color.borderStructure,
                      borderLeftWidth: 2,
                      borderLeftColor: t.color[neighbour.domain],
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontSize: 14.5,
                      lineHeight: 23,
                    }}
                  >
                    {profile.voice}
                  </Text>
                </View>
              </View>

              <View>
                <Label t={t}>{`What ${he ? 'he' : 'she'} can & can't see`}</Label>
                <View style={styles.visibilityRow}>
                  <View
                    style={[
                      styles.visibilityCol,
                      { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure },
                    ]}
                  >
                    <View
                      style={[
                        styles.pane,
                        { backgroundColor: t.color[neighbour.domain], borderColor: t.color.borderEmphasis },
                      ]}
                    />
                    <Text
                      style={{
                        color: t.color.textPrimary,
                        fontFamily: t.typography.textBody.fontFamily,
                        fontWeight: '500',
                        fontSize: 13,
                      }}
                    >
                      Sees
                    </Text>
                    <Text
                      style={{
                        color: t.color.textSecondary,
                        fontFamily: t.typography.textSmall.fontFamily,
                        fontSize: 12.5,
                        lineHeight: 19,
                      }}
                    >
                      {profile.sees}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.visibilityCol,
                      { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure },
                    ]}
                  >
                    <View style={[styles.pane, { backgroundColor: t.color.surfaceInset }]} />
                    <Text
                      style={{
                        color: t.color.textPrimary,
                        fontFamily: t.typography.textBody.fontFamily,
                        fontWeight: '500',
                        fontSize: 13,
                      }}
                    >
                      Never
                    </Text>
                    <Text
                      style={{
                        color: t.color.textSecondary,
                        fontFamily: t.typography.textSmall.fontFamily,
                        fontSize: 12.5,
                        lineHeight: 19,
                      }}
                    >
                      {profile.never}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Footer: the honest price line, then the action. A resident's
                  profile shows when they moved in and the way out. */}
              <View style={[styles.footer, { borderTopColor: t.color.borderStructure }]}>
                {resident ? (
                  <>
                    <Text
                      style={{
                        color: t.color.textPrimary,
                        fontFamily: t.typography.textSmall.fontFamily,
                        fontSize: 13.5,
                      }}
                    >
                      {`Lives here · moved in ${parseServerDate(resident.moved_in_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: '/(drawer)/household/moving-out',
                          params: { neighbour: selectedId },
                        })
                      }
                      style={[styles.moveOut, { borderColor: t.color.borderEmphasis }]}
                    >
                      <Text
                        style={{
                          color: t.color.textPrimary,
                          fontFamily: t.typography.textBody.fontFamily,
                          fontWeight: '500',
                          fontSize: 15,
                        }}
                      >
                        {`Move ${neighbour.name} out`}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {priceLine ? (
                      <Text
                        style={{
                          color: t.color.textPrimary,
                          fontFamily: t.typography.textSmall.fontFamily,
                          fontSize: 13.5,
                        }}
                      >
                        {priceLine}
                      </Text>
                    ) : null}
                    {canInvite ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={moving}
                        onPress={() => void invite()}
                        style={[
                          styles.invite,
                          { backgroundColor: t.color.interactive, opacity: moving ? 0.65 : 1 },
                        ]}
                      >
                        {moving ? (
                          <ActivityIndicator color={t.color.textOnInteractive} />
                        ) : (
                          <Text
                            style={{
                              color: t.color.textOnInteractive,
                              fontFamily: t.typography.textBody.fontFamily,
                              fontWeight: '500',
                              fontSize: 15,
                            }}
                          >
                            {profile.inviteLabel}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                  </>
                )}
                {error ? (
                  <Text style={{ color: t.color.error, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>
                    {error}
                  </Text>
                ) : null}
              </View>
            </View>
          </ScrollView>
          </GestureDetector>
        </>
      )}
    </SafeAreaView>
  );
}

function Label({ children, t }: { children: string; t: ReturnType<typeof useTheme> }) {
  return (
    <Text
      style={{
        color: t.color.textSecondary,
        fontFamily: t.typography.textLabel.fontFamily,
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  switchHead: { width: 40, height: 40 },
  hero: {
    minHeight: HERO_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    borderBottomWidth: 2,
    overflow: 'hidden',
  },
  heroSprite: { width: 84, height: 116, marginLeft: 12 },
  heroCopy: { flex: 1, minWidth: 0, paddingBottom: 16 },
  sections: { padding: 20, gap: 20 },
  quotes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  quote: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  voiceRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  voiceHead: { width: 32, height: 32 },
  visibilityRow: { flexDirection: 'row', gap: 10 },
  visibilityCol: { flex: 1, borderWidth: 1, padding: 12 },
  pane: { width: 14, height: 14, borderWidth: 1, borderColor: 'transparent', marginBottom: 8 },
  footer: { borderTopWidth: 1, paddingTop: 16, gap: 10 },
  invite: { height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  moveOut: { height: 44, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});

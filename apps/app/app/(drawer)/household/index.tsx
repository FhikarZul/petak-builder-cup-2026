// Your neighbours (Run B #8) — who lives here, and the way out for each.
//
// C60: **truthful state only, zero payment wiring.** The drawn screen carries
// a "YOUR STREET" price card — "S$18/month · Two paid neighbours · Renews 14
// September" — and Petak has no billing, no subscription and no renewal date.
// Drawing that card would put invented facts on the one screen whose whole
// job is telling you what your street costs. It is left out, and the reason
// is in delta 28l.
//
// What IS true and IS drawn (2 Sep 2026 design sweep): resident cards with
// headshots and the 2px domain rule, when each moved in, which petak is the
// free one (C05), the swap date, and Move out. The invite affordance is the
// dashed row and it disappears once every P0 domain is filled.
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { NEIGHBOURS, type NeighbourId } from '../../../lib/neighbours';
import { parseServerDate } from '../../../lib/honesty';
import { useStreet } from '../../../lib/thread';
import { useTheme } from '../../../lib/theme';

const MOVE_IN_IDS = ['penny', 'mira', 'milo'] as const;

const movedInWords = (iso: string): string =>
  `Moved in ${parseServerDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;

/** C05: the free petak swaps once every 30 days. */
const swapOpensWords = (iso: string): string =>
  `swappable again on ${new Date(parseServerDate(iso).getTime() + 30 * 86_400_000).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;

export default function HouseholdScreen() {
  const t = useTheme();
  const street = useStreet();
  const residents = street.data?.residents ?? [];
  const residentSet = new Set(residents.map((r) => r.neighbour));
  const hasEmptyPetak = MOVE_IN_IDS.some((id) => !residentSet.has(id));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Your neighbours" />
      <ScrollView contentContainerStyle={styles.body}>
        {street.isLoading ? (
          <ActivityIndicator color={t.color.textSecondary} />
        ) : (
          <>
            <Label t={t}>Living here</Label>
            {residents.map((res) => {
              const n = NEIGHBOURS[res.neighbour as NeighbourId];
              return (
                <View
                  key={res.neighbour}
                  style={[
                    styles.residentCard,
                    {
                      backgroundColor: t.color.surfaceCard,
                      borderColor: t.color.borderStructure,
                      borderLeftColor: n ? t.color[n.domain] : t.color.borderStructure,
                    },
                  ]}
                >
                  {n ? (
                    <Image
                      source={n.head}
                      style={[styles.head, { borderColor: t.color.borderStructure }]}
                      accessibilityIgnoresInvertColors
                    />
                  ) : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <Text
                        style={{
                          color: t.color.textPrimary,
                          fontFamily: t.typography.textBody.fontFamily,
                          fontWeight: '500',
                          fontSize: 15,
                        }}
                      >
                        {n?.name ?? res.display_name}
                      </Text>
                      {n ? (
                        <Text
                          style={{
                            color: t.color.textSecondary,
                            fontFamily: t.typography.textSmall.fontFamily,
                            fontSize: 12.5,
                          }}
                        >
                          {`· ${n.roleWord}`}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        color: t.color.textSecondary,
                        fontFamily: t.typography.textSmall.fontFamily,
                        fontSize: 12.5,
                      }}
                    >
                      {res.free_petak
                        ? `Your free petak · ${swapOpensWords(res.moved_in_at)}`
                        : movedInWords(res.moved_in_at)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/(drawer)/household/moving-out', params: { neighbour: res.neighbour } })
                    }
                    hitSlop={6}
                  >
                    <Text
                      style={{
                        color: t.color.interactive,
                        fontFamily: t.typography.textSmall.fontFamily,
                        fontWeight: '500',
                        fontSize: 13,
                      }}
                    >
                      Move out
                    </Text>
                  </Pressable>
                </View>
              );
            })}

            {/* The dashed invite affordance — only while a domain is unfilled.
                An invite that cannot be accepted is never shown. Opens the
                neighbour picker page (founder ruling, 2 Sep 2026). */}
            {hasEmptyPetak ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Invite a neighbour"
                onPress={() => router.push('/(drawer)/invite')}
                style={[
                  styles.inviteRow,
                  { borderColor: t.color.borderEmphasis, backgroundColor: t.color.surfacePage },
                ]}
              >
                <View
                  style={[
                    styles.inviteGlyph,
                    { borderColor: t.color.batu, backgroundColor: t.color.surfaceInset },
                  ]}
                >
                  <Icon name="add" size={20} color={t.color.interactive} />
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
                  <Text
                    style={{
                      color: t.color.textSecondary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontSize: 12.5,
                    }}
                  >
                    There is an empty petak upstairs
                  </Text>
                </View>
                <Icon name="chevron_right" size={20} color={t.color.textSecondary} />
              </Pressable>
            ) : null}

            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              One list, one price, one date. Payment details live in the App Store — never here. Nothing on
              your street is charged yet.
            </Text>
          </>
        )}
      </ScrollView>
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
        letterSpacing: 0.9,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 12 },
  residentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderLeftWidth: 2,
    padding: 12,
  },
  head: { width: 44, height: 44, borderWidth: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 12,
  },
  inviteGlyph: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Petak Coins (Run B #15) — one balance, earned and bought, and where it came
// from.
//
// C06's line, settled 27 Aug: stating what you HAVE is not gamification;
// stating what you might LOSE is. So the balance, the history and the rates
// are all fine — and there is no streak, no bar, no countdown and nothing
// that makes the number feel like it is slipping away.
//
// The one rule the copy exists to protect (C05/C25): **coins never buy a
// neighbour.** It is said plainly at the bottom rather than left to be
// inferred from an absence.
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import coinStack from '../../../../../packages/assets/sprites/coin_stack.png';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import {
  COINS_PER_CREDIT_RUNG,
  COINS_PER_PHOTO,
  coinsWorthLine,
  CREDITS_PER_RUNG,
  REFERRAL_COINS,
  coinKindLabel,
  signedCoins,
} from '../../../lib/dashboard';
import { ApiError, apiFetch } from '../../../lib/api';
import { parseServerDate } from '../../../lib/honesty';
import { useWallet } from '../../../lib/thread';
import { useTheme } from '../../../lib/theme';

/** C58's alphabet has no 0/O/1/I/L, so "check the letters" is actionable
 *  advice rather than a shrug — the confusable characters are not in play. */
function redeemError(code: string | undefined): string {
  switch (code) {
    case 'invalid_code':
      return "That code doesn't exist. Check the letters — there are no 0s, 1s, Is, Ls or Os in them.";
    case 'own_code':
      return 'That one is yours.';
    case 'already_redeemed':
      return 'You have already used a code. One each, ever.';
    case 'window_closed':
      return 'A code can be used in your first month. That window has closed.';
    default:
      return 'That did not go through. Try again in a moment.';
  }
}

const WEEK_PASS_COINS = 500;

export default function CoinsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const wallet = useWallet();
  const w = wallet.data;
  const [entry, setEntry] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const referral = useQuery({
    queryKey: ['referral'],
    queryFn: () =>
      apiFetch<{ code: string | null; used_a_code: boolean; settled_in: boolean }>('/v1/referrals/me'),
    staleTime: 60 * 1000,
  });

  const redeem = async () => {
    const code = entry.trim().toUpperCase();
    if (code.length === 0) return;
    setNote(null);
    try {
      await apiFetch('/v1/referrals/redeem', { method: 'POST', body: JSON.stringify({ code }) });
      setEntry('');
      await qc.invalidateQueries({ queryKey: ['referral'] });
    } catch (e) {
      // Each refusal says which one it is. The server distinguishes them by
      // error CODE, not status — all four are 400.
      setNote(redeemError(e instanceof ApiError ? e.code : undefined));
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Petak Coins" />
      <ScrollView contentContainerStyle={styles.body}>
        {wallet.isLoading ? (
          <ActivityIndicator color={t.color.textSecondary} />
        ) : !w ? (
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>
            Nothing to show yet.
          </Text>
        ) : (
          <>
            <View style={[styles.card, styles.balance, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Image source={coinStack} style={styles.stack} accessibilityIgnoresInvertColors />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.fontDisplay,
                    fontSize: 32,
                  }}
                >
                  {`${w.coins.toLocaleString('en-US')} coins`}
                </Text>
                {/* PAR-B15 (C63) — the drawn line, restored. This had been
                    rewritten to state the rate instead, on the reasoning that a
                    bare "38 photos" would name a plan the user never made. But
                    the approved drawing does NOT say a bare "38 photos": it
                    says "38 photos, if that is what you spend them on", which
                    carries the same hedge and answers the question the balance
                    actually raises — what is this worth to me? The rewrite was
                    solving a problem the drawing had already solved. */}
                <Text
                  style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}
                >
                  {coinsWorthLine(w.coins)}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Label t={t}>Have a code?</Label>
              {referral.data?.used_a_code ? (
                <Text
                  style={{
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  {referral.data.settled_in
                    ? 'Used, and settled in. The coins are in your balance.'
                    : 'Used. The coins land once you have filed something and come back another day.'}
                </Text>
              ) : (
                <>
                  <View style={styles.entryRow}>
                    <TextInput
                      value={entry}
                      onChangeText={(v) => setEntry(v.toUpperCase())}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="K7MRQ2NX"
                      placeholderTextColor={t.color.textSecondary}
                      maxLength={8}
                      style={[
                        styles.input,
                        {
                          color: t.color.textPrimary,
                          borderColor: t.color.borderStructure,
                          backgroundColor: t.color.surfaceInset,
                          fontFamily: t.typography.textBody.fontFamily,
                        },
                      ]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void redeem()}
                      style={({ pressed }) => [
                        styles.redeemButton,
                        {
                          borderColor: t.color.borderEmphasis,
                          backgroundColor: pressed ? t.color.surfaceInset : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: t.color.textPrimary,
                          fontFamily: t.typography.textBody.fontFamily,
                          fontWeight: '500',
                          fontSize: 14,
                        }}
                      >
                        Redeem
                      </Text>
                    </Pressable>
                  </View>
                  <Text
                    style={{
                      color: t.color.textSecondary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontSize: 12.5,
                      lineHeight: 18,
                    }}
                  >
                    {`Someone brought you here? Type their code any time in your first month — you both get ${REFERRAL_COINS}.`}
                  </Text>
                </>
              )}
              {note ? (
                <Text style={{ color: t.color.error, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
                  {note}
                </Text>
              ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Label t={t}>Spend them</Label>
              {[
                {
                  icon: 'photo_camera',
                  title: `${CREDITS_PER_RUNG} photo credits`,
                  sub: 'Yours to keep — they never expire',
                  cost: `${COINS_PER_CREDIT_RUNG}`,
                  onPress: () => router.push('/(drawer)/wallet/photo-credits'),
                },
                {
                  icon: 'door_front',
                  title: 'Tally, for the trip',
                  sub: 'Seven days of shared bills — she moves out after',
                  cost: `${WEEK_PASS_COINS}`,
                  onPress: null,
                },
                {
                  icon: 'local_mall',
                  title: 'Tote, stickers, pins',
                  sub: 'Coming soon',
                  cost: null,
                  onPress: null,
                },
              ].map((row) => (
                <View key={row.title} style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
                  <Icon name={row.icon} size={18} color={t.color.textSecondary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}
                    >
                      {row.title}
                    </Text>
                    <Text
                      style={{
                        color: t.color.textSecondary,
                        fontFamily: t.typography.textSmall.fontFamily,
                        fontSize: 11.5,
                      }}
                    >
                      {row.sub}
                    </Text>
                  </View>
                  {row.cost ? (
                    <Text
                      style={{
                        color: t.color.textPrimary,
                        fontFamily: t.typography.textBody.fontFamily,
                        fontWeight: '500',
                        fontSize: 14,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {row.cost}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Label t={t}>Where yours came from</Label>
              {w.history.length === 0 ? (
                <Text
                  style={{
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  {`Nothing yet. ${COINS_PER_PHOTO} coins is one photo — they arrive from referrals and milestones, and can be bought.`}
                </Text>
              ) : (
                w.history.map((h) => (
                  <View key={h.id} style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}
                      >
                        {coinKindLabel(h.kind)}
                      </Text>
                      <Text
                        style={{
                          color: t.color.textSecondary,
                          fontFamily: t.typography.textSmall.fontFamily,
                          fontSize: 11.5,
                        }}
                      >
                        {parseServerDate(h.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: t.color.textPrimary,
                        fontFamily: t.typography.textBody.fontFamily,
                        fontWeight: '500',
                        fontSize: 14,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {signedCoins(h.delta)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              Coins buy photos and extras. A neighbour is a subscription — coins never buy one.
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
  card: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stack: { width: 56, height: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingVertical: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, height: 44, fontSize: 16, letterSpacing: 1.5 },
  redeemButton: { borderWidth: 1, borderRadius: 4, paddingVertical: 11, paddingHorizontal: 14 },
});

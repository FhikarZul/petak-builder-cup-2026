// Bring a friend (Run B #14) — your code, and the box for someone else's.
//
// C58/C33: **code-first, never link-first.** iOS cannot reliably attribute an
// install, so the code carries the credit — which is why the code is the
// biggest thing on the screen and there is no "share link" button pretending
// to do the work.
//
// The other half of the ruling is what the copy has to be careful about:
// **both sides are paid when the newcomer SETTLES IN**, not on signup. Saying
// "you both get 100" without that clause would promise a payout on a tap.
//
// Design sweep 2 Sep 2026: rebuilt to the Run B drawing — reward hero first,
// the code card, Share, how it goes, who you have brought, terms. The "Have a
// code?" box lives on the Petak Coins screen (Run B #15), not here.
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import coinStack from '../../../../../packages/assets/sprites/coin_stack.png';
import { apiFetch } from '../../../lib/api';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { REFERRAL_COINS } from '../../../lib/dashboard';
import { referralShareMessage } from '../../../lib/referralShare';
import { useTheme } from '../../../lib/theme';

interface ReferralInfo {
  /** Null only for an account that predates bootstrap's code creation. */
  code: string | null;
  used_a_code: boolean;
  settled_in: boolean;
  invited: { redeemed: number; settled: number };
}

export default function ReferralScreen() {
  const t = useTheme();
  const [copied, setCopied] = useState(false);
  const info = useQuery({
    queryKey: ['referral'],
    queryFn: () => apiFetch<ReferralInfo>('/v1/referrals/me'),
    staleTime: 60 * 1000,
  });
  const r = info.data;

  const share = () => {
    if (!r?.code) return;
    void Share.share({
      message: referralShareMessage(r.code),
    });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Bring the street a neighbour" />
      <ScrollView contentContainerStyle={styles.body}>
        {info.isLoading ? (
          <ActivityIndicator color={t.color.textSecondary} />
        ) : !r ? (
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>
            Nothing to show yet.
          </Text>
        ) : (
          <>
            {/* The reward, said first — both sides, and only once settled. */}
            <View style={[styles.card, { backgroundColor: t.color.fillSystem, borderColor: t.color.borderStructure }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Image source={coinStack} style={{ width: 64, height: 64 }} accessibilityIgnoresInvertColors />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontWeight: '500',
                      fontSize: 24,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    You each get {REFERRAL_COINS} coins
                  </Text>
                  <Text
                    style={{
                      color: t.color.textSecondary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontSize: 13,
                      lineHeight: 19,
                    }}
                  >
                    Ten photos apiece, once they get started
                  </Text>
                </View>
              </View>
            </View>

            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 15,
                lineHeight: 24,
              }}
            >
              Send someone your code and they arrive with a welcome — not as a favour to you. You both get the
              same {REFERRAL_COINS} coins.
            </Text>

            {r.code ? (
              <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
                <Label t={t}>Your code</Label>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View
                    style={{
                      flex: 1,
                      height: 52,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: t.color.borderEmphasis,
                    }}
                  >
                    <Text
                      style={{
                        color: t.color.textPrimary,
                        fontFamily: t.typography.textBody.fontFamily,
                        fontWeight: '500',
                        fontSize: 22,
                        letterSpacing: 2,
                      }}
                    >
                      {r.code}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Copy your code"
                    onPress={() => {
                      void Clipboard.setStringAsync(r.code ?? '');
                      setCopied(true);
                    }}
                    style={({ pressed }) => [
                      styles.copyButton,
                      {
                        borderColor: t.color.borderStructure,
                        backgroundColor: pressed ? t.color.surfaceInset : 'transparent',
                      },
                    ]}
                  >
                    <Icon name={copied ? 'check' : 'content_copy'} size={20} color={t.color.textPrimary} />
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
                  They type this in when they arrive — under Have a code? on the welcome screen. It works
                  however they got here, and it does not expire.
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={share}
              disabled={!r.code}
              style={({ pressed }) => [
                styles.shareButton,
                { backgroundColor: pressed ? t.color.interactivePressed : t.color.interactive, opacity: r.code ? 1 : 0.5 },
              ]}
            >
              <Icon name="share" size={18} color={t.color.textOnInteractive} />
              <Text
                style={{
                  color: t.color.textOnInteractive,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontWeight: '500',
                  fontSize: 16,
                }}
              >
                Share
              </Text>
            </Pressable>

            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Label t={t}>How it goes</Label>
              {[
                { icon: 'waving_hand', line: 'They arrive with a welcome waiting for them.' },
                { icon: 'savings', line: `Once they are settled in, ${REFERRAL_COINS} coins each — theirs and yours.` },
              ].map((row) => (
                <View key={row.icon} style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
                  <Icon name={row.icon} size={18} color={t.color.textSecondary} />
                  <Text
                    style={{
                      flex: 1,
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontSize: 14,
                    }}
                  >
                    {row.line}
                  </Text>
                </View>
              ))}
            </View>

            {r.invited.redeemed > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(drawer)/wallet/coins')}
                style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}
              >
                <Label t={t}>From referrals so far</Label>
                <View style={[styles.row, { borderTopWidth: 0, paddingVertical: 4 }]}>
                  <Text
                    style={{
                      flex: 1,
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontSize: 14,
                    }}
                  >
                    {r.invited.redeemed} used your code · {r.invited.settled} settled in
                  </Text>
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontWeight: '500',
                      fontSize: 14,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {r.invited.settled * REFERRAL_COINS} coins
                  </Text>
                  <Icon name="chevron_right" size={20} color={t.color.textSecondary} />
                </View>
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
              Coins land when someone is settled in, not the moment they join — so nothing goes missing, it is
              just not due yet. A link cannot always tell us who sent whom, so the code is what actually counts:
              nudge them to type it if they forget.
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingVertical: 10 },
  copyButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 4,
  },
  shareButton: {
    height: 52,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

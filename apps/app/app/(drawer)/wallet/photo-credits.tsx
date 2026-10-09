// Photo credits (Run B #16) — the daily allowance and the reserve, told apart.
//
// The card exists because they are two different things that both look like
// "photos left": the DAILY allowance resets at midnight and never rolls over;
// KEPT credits never expire and are only touched once the day's are gone
// (C05/C13). A single merged number would hide which one is about to vanish.
//
// The exchange is the one action here, and the only conversion point in the
// whole economy: coins → credits, never back (C05/C07 — credits are never
// sold for cash, so they must never turn back into the thing that is bought).
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ApiError, apiFetch } from '../../../lib/api';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import {
  COINS_PER_CREDIT_RUNG,
  CREDITS_PER_RUNG,
  allowanceWords,
  coinsInPhotos,
} from '../../../lib/dashboard';
import { newClientKey } from '../../../lib/send';
import { useStreet } from '../../../lib/thread';
import { useTheme } from '../../../lib/theme';

export default function PhotoCreditsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const street = useStreet();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const s = street.data;

  const exchange = async () => {
    if (!s || busy) return;
    setBusy(true);
    setNote(null);
    try {
      await apiFetch('/v1/wallet/exchange', {
        method: 'POST',
        body: JSON.stringify({ rungs: 1, client_key: newClientKey() }),
      });
      await Promise.all([qc.invalidateQueries({ queryKey: ['street'] }), qc.invalidateQueries({ queryKey: ['wallet'] })]);
    } catch (e) {
      // Refused, never clamped: the server will not exchange fewer than asked,
      // so the screen says so instead of pretending something happened.
      setNote(
        e instanceof ApiError && e.status === 409
          ? `Not enough coins — ${COINS_PER_CREDIT_RUNG} buys ${CREDITS_PER_RUNG}.`
          : 'That did not go through. Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Photo credits" />
      <ScrollView contentContainerStyle={styles.body}>
        {street.isLoading ? (
          <ActivityIndicator color={t.color.textSecondary} />
        ) : !s ? (
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>
            Nothing to show yet.
          </Text>
        ) : (
          <>
            {(() => {
              const words = allowanceWords(s.allowance, s.residents.map((r) => r.display_name));
              return (
                <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
                  <View style={styles.half}>
                    <Label t={t}>Today</Label>
                    <Text
                      style={{
                        color: t.color.textPrimary,
                        fontFamily: t.typography.fontDisplay,
                        fontSize: 28,
                      }}
                    >
                      {words.left}
                    </Text>
                    <Text
                      style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}
                    >
                      {`Resets at midnight.${words.because ? ` ${words.because}` : ''}`}
                    </Text>
                  </View>

                  <View style={[styles.half, { borderTopColor: t.color.borderStructure, borderTopWidth: 1, paddingTop: 12 }]}>
                    <Label t={t}>Kept</Label>
                    <Text
                      style={{
                        color: t.color.textPrimary,
                        fontFamily: t.typography.fontDisplay,
                        fontSize: 28,
                      }}
                    >
                      {`${s.kept_credits}`}
                    </Text>
                    <Text
                      style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}
                    >
                      No expiry. Only touched once today's are gone.
                    </Text>
                  </View>

                  <Text
                    style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}
                  >
                    Daily first, always. The kept ones sit there until a day runs long.
                  </Text>
                </View>
              );
            })()}

            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Label t={t}>More kept credits</Label>
              <View style={styles.exchangeRow}>
                <Icon name="photo_camera" size={18} color={t.color.textSecondary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>
                    {`${CREDITS_PER_RUNG} photos`}
                  </Text>
                  <Text
                    style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 11.5 }}
                  >
                    Yours to keep — they never expire
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void exchange()}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      borderColor: t.color.borderEmphasis,
                      backgroundColor: pressed ? t.color.surfaceInset : 'transparent',
                      opacity: busy ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontWeight: '500',
                      fontSize: 13.5,
                    }}
                  >
                    {`Exchange ${COINS_PER_CREDIT_RUNG} coins`}
                  </Text>
                </Pressable>
              </View>
              <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
                {`${s.coins.toLocaleString('en-US')} coins in hand · ${coinsInPhotos(s.coins)} photos' worth`}
              </Text>
              {note ? (
                <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
                  {note}
                </Text>
              ) : null}
            </View>

            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Label t={t}>Or a wider street</Label>
              <Pressable accessibilityRole="button" onPress={() => router.push('/(drawer)/invite')} style={styles.exchangeRow}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: t.color.batu,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="add" size={18} color={t.color.interactive} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: t.color.interactive,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontWeight: '500',
                      fontSize: 14,
                    }}
                  >
                    Invite a neighbour
                  </Text>
                  <Text
                    style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 11.5 }}
                  >
                    +10 a day for good, and everything they do
                  </Text>
                </View>
                <Icon name="chevron_right" size={18} color={t.color.textSecondary} />
              </Pressable>
            </View>

            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              A neighbour widens the street; coins buy photos and extras — never a neighbour.
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
  half: { gap: 3 },
  exchangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { borderWidth: 1, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 12 },
});

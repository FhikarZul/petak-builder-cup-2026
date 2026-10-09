// App slice 3 (plan §3) — the attach sheet (was the #75 "Send a photo"
// sheet; founder ruling 3 Sep 2026). Opened by the composer's paperclip.
// Rows: "From your photos", "A document (PDF)", and — only while the field
// is FOCUSED (keyboard up) — "Take a photo"; the unfocused composer already
// carries its own immediate camera button. Run A #30-31 keeps the
// out-of-photos branch once the daily allowance is gone. Billing rows stay
// absent until RevenueCat exists.
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../lib/api';
import {
  COINS_PER_CREDIT_RUNG,
  CREDITS_PER_RUNG,
} from '../lib/dashboard';
import {
  buildWalletExchangePayload,
  newClientKey,
  sendPhotoSheetState,
} from '../lib/send';
import { useStreet } from '../lib/thread';
import { useTheme } from '../lib/theme';
import { Icon } from './Icon';

type SourceOpts = { useKeptCredit?: boolean };

export function SendPhotoSheet({
  visible,
  showCamera,
  onClose,
  onCamera,
  onLibrary,
  onDocument,
}: {
  visible: boolean;
  /** The composer field is focused (keyboard up) — offer the camera here.
   *  Unfocused: hidden, because the composer's right button IS the camera. */
  showCamera?: boolean;
  onClose: () => void;
  onCamera: (opts?: SourceOpts) => void;
  onLibrary: (opts?: SourceOpts) => void;
  onDocument: () => void;
}) {
  const t = useTheme();
  const qc = useQueryClient();
  const street = useStreet();
  const [useKeptCredit, setUseKeptCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const state = street.data
    ? sendPhotoSheetState({
        cap: street.data.allowance.cap,
        used: street.data.allowance.used,
        keptCredits: street.data.kept_credits,
        coins: street.data.coins,
      })
    : null;
  const leftToday = state?.leftToday ?? null;
  const out = state?.mode === 'out';

  useEffect(() => {
    if (visible) {
      setUseKeptCredit(false);
      setNote(null);
    }
  }, [visible]);

  const exchange = async () => {
    if (!state || busy || !state.canExchange) return;
    setBusy(true);
    setNote(null);
    try {
      await apiFetch('/v1/wallet/exchange', {
        method: 'POST',
        body: JSON.stringify(buildWalletExchangePayload(newClientKey())),
      });
      await Promise.all([qc.invalidateQueries({ queryKey: ['street'] }), qc.invalidateQueries({ queryKey: ['wallet'] })]);
      setUseKeptCredit(true);
      setNote(`${CREDITS_PER_RUNG} kept credits added.`);
    } catch (e) {
      setNote(
        e instanceof ApiError && e.status === 409
          ? `Not enough coins — ${COINS_PER_CREDIT_RUNG} buys ${CREDITS_PER_RUNG}.`
          : 'That did not go through. Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  const sourceOpts = out && useKeptCredit ? { useKeptCredit: true } : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* QA-03: the scrim is decorative + tap-to-close. It must NOT present as
          the only accessibility element, or VoiceOver/Maestro see "Close" and
          nothing inside the sheet. */}
      <Pressable style={styles.scrim} onPress={onClose} accessible={false} importantForAccessibility="no-hide-descendants">
        <Pressable
          style={[styles.sheet, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}
          onPress={() => {}}
          accessible={false}
        >
          <View style={styles.titleRow}>
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 15,
              }}
            >
              {out ? "Today's photos are used" : 'Attach'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={20} color={t.color.textSecondary} />
            </Pressable>
          </View>

          {out && state ? (
            <>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 13,
                  lineHeight: 20,
                  marginBottom: 4,
                }}
              >
                {`All ${street.data!.allowance.cap} of them. Send it anyway and Ollie will hold it until tomorrow, or spend something you already have.`}
              </Text>
              {state.canUseKeptCredit ? (
                <SheetRow
                  icon={useKeptCredit ? 'check_circle' : 'photo_camera'}
                  label="Use a kept photo"
                  detail={`${state.keptCredits} kept · never expire`}
                  onPress={() => setUseKeptCredit((v) => !v)}
                  borderColor={t.color.borderStructure}
                />
              ) : null}
              <View style={[styles.exchange, { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure }]}>
                <View style={styles.exchangeTop}>
                  <Icon name="paid" size={20} color={t.color.textSecondary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontWeight: '500', fontSize: 14 }}>
                      Exchange coins for photo credits
                    </Text>
                    <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
                      {`${state.coins.toLocaleString('en-US')} coins`}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13, lineHeight: 19 }}>
                  {state.canExchange
                    ? `${COINS_PER_CREDIT_RUNG} coins for ${CREDITS_PER_RUNG} photos that never expire.`
                    : `${COINS_PER_CREDIT_RUNG} coins for ${CREDITS_PER_RUNG} photos that never expire — ${state.exchangeShortBy} short.`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={!state.canExchange || busy}
                  onPress={() => void exchange()}
                  style={[
                    styles.exchangeButton,
                    {
                      backgroundColor: state.canExchange && !busy ? t.color.interactive : t.color.surfaceCard,
                      borderColor: t.color.borderStructure,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: state.canExchange && !busy ? t.color.textOnInteractive : t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontWeight: '500',
                      fontSize: 14,
                    }}
                  >
                    {`Exchange ${COINS_PER_CREDIT_RUNG}`}
                  </Text>
                </Pressable>
              </View>
              {note ? (
                <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
                  {note}
                </Text>
              ) : null}
            </>
          ) : null}

          {showCamera ? (
            <SheetRow
              icon="photo_camera"
              label="Take a photo"
              detail={out ? (useKeptCredit ? 'Uses a kept credit' : 'Held until tomorrow') : undefined}
              onPress={() => onCamera(sourceOpts)}
              borderColor={t.color.borderStructure}
            />
          ) : null}
          <SheetRow
            icon="photo_library"
            label="From your photos"
            detail={out ? (useKeptCredit ? 'Uses a kept credit' : 'Held until tomorrow') : undefined}
            onPress={() => onLibrary(sourceOpts)}
            borderColor={t.color.borderStructure}
          />
          <SheetRow
            icon="description"
            label="A document (PDF)"
            onPress={onDocument}
            borderColor={t.color.borderStructure}
            last
          />

          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12.5,
              lineHeight: 19,
              marginTop: 14,
            }}
          >
            One photo costs one credit. Pick as many as you like.
          </Text>
          {leftToday !== null && street.data && !out ? (
            <View style={styles.chipRow}>
              <Icon name="schedule" size={14} color={t.color.textSecondary} />
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 11.5,
                  flex: 1,
                }}
              >
                {`${leftToday} photos left today · ${street.data.kept_credits} kept credits`}
              </Text>
            </View>
          ) : null}
          {out ? (
            <View style={styles.chipRow}>
              <Icon name="schedule" size={14} color={t.color.textSecondary} />
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 11.5,
                  flex: 1,
                }}
              >
                Resets tomorrow. Free text (fair use).
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetRow({
  icon,
  label,
  detail,
  onPress,
  borderColor,
  last,
}: {
  icon: string;
  label: string;
  detail?: string;
  onPress: () => void;
  borderColor: string;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.row, { borderBottomColor: borderColor, borderBottomWidth: last ? 0 : 1 }]}
    >
      <Icon name={icon} size={22} color={t.color.textPrimary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontSize: 15,
          }}
        >
          {label}
        </Text>
        {detail ? (
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron_right" size={20} color={t.color.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  exchange: { borderWidth: 1, padding: 12, gap: 8, marginVertical: 6 },
  exchangeTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exchangeButton: {
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

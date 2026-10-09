// App slice 2 (plan §3, mirror #60–64) — the record-honesty strip: always
// the LAST row of the entry card, full width, hairline above; icon + text
// only — never a fill, border colour or semantic hue. edited/refined are
// tappable and open #61's "What changed" sheet over the trail endpoint
// (G2); estimate is NEVER tappable (there is nothing behind it yet).
// No strikethrough, no red, no badge count.
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  TRAIL_FOOTER,
  stripIcon,
  stripText,
  trailSourceLine,
  trailTimeLine,
  trailValueLabel,
  type DerivedStrip,
  type StripState,
  type TrailVersion,
} from '../lib/honesty';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';
import { usePhoto } from '../lib/thread';

export function HonestyStrip({
  strip,
  text,
  onPress,
  t,
}: {
  strip: StripState;
  /** Pre-formatted via stripText()/objectiveStripText() — never composed inline. */
  text?: string;
  /** Present ONLY for edited/refined — estimate never gets one. */
  onPress?: () => void;
  t: Theme;
}) {
  const body = (
    <>
      <Icon name={stripIcon(strip)} size={15} color={t.color.textSecondary} />
      <Text
        style={{
          flex: 1,
          color: t.color.textSecondary,
          fontFamily: t.typography.textSmall.fontFamily,
          fontSize: 12.5,
          lineHeight: 19,
        }}
      >
        {text ?? stripText({ state: strip })}
      </Text>
    </>
  );
  return (
    <View
      style={[
        styles.strip,
        { borderTopColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
      ]}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="What changed"
          style={styles.stripPress}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.stripPress}>{body}</View>
      )}
    </View>
  );
}

/**
 * #61 — "What changed": every version, newest first (check Now / history
 * Before, provenance + time), the exact footer line + open_in_full + Close.
 *
 * The footer is drawn as a 56px thumbnail of the kept photo, the line, and
 * open_in_full. It shipped with an INERT icon because the trail endpoint
 * (G2) serves no photo reference — and it still does not. The id comes from
 * the ENTRY instead, which the card already holds, so nothing new is asked of
 * the server. Where an entry has no photo (a typed entry, C20) the footer
 * degrades to the line alone: no empty well, and the icon goes with it rather
 * than sitting there doing nothing.
 */
export function WhatChangedSheet({
  visible,
  context,
  versions,
  photoId,
  onOpenPhoto,
  onClose,
  t,
}: {
  visible: boolean;
  /** "Cold Storage · groceries · Sat 8 Aug" — composed by the caller. */
  context: string;
  versions: TrailVersion[];
  /** The entry's own kept photo. Null on a typed entry (C20). */
  photoId?: string | null;
  onOpenPhoto?: (photoId: string, uri: string, caption: string, iso: string) => void;
  onClose: () => void;
  t: Theme;
}) {
  const photo = usePhoto(photoId ?? null);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.color.surfaceCard, borderTopColor: t.color.borderEmphasis },
          ]}
        >
        <View style={[styles.sheetHeader, { borderBottomColor: t.color.borderStructure }]}>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.fontDisplay,
              fontSize: 24,
            }}
          >
            What changed
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={24} color={t.color.textPrimary} />
          </Pressable>
        </View>
        <Text
          style={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 8,
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontSize: 14,
            lineHeight: 22,
          }}
        >
          {context}
        </Text>
        <View>
          {versions.map((v, i) => {
            const now = i === 0;
            return (
              <View
                key={v.id}
                style={[
                  styles.versionRow,
                  { borderTopColor: t.color.borderStructure },
                  !now && { backgroundColor: t.color.surfaceInset },
                ]}
              >
                <Icon
                  name={now ? 'check' : 'history'}
                  size={18}
                  color={now ? t.color.textPrimary : t.color.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.versionTop}>
                    <Text
                      style={{
                        color: now ? t.color.textPrimary : t.color.textSecondary,
                        fontFamily: t.typography.textBody.fontFamily,
                        fontWeight: now ? '500' : '400',
                        fontSize: 14,
                      }}
                    >
                      {now ? 'Now' : 'Before'}
                    </Text>
                    <Text
                      style={{
                        color: now ? t.color.textPrimary : t.color.textSecondary,
                        fontFamily: t.typography.textBody.fontFamily,
                        fontSize: 15,
                      }}
                    >
                      {trailValueLabel(v.value)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      marginTop: 3,
                      color: t.color.textSecondary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontSize: 12.5,
                      lineHeight: 19,
                    }}
                  >
                    {`${trailSourceLine(v.source)} · ${trailTimeLine(v.created_at)}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <View style={[styles.footer, { borderTopColor: t.color.borderStructure }]}>
          {photoId && photo.data ? (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel="The photo this was read from"
              style={styles.trailThumbTap}
              onPress={() =>
                photo.data &&
                onOpenPhoto?.(photoId, photo.data.image_url, '', versions[versions.length - 1]?.created_at ?? '')
              }
            >
              <Image
                source={{ uri: photo.data.image_url }}
                style={[styles.trailThumb, { borderColor: t.color.borderStructure }]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            </Pressable>
          ) : null}
          <Text
            style={{
              flex: 1,
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12.5,
              lineHeight: 19,
            }}
          >
            {TRAIL_FOOTER}
          </Text>
          {photoId && photo.data ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open the photo"
              hitSlop={10}
              onPress={() =>
                photo.data &&
                onOpenPhoto?.(photoId, photo.data.image_url, '', versions[versions.length - 1]?.created_at ?? '')
              }
            >
              <Icon name="open_in_full" size={20} color={t.color.interactive} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.closeWrap}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.closeButton, { backgroundColor: t.color.interactive }]}
          >
            <Text
              style={{
                color: t.color.textOnInteractive,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 15,
              }}
            >
              Close
            </Text>
          </Pressable>
        </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  strip: { borderTopWidth: 1 },
  stripPress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(32,36,46,.48)',
  },
  sheet: { borderTopWidth: 2 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  versionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    alignItems: 'flex-start',
  },
  versionTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  // #61's footer thumbnail: 56px, flex:none, hairline border, never cropped
  // into a different picture than the one that was read.
  trailThumbTap: { flex: 0 },
  trailThumb: { width: 56, height: 56, borderWidth: 1 },
  closeWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  closeButton: { height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});

// Re-exported so cards build strip copy through the ONE pure home.
export type { DerivedStrip };

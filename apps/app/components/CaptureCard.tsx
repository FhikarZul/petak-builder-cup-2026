import { CaptureVisibilityContext } from './CaptureVisibilityContext';
// A local capture appears before preparation and carries Sending until the
// server accepts it. For upload acknowledgement, the tick is the whole notification.
// Read progress stays with this photo, restored from the
// server snapshot; the last-thread activity indicator belongs to text work.
import { useContext, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { cardState, isDocument, type CapturePayload } from '../lib/capture';
import { batchTiles } from '../lib/photoBatch';
import { refreshFeedHead, usePhotoState } from '../lib/thread';
import { useTheme, type Theme } from '../lib/theme';
import { Icon } from './Icon';
import { UserAvatar } from './chat/UserAvatar';
import { CHAT_AVATAR_GAP } from '../lib/chatLayout';
import { useChatWidths } from './chat/ChatLayout';
import { CaptureProgressText } from './CaptureProgressStatus';

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CaptureCard({
  payload,
  createdAt,
  onRetry,
  onOpen,
}: {
  payload: CapturePayload;
  createdAt: string;
  onRetry: (p: CapturePayload) => void;
  onOpen: (uri: string, caption: string, iso: string) => void;
}) {
  const t = useTheme();
  const visibility = useContext(CaptureVisibilityContext);
  const widths = useChatWidths();
  const queryClient = useQueryClient();

  const serverState = usePhotoState(payload.photo_id ?? null);
  const state = cardState(payload, serverState.data?.state ?? null);

  // Filed: the server twin (the photo message + its replies) takes over —
  // refresh the thread so the local card hands off.
  useEffect(() => {
    if (serverState.data?.state === 'filed' || serverState.data?.progress?.stage === 'clarification_needed') {
      void refreshFeedHead(queryClient);
    }
  }, [serverState.data?.state, serverState.data?.progress?.stage, payload.neighbour, queryClient]);

  const document = isDocument(payload);

  return (
    <View>
      <View style={styles.userRow}>
        {/* #76: for a PHOTO the card is one bordered, padded container holding
            the image and the state row. A document brings its own bordered
            card (docCard), so it is not double-framed. */}
        <View
          style={[
            styles.userCol,
            { maxWidth: widths.user },
            document
              ? null
              : [
                  styles.captureCard,
                  { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure },
                ],
          ]}
        >
          {document ? (
            // A document is never an image: the viewer stays image-only, so
            // the card is inert — tapping does nothing (3 Sep 2026).
            <View
              accessibilityRole="text"
              accessibilityLabel={payload.caption ? `PDF receipt: ${payload.caption}` : 'PDF receipt'}
              style={[
                styles.docCard,
                { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure },
              ]}
            >
              <Icon name="description" size={22} color={t.color.textPrimary} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 14,
                  }}
                >
                  PDF receipt
                </Text>
                {payload.filename ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      color: t.color.textSecondary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontSize: 12,
                    }}
                  >
                    {payload.filename}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => onOpen(payload.local_uri, payload.caption, createdAt)}
              accessibilityRole="imagebutton"
              accessibilityLabel={payload.caption ? `Photo: ${payload.caption}` : 'Photo'}
            >
              <View style={[styles.well, { backgroundColor: t.color.surfacePage }]}>
                {/* #76: the dim rides the IMAGE and only while it is going —
                    a sent photo is not faded. */}
                <Image
                  source={{ uri: payload.local_uri }}
                  style={[StyleSheet.absoluteFill, { opacity: state === 'picked' ? 0.55 : 1 }]}
                  resizeMode="cover"
                />
              </View>
            </Pressable>
          )}
          {/* The caption rides INSIDE the card — CLAUDE.md: "Photo messages
              are captioned cards (caption + time inside the bubble)." It sits
              ABOVE the failed/sent branch because a failed upload does not
              erase what you said about the photo. The server twin renders it
              too (rows.tsx, BubbleBody); without it here the caption blinks in
              only when the twin lands, and for a byte-duplicate — which creates
              no twin — it never appears at all. */}
          {payload.caption.length > 0 ? (
            <Text
              style={[
                styles.captionLine,
                { color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily },
              ]}
            >
              {payload.caption}
            </Text>
          ) : null}
          {state === 'failed' ? (
            <View style={styles.failureRow}>
              <Text
                style={{
                  color: t.color.error,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 11.5,
                }}
              >
                {document ? "That document didn't upload." : "That photo didn't upload."}
              </Text>
              <Pressable
                onPress={() => onRetry(payload)}
                accessibilityRole="button"
                accessibilityLabel={document ? 'Try uploading the document again' : 'Try uploading the photo again'}
                style={[styles.retryButton, { borderColor: t.color.borderStructure }]}
              >
                <Icon name="refresh" size={14} color={t.color.interactive} />
                <Text
                  style={{
                    color: t.color.interactive,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 13,
                  }}
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.meta}>
              <View style={styles.metaLabel}>
                <Icon
                  name={state === 'picked' ? 'schedule' : 'check'}
                  size={14}
                  color={t.color.textSecondary}
                />
                <Text
                  key={state === 'picked' ? 'sending' : 'sent'}
                  onLayout={state === 'picked' ? () => visibility?.localLayout(payload) : undefined}
                  style={{
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 12,
                  }}
                >
                  {state === 'picked' ? 'Sending…' : 'Sent'}
                </Text>
              </View>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 11.5,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {hhmm(createdAt)}
              </Text>
            </View>
          )}
          {payload.step === 'accepted' && payload.photo_id ? <CaptureProgressText photoId={payload.photo_id} progress={serverState.data?.progress} error={serverState.isError} /> : null}
        </View>
        <UserAvatar />
      </View>
    </View>
  );
}

/**
 * The #77 batch card, as drawn: a right-aligned wrap grid of 64px thumbnails
 * (four shown) plus a "+N" overflow tile, captioned "9 photos · 21:17 · Sent".
 * Note there is NO leading "+" on the count — the drawing counts photos, it
 * does not add them.
 *
 * The thumbnails are the user's OWN local files, already on the device, so
 * this needs no server call and no presigned url.
 */
export function PhotoBatchCard({
  count,
  minute,
  uris,
  t,
}: {
  count: number;
  minute: string;
  /** Local uris of the batched captures, in send order. A batch replayed from
   *  HISTORY has none (the files are the server's, behind presigned urls), so
   *  it degrades to the summary line rather than an empty grid. */
  uris?: string[];
  t: Theme;
}) {
  const widths = useChatWidths();
  const { shown, overflow } = batchTiles(count);
  const tiles = uris ?? [];
  return (
    <View style={styles.userRow}>
      <View style={[styles.userCol, { gap: 6, maxWidth: widths.user }]}>
        {tiles.length > 0 ? (
        <View style={styles.batchGrid}>
          {tiles.slice(0, shown).map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={[styles.batchTile, { borderColor: t.color.borderStructure }]}
            />
          ))}
          {overflow > 0 ? (
            <View
              style={[
                styles.batchTile,
                styles.batchOverflow,
                { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
              ]}
            >
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontSize: 15,
                }}
              >
                {`+${overflow}`}
              </Text>
            </View>
          ) : null}
        </View>
        ) : null}
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textBody.fontFamily,
            fontSize: 12,
            textAlign: 'right',
          }}
        >
          {`${count} photos · ${minute} · Sent`}
        </Text>
      </View>
      <UserAvatar />
    </View>
  );
}

const styles = StyleSheet.create({
  batchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  batchTile: { width: 64, height: 64, borderWidth: 1 },
  batchOverflow: { alignItems: 'center', justifyContent: 'center' },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', gap: CHAT_AVATAR_GAP },
  userCol: { minWidth: 0, flexShrink: 1 },
  // #76: ONE bordered, padded card holds the image and the state row. The row
  // used to sit outside the well's border, which read as a caption under a
  // picture rather than a card reporting its own state.
  captureCard: { width: 212, borderWidth: 1, padding: 6 },
  well: { width: 200, height: 140, overflow: 'hidden' },
  docCard: {
    width: 220,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 7,
    paddingHorizontal: 2,
    paddingBottom: 1,
  },
  metaLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  captionLine: { fontSize: 14, lineHeight: 20, paddingTop: 8, paddingHorizontal: 2 },
  failureRow: { alignItems: 'flex-end', gap: 6, marginTop: 6 },
  retryButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  batch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

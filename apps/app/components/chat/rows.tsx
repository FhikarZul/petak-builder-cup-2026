import { CaptureProgressStatus } from '../CaptureProgressStatus';
// C63 — the chat ROWS, used by the merged feed (app/(drawer)/index.tsx). Extracted
// verbatim from app/thread/[neighbour].tsx on 27 Aug 2026 as W2 §3.1, a
// behaviour-preserving move with the app suite passing unchanged as the proof;
// that screen was then deleted once the feed reached parity, so this is now
// the only home for these renderers.
//
// ServerRow already took `neighbour` as a PROP, so these render correctly in a
// merged feed with a different neighbour per row — attribution, never
// navigation (C63).

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetworkState } from 'expo-network';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { tokens } from '@petak/design-system/tokens';
import { ApiError, apiFetch } from '../../lib/api';
import { sharePhoto, SHARE_PHOTO_FAILED } from '../../lib/sharePhoto';
import { orderPicker, parseSegments } from '../../lib/mentions';
import {
  NEIGHBOURS,
  type Neighbour,
  type NeighbourId,
} from '../../lib/neighbours';
import {
  indicatorRowOrder,
  noteSendEnd,
  noteSendStart,
  type WorkingNeighbour,
} from '../../lib/indicator';
import { parseBlocks, type QueueNoteBlock } from '../../lib/blocks';
import { chatReplyLayout, CHAT_AVATAR, CHAT_AVATAR_GAP } from '../../lib/chatLayout';
import { UserAvatar } from './UserAvatar';
import { ItemsToggle } from './ItemsToggle';
import { useChatWidths } from './ChatLayout';
import { compactCaptureDetails } from '../../lib/captureDetails';
import { enqueue, flush as flushOutboxFile, list as outboxList, type OutboxItem } from '../../lib/outbox';
import { buildMessageOutboxItem, newClientKey, type MessagePayload } from '../../lib/send';
import {
  type CapturePayload,
} from '../../lib/capture';
import { collapsePhotoBatches } from '../../lib/photoBatch';
import { SWIPE_TO_REFERENCE, swipeProgress, swipeTravel, swipeTriggersPin } from '../../lib/swipe';
import {
  getDismissedQueueNotes,
  dismissQueueNote,
} from '../../lib/dismissals';
import { useTheme, type Theme } from '../../lib/theme';
import { useSession } from '../../lib/supabase';
import { hhmmInTz } from '../../lib/time';
import {
  flattenThread,
  mergeSendIntoCache,
  threadKey,
  useOpenTasks,
  usePhoto,
  useStreet,
  useThreadMessages,
  useThreadOrder,
  type SendResult,
  type ThreadMessage,
} from '../../lib/thread';
import { Composer, type ComposerDraft, type ComposerReference } from '../../components/Composer';
import { GridWallpaper } from '../../components/GridWallpaper';
import { Icon } from '../../components/Icon';
import { EntryCard } from '../../components/EntryCard';
import { PageCard } from '../../components/PageCard';
import { ObjectiveTable } from '../../components/ObjectiveTable';
import { PaceMark } from '../../components/PaceMark';
import { SpendTable } from '../../components/SpendTable';
import { DayClose } from '../../components/DayClose';
import { CoinsChips } from '../../components/CoinsChips';
import { CostChips, MessageChips, MessageNote, UndoneStrip } from '../../components/MessageChips';
import { FiguresTable } from './FiguresTable';
import { MoveInPicker } from '../../components/MoveInPicker';
import { inlineEmphasis, neighbourKeywords, keywordStyle } from '../../lib/inlineEmphasis';
import { ZoomablePhoto } from '../ZoomablePhoto';
import { MealItemsTable } from './MealItemsTable';
import { ReferencedEntry } from '../../components/ReferencedEntry';
import { ReceiptPlates } from './ReceiptPlates';
import { ReceiptDetail } from './ReceiptDetail';
import { MealDetail } from './MealDetail';
import { TaskActionsRow, UndoRow, QueueNoteActionsRow } from '../../components/AskButtons';
import { ProfileForm } from '../../components/ProfileForm';
import { WorkingIndicator } from '../../components/WorkingIndicator';
import { SendPhotoSheet } from '../../components/SendPhotoSheet';
import { CaptureCard, PhotoBatchCard } from '../../components/CaptureCard';
import { savePhotoToLibrary } from '../../lib/savePhoto';
import { shouldShowQuote } from '../../lib/quote';
import { failureLine, type SendRecovery } from '../../lib/send';

// The ONE ephemeral resume line (C18; founder-ruled copy 26 Aug) — a
// client-local line in the thread's neighbour's voice, never persisted.
export const RESUME_LINE = 'Back with you — everything you sent is on its way.';
export const RESUME_LINE_MS = 8_000;

// C18 offline line — Ink icon + text, never a banner.
export const OFFLINE_LINE = "You're offline — keep sending, everything queues";

/** Optimistic outbox bubble (C18): queued, or terminally failed with inline retry. */
export interface LocalMessage {
  clientKey: string;
  text: string;
  clientSentAt: string;
  refMessageId: string | null;
  state: 'queued' | 'failed';
  /** C111: this send can NEVER succeed as written (a 400 on the message
   *  itself), so no retry is offered. An affordance that always fails is worse
   *  than an honest dead end — the user keeps paying attention to it. */
  permanent?: boolean;
}

export interface PinnedReference {
  id: string;
  photoId: string | null;
  mine: boolean;
  excerpt: string;
  /** C63 — in a MERGED feed the referenced message's owner varies per row, so
   *  the pin carries it. Null when the message is the user's own (the user has
   *  no colour). The per-neighbour screen leaves it null: the screen IS the
   *  owner. */
  neighbour?: string | null;
}

/** A capture card in flight (or settled this session) — outbox-backed (C18). */
export interface LocalCapture {
  payload: CapturePayload;
  createdAt: string;
}

/** Run A #8's viewer subtitle: the DATE as well as the time — "10 Aug, 21:17".
 *  A photo you open is often days old, and the bare clock said nothing about
 *  which day it came from. */
export function dayTimeLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${day}, ${hhmm(iso)}`;
}

export function hhmm(iso: string, tz: string | null = null): string {
  return hhmmInTz(iso, tz);
}

export function excerptOf(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function SwipeToReference({
  onPin,
  children,
}: {
  onPin: () => void;
  children: React.ReactNode;
}) {
  // Tuning lives in lib/swipe.ts: swipe right wins over scroll hesitation
  // (shallow activation, generous vertical band) but never hijacks
  // scrolling — the pin needs a decisive 64px rightward travel.
  //
  // z8v0kmqxf5 — the founder: "i cant see the animation (i.e. the message
  // Move), make the animation so it feels like marking". There was none: this
  // read translationX ONCE on release and fired a callback, so the row could
  // not move at any point in the gesture. A gesture with no feedback cannot
  // teach itself, and with nothing moving there was nothing to say where the
  // 64px threshold was — a short swipe silently did nothing and read exactly
  // like a broken feature.
  //
  // RN's own Animated, not Reanimated: the app has no babel.config.js, so the
  // worklet plugin is not configured and a worklet would fail at runtime.
  // `runOnJS(true)` is already set on this gesture, so the handlers run on the
  // JS thread and setValue is the right tool; transform and opacity still go
  // over the native driver.
  const t = useTheme();
  const dx = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;

  const settle = useCallback(() => {
    // A spring home, because the row is snapping back to where it belongs
    // rather than being placed. Both drivable natively.
    Animated.spring(dx, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
    Animated.timing(mark, { toValue: 0, duration: 140, useNativeDriver: true }).start();
  }, [dx, mark]);

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(SWIPE_TO_REFERENCE.activeOffsetX)
    .failOffsetY(SWIPE_TO_REFERENCE.failOffsetY)
    .onUpdate((e) => {
      dx.setValue(swipeTravel(e.translationX));
      mark.setValue(swipeProgress(e.translationX));
    })
    .onEnd((e) => {
      if (swipeTriggersPin(e.translationX)) onPin();
      settle();
    })
    // A cancelled gesture (the list took over the scroll) must not strand the
    // row off to the right.
    .onFinalize(settle);

  return (
    <GestureDetector gesture={swipe}>
      <View>
        {/* The mark lives in the gutter the row uncovers as it travels, so the
            threshold is visible BEFORE the finger lifts rather than discovered
            after. System teal: this is app-level furniture, not a domain, and
            C01 keeps a domain accent for WHO. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.swipeMark,
            { opacity: mark, transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
          ]}
        >
          <View style={[styles.swipeMarkDot, { backgroundColor: t.color.domainSystem }]} />
        </Animated.View>
        <Animated.View style={{ transform: [{ translateX: dx }] }}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

/** Mention chip inside a sent bubble (plan §5: the chip rides the sent message). */
export function MentionChip({ id, t }: { id: NeighbourId; t: Theme }) {
  const n = NEIGHBOURS[id];
  return (
    <View
      style={[
        styles.mentionChip,
        {
          borderColor: t.color.borderStructure,
          borderLeftColor: t.color[n.domain],
          backgroundColor: t.color.surfacePage,
        },
      ]}
    >
      <Image source={n.head} style={styles.mentionHead} />
      <Text
        style={{
          color: t.color.textPrimary,
          fontFamily: t.typography.textSmall.fontFamily,
          fontWeight: '500',
          fontSize: 14,
        }}
      >
        {n.name}
      </Text>
    </View>
  );
}

/** Bubble body with mention segments rendered as chips (name-only text stays plain). */
export function BubbleBody({ body, t, category, keywords, brandedEmphasis = false }: { body: string; t: Theme; category?: string; keywords?: string[]; brandedEmphasis?: boolean }) {
  const bodyStyle = {
    color: t.color.textPrimary,
    fontFamily: t.typography.textBody.fontFamily,
    fontSize: 15,
    lineHeight: 24,
  } as const;
  const renderText = (value: string) => inlineEmphasis(value, category, keywords).map((part, i) => (
    <Text key={i} style={part.bold ? (brandedEmphasis ? keywordStyle(part.text) : { fontFamily: 'PlusJakartaSans_500Medium', fontWeight: '500' }) : undefined}>{part.text}</Text>
  ));
  const segments = parseSegments(body);
  if (!segments.some((s) => s.kind === 'mention')) {
    return <Text style={bodyStyle}>{renderText(body)}</Text>;
  }
  return (
    <View style={styles.bodyWrap}>
      {segments.map((s, i) =>
        s.kind === 'mention' ? (
          <MentionChip key={i} id={s.neighbour} t={t} />
        ) : (
          <Text key={i} style={bodyStyle}>
            {renderText(s.text)}
          </Text>
        ),
      )}
    </View>
  );
}

/** The ref_message_id quote chip — above the bubble body, owner's domain accent. */
export function QuoteChip({
  target,
  ownerName,
  accent,
  t,
  onPress,
}: {
  target: ThreadMessage;
  ownerName: string;
  accent: string;
  t: Theme;
  onPress?: () => void;
}) {
  // A quoted DOCUMENT never renders its presigned url in an Image — the
  // document icon stands in (the viewer stays image-only).
  const targetIsDocument = target.content_type === 'application/pdf';
  const photo = usePhoto(targetIsDocument ? null : target.photo_id);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Open message from ${ownerName}` : undefined}
      onPress={onPress}
      style={[
        styles.quoteChip,
        { borderLeftColor: accent, backgroundColor: t.color.surfaceInset },
      ]}
    >
      {target.photo_id ? (
        targetIsDocument ? (
          <View style={[styles.quoteThumb, styles.quoteThumbWell, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfacePage }]}>
            <Icon name="description" size={18} color={t.color.textSecondary} />
          </View>
        ) : photo.data ? (
          <Image source={{ uri: photo.data.image_url }} style={styles.quoteThumb} />
        ) : (
          <View style={[styles.quoteThumb, styles.quoteThumbWell, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfacePage }]}>
            <Icon name="image" size={18} color={t.color.textSecondary} />
          </View>
        )
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontWeight: '500',
            fontSize: 12,
          }}
        >
          {target.photo_id
            ? targetIsDocument
              ? `${target.role === 'user' ? 'your document' : `${ownerName}'s document`} · ${hhmm(target.created_at)}`
              : `${target.role === 'user' ? 'your photo' : `${ownerName}'s photo`} · ${hhmm(target.created_at)}`
            : ownerName}
        </Text>
        {!target.photo_id ? (
          <Text
            numberOfLines={2}
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12.5,
            }}
          >
            {excerptOf(target.body)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A server-filed document (0029): the SAME card a local document capture
 *  shows — description icon + "PDF receipt" — and inert: the fullscreen
 *  viewer stays image-only, so there is no tap target here, ever. */
export function DocumentWell({ t }: { t: Theme }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="PDF receipt"
      style={[
        styles.docWell,
        { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure },
      ]}
    >
      <Icon name="description" size={22} color={t.color.textPrimary} />
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
    </View>
  );
}

/** Photo well + open_in_full badge; the tap opens the full-screen viewer (canon: EVERY photo). */
export function PhotoWell({
  photoId,
  caption,
  iso,
  t,
  onOpen,
}: {
  photoId: string;
  caption: string;
  iso: string;
  t: Theme;
  onOpen: (photoId: string, uri: string, caption: string, iso: string) => void;
}) {
  const photo = usePhoto(photoId);
  return (
    <Pressable
      onPress={() => photo.data && onOpen(photoId, photo.data.image_url, caption, iso)}
      accessibilityRole="imagebutton"
      accessibilityLabel={caption ? `Photo: ${caption}` : 'Photo'}
    >
      <View
        style={[
          styles.photoWell,
          { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure },
        ]}
      >
        {photo.data ? (
          <Image source={{ uri: photo.data.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.photoWellEmpty}>
            <Icon name="image" size={26} color={t.color.textSecondary} />
          </View>
        )}
        <View
          style={[
            styles.photoBadge,
            { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure },
          ]}
        >
          <Icon name="open_in_full" size={16} color={t.color.textPrimary} />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Run C #77's queue note, as drawn: a SOLID system card, full thread width,
 * with Ollie's attribution above it and a record-honesty-style
 * footer strip at the bottom.
 *
 * It used to ship as the #68 visitor bubble — dashed edge, 280px, "Ollie,
 * visiting this thread". That treatment meant he had stepped into someone
 * ELSE's thread, and after C63 there is only one feed to be in, so nobody is
 * visiting anywhere.
 *
 * The footer is the line that stops a user thinking they were billed for
 * photos they never got. It did not exist in code at all.
 */
export function QueueNoteCard({
  body,
  createdAt,
  timeZone = null,
  waiting,
  actions,
  t,
}: {
  body: string;
  createdAt: string;
  timeZone?: string | null;
  waiting: number;
  actions?: { onChoose: () => void; onLeave: () => void };
  t: Theme;
}) {
  const ollie = NEIGHBOURS.ollie;
  return (
    <View>
      <View style={styles.structuredHeading}>
        <Image source={ollie.head} style={[styles.head, { borderColor: t.color.borderStructure }]} />
        <View style={styles.metaLine}>
          <Text style={{ color: t.color.textPrimary, fontWeight: '500', fontSize: 13 }}>{ollie.name}</Text>
          <Text style={{ color: t.color.textSecondary, fontSize: 11.5 }}>{`· ${ollie.roleWord}`}</Text>
          <Text style={{ color: t.color.textSecondary, fontSize: 11.5 }}>{hhmm(createdAt, timeZone)}</Text>
        </View>
      </View>
      <View
        style={{
          borderWidth: 1,
          borderColor: t.color.borderStructure,
          borderLeftWidth: 2,
          borderLeftColor: t.color[ollie.domain],
          backgroundColor: t.color.surfaceCard,
        }}
      >
      <Text
        style={{
          color: t.color.textPrimary,
          fontFamily: t.typography.textBody.fontFamily,
          fontSize: 15,
          lineHeight: 24,
          padding: 12,
        }}
      >
        {body}
      </Text>
      {actions ? (
        <QueueNoteActionsRow waiting={waiting} onChoose={actions.onChoose} onLeave={actions.onLeave} t={t} />
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          padding: 12,
          borderTopWidth: 1,
          borderTopColor: t.color.borderStructure,
          backgroundColor: t.color.surfaceInset,
        }}
      >
        <Icon name="schedule" size={15} color={t.color.textSecondary} />
        <Text
          style={{
            flex: 1,
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 12.5,
            lineHeight: 19,
          }}
        >
          {/* DRAFT copy, modelled on #77 — founder wordsmiths. The SHAPE
              binds: nothing deleted, nothing charged, it reads itself. */}
          {`Nothing is deleted and nothing was charged for the ${waiting}. The queue reads itself at midnight.`}
        </Text>
      </View>
      </View>
    </View>
  );
}

export const ServerRow = memo(function ServerRow({
  userDisplayName,
  message,
  showHead,
  neighbour,
  t,
  byId,
  prevMessageId = null,
  openTasks,
  onPin,
  onQuotePress,
  onSend,
  onOpenPhoto,
  onSubmitProfile,
  queueActions,
  residents,
  onMoveIn,
  timeZone = null,
}: {
  message: ThreadMessage;
  showHead: boolean;
  neighbour: Neighbour;
  t: Theme;
  byId: Map<string, ThreadMessage>;
  /** The message rendered immediately BEFORE this one, or null. A reply whose
   *  quote target IS that message needs no quote — the user is looking at it. */
  prevMessageId?: string | null;
  /** The server's OPEN task ids; undefined (not yet loaded) renders buttons ACTIVE. */
  openTasks: Set<string> | undefined;
  onPin: (m: ThreadMessage) => void;
  onQuotePress?: (messageId: string) => void;
  /** QA-07/08: an optional task_id lets button taps answer the exact task they belong to. */
  onSend: (wireText: string, taskId?: string) => void;
  onOpenPhoto: (photoId: string, uri: string, caption: string, iso: string) => void;
  /** Milo's one-go form (6 Sep 2026). Submits every filled field at once
   *  instead of walking the questions; typed answers still work unchanged. */
  onSubmitProfile?: (taskId: string, profile: Record<string, string | number>) => Promise<void>;
  /** §7: the queue note's LOCAL actions. readableNow null = street not loaded (no buttons). */
  queueActions: {
    readableNow: number | null;
    onChoose: () => void;
    onLeave: (messageId: string) => void;
  };
  residents: string[];
  onMoveIn: (neighbour: 'penny' | 'mira' | 'milo') => Promise<void>;
  /** The user's anchored timezone; null renders device-local clocks (the default). */
  userDisplayName?: string | null;
  timeZone?: string | null;
}) {
  const widths = useChatWidths();
  const session = useSession();
  const mine = message.role === 'user';
  const blocks = useMemo(() => (mine ? [] : parseBlocks(message.blocks)), [message.blocks, mine]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // C19's reference is real data and always stored; SHOWING it is only useful
  // when it disambiguates. Quoting the row directly above prints the same
  // sentence twice, one screen apart, on every turn (4 Sep E2E).
  const refTarget =
    message.ref_message_id && shouldShowQuote(message.ref_message_id, prevMessageId)
      ? byId.get(message.ref_message_id)
      : undefined;

  const quote = refTarget ? (
    (() => {
      const refNeighbour = (refTarget as ThreadMessage & { neighbour?: string }).neighbour;
      const refOwner = refNeighbour ? NEIGHBOURS[refNeighbour as NeighbourId] : null;
      return (
    <QuoteChip
      target={refTarget}
      ownerName={refTarget.role === 'user' ? 'you' : refOwner?.name ?? neighbour.name}
      accent={refTarget.role === 'user' ? t.color.borderEmphasis : t.color[refOwner?.domain ?? neighbour.domain]}
      t={t}
      onPress={onQuotePress ? () => onQuotePress(refTarget.id) : undefined}
    />
      );
    })()
  ) : null; // degrade to nothing when the target isn't in the loaded pages

  const body = (
    <>
      {message.photo_id ? (
        message.content_type === 'application/pdf' ? (
          <DocumentWell t={t} />
        ) : (
          <PhotoWell
            photoId={message.photo_id}
            caption={message.body}
            iso={message.created_at}
            t={t}
            onOpen={onOpenPhoto}
          />
        )
      ) : null}
      {mine && message.photo_id ? <CaptureProgressStatus photoId={message.photo_id} /> : null}
      {message.body.length > 0 ? <BubbleBody body={message.body} t={t} brandedEmphasis={message.role === 'assistant'} category={blocks.find(b => b.kind === 'category_pill')?.category} keywords={neighbourKeywords(blocks)} /> : null}
    </>
  );

  const openProfile = () => router.push('/(drawer)/settings/your-details');

  if (mine) {
    const userName =
      userDisplayName ??
      (session?.user?.user_metadata?.full_name as string | undefined) ??
      (session?.user?.user_metadata?.name as string | undefined) ??
      session?.user?.email?.split('@')[0] ??
      'You';
    return (
      <SwipeToReference onPin={() => onPin(message)}>
        <View style={styles.userRow}>
          <View style={[styles.userCol, { maxWidth: widths.user }]}>
            <Pressable onPress={openProfile} accessibilityRole="button" accessibilityLabel="Open your profile" style={styles.userMeta}>
              <Text style={[styles.userName, { color: t.color.textPrimary, fontFamily: t.typography.textSmall.fontFamily }]}>{userName}</Text>
              <Text style={[styles.metaSecondary, { color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily }]}>· {hhmm(message.created_at, timeZone)}</Text>
            </Pressable>
            <View
              style={[
                styles.bubble,
                styles.userBubble,
                { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure },
              ]}
            >
              {quote}
              {body}
            </View>
          </View>
          <Pressable onPress={openProfile} accessibilityRole="button" accessibilityLabel="Open your profile">
            <UserAvatar />
          </Pressable>
        </View>
      </SwipeToReference>
    );
  }

  // ---- blocks (plan §2): a block DECORATES the message — the body above
  // always renders; unknown/malformed kinds have already dropped out.
  const pageBlock = blocks.find((b) => b.kind === 'page' || b.kind === 'draft');
  const visitorBlock = blocks.find((b) => b.kind === 'visitor');
  const taskActions = blocks.filter((b) => b.kind === 'task_actions');
  const profileForm = blocks.find((b) => b.kind === 'profile_form');
  const undoBlocks = blocks.filter((b) => b.kind === 'undo');
  // #72 — a footnote sits BELOW the buttons, so it renders after them.
  const noteBlocks = blocks.filter((b) => b.kind === 'note');
  // #69 — the record-honesty strip on a reply that WAS an undo.
  const undoneStrip = blocks.some((b) => b.kind === 'undone');
  // #66 — the weekly draft's figures, under the page and above its actions.
  const figures = blocks.filter((b) => b.kind === 'figures');
  // #65 — a reflection page's two ways back into the writing. Not an ask, so
  // they are rendered as quiet text links rather than answer buttons: nothing
  // here is waiting on the user.
  const pageActions = blocks.find((b) => b.kind === 'page_actions');
  const coinsBlocks = blocks.filter((b) => b.kind === 'coins');
  // #50 + the small-chips bucket: semantic tokens under the LINE, not on a card.
  const chipTokens = blocks.flatMap((b) => (b.kind === 'chips' ? b.tokens : []));
  // #43 — values for {placeholders} in chip labels, merged across chip blocks.
  const chipValues = Object.assign({}, ...blocks.map((b) => (b.kind === 'chips' ? (b.values ?? {}) : {}))) as Record<
    string,
    string
  >;
  const entryCards = blocks.filter((b) => b.kind === 'entry_card');
  const receiptDetails = blocks.filter((b) => b.kind === 'receipt_detail');
  const mealDetails = blocks.filter((b) => b.kind === 'meal_detail');
  const compactDetails = compactCaptureDetails(message.blocks, [...receiptDetails, ...mealDetails]);
  const objectiveTables = blocks.filter((b) => b.kind === 'objective_table');
  const queueNote = blocks.find((b) => b.kind === 'queue_note') as QueueNoteBlock | undefined;
  // W5 — the three structured answers. Each sits where its drawing puts it:
  // the close-out rows INSIDE the bubble (they are part of the sentence), the
  // pace mark BELOW the prose but still in the bubble (bar + its chip footer),
  // and the week table as its own card UNDER the bubble.
  const dayCloses = blocks.filter((b) => b.kind === 'day_close');
  const paceMarks = blocks.filter((b) => b.kind === 'pace_mark');
  const spendTables = blocks.filter((b) => b.kind === 'spend_table');
  const costChips = blocks.filter((b) => b.kind === 'cost_chips');
  const moveInPicker = blocks.find((b) => b.kind === 'move_in_picker');
  // #70 — the entry the ask is ABOUT. Between the question and the buttons,
  // because that is the order the user needs it in.
  const referenced = blocks.filter((b) => b.kind === 'referenced_entry');
  // #71 — the reverse lookup: the plates linked to a receipt, inside Penny's
  // answer. The chip and the footer open the other entry, never a merged record.
  const receiptPlates = blocks.filter((b) => b.kind === 'receipt_plates');
  // §7 (economy.md): the buttons render ONLY when the queue outruns what can
  // read today — a real choice; otherwise the queue reads itself at midnight.
  const showQueueActions =
    queueNote !== undefined &&
    queueActions.readableNow !== null &&
    queueNote.waiting > queueActions.readableNow;

  // A closed task (absent from the open set) renders its buttons inert —
  // one undo per action, asked once; nothing expires locally.
  const isOpen = (taskId: string) => (openTasks === undefined ? true : openTasks.has(taskId));

  // #77: the queue note is its OWN full-width card, not a bubble.
  if (queueNote) {
    return (
      <QueueNoteCard
        body={message.body}
        createdAt={message.created_at}
        timeZone={timeZone}
        waiting={queueNote.waiting}
        actions={
          showQueueActions
            ? {
                onChoose: queueActions.onChoose,
                onLeave: () => queueActions.onLeave(message.id),
              }
            : undefined
        }
        t={t}
      />
    );
  }

  // Page/draft geometry (#65–67): full thread width, the #67 rule enforced
  // by geometry — the long form IS its own component, never a wide bubble.
  if (pageBlock && (pageBlock.kind === 'page' || pageBlock.kind === 'draft')) {
    const first = taskActions[0];
    return (
      <SwipeToReference onPin={() => onPin(message)}>
        <View>
          <PageCard
          kind={pageBlock.kind}
          title={pageBlock.title}
          dateline={pageBlock.dateline}
          emotion={pageBlock.kind === 'page' ? pageBlock.emotion : null}
          body={message.body}
          figures={figures}
          neighbour={neighbour}
          actions={
            first && first.kind === 'task_actions'
              ? { labels: first.labels, open: isOpen(first.taskId), taskId: first.taskId, onSend }
              : undefined
          }
          t={t}
        />
        </View>
      </SwipeToReference>
    );
  }

  // #68 — the visitor treatment: dashed edge, the 2px ring on his head, the
  // domain rule, and the chip — never a different header. An unknown
  // visitor id degrades to the resident's ordinary bubble.
  const visitor =
    visitorBlock && visitorBlock.kind === 'visitor'
      ? NEIGHBOURS[visitorBlock.from as NeighbourId]
      : undefined;
  const speaker = visitor ?? neighbour;
  const openSpeaker = () => {
    if (speaker.id === 'ollie') router.push('/(drawer)/board');
    else if (speaker.id === 'penny') router.push('/(drawer)/dashboards/penny');
    else if (speaker.id === 'milo') router.push('/(drawer)/dashboards/milo');
    else if (speaker.id === 'mira') router.push('/(drawer)/dashboards/mira');
  };

  // One wrapper around the WHOLE row: the bubble AND the cards under it
  // (move-in picker, entry/receipt/meal cards, tables) — a swipe right
  // anywhere on the row pins the message for reply (C19).
  //
  const layout = chatReplyLayout(blocks, showHead);
  return (
    <SwipeToReference onPin={() => onPin(message)}>
      <View>
        <View style={layout.speakerAbove ? styles.structuredRow : styles.assistantRow}>
          {!layout.speakerAbove && (showHead ? (
            <Image
              source={speaker.head}
              style={[
                styles.head,
                visitor
                  ? { borderColor: t.color.borderEmphasis, borderWidth: 2 }
                  : { borderColor: t.color.borderStructure },
              ]}
            />
          ) : (
            <View style={styles.headSpacer} />
          ))}
          <View style={[styles.assistantCol, layout.fullWidth ? styles.structuredCol : { maxWidth: widths.assistant }]}>
            {layout.showSpeaker ? (
              <View style={layout.speakerAbove ? styles.structuredHeading : undefined}>
                {layout.speakerAbove ? (
                  <Image source={speaker.head} style={[styles.head, {
                    borderColor: visitor ? t.color.borderEmphasis : t.color.borderStructure,
                    borderWidth: visitor ? 2 : 1,
                  }]} />
                ) : null}
              <View style={styles.metaLine}>
                <Pressable onPress={openSpeaker} accessibilityRole="button" accessibilityLabel={`Open ${speaker.name}'s dashboard`}>
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontWeight: '500',
                      fontSize: 13,
                    }}
                  >
                    {speaker.name}
                  </Text>
                </Pressable>
                <Text style={[styles.metaSecondary, { color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily }]}>
                  · {speaker.roleWord}
                </Text>
                <Text style={[styles.metaSecondary, { color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily }]}>
                  {hhmm(message.created_at, timeZone)}
                </Text>
              </View>
              </View>
            ) : null}
            <View
              style={[
                styles.blockBubble,
                !layout.fullWidth ? styles.intrinsicBubble : null,
                visitor
                  ? {
                      backgroundColor: t.color.surfacePage,
                      borderColor: t.color.borderEmphasis,
                      borderStyle: 'dashed',
                      borderLeftColor: t.color[visitor.domain],
                      borderLeftWidth: 2,
                    }
                  : {
                      backgroundColor: t.color.surfaceCard,
                      borderColor: t.color.borderStructure,
                      borderLeftColor: t.color[neighbour.domain],
                      borderLeftWidth: 2,
                    },
              ]}
            >
              <View style={styles.blockBubbleContent}>
                {quote}
                {body}
                {coinsBlocks.length > 0 ? (
                  <CoinsChips
                    blocks={coinsBlocks.filter((b) => b.kind === 'coins')}
                    t={t}
                  />
                ) : null}
                {chipTokens.length > 0 ? <MessageChips tokens={chipTokens} values={chipValues} t={t} /> : null}
                {compactDetails && mealDetails.length > 0 ? (
                  <>
                    <ItemsToggle open={detailsOpen} onPress={() => setDetailsOpen(value => !value)} t={t} />
                    {detailsOpen ? <MealItemsTable items={mealDetails} t={t} /> : null}
                  </>
                ) : null}
                {dayCloses.map((b, i) =>
                  b.kind === 'day_close' ? <DayClose key={`dc-${i}`} block={b} t={t} /> : null,
                )}
                {costChips.map((b, i) =>
                  b.kind === 'cost_chips' ? <CostChips key={`cc-${i}`} block={b} t={t} /> : null,
                )}
              </View>
              {paceMarks.map((b, i) =>
                b.kind === 'pace_mark' ? <PaceMark key={`pm-${i}`} block={b} t={t} /> : null,
              )}
              {referenced.map((b, i) =>
                b.kind === 'referenced_entry' ? (
                  <ReferencedEntry
                    key={`re-${i}`}
                    block={b}
                    // Every photo opens full-screen, recalled ones included.
                    // No caption: the row is not the photo's own message, and
                    // borrowing this bubble's words would misattribute them.
                    onOpen={(id, url) => onOpenPhoto(id, url, '', b.at ?? message.created_at)}
                    t={t}
                  />
                ) : null,
              )}
              {receiptPlates.map((b, i) =>
                b.kind === 'receipt_plates' ? (
                  <ReceiptPlates key={`rp-${i}`} block={b} onOpenPhoto={onOpenPhoto} t={t} />
                ) : null,
              )}
              {taskActions.map((b) =>
                b.kind === 'task_actions' ? (
                  <TaskActionsRow
                    key={b.taskId}
                    block={b}
                    open={isOpen(b.taskId)}
                    onSend={onSend}
                    t={t}
                  />
                ) : null,
              )}
              {profileForm?.kind === 'profile_form' && onSubmitProfile ? (
                <ProfileForm
                  block={profileForm}
                  parentBody={message.body}
                  open={isOpen(profileForm.taskId)}
                  onSubmit={onSubmitProfile}
                  t={t}
                />
              ) : null}
              {figures.map((b, i) =>
                b.kind === 'figures' ? (
                  <View key={`fig-${i}`} style={styles.belowCard}>
                    <FiguresTable block={b} t={t} />
                  </View>
                ) : null,
              )}
              {pageActions?.kind === 'page_actions' ? (
                <View style={[styles.pageActions, { borderTopColor: t.color.borderStructure }]}>
                  {pageActions.labels.map((label) => (
                    <Pressable key={label} accessibilityRole="button" onPress={() => onSend(label)} hitSlop={10}>
                      <Text
                        style={{
                          color: t.color.interactive,
                          fontFamily: t.typography.textBody.fontFamily,
                          fontWeight: '500',
                          fontSize: 14,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {noteBlocks.map((b, i) => (b.kind === 'note' ? <MessageNote key={`${b.token}-${i}`} token={b.token} t={t} /> : null))}
              {undoneStrip ? <UndoneStrip at={hhmm(message.created_at, timeZone)} t={t} /> : null}
              {undoBlocks.map((b) =>
                b.kind === 'undo' ? (
                  <UndoRow
                    key={b.taskId}
                    block={b}
                    open={isOpen(b.taskId)}
                    onSend={onSend}
                    t={t}
                  />
                ) : null,
              )}
            </View>
            {visitor ? (
              <View
                style={[
                  styles.visitorChip,
                  { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
                ]}
              >
                <Icon name="door_front" size={14} color={t.color.textPrimary} />
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontWeight: '500',
                    fontSize: 11.5,
                  }}
                >
                  {`${visitor.name}, visiting this thread`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {moveInPicker && moveInPicker.kind === 'move_in_picker' ? (
        <View style={styles.moveInCard}>
          <MoveInPicker
            neighbours={moveInPicker.neighbours}
            residents={residents}
            onMoveIn={onMoveIn}
            t={t}
          />
        </View>
      ) : null}
      {entryCards.map((b) =>
        b.kind === 'entry_card' ? (
          <View key={b.entryId} style={styles.belowCard}>
            <EntryCard block={b} t={t} onOpenPhoto={onOpenPhoto} />
          </View>
        ) : null,
      )}
      {compactDetails && receiptDetails.length > 0 ? (
        <View style={styles.belowCard}>
          <ItemsToggle open={detailsOpen} onPress={() => setDetailsOpen(value => !value)} t={t} />
        </View>
      ) : null}
      {(!compactDetails || detailsOpen) && receiptDetails.map((b, i) =>
        b.kind === 'receipt_detail' ? (
          <View key={`rd-${i}`} style={styles.belowCard}>
            <ReceiptDetail block={b} t={t} />
          </View>
        ) : null,
      )}
      {!compactDetails && mealDetails.map((b, i) =>
        b.kind === 'meal_detail' ? (
          <View key={`md-${i}`} style={styles.belowCard}>
            <MealDetail block={b} t={t} />
          </View>
        ) : null,
      )}
      {objectiveTables.map((b, i) =>
        b.kind === 'objective_table' ? (
          <View key={i} style={styles.belowCard}>
            <ObjectiveTable block={b} createdAt={message.created_at} t={t} />
          </View>
        ) : null,
      )}
      {spendTables.map((b, i) =>
        b.kind === 'spend_table' ? (
          <View key={`st-${i}`} style={styles.belowCard}>
            <SpendTable block={b} t={t} />
          </View>
        ) : null,
      )}
      </View>
    </SwipeToReference>
  );
});

export function LocalRow({
  local,
  t,
  onRetry,
}: {
  local: LocalMessage;
  t: Theme;
  onRetry: (l: LocalMessage) => void;
}) {
  const widths = useChatWidths();
  const failed = local.state === 'failed';
  // C111 — a 400 on the message body is terminal: re-sending it unchanged
  // fails identically, forever. The founder hit exactly that (two 400s three
  // seconds apart: the send, then his retry) and read the whole thing as the
  // app simply not responding.
  const recovery: SendRecovery = failed
    ? local.permanent
      ? { kind: 'permanent' }
      : { kind: 'retry' }
    : { kind: 'retry' };
  return (
    <View style={styles.userRow}>
      <View style={[styles.userCol, { maxWidth: widths.user }]}>
        <View
          style={[
            styles.bubble,
            styles.userBubble,
            { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure },
          ]}
        >
          <BubbleBody body={local.text} t={t} />
        </View>
        <View style={styles.localMeta}>
          {failed ? (
            // A retryable failure keeps its tap target; a permanent one is a
            // plain line, because tapping it can only fail again. Bumped from
            // 11.5px: the founder did not see this at all, and a message that
            // did not send is not a footnote.
            local.permanent ? (
              <Text
                style={{
                  color: t.color.error,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12.5,
                  fontWeight: '500',
                }}
              >
                {failureLine(recovery)}
              </Text>
            ) : (
              <Pressable onPress={() => onRetry(local)} hitSlop={8} accessibilityRole="button">
                <Text
                  style={{
                    color: t.color.error,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 12.5,
                    fontWeight: '500',
                  }}
                >
                  {failureLine(recovery)}
                </Text>
              </Pressable>
            )
          ) : (
            // queued glyph at secondary-ink opacity (C18)
            <Icon name="schedule" size={13} color={t.color.textSecondary} />
          )}
          <Text style={[styles.time, { color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily }]}>
            {hhmm(local.clientSentAt)}
          </Text>
        </View>
      </View>
      <UserAvatar />
    </View>
  );
}

/** Clear-chat greeting (founder ruling 1 Sep 2026): a cleared view is never
 * blank. Ollie — always resident as the concierge — greets by first name,
 * reassures that nothing was lost, restates today's numbers, and opens the
 * floor. Client-local only; the server keeps the real history untouched. */
export function GreetingRow({
  name,
  allowance,
  neighbour,
  t,
}: {
  name: string | null;
  allowance: string | null;
  neighbour: Neighbour;
  t: Theme;
}) {
  const widths = useChatWidths();
  return (
    <View style={styles.assistantRow}>
      <Image source={neighbour.head} style={[styles.head, { borderColor: t.color.borderStructure }]} />
      <View style={[styles.assistantCol, { maxWidth: widths.assistant }]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: t.color.surfaceCard,
              borderColor: t.color.borderStructure,
              borderLeftColor: t.color[neighbour.domain],
              borderLeftWidth: 2,
            },
          ]}
        >
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 15,
              lineHeight: 24,
            }}
          >
            {name
              ? `Clean slate, ${name}. Everything you've told me is safe — just out of the way. What are we starting with?`
              : `Clean slate. Everything you've told me is safe — just out of the way. What are we starting with?`}
          </Text>
          {allowance ? (
            <Text
              style={{
                marginTop: 6,
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12.5,
              }}
            >
              {allowance}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** The ONE ephemeral resume line — client-local, in this thread's neighbour's voice. */
export function ResumeRow({ neighbour, t }: { neighbour: Neighbour; t: Theme }) {
  const widths = useChatWidths();
  return (
    <View style={styles.assistantRow}>
      <Image source={neighbour.head} style={[styles.head, { borderColor: t.color.borderStructure }]} />
      <View style={[styles.assistantCol, { maxWidth: widths.assistant }]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: t.color.surfaceCard,
              borderColor: t.color.borderStructure,
              borderLeftColor: t.color[neighbour.domain],
              borderLeftWidth: 2,
            },
          ]}
        >
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 15,
              lineHeight: 24,
            }}
          >
            {RESUME_LINE}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Full-screen viewer (Run A #8) — always the dark ramp, like the mirror. */
export function PhotoViewer({
  viewer,
  onClose,
}: {
  viewer: { uri: string; caption: string; time: string; photoId?: string | null };
  onClose: () => void;
}) {
  const dark = tokens.dark.color;
  // Run A #8's footer. Absent until the photo has been read — the app never
  // guesses what is in a photo (C66), it only reports a read already paid for.
  const detail = usePhoto(viewer.photoId ?? null);
  const filed = detail.data?.filed_by ?? [];
  const filedLine =
    filed.length > 0
      ? `filed by ${filed
          .map((f) => {
            const who = NEIGHBOURS[f.neighbour as NeighbourId]?.name ?? f.neighbour;
            return f.category ? `${who} · ${f.category}` : who;
          })
          .join(' · ')}`
      : null;

  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const shareBusy = useRef(false);
  const share = useCallback(() => {
    if (shareBusy.current) return;
    shareBusy.current = true;
    setSharing(true);
    setShareNote(null);
    void sharePhoto(viewer)
      .catch(() => setShareNote(SHARE_PHOTO_FAILED))
      .finally(() => { shareBusy.current = false; setSharing(false); });
  }, [viewer.uri, viewer.photoId, viewer.caption]);

  // Download remains a separate action that writes to the photo library.
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = useCallback(() => {
    if (saving) return;
    setSaving(true);
    setSaveNote(null);
    setShareNote(null);
    void savePhotoToLibrary(viewer.uri)
      .then((r) => setSaveNote(r.message))
      .finally(() => setSaving(false));
  }, [viewer.uri, saving]);
  return (
    <View style={{ flex: 1, backgroundColor: dark.surfacePage }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: dark.borderStructure }]}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={24} color={dark.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            {viewer.caption.length > 0 ? (
              <Text
                numberOfLines={1}
                style={{ color: dark.textPrimary, fontWeight: '500', fontSize: 14 }}
              >
                {viewer.caption}
              </Text>
            ) : null}
            <Text style={{ color: dark.textSecondary, fontSize: 12 }}>{viewer.time}</Text>
          </View>
          <Pressable
            onPress={save}
            disabled={saving}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Save to your photos"
          >
            <Icon
              name="download"
              size={22}
              color={saving ? dark.textSecondary : dark.textPrimary}
            />
          </Pressable>
          <Pressable onPress={share} disabled={sharing} hitSlop={12} accessibilityRole="button" accessibilityLabel="Share" accessibilityState={{ busy: sharing, disabled: sharing }}>
            <Icon name="share" size={22} color={sharing ? dark.textSecondary : dark.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.viewerBody}>
          <ZoomablePhoto key={viewer.uri} uri={viewer.uri} />
        </View>
        {shareNote || saveNote ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={{ color: dark.textSecondary, fontSize: 12.5 }}>{shareNote ?? saveNote}</Text>
          </View>
        ) : null}
        {filedLine ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: dark.textSecondary, fontSize: 12.5 }}>{filedLine}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

export const styles = StyleSheet.create({
  // z8v0kmqxf5 — the gutter the row uncovers as it travels. Absolute so it
  // costs the row no layout, and pointerEvents none so it never eats a tap.
  swipeMark: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A filled square, not a glyph: C01 keeps the lit-pane square as the
  // app's own mark, and a square needs no icon whitelist entry.
  swipeMarkDot: { width: 10, height: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerHead: { width: 32, height: 32, borderWidth: 1 },
  offlineLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  waitingWrap: { alignItems: 'center', paddingVertical: 6 },
  waitingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  assistantRow: { flexDirection: 'row', gap: CHAT_AVATAR_GAP, alignItems: 'flex-start' },
  head: { width: CHAT_AVATAR, height: CHAT_AVATAR, borderWidth: 1, flexShrink: 0 },
  headSpacer: { width: CHAT_AVATAR, flexShrink: 0 },
  assistantCol: { minWidth: 0, flexShrink: 1 },
  structuredRow: { alignItems: 'stretch' },
  structuredCol: { width: '100%' },
  structuredHeading: { flexDirection: 'row', alignItems: 'center', gap: CHAT_AVATAR_GAP, marginBottom: 8 },
  metaLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flexShrink: 1, gap: 6, marginBottom: 4 },
  metaSecondary: { fontSize: 11.5 },
  bubble: { alignSelf: 'flex-start', maxWidth: '100%', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', gap: CHAT_AVATAR_GAP },
  userBubble: { alignSelf: 'flex-end' },
  userCol: { minWidth: 0, flexShrink: 1, alignItems: 'flex-end' },
  userMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 4 },
  userName: { fontSize: 13, fontWeight: '500' },
  time: { fontSize: 11.5, textAlign: 'right', marginTop: 4 },
  localMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  bodyWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  mentionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderLeftWidth: 2,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 3,
  },
  mentionHead: { width: 18, height: 18 },
  quoteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderLeftWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  quoteThumb: { width: 36, height: 36 },
  quoteThumbWell: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  photoWell: { width: 200, height: 140, borderWidth: 1 },
  docWell: {
    width: 200,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  photoWellEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockBubble: { borderWidth: 1 },
  intrinsicBubble: { alignSelf: 'flex-start', maxWidth: '100%' },
  blockBubbleContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  visitorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  moveInCard: {},
  pageActions: {
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  belowCard: { marginTop: 6 },
  viewerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

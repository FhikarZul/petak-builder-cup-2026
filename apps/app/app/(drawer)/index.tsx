import { CaptureVisibilityContext } from '../../components/CaptureVisibilityContext';
import { NeighbourNavigation } from '../../components/NeighbourNavigation';
import { CaptureTimingObserver, CaptureVisibilityObserver } from '../../lib/captureTiming';
import { appAnalytics, trackCaptureTiming } from '../../lib/clientAnalytics';
import { appVersion } from '../../lib/analytics';
// Chat home — the merged feed (C63, Run A #7). ONE feed, every neighbour,
// chronological. Thread identity survives as inline attribution — the speaker
// head, "name · role", the 2px domain rule — never as navigation.
//
// Rows come from components/chat/rows.tsx, shared verbatim with the
// per-neighbour screen: ServerRow already took `neighbour` as a prop, so a
// different neighbour per row needed no change to the renderer.
//
// Sending is UN-ADDRESSED (C65) — text AND photos. The composer posts with no
// neighbour and the server routes: one domain, two (both answer, never
// merged), or none, in which case Ollie picks it up. The user is never asked
// who they meant, and the placeholder stays "Message…".
//
// Run A #33 — the board's "Answer in chat" enters here: the `answer` route
// param carries the task's origin message id, the feed pages back to it, the
// row is marked "From the board" and the shipped reply chip pins above the
// input (never prefilled).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ViewToken, ActivityIndicator, AppState, Alert, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNetworkState } from 'expo-network';
import { router, useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import markColour from '../../../../packages/assets/logo/mark-colour.png';
import markInverse from '../../../../packages/assets/logo/mark-inverse-v3-litwindow.png';
import wordmark from '../../../../packages/assets/logo/wordmark.png';
import wordmarkInverse from '../../../../packages/assets/logo/wordmark-inverse.png';
import { NEIGHBOURS, type NeighbourId } from '../../lib/neighbours';
import { useTheme } from '../../lib/theme';
import {
  flattenFeed,
  groupByDay,
  refreshFeedHead,
  useFeed,
  useOpenTasks,
  usePhoto,
  useStreet,
  useSettings,
  useThreadOrder,
  type FeedMessage,
  type ThreadMessage,
} from '../../lib/thread';
import { indicatorRowOrder, noteSendEnd, noteSendStart, ordinalOf, remainingHold, type WorkingNeighbour } from '../../lib/indicator';
import { activityLines } from '../../lib/activity';
import { captureStatus } from '../../lib/captureStatus';
import { preferredName } from '../../lib/profile';
import { clearChatConfirmation } from '../../lib/clearChatConfirmation';
import { useActivity } from '../../lib/useActivity';
import { requestActivity } from '../../lib/requestActivity';
import { recoveryFor, withoutField } from '../../lib/send';
import { appPlatform } from '../../lib/analytics';
import { enqueue, flush as flushOutboxFile, list as outboxList, type OutboxItem } from '../../lib/outbox';
import { getDismissedQueueNotes, dismissQueueNote } from '../../lib/dismissals';
import { buildUnaddressedOutboxItem, newClientKey } from '../../lib/send';
import { UNADDRESSED, cardState, isDocument, newCapture, reconcileLocalCaptures, type CapturePayload } from '../../lib/capture';
import { orderPicker, serializePhotoDraft } from '../../lib/mentions';
import { beginMessageNavigation, canPageHistoryFromScroll, boardAnswerRequest, boardNavigationStep, boardScrollRecoveryOffset, boardVisibleMessages, leaveBoardNavigation, BOARD_ORIGIN_UNAVAILABLE } from '../../lib/boardNavigation';
import { getClearedAt, setClearedAt as setClearedAtPersisted } from '../../lib/clearedChat';
import { useSession } from '../../lib/supabase';
import { useShareIntent } from 'expo-share-intent';
import type { ShareIntentFile } from 'expo-share-intent';
import { localCaptureRows } from '../../lib/captureRows';
import {
  resumeCapture,
  retryCapture,
  startCapture,
  type CaptureRunner,
} from '../../lib/captureRun';
import { ApiError, apiFetch } from '../../lib/api';
import { Composer, type ComposerDraft } from '../../components/Composer';
import { GridWallpaper } from '../../components/GridWallpaper';
import { Icon } from '../../components/Icon';
import { SendPhotoSheet } from '../../components/SendPhotoSheet';
import { ChatLayout } from '../../components/chat/ChatLayout';
import { CHAT_GUTTER } from '../../lib/chatLayout';
import { CaptureCard, PhotoBatchCard } from '../../components/CaptureCard';
import { WorkingIndicator } from '../../components/WorkingIndicator';
import {
  ServerRow,
  PhotoViewer,
  dayTimeLabel,
  excerptOf,
  LocalRow,
  ResumeRow,
  OFFLINE_LINE,
  RESUME_LINE_MS,
  hhmm,
  styles,
  GreetingRow,
  type PinnedReference,
  type LocalMessage,
} from '../../components/chat/rows';

interface LocalCapture {
  payload: CapturePayload;
  createdAt: string;
}

const viewabilityConfig = { itemVisiblePercentThreshold: 1 };

type Row =
  | { kind: 'day'; label: string }
  | { kind: 'message'; message: FeedMessage; showHead: boolean }
  | { kind: 'capture'; capture: LocalCapture }
  | { kind: 'batch'; key: string; count: number; minute: string; uris: string[] }
  | { kind: 'local'; local: LocalMessage }
  | { kind: 'from-board' }
  | { kind: 'resume' }
  | { kind: 'greeting'; name: string | null; allowance: string | null }
  | { kind: 'activity-status'; key: string; text: string; failed: boolean; dismiss?: () => void; retry?: () => void }
  | { kind: 'working'; working: WorkingNeighbour };

export default function ChatHome() {
  const t = useTheme();
  const qc = useQueryClient();
  const session = useSession();
  const captureTiming = useRef(new CaptureTimingObserver());
  const timingUserId = useRef(session?.user?.id ?? null);
  timingUserId.current = session?.user?.id ?? null;
  const newVisibilityObserver = () => {
    const visibilitySessionId = newClientKey();
    return new CaptureVisibilityObserver(event => {
      trackCaptureTiming(appAnalytics(timingUserId.current), { ...event, visibility_session_id: visibilitySessionId, platform: appPlatform(), app_version: appVersion() });
    });
  };
  const captureVisibility = useRef<CaptureVisibilityObserver | null>(null);
  if (!captureVisibility.current) captureVisibility.current = newVisibilityObserver();
  const visibilityCallbacks = useMemo(() => ({
    localLayout: (p: Parameters<CaptureVisibilityObserver['localLayout']>[0]) => {
      if (AppState.currentState === 'active' && timingScreenFocused.current) captureVisibility.current?.localLayout(p, Date.now());
    },
    progressUnavailable: (photoId: string) => captureVisibility.current?.progressUnavailable(photoId),
    progressLayout: (p: import('@petak/config/capture-progress').CaptureProgress) => {
      if (AppState.currentState === 'active' && timingScreenFocused.current) captureVisibility.current?.progressLayout(p, Date.now());
    },
  }), []);
  useEffect(() => {
    captureTiming.current = new CaptureTimingObserver();
    captureVisibility.current = newVisibilityObserver();
  }, [session?.user?.id]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') { captureTiming.current.background(); captureVisibility.current?.background(); }
    });
    return () => sub.remove();
  }, []);
  const navigation = useNavigation<{ openDrawer(): void }>();
  const timingScreenFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    timingScreenFocused.current = true;
    return () => { timingScreenFocused.current = false; captureTiming.current.background(); captureVisibility.current?.background(); };
  }, []));
  const dark = useColorScheme() === 'dark';
  const feed = useFeed();
  const activity = useActivity();
  const [dismissedActivity, setDismissedActivity] = useState<Set<string>>(() => new Set());
  const openTasks = useOpenTasks();
  const street = useStreet();
  const settings = useSettings();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: false });
  /** The user's anchored timezone (null until settings load = device-local). */
  const timeZone = settings.data?.region?.timezone ?? null;
  const threadOrder = useThreadOrder();
  const [captures, setCaptures] = useState<LocalCapture[]>([]);
  /** Attach sheet (paperclip). The camera row appears only while the composer
   *  field is focused — the unfocused composer's right button IS the camera. */
  const [attachOpen, setAttachOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  /** Transient line above the composer (e.g. document attach needs a rebuild
   *  on an APK that predates expo-document-picker). */
  const [attachNote, setAttachNote] = useState<string | null>(null);
  const [working, setWorking] = useState<WorkingNeighbour[]>([]);
  const [viewer, setViewer] = useState<{ uri: string; caption: string; iso: string; photoId?: string | null } | null>(null);
  const [reference, setReference] = useState<PinnedReference | null>(null);
  /** Your own message, shown the INSTANT you send it — before any round trip.
   *  Removed once the server twin lands in the feed (C18). */
  const [locals, setLocals] = useState<LocalMessage[]>([]);
  /** The ONE ephemeral C18 resume line, client-local, never persisted. */
  const [resumeLine, setResumeLine] = useState(false);

  const [dismissedNotes, setDismissedNotes] = useState<Set<string>>(new Set());
  const network = useNetworkState();
  const offline = network.isConnected === false;
  const referenceRef = useRef(reference);
  const offlineRef = useRef(offline);
  referenceRef.current = reference;
  offlineRef.current = offline;
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffline = useRef(false);
  const params = useLocalSearchParams<{ answer?: string; ask?: string; askWith?: string }>();
  /** Run A #33 — the board's target: consumed once from the route param, then
   *  resolved against the loaded feed (paging backward until found). */
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [boardTarget, setBoardTarget] = useState<string | null>(null);
  const [composerPrefill, setComposerPrefill] = useState<{ text: string; chips: NeighbourId[] }>({ text: '', chips: [] });
  const consumedAnswer = useRef<string | null>(null);
  const consumedAsk = useRef<string | null>(null);
  const listRef = useRef<FlatList<Row>>(null);
  const scrollPending = useRef(false);
  const scrollAttempts = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentBoardScroll = useRef<{ target: string | null; index: number | null }>({ target: null, index: null });
  const leaveBoard = useCallback(() => {
    leaveBoardNavigation({ setBoardTarget, setPendingTarget, scrollPending, scrollTimer, currentBoardScroll });
  }, []);
  const beginMessageJump = useCallback((target: string) => {
    setReference(null);
    // A new board or quote tap is a deliberate retry of failed history.
    if (feed.isError) void feed.refetch();
    beginMessageNavigation(target, {
      setBoardTarget, setPendingTarget, scrollPending, scrollTimer, currentBoardScroll, scrollAttempts,
    });
  }, [feed.isError, feed.refetch]);
  useEffect(() => () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
  }, []);

  /** Client-side "clear chat" cut (founder ruling 1 Sep 2026): messages older
   *  than this ISO timestamp stay on the server but are not rendered here. */
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  useEffect(() => {
    void getClearedAt().then(setClearedAt);
  }, []);

  const messages = useMemo(() => flattenFeed(feed.data), [feed.data]);
  const visibleMessages = useMemo(
    () => boardVisibleMessages(messages, clearedAt, boardTarget),
    [messages, clearedAt, boardTarget],
  );
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Row>[] }) => {
    if (AppState.currentState !== 'active' || !timingScreenFocused.current) { captureTiming.current.background(); return; }
    captureVisibility.current?.setVisible(viewableItems.flatMap(({ isViewable, item }) => {
      if (!isViewable) return [];
      if (item.kind === 'capture') return [...(item.capture.payload.step !== 'accepted' && !item.capture.payload.failed ? [`capture:${item.capture.payload.client_key}`] : []), ...(item.capture.payload.photo_id ? [`photo:${item.capture.payload.photo_id}`] : [])];
      if (item.kind === 'message' && item.message.role === 'user' && item.message.photo_id) return [`photo:${item.message.photo_id}`];
      return [];
    }), Date.now());
    for (const result of captureTiming.current.viewable(viewableItems, Date.now())) {
      trackCaptureTiming(appAnalytics(timingUserId.current), {
        stage: 'first_result_in_feed', ...result, platform: appPlatform(), app_version: appVersion(),
      });
    }
  }).current;
  const byId = useMemo(
    () => new Map(visibleMessages.map((m) => [m.id, m])),
    [visibleMessages],
  );

  useEffect(() => {
    setCaptures((prev) => reconcileLocalCaptures(prev, messages));
  }, [messages]);

  // Run A #33 — the board's "Answer in chat" entry. The target rides the
  // route param ONCE: it is consumed into state and the param cleared, so a
  // later focus or re-render never re-fires the scroll-back.
  useEffect(() => {
    const request = boardAnswerRequest(params.answer, consumedAnswer.current);
    consumedAnswer.current = request.consumed;
    if (!request.target) return;
    router.setParams({ answer: undefined });
    beginMessageJump(request.target);
  }, [params.answer, beginMessageJump]);

  // Dashboard actions may open the merged chat with a useful starting line.
  // Consume the route once so a focus/re-render cannot reinsert the draft.
  useEffect(() => {
    if (typeof params.ask !== 'string' || consumedAsk.current === params.ask) return;
    consumedAsk.current = params.ask;
    router.setParams({ ask: undefined, askWith: undefined });
    setComposerPrefill({
      text: params.askWith === 'penny' ? 'Keep me under ' : params.ask,
      chips: params.askWith === 'penny' ? ['penny'] : [],
    });
  }, [params.ask, params.askWith]);

  const upsertCapture = useCallback((p: CapturePayload, createdAt?: string) => {
    setCaptures((prev) => {
      const i = prev.findIndex((c) => c.payload.client_key === p.client_key);
      if (i >= 0) return prev.map((c, j) => (j === i ? { ...c, payload: p } : c));
      return [...prev, { payload: p, createdAt: createdAt ?? new Date().toISOString() }];
    });
  }, []);

  const captureRunner: CaptureRunner = useMemo(
    () => ({
      onPayload: (p) => {
        captureTiming.current.note(p, Date.now());
        if (AppState.currentState !== 'active' || !timingScreenFocused.current) captureTiming.current.background();
        upsertCapture(p);
      },
      onTiming: timing => trackCaptureTiming(appAnalytics(session?.user?.id ?? null), {
        ...timing, platform: appPlatform(), app_version: appVersion(),
      }),
      onAccepted: () => {
        // One feed — one thing to refresh. The server has already routed the
        // photo to whoever it belongs to; the feed simply reloads.
        void refreshFeedHead(qc);
        void qc.invalidateQueries({ queryKey: ['activity'] });
        void qc.invalidateQueries({ queryKey: ['photos', 'queued'] });
        void qc.invalidateQueries({ queryKey: ['street'] });
      },
    }),
    [upsertCapture, qc, session?.user?.id],
  );

  /** Rehydrate cards + resume every unfinished capture (C18). */
  const resumeCaptures = useCallback(async () => {
    const items = await outboxList();
    const mine = items.filter((i) => i.kind === 'capture');
    setCaptures((prev) => {
      const known = new Set(prev.map((c) => c.payload.client_key));
      return [
        ...prev,
        ...mine
          .map((i) => ({ payload: i.payload as CapturePayload, createdAt: i.createdAt }))
          .filter((c) => !known.has(c.payload.client_key)),
      ];
    });
    if (!offlineRef.current) for (const item of mine) void resumeCapture(item, captureRunner);
  }, [captureRunner]);

  /** Photo-first composer (3 Sep 2026): the picked attachment waits in the
   *  field for its caption and the send tap — attachment and text go together. */
  const [attached, setAttached] = useState<
    | {
        kind: 'photos';
        assets: ImagePicker.ImagePickerAsset[];
        useKeptCredit: boolean;
        source: 'camera' | 'gallery' | 'share_sheet';
      }
    | { kind: 'document'; uri: string; name: string; sizeBytes: number; source: 'gallery' | 'share_sheet' }
    | null
  >(null);

  useEffect(() => {
    if (!hasShareIntent || !shareIntent.files?.length) return;
    const files = shareIntent.files as ShareIntentFile[];
    const images = files.filter((f) => f.mimeType.startsWith('image/'));
    const pdfs = files.filter((f) => f.mimeType === 'application/pdf');
    if (images.length > 0 && pdfs.length > 0) {
      showAttachNote('Share photos or a PDF separately.');
      resetShareIntent();
    } else if (images.length > 0) {
      setAttached({ kind: 'photos', source: 'share_sheet', useKeptCredit: false, assets: images.map((f) => ({
        uri: f.path, width: f.width ?? 0, height: f.height ?? 0, fileName: f.fileName,
        mimeType: f.mimeType, assetId: f.path,
      } as ImagePicker.ImagePickerAsset)) });
      resetShareIntent();
    } else if (pdfs.length > 0) {
      const file = pdfs[0];
      setAttached({ kind: 'document', uri: file.path, name: file.fileName || 'document.pdf', sizeBytes: file.size ?? 0, source: 'share_sheet' });
      resetShareIntent();
    } else {
      showAttachNote('Petak can receive photos and PDF files.');
      resetShareIntent();
    }
  }, [hasShareIntent, resetShareIntent, shareIntent.files]);

  const showAttachNote = useCallback((line: string) => {
    setAttachNote(line);
    if (attachNoteTimer.current) clearTimeout(attachNoteTimer.current);
    attachNoteTimer.current = setTimeout(() => setAttachNote(null), 4_000);
  }, []);

  /** Multi-pick → one capture per asset, de-duped by asset id. No cap (C41). */
  const startPicks = useCallback(
    async (
      assets: ImagePicker.ImagePickerAsset[],
      draft: ComposerDraft,
      useKeptCredit = false,
      source: 'camera' | 'gallery' | 'share_sheet' = 'gallery',
      refMessageId?: string,
    ) => {
      const seen = new Set<string>();
      for (const asset of assets) {
        const key = asset.assetId ?? asset.uri;
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          const payload = newCapture({
            clientKey: newClientKey(),
            startedAtMs: Date.now(),
            neighbour: UNADDRESSED, // C65 — nobody named; the server routes
            // C19/C65: explicit @ chips remain in the ordinary wire text, so
            // the backend can address directly instead of routing blindly.
            caption: serializePhotoDraft(draft.chips, draft.text),
            localUri: asset.uri,
            refMessageId,
            useKeptCredit,
            platform: appPlatform(),
            source,
          });
          upsertCapture(payload);
          void startCapture(payload, captureRunner);
        } catch {
          showAttachNote("That photo didn't upload.");
        }
      }
    },
    [captureRunner, upsertCapture, showAttachNote],
  );

  /** One document → one capture. The same pipeline as a photo, but the bytes
   *  are never downscaled and the create call declares application/pdf. */
  const startDocument = useCallback(
    async (doc: { uri: string; name: string; sizeBytes: number }, draft: ComposerDraft, source: 'gallery' | 'share_sheet' = 'gallery', refMessageId?: string) => {
      try {
        const payload = newCapture({
          clientKey: newClientKey(),
          startedAtMs: Date.now(),
          neighbour: UNADDRESSED,
          caption: serializePhotoDraft(draft.chips, draft.text),
          localUri: doc.uri,
          platform: appPlatform(),
          source,
          contentType: 'application/pdf',
          filename: doc.name,
          refMessageId,
        });
        upsertCapture(payload);
        void startCapture(payload, captureRunner);
      } catch {
        // unreadable file — skipped honestly, no card, no crash
      }
    },
    [captureRunner, upsertCapture],
  );

  /** The sheet's "From your photos". The sheet closes first; QA-01's yield
   *  keeps the iOS picker off a dying view controller. */
  const pickFromLibrary = useCallback(async (useKeptCredit = false) => {
    setAttachOpen(false);
    // QA-01: closing the RN Modal and presenting the iOS photo picker in the
    // same tick leaves the picker attached to a dying view controller. Yield
    // until the modal dismissal animation finishes, matching the camera path
    // which naturally waits for the permission prompt first.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.85 });
    if (!res.canceled) setAttached({ kind: 'photos', assets: res.assets, useKeptCredit, source: 'gallery' });
  }, []);

  /** The camera itself. Called from the sheet (after it closes) AND straight
   *  from the composer's right button — no sheet, no intermediate dialog. */
  const launchCamera = useCallback(async (useKeptCredit = false) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!res.canceled) setAttached({ kind: 'photos', assets: res.assets, useKeptCredit, source: 'camera' });
  }, []);

  const takePhoto = useCallback(
    async (useKeptCredit = false) => {
      setAttachOpen(false);
      await launchCamera(useKeptCredit);
    },
    [launchCamera],
  );

  /** The sheet's "A document (PDF)". expo-document-picker is a native module
   *  an installed dev APK may predate, so the import is lazy — a missing
   *  module degrades to an honest note, never a crash. */
  const pickDocument = useCallback(async () => {
    setAttachOpen(false);
    let DocumentPicker: typeof import('expo-document-picker');
    try {
      DocumentPicker = await import('expo-document-picker');
    } catch {
      showAttachNote('Documents need the latest app build.');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300)); // QA-01, as above
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      if (!asset) return;
      setAttached({
        kind: 'document',
        uri: asset.uri,
        name: asset.name ?? 'document.pdf',
        sizeBytes: asset.size ?? 0,
        source: 'gallery',
      });
    } catch {
      // The JS imported but the native side is absent (an old APK): honest
      // note, no crash. The rebuild ships the module separately.
      showAttachNote('Documents need the latest app build.');
    }
  }, [showAttachNote]);

  /** The composer's send-with-attachment: the words ride it as the caption. */
  const sendAttached = useCallback(
    (chips: NeighbourId[], text: string) => {
      const a = attached;
      if (!a) return;
      const refMessageId = referenceRef.current?.id;
      leaveBoard();
      setAttached(null);
      setReference(null);
      if (a.kind === 'document') {
        void startDocument(a, { chips, text }, a.source, refMessageId);
      } else {
        void startPicks(a.assets, { chips, text }, a.useKeptCredit, a.source, refMessageId);
      }
    },
    [attached, startPicks, startDocument, leaveBoard],
  );

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      if (attachNoteTimer.current) clearTimeout(attachNoteTimer.current);
    },
    [],
  );

  const pendingCaptures = useMemo(() => captures.flatMap(({ payload }) => {
    const status = captureStatus(payload, offline);
    return status ? [{ payload, ...status }] : [];
  }), [captures, offline]);
  const waitingLabel = `${pendingCaptures.length} ${pendingCaptures.length === 1 ? 'file' : 'files'} ${pendingCaptures.some(p => p.failed) ? (pendingCaptures.length === 1 ? 'needs attention' : 'need attention') : offline ? 'waiting for connection' : 'to send'} · View`;
  const showCaptureStatus = () => Alert.alert('Files to send',
    pendingCaptures.map(p => `${p.title}\n${p.reason}`).join('\n\n'),
    [{ text: 'OK' }, ...(pendingCaptures.some(p => p.failed) ? [{ text: 'Retry failed', onPress: () => {
      for (const item of pendingCaptures) if (item.failed) void retryCapture(item.payload, captureRunner);
    } }] : [])]);

  useEffect(() => {
    void getDismissedQueueNotes().then(setDismissedNotes);
    void resumeCaptures();
  }, [offline, resumeCaptures]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !offlineRef.current) void resumeCaptures();
    });
    return () => subscription.remove();
  }, [resumeCaptures]);

  const showResumeLine = useCallback(() => {
    setResumeLine(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setResumeLine(false), RESUME_LINE_MS);
  }, []);

  /** Clear chat (founder ruling 1 Sep 2026): everything currently loaded
   *  stops rendering — the cut is persisted client-side and the server keeps
   *  the full history. In-flight captures and queued words stay visible. */
  const clearChat = useCallback(() => {
    const dialog = clearChatConfirmation(() => {
      void (async () => {
        const now = new Date().toISOString();
        try {
          await setClearedAtPersisted(now);
          setNavigationOpen(false);
          setReference(null);
          leaveBoard();
          setClearedAt(now);
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch {
          Alert.alert('Clear chat', 'That did not go through. Try again in a moment.');
        }
      })();
    });
    Alert.alert(dialog.title, dialog.message, dialog.buttons);
  }, [leaveBoard]);

  /** Reconnect: flush quietly, then ONE ephemeral resume line if anything
   *  actually went (C18). Nothing queued means nothing to announce. */
  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    void (async () => {
      let sentAny = false;
      await flushOutboxFile(
        async (out: OutboxItem) => {
          const key = (out.payload as { client_key: string }).client_key;
          await apiFetch(out.path, { method: 'POST', body: JSON.stringify(out.payload) });
          setLocals((prev) => prev.filter((l) => l.clientKey !== key));
          sentAny = true;
        },
        { kinds: ['message'] },
      );
      if (sentAny) {
        void refreshFeedHead(qc);
        void qc.invalidateQueries({ queryKey: ['tasks'] });
        showResumeLine();
      }
    })();
  }, [offline, qc, showResumeLine]);

  const referencePhoto = usePhoto(reference?.photoId ?? null);

  /** Swipe a row to quote it (C19). In one feed the quoted message may belong
   *  to anyone, so the pin records WHOSE it was — that decides the name on the
   *  chip and its 2px accent. */
  const pinReference = useCallback(
    (m: ThreadMessage, owner: string) => {
      const document = m.content_type === 'application/pdf';
      setReference({
        id: m.id,
        // A document's id stays null here: the reference strip's thumb is an
        // Image and the viewer stays image-only — a PDF uri never reaches one.
        photoId: m.photo_id && !document ? m.photo_id : null,
        mine: m.role === 'user',
        neighbour: m.role === 'user' ? null : owner,
        excerpt: m.photo_id
          ? `${m.role === 'user' ? (document ? 'your document' : 'your photo') : document ? 'document' : 'photo'} · ${hhmm(m.created_at, timeZone)}`
          : excerptOf(m.body),
      });
    },
    [timeZone],
  );

  // Search the full retained history, including messages hidden by Clear chat.
  // A failed page ends this attempt; it must never trigger an endless fetch loop.
  useEffect(() => {
    if (!pendingTarget) return;
    const step = boardNavigationStep({
      target: pendingTarget,
      messages,
      hasData: !!feed.data,
      isError: feed.isError,
      isFetching: feed.isFetching,
      hasNextPage: !!feed.hasNextPage,
    });
    if (step.kind === 'found') {
      pinReference(step.message, step.message.neighbour);
      setBoardTarget(pendingTarget);
      scrollPending.current = true;
      setPendingTarget(null);
    } else if (step.kind === 'load') {
      void feed.fetchNextPage();
    } else if (step.kind === 'missing' || step.kind === 'error') {
      setPendingTarget(null);
      if (step.kind === 'missing') Alert.alert('From the board', BOARD_ORIGIN_UNAVAILABLE);
      else Alert.alert('From the board', 'That did not go through. Try again in a moment.');
    }
  }, [pendingTarget, messages, feed.data, feed.isError, feed.isFetching, feed.hasNextPage, feed.fetchNextPage, pinReference]);

  const composerReference = useMemo(() => {
    if (!reference) return null;
    const owner = reference.neighbour ? NEIGHBOURS[reference.neighbour as NeighbourId] : null;
    return {
      name: reference.mine ? 'you' : (owner?.name ?? 'them'),
      excerpt: reference.excerpt,
      // The user has NO colour — their own quote takes the Batu-class border.
      accent: reference.mine || !owner ? t.color.borderEmphasis : t.color[owner.domain],
      photoUri: reference.photoId ? (referencePhoto.data?.image_url ?? null) : null,
    };
  }, [reference, t, referencePhoto.data]);

  const onSend = useCallback(
    (wireText: string, taskId?: string) => {
      const item = buildUnaddressedOutboxItem({
        text: wireText,
        clientKey: newClientKey(),
        clientSentAt: new Date().toISOString(),
        refMessageId: referenceRef.current?.id ?? null,
        taskId: taskId ?? null,
      });
      // QA-07/08: a button tap closes the task locally NOW so the card goes
      // inert immediately, even before the server round trip.
      // The cache holds the RAW /v1/tasks body — useOpenTasks' `select` only
      // shapes what observers read. setQueryData sees the raw object, so
      // filter the array (a `new Set(prev)` here crashed: a plain object is
      // not iterable — "iterator method is not callable", 3 Sep 2026).
      if (taskId) {
        qc.setQueryData<{ tasks: { id: string }[] }>(['tasks'], (prev) =>
          prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev,
        );
      }
      setReference(null);
      setBoardTarget(null); // Run A #33 — the mark leaves with the chip
      // Your words appear NOW, not after the round trip (C18). The local is
      // dropped when the server twin arrives in the feed.
      setLocals((prev) => [
        ...prev,
        {
          clientKey: item.payload.client_key,
          text: wireText,
          clientSentAt: item.payload.client_sent_at,
          refMessageId: item.payload.ref_message_id ?? null,
          state: 'queued',
        },
      ]);
      // #78: "Ollie's finding the right neighbour" — the routing moment, which
      // until C65 had no signal to fire on. Shown for the whole flight; the
      // client cannot see the handoff from routing to answering.
      //
      // internal-reference — the founder, twice: "there is no response bubble but after
      // a while the response suddently appear... at the first the user thinks
      // nothing happened". A large part of that was the poisoned outbox
      // (internal-reference): the flush threw instantly, the `finally` below fired, and
      // the indicator appeared and vanished within a frame. With the queue
      // able to drain, this line now actually spans the wait.
      //
      // It stays 'ollie'/'route' deliberately: on the merged feed the client
      // does not know who will answer until the server routes, and naming the
      // wrong neighbour is worse than naming the front door. Canon wants a
      // NAMED neighbour doing a NAMED thing — this is the honest one to name
      // while routing is genuinely what is happening.
      const indicatorStartedAt = Date.now();
      setWorking((prev) => noteSendStart(prev, 'ollie', 'route', indicatorStartedAt));
      void (async () => {
        try {
          await enqueue(item);
          if (offlineRef.current) return; // it stays queued; the offline line says so
          await flushOutboxFile(
            async (out: OutboxItem) => {
              const key = (out.payload as { client_key: string }).client_key;
              try {
                await apiFetch(out.path, { method: 'POST', body: JSON.stringify(out.payload) });
                setLocals((prev) => prev.filter((l) => l.clientKey !== key));
              } catch (error) {
                // Terminal (4xx): out of the queue, failed on THAT message
                // alone. C111 — WHAT to offer depends on why it was rejected:
                // a 400 is a malformed body, so re-sending it unchanged fails
                // identically forever. The server names the field; a droppable
                // decoration (a quote, a task ref) is removed and the message
                // is sent again automatically, because the words are the point
                // and the quote never was.
                if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                  const field = error.field ?? null;
                  const recovery = recoveryFor(error.status, field);
                  if (recovery.kind === 'retry_without') {
                    const retried = withoutField(out.payload as Record<string, unknown>, recovery.field);
                    try {
                      await apiFetch(out.path, { method: 'POST', body: JSON.stringify(retried) });
                      setLocals((prev) => prev.filter((l) => l.clientKey !== key));
                      return; // it went — nothing failed as far as the user is concerned
                    } catch {
                      // fall through to the failed state below
                    }
                  }
                  setLocals((prev) =>
                    prev.map((l) =>
                      l.clientKey === key ? { ...l, state: 'failed', permanent: recovery.kind === 'permanent' } : l,
                    ),
                  );
                }
                throw error;
              }
            },
            {
              kinds: ['message'],
              // A dropped message must not be silent (internal-reference). Before this
              // the bubble kept its queued clock forever while nothing was
              // being attempted — which read as "still sending" and was the
              // reason the app looked stuck rather than broken.
              onDropped: (dropped) => {
                const key = (dropped.payload as { client_key?: string }).client_key;
                if (!key) return;
                setLocals((prev) =>
                  prev.map((l) => (l.clientKey === key ? { ...l, state: 'failed', permanent: true } : l)),
                );
              },
            },
          );
          await refreshFeedHead(qc);
          // A budget set in Penny's chat changes dashboard read models. Clear
          // the cached reads with the feed so the dashboard cannot show the
          // previous budget during its normal stale window.
          void qc.invalidateQueries({ queryKey: ['today', 'penny'] });
          void qc.invalidateQueries({ queryKey: ['series', 'penny'] });
          void qc.invalidateQueries({ queryKey: ['categories', 'penny'] });
          void qc.invalidateQueries({ queryKey: ['entries', 'penny'] });
          // Run A #33 — the answered task drops off the board on next focus
          // (useOpenTasks and the board both key on ['tasks']).
          void qc.invalidateQueries({ queryKey: ['tasks'] });
        } finally {
          // internal-reference — ends AFTER refreshFeedHead, so the reply is already in
          // the feed when the line goes. Ending on the HTTP response alone left
          // a gap where the indicator had stopped and the bubble had not yet
          // rendered — which is precisely the "nothing happened, then it
          // suddenly appeared" the founder described.
          // z8v0kmqxf6 — the line survives one full blink. Founder ruling,
          // 11 Sep: hold it, then name it. A line that appears and vanishes
          // inside one cycle never completes the animation that makes it read
          // as work — and a typed turn on his account takes about 1,000ms
          // against a 1,050ms cycle.
          const hold = remainingHold(indicatorStartedAt, Date.now());
          if (hold === 0) setWorking((prev) => noteSendEnd(prev, 'ollie'));
          else setTimeout(() => setWorking((prev) => noteSendEnd(prev, 'ollie')), hold);
        }
      })();
    },
    [qc],
  );

  // First name for Ollie's clear-chat greeting — same resolution as the
  // drawer header, then just the first token.
  const displayName = preferredName(settings.data?.settings?.profile?.display_name, session?.user?.user_metadata);
  const firstName = displayName?.split(' ')[0] ?? null;

  // Today's numbers, restated in the greeting card. Computed before `rows`
  // because the greeting consumes it; the footer reuses the same line.
  const allowance = street.data?.allowance;
  const balanceLine =
    allowance !== undefined
      ? `${Math.max(0, allowance.cap - allowance.used)} photos left today · ${street.data?.kept_credits ?? 0} credits`
      : null;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const group of groupByDay(visibleMessages, new Date(), timeZone)) {
      out.push({ kind: 'day', label: group.day });
      let prev: string | null = null;
      for (const message of group.messages) {
        const speaker = message.role === 'user' ? 'you' : message.neighbour;
        // Run A #33 — the "From the board" mark sits immediately BEFORE the
        // target's message row, exactly as drawn.
        if (boardTarget && message.id === boardTarget) out.push({ kind: 'from-board' });
        out.push({ kind: 'message', message, showHead: speaker !== prev });
        prev = speaker;
      }
    }
    // Cleared chat (founder ruling 1 Sep 2026): a cleared view is never blank.
    // Ollie — always resident as the concierge — opens the fresh page in his
    // own voice. Sits as the OLDEST row, so the inverted list shows it at the
    // bottom, exactly where a first message would land.
    if (feed.isSuccess && clearedAt && visibleMessages.length === 0) {
      out.push({ kind: 'greeting', name: firstName, allowance: balanceLine });
    }
    // Local capture cards sit after the server's history, in send order — they
    // ARE the newest thing until the server twin lands (#76). Consecutive sent
    // ones in the same minute collapse into ONE #77 batch card.
    out.push(...localCaptureRows(captures, messages));
    // Your own unsent words, after everything the server knows about.
    for (const local of locals) out.push({ kind: 'local', local });
    // Photo progress belongs to each card; only text work uses the final indicator.
    const requests = activity.requests.filter(r => !r.failed && !r.refreshFailed).map(r => ({
      id:r.id, kind:r.kind, startedAt:r.startedAt, count:1, total:1,
    }));
    const localWorking = offline ? [] : activityLines([...working, ...requests], []);
    const background = activity.isError || offline ? [] : (activity.data?.activities ?? []).filter(work => !work.photo_id);
    for (const work of background) {
      if (work.state === 'running' || dismissedActivity.has(work.id)) continue;
      const name = NEIGHBOURS[work.neighbour].name;
      const text = work.state === 'failed' ? `${name} couldn't finish this.`
        : work.state === 'retrying' ? `${name} will try again.`
        : work.state === 'waiting' ? `${name}'s work is waiting.`
        : `${name}'s work is queued.`;
      out.push({kind:'activity-status',key:work.id,text,failed:work.state==='failed',
        dismiss:work.state==='failed' ? () => setDismissedActivity(prev=>new Set([...prev,work.id])) : undefined});
    }
    for (const failed of activity.requests.filter(r=>r.failed)) {
      out.push({kind:'activity-status',key:`request-${failed.key}`,text:`${NEIGHBOURS[failed.id].name} couldn't finish that request. You can try again.`,failed:true,
        dismiss:()=>requestActivity.dismiss(failed.key)});
    }
    for (const request of activity.requests.filter(r=>r.refreshFailed)) {
      out.push({kind:'activity-status',key:`refresh-${request.key}`,text:'Request received. Couldn’t load the latest replies.',failed:false,
        retry:()=>{void refreshFeedHead(qc,true).then(()=>requestActivity.dismiss(request.key)).catch(()=>{});}});
    }
    if (activity.isError && !offline) out.push({kind:'activity-status',key:'status-error',text:'Couldn’t check progress. Reconnecting…',failed:false,
      retry:()=>{void activity.refetch();}});
    for (const w of indicatorRowOrder(activityLines(localWorking, background))) out.push({kind:'working',working:w});
    // C18: the ONE ephemeral resume line, at the very top of what is new.
    if (resumeLine) out.unshift({ kind: 'resume' });
    return out;
  }, [feed.isSuccess, messages, visibleMessages, captures, locals, working, resumeLine, boardTarget, clearedAt, firstName, balanceLine, timeZone, activity.requests, activity.data, activity.isError, activity.refetch, dismissedActivity, offline, qc]);
  const reversedRows = useMemo(() => [...rows].reverse(), [rows]);
  const boardRowIndex = reversedRows.findIndex((row) => row.kind === 'from-board');
  currentBoardScroll.current = { target: boardTarget, index: boardRowIndex < 0 ? null : boardRowIndex };

  // Run A #33 — scroll the divider + question to center, matching the
  // drawing's framing (dimmed older message above, divider, question). The
  // FlatList renders [...rows].reverse(), so the data index mirrors rows.
  useEffect(() => {
    if (!scrollPending.current) return;
    const i = rows.findIndex((r) => r.kind === 'from-board');
    if (i === -1) return;
    const dataIndex = rows.length - 1 - i;
    listRef.current?.scrollToIndex({ index: dataIndex, viewPosition: 0.5, animated: true });
    scrollPending.current = false;
  }, [rows]);

  const allowanceLeft = allowance ? Math.max(0, allowance.cap - allowance.used) : null;
  const pickerOrder = useMemo(
    () => orderPicker(threadOrder.data ?? [], (street.data?.residents ?? []).map((r) => r.neighbour)),
    [street.data?.residents, threadOrder.data],
  );
  // Milo's one-go form (6 Sep 2026). Every filled field goes at once and the
  // server closes the outstanding number questions, so the flow lands on the
  // same C97 confirmation the one-at-a-time path reaches. Refetch rather than
  // optimistically render: his confirmation is a real message with buttons, and
  // guessing at it would be inventing a reply.
  const onSubmitProfile = useCallback(
    async (taskId: string, profile: Record<string, string | number>) => {
      try {
        await apiFetch('/v1/neighbours/milo/profile-form', {
          method: 'POST',
          body: JSON.stringify({ task_id: taskId, profile }),
        });
      } finally {
        // Even on failure the task may have committed; preserve recovery
        // rather than allowing this best-effort read to reject unhandled.
        void refreshFeedHead(qc, true).catch(() => {});
        void qc.invalidateQueries({ queryKey: ['tasks'] });
      }
    },
    [qc],
  );

  const onPinFeedMessage = useCallback(
    (message: ThreadMessage) => {
      leaveBoard();
      pinReference(message, (message as FeedMessage).neighbour);
    },
    [leaveBoard, pinReference],
  );
  const onQuotePress = useCallback((messageId: string) => {
    beginMessageJump(messageId);
  }, [beginMessageJump]);
  const onOpenFeedPhoto = useCallback(
    (photoId: string, uri: string, caption: string, iso: string) =>
      setViewer({ uri, caption, iso, photoId }),
    [],
  );
  const onRetryLocal = useCallback(
    (local: LocalMessage) => {
      setLocals((prev) =>
        prev.map((item) =>
          item.clientKey === local.clientKey ? { ...item, state: 'queued' } : item,
        ),
      );
      onSend(local.text);
    },
    [onSend],
  );
  const onRetryCapture = useCallback(
    (payload: CapturePayload) => void retryCapture(payload, captureRunner),
    [captureRunner],
  );
  const onOpenCapture = useCallback(
    (uri: string, caption: string, iso: string) => setViewer({ uri, caption, iso }),
    [],
  );
  const onChooseQueued = useCallback(() => router.push('/photos-waiting'), []);
  const onLeaveQueueNote = useCallback((messageId: string) => {
    setDismissedNotes((prev) => new Set(prev).add(messageId));
    void dismissQueueNote(messageId);
  }, []);
  const queueActions = useMemo(
    () => ({ readableNow: allowanceLeft, onChoose: onChooseQueued, onLeave: onLeaveQueueNote }),
    [allowanceLeft, onChooseQueued, onLeaveQueueNote],
  );
  const residents = useMemo(() => (street.data?.residents ?? []).map((resident) => resident.neighbour), [street.data?.residents]);
  const onMoveIn = useCallback(
    async (neighbour: 'penny' | 'mira' | 'milo') => {
      await apiFetch(`/v1/neighbours/${neighbour}/move-in`, { method: 'POST' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['street'] }),
        refreshFeedHead(qc),
      ]);
    },
    [qc],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.surfacePage }} edges={['top', 'bottom']}>
      {/* KeyboardAvoidingView keeps the composer above the keyboard on both platforms.
          iOS uses padding; Android uses height because edge-to-edge Android (API 35+)
          ignores windowSoftInputMode adjustResize. The SafeAreaView now handles the
          bottom home-indicator inset, so the composer container no longer needs a
          manual paddingBottom that could fight the keyboard lift. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={{ height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: t.color.borderStructure, backgroundColor: t.color.surfacePage }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open menu" hitSlop={10} onPress={() => navigation.openDrawer()}>
            <Icon name="menu" size={24} color={t.color.textPrimary} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Image source={dark ? markInverse : markColour} style={{ width: 27, height: 27 }} resizeMode="contain" accessibilityIgnoresInvertColors />
            <Image source={dark ? wordmarkInverse : wordmark} style={{ width: 50, height: 19 }} resizeMode="contain" accessibilityLabel="Petak" />
          </View>
          {/* 6 Sep 2026 (founder): "the button for 'new chat' is next to ollie's
              board, i think its too risky". Starting a new chat throws away the
              thread you are in; opening the board does not. Two controls that
              far apart in consequence should not be 8px apart on screen, in the
              busiest header in the product. Clear-chat has moved down beside
              the allowance line — see the composer footer. */}
          <Pressable accessibilityRole="button" accessibilityLabel="Your neighbours" hitSlop={10} onPress={() => {Keyboard.dismiss();setNavigationOpen(true);}}>
            <Icon name="grid_view" size={24} color={t.color.textPrimary} />
          </Pressable>
        </View>
        {offline ? (
          <View style={[styles.offlineLine, { borderBottomColor: t.color.borderStructure }]}>
            <Icon name="schedule" size={16} color={t.color.textSecondary} />
            <Text style={{ color: t.color.textSecondary, fontSize: 13 }}>{OFFLINE_LINE}</Text>
          </View>
        ) : null}
        <GridWallpaper />
        <ChatLayout>
          <CaptureVisibilityContext.Provider value={visibilityCallbacks}>
          <FlatList
            ref={listRef}
            data={reversedRows}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            inverted
            // Tapping the feed (or dragging it) ends the composer's turn: the
            // keyboard closes, and the Composer's keyboardDidHide listener
            // reverts the right button to the camera. "handled" keeps taps on
            // bubbles/buttons working — only unhandled taps dismiss.
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            keyExtractor={(row) =>
              row.kind === 'day'
                ? `day:${row.label}`
                : row.kind === 'message'
                  ? row.message.id
                  : row.kind === 'capture'
                    ? `cap:${row.capture.payload.client_key}`
                    : row.kind === 'batch'
                      ? row.key
                      : row.kind === 'local'
                        ? `local:${row.local.clientKey}`
                        : row.kind === 'from-board'
                          ? 'from-board'
                          : row.kind === 'greeting'
                            ? 'greeting'
                            : row.kind === 'resume'
                              ? 'resume'
                              : row.kind === 'activity-status' ? `activity:${row.key}` : `work:${row.working.id}`
            }
            contentContainerStyle={{
              padding: CHAT_GUTTER,
              gap: 14,
              flexGrow: feed.isPending || feed.isError ? 1 : undefined,
            }}
            ListEmptyComponent={
              feed.isPending ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={t.color.interactive} />
                </View>
              ) : feed.isError ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <Text style={{ color: t.color.textSecondary, textAlign: 'center' }}>
                    That did not go through. Try again in a moment.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void feed.refetch()}
                    style={{
                      minHeight: 44,
                      justifyContent: 'center',
                      paddingHorizontal: 18,
                      borderWidth: 1,
                      borderRadius: 4,
                      borderColor: t.color.interactive,
                    }}
                  >
                    <Text style={{ color: t.color.interactive, fontWeight: '500' }}>Try again</Text>
                  </Pressable>
                </View>
              ) : null
            }
            onEndReached={() => {
              if (canPageHistoryFromScroll({
                pendingTarget, hasNextPage: !!feed.hasNextPage, isFetching: feed.isFetching, isError: feed.isError,
              })) void feed.fetchNextPage();
            }}
            onEndReachedThreshold={0.4}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              const target = currentBoardScroll.current.target;
              if (!target) return;
              if (scrollTimer.current) clearTimeout(scrollTimer.current);
              const offset = boardScrollRecoveryOffset(index, averageItemLength, scrollAttempts.current++);
              if (offset === null) {
                // The message exists and stays pinned; this is a scroll failure,
                // never evidence that the original has gone missing.
                Alert.alert('From the board', 'That did not go through. Try again in a moment.');
                return;
              }
              listRef.current?.scrollToOffset({ offset, animated: false });
              scrollTimer.current = setTimeout(() => {
                const latest = currentBoardScroll.current;
                if (latest.target !== target || latest.index === null) return;
                listRef.current?.scrollToIndex({ index: latest.index, viewPosition: 0.5, animated: true });
              }, 300);
            }}
            renderItem={({ item: row, index }) => {
              // reversedRows is newest-first, so the row rendered ABOVE this
              // one in reading order is the NEXT index. Used only to decide
              // whether a reply's quote block earns its place.
              const above = reversedRows[index + 1];
              const prevMessageId =
                above && (above.kind === 'message' || above.kind === 'local')
                  ? ((above as { message?: { id?: string } }).message?.id ?? null)
                  : null;
              if (row.kind === 'from-board') {
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: t.color.borderStructure }} />
                    <Text
                      style={{
                        color: t.color.textSecondary,
                        fontFamily: t.typography.textSmall.fontFamily,
                        fontWeight: '500',
                        fontSize: 11,
                        letterSpacing: 0.9, // the drawing's .08em at 11px
                        textTransform: 'uppercase',
                      }}
                    >
                      From the board
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: t.color.borderStructure }} />
                  </View>
                );
              }
              if (row.kind === 'day') {
                return (
                  <Text style={{ textAlign: 'center', color: t.color.textSecondary, fontSize: 12 }}>
                    {row.label}
                  </Text>
                );
              }
              if (row.kind === 'activity-status') {
                return <View accessibilityLiveRegion="polite" style={{marginLeft:40,gap:8}}>
                  <Text style={{color:row.failed?t.color.error:t.color.textSecondary,fontSize:13}}>{row.text}</Text>
                  {row.retry ? <Pressable accessibilityRole="button" onPress={row.retry}><Text style={{color:t.color.interactive}}>Try again</Text></Pressable> : null}
                  {row.failed ? <View style={{flexDirection:'row',gap:16}}>
                    <Pressable accessibilityRole="button" onPress={()=>router.push('/(drawer)/settings/tell-ollie')}>
                      <Text style={{color:t.color.interactive}}>Tell Ollie</Text>
                    </Pressable>
                    {row.dismiss ? <Pressable accessibilityRole="button" onPress={row.dismiss}><Text style={{color:t.color.interactive}}>Dismiss</Text></Pressable> : null}
                  </View> : null}
                </View>;
              }
              if (row.kind === 'working') {
                const who = NEIGHBOURS[row.working.id];
                return (
                  <WorkingIndicator
                    neighbour={who}
                    kind={row.working.kind}
                    ordinal={ordinalOf(row.working)}
                    t={t}
                  />
                );
              }
              if (row.kind === 'resume') {
                return <ResumeRow neighbour={NEIGHBOURS.ollie} t={t} />;
              }
              if (row.kind === 'greeting') {
                return (
                  <GreetingRow
                    name={row.name}
                    allowance={row.allowance}
                    neighbour={NEIGHBOURS.ollie}
                    t={t}
                  />
                );
              }
              if (row.kind === 'local') {
                return (
                  <LocalRow
                    local={row.local}
                    t={t}
                    onRetry={onRetryLocal}
                  />
                );
              }
              if (row.kind === 'batch') {
                return (
                  <PhotoBatchCard count={row.count} minute={row.minute} uris={row.uris} t={t} />
                );
              }
              if (row.kind === 'capture') {
                return (
                  <CaptureCard
                    payload={row.capture.payload}
                    createdAt={row.capture.createdAt}
                    onRetry={onRetryCapture}
                    onOpen={onOpenCapture}
                  />
                );
              }
              const neighbour = NEIGHBOURS[row.message.neighbour as NeighbourId];
              if (!neighbour) return null; // an unknown speaker never crashes the feed
              // "or leave them" hides the note; the row is the record, so
              // tomorrow's note is a different message and appears again.
              if (dismissedNotes.has(row.message.id)) return null;
              return (
                <ServerRow
                  userDisplayName={displayName}
                  message={row.message}
                  showHead={row.showHead}
                  neighbour={neighbour}
                  t={t}
                  byId={byId}
                  prevMessageId={prevMessageId}
                  openTasks={openTasks.data}
                  onPin={onPinFeedMessage}
                  onQuotePress={onQuotePress}
                  onSend={onSend}
                  onSubmitProfile={onSubmitProfile}
                  onOpenPhoto={onOpenFeedPhoto}
                  queueActions={queueActions}
                  residents={residents}
                  onMoveIn={onMoveIn}
                  timeZone={timeZone}
                />
              );
            }}
          />
          </CaptureVisibilityContext.Provider>
        </ChatLayout>
        {/* Bottom chrome: SafeAreaView handles the home-indicator inset;
            KeyboardAvoidingView lifts this whole area above the keyboard. */}
        <View>
          {pendingCaptures.length > 0 ? (
            <View style={styles.waitingWrap}>
              <Pressable accessibilityRole="button" accessibilityLabel={waitingLabel} onPress={showCaptureStatus} style={[styles.waitingChip, { borderColor: t.color.borderStructure, minHeight: 44 }]}>
                <Icon name="schedule" size={14} color={t.color.textSecondary} />
                <Text style={{ color: t.color.textSecondary, fontSize: 12 }}>{waitingLabel}</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={{ textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6, color: t.color.textSecondary, fontSize: 12 }}>
            {balanceLine ?? ''}
          </Text>
          {attachNote ? (
            <Text
              style={{
                textAlign: 'center',
                paddingBottom: 6,
                color: t.color.textSecondary,
                fontSize: 12,
              }}
            >
              {attachNote}
            </Text>
          ) : null}
          <Composer
            pickerOrder={pickerOrder}
            initialText={composerPrefill.text}
            initialChips={composerPrefill.chips}
            reference={composerReference}
            photoDraft={
              attached?.kind === 'photos'
                ? { uri: attached.assets[0].uri, count: attached.assets.length }
                : null
            }
            documentDraft={attached?.kind === 'document' ? { name: attached.name } : null}
            onRemovePhoto={() => setAttached(null)}
            onRemoveDocument={() => setAttached(null)}
            onSendPhoto={sendAttached}
            onClearReference={() => {
              setReference(null);
              leaveBoard(); // Run A #33 — the mark leaves with the chip
            }}
            onSend={onSend}
            onAttach={() => setAttachOpen(true)}
            onCamera={() => void launchCamera()}
            onFocusChange={setComposerFocused}
          />
        </View>
      </KeyboardAvoidingView>
      <NeighbourNavigation visible={navigationOpen} onClose={() => setNavigationOpen(false)} onClearChat={clearChat} />
      <SendPhotoSheet
        visible={attachOpen}
        showCamera={composerFocused}
        onClose={() => setAttachOpen(false)}
        onCamera={(opts) => void takePhoto(opts?.useKeptCredit === true)}
        onLibrary={(opts) => void pickFromLibrary(opts?.useKeptCredit === true)}
        onDocument={() => void pickDocument()}
      />
      {viewer ? (
        <Modal visible animationType="fade" onRequestClose={() => setViewer(null)}>
          <PhotoViewer
            viewer={{
              uri: viewer.uri,
              caption: viewer.caption,
              time: dayTimeLabel(viewer.iso),
              photoId: viewer.photoId,
            }}
            onClose={() => setViewer(null)}
          />
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

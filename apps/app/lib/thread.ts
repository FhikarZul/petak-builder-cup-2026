import type { CaptureProgress } from '@petak/config/capture-progress';
import { preserveNewerProgress } from './captureProgress';
import { collectJournalPages, type JournalPage } from './journalPages';
// Thread data layer (plan §3): TanStack Query is the ONE data layer (C61).
//
// As-built server contract (26 Aug):
// - GET /v1/neighbours/:neighbour/messages — no cursor returns the MOST
//   RECENT page; pages are OLDEST-FIRST within the page; `cursor` is the
//   page's OLDEST id, so `before=cursor` pages backward (older history) and
//   `since=cursor` pages forward. both → `since` wins.
// - GET /v1/photos/:id returns a presigned `image_url` (G3).
// - POST returns the reply synchronously; a second neighbour's reply lands
//   via SSE + sync.
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { apiFetch } from './api';
import { requestActivity } from './requestActivity';
import { useSession } from './supabase';
import type {
  CategoryRow,
  MiloLogType,
  MiloToday,
  PennyRange,
  PennySeries,
  PennyToday,
  Street,
  UserSettings,
  Wallet,
} from './dashboard';
import type { TrailVersion } from './honesty';
import type { Rule } from './rules';
import { photoStateRefetchInterval, photoStateStaleTime } from './photoState';
export { photoStateRefetchInterval } from './photoState';

const PAGE_SIZE = 50;

export interface ThreadMessage {
  id: string;
  role: string; // 'user' | 'assistant'
  body: string;
  state: string; // 'sent' | 'queued' | 'failed'
  created_at: string;
  photo_id: string | null;
  /** What the carried photo IS (0029): 'application/pdf' renders a document
   *  card, never an Image. NULL when the message carries no photo. */
  content_type: string | null;
  ref_message_id: string | null;
  // G1 (app slice 2): the structured payload beside the body — an OPEN kind
  // set, narrowed by lib/blocks.ts; null for plain messages. A block
  // decorates a message, it never replaces the body.
  blocks: unknown;
}

export interface ThreadPage {
  messages: ThreadMessage[];
  cursor: string | null;
  has_more: boolean;
}

export function threadKey(neighbour: string) {
  return ['thread', neighbour] as const;
}

function fetchThreadPage(neighbour: string, before: string | null): Promise<ThreadPage> {
  const cursor = before ? `&before=${before}` : '';
  return apiFetch<ThreadPage>(`/v1/neighbours/${neighbour}/messages?limit=${PAGE_SIZE}${cursor}`);
}

/**
 * The thread, newest page first. `fetchNextPage` walks BACKWARD into older
 * history (an inverted FlatList calls it when the user scrolls up).
 */
export function useThreadMessages(neighbour: string) {
  return useInfiniteQuery({
    queryKey: threadKey(neighbour),
    queryFn: ({ pageParam }) => fetchThreadPage(neighbour, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.cursor : undefined),
  });
}

/** All loaded messages, oldest-first (pages are newest-first, each oldest-first within). */
export function flattenThread(data: InfiniteData<ThreadPage> | undefined): ThreadMessage[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((page) => page.messages);
}

// ---------------------------------------------------------------------------
// C63 — the merged feed (pure types + grouping live in lib/feed.ts)
// ---------------------------------------------------------------------------
import { mergeFeedHead, type FeedPage, type FeedMessage } from './feed';
export type { FeedPage, FeedMessage } from './feed';
export { groupByDay } from './feed';

export function feedKey() {
  return ['feed'] as const;
}

function fetchFeedPage(before: string | null): Promise<FeedPage> {
  const cursor = before ? `&before=${before}` : '';
  return apiFetch<FeedPage>(`/v1/feed?limit=${PAGE_SIZE}${cursor}`);
}

/** Fetch only the newest feed page and merge it into the loaded history.
 * TanStack Query otherwise refetches every loaded infinite-query page when
 * ['feed'] is invalidated. The short-lived head key also coalesces event bursts. */
export async function refreshFeedHead(queryClient: QueryClient, force = false): Promise<void> {
  const recoverable = requestActivity.snapshot().filter(row => row.refreshFailed).map(row => row.key);
  // A post-write refresh must start AFTER the write, not join a head request
  // already in flight with a pre-write snapshot. mergeFeedHead preserves any
  // newer additions even if that older request subsequently completes.
  const fresh = force ? await fetchFeedPage(null) : await queryClient.fetchQuery({
    queryKey: ['feed', 'head'],
    queryFn: () => fetchFeedPage(null),
    staleTime: force ? 0 : 500,
  });
  queryClient.setQueryData<InfiniteData<FeedPage>>(feedKey(), (current) =>
    mergeFeedHead(current, fresh) as InfiniteData<FeedPage>,
  );
  if (force && recoverable.length) requestActivity.refreshed(recoverable);
}

/** The whole street in one thread, newest page first — same paging contract as
 *  useThreadMessages, and the server shares one cursor engine with it. */
export function useFeed() {
  const session = useSession();
  return useInfiniteQuery({
    queryKey: feedKey(),
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.cursor : undefined),
    enabled: session !== null,
  });
}

/** All loaded feed messages, oldest-first. */
export function flattenFeed(data: InfiniteData<FeedPage> | undefined): FeedMessage[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((page) => page.messages);
}

export interface PhotoInfo {
  progress?: CaptureProgress;
  photo_id: string;
  state: string;
  created_at: string;
  image_url: string;
  /** Run A #8's viewer footer — who filed this photo and under what. Empty
   *  until it has been read; the app never guesses (C66). */
  filed_by?: { neighbour: string; kind: string; category: string | null }[];
}


/** Presigned image URL for one photo (G3) — received and quoted photos only. */
export function usePhoto(photoId: string | null) {
  return useQuery({
    queryKey: ['photo', photoId],
    queryFn: ({ signal }) => apiFetch<PhotoInfo>(`/v1/photos/${photoId}`, { signal }),
    structuralSharing: (previous, next) => preserveNewerProgress(previous as PhotoInfo | undefined, next as PhotoInfo),
    enabled: photoId !== null,
    staleTime: 30 * 60 * 1000, // presigned URLs expire; refetch rather than persist
  });
}

/**
 * App slice 3 (plan §5): a capture card's photo state. Same ['photo', id]
 * key (the photo.reading nudge invalidates it). A processing photo gets a
 * five-second fallback poll; confirmed terminal and parked progress stops polling.
 */
export function usePhotoState(photoId: string | null) {
  return useQuery({
    queryKey: ['photo', photoId],
    queryFn: ({ signal }) => apiFetch<PhotoInfo>(`/v1/photos/${photoId}`, { signal }),
    structuralSharing: (previous, next) => preserveNewerProgress(previous as PhotoInfo | undefined, next as PhotoInfo),
    enabled: photoId !== null,
    staleTime: query => photoStateStaleTime(query.state.data?.progress?.stage),
    refetchInterval: (query) => photoStateRefetchInterval(query.state.data?.state, query.state.data?.progress?.stage),
  });
}

/** ONE shape for /v1/street (D4). Run B #16 added the allowance SPLIT — what
 *  is yours and what the street adds — so the wallet can say why the number
 *  is what it is. */
export type StreetInfo = Street;

/** GET /v1/street — the #75 sheet's allowance chips and the #32 picker's n. */
export function useStreet() {
  return useQuery({
    queryKey: ['street'],
    queryFn: () => apiFetch<StreetInfo>('/v1/street'),
    staleTime: 30 * 1000,
  });
}

export interface QueuedPhoto {
  photo_id: string;
  created_at: string;
  /** Presigned, carried on the list itself (27 Aug) so the picker renders N
   *  tiles without N extra round trips. It is a signed URL, never a read. */
  image_url: string;
}

/** GET /v1/photos?state=queued — the #32 "Photos waiting" list, oldest first. */
export function useQueuedPhotos() {
  return useQuery({
    queryKey: ['photos', 'queued'],
    queryFn: () => apiFetch<{ photos: QueuedPhoto[] }>('/v1/photos?state=queued'),
    select: (data) => data.photos,
    staleTime: 15 * 1000,
  });
}

export interface ThreadSummary {
  neighbour: string;
  last_message: { role: string; excerpt: string; at: string; state: string } | null;
  open_asks: number;
}

/**
 * GET /v1/threads — every resident, most-recent first. This slice consumes
 * the ORDER ONLY (the @-picker's most-talked-to proxy); chat home is a
 * later slice.
 */
export function useThreadOrder() {
  return useQuery({
    queryKey: ['threads'],
    queryFn: () => apiFetch<{ threads: ThreadSummary[] }>('/v1/threads'),
    select: (data) => data.threads.map((t) => t.neighbour),
  });
}

export interface SendResult {
  user_message_id: string;
  reply: { id: string; body: string; created_at: string };
  limited: string | null;
}

// ---- app slice 2 hooks ------------------------------------------------------

/** GET /v1/tasks — the OPEN asks (slice 14). task_actions/undo blocks whose
 * task_id is absent here are closed: their buttons render INERT (plan §5 —
 * one undo per action, a second tap does nothing; the button never expires
 * locally). */
export function useOpenTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () =>
      apiFetch<{ tasks: { id: string; neighbour: string; kind: string }[] }>('/v1/tasks'),
    select: (data) => new Set(data.tasks.map((t) => t.id)),
  });
}

/** GET /v1/entries/:id/trail (G2) — every version, newest first. Backs both
 * the entry card's honesty strip and #61's "What changed" sheet. A foreign
 * id 404s exactly like the message cursors — the card just shows no strip. */
export function useEntryTrail(entryId: string | null) {
  return useQuery({
    queryKey: ['trail', entryId],
    queryFn: () =>
      apiFetch<{ versions: TrailVersion[] }>(`/v1/entries/${entryId}/trail`),
    enabled: entryId !== null,
    retry: false, // a 404 is an answer (foreign/gone), not a failure to retry
    staleTime: 60 * 1000,
  });
}

export interface LinkedPhoto {
  /** The OTHER photo in the link (the entry's own photo id rides `photo_id`). */
  photo_id: string;
  kind: string;
  direction: 'from' | 'to';
}

/** One row of GET /v1/neighbours/:neighbour/entries (fields this slice reads). */
export interface LedgerEntry {
  /** Expense calendar day in the server's anchored policy; never a timestamp. */
  effective_day?: string;
  /** Printed purchase clock only; null means unknown, not midnight. */
  purchase_time?: string | null;
  date_basis?: 'purchase' | 'recorded';
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
  has_photo: boolean;
  /** Run C #71 — the entry's OWN photo, served so the evidence-chip target is
   *  a lookup, not a guess. */
  photo_id: string | null;
  /** Founder, 3 Sep 2026 — the dashboards DRAW the photo: a presigned GET for
   *  the entry's own photo, null for text entries. Never persist (it expires). */
  image_url: string | null;
  /** What the photo IS (0029): 'application/pdf' renders an inert document
   *  chip, never an Image or the viewer. NULL when the entry carries no photo. */
  content_type: string | null;
  superseded_by: string | null;
  voided?: true;
  linked_photos: LinkedPhoto[];
  filing: 'filed' | 'waiting_on_a_name';
  meal_group_id?: string | null;
  /** Server-valued expense amount; null when home evidence is unavailable. */
  reporting_amount?: number | null;
  reporting_currency?: string;
  valuation_estimated?: boolean;
}

/**
 * A neighbour's most recent entries — the entry card's payload (value,
 * category, date) and the evidence chip's linked_photos ride this endpoint
 * (C41; no single-entry endpoint exists). First page only: an entry older
 * than that degrades the card to the block's own fields.
 */
export function useNeighbourEntries(neighbour: string | null) {
  return useQuery({
    queryKey: ['entries', neighbour],
    queryFn: () =>
      apiFetch<{ entries: LedgerEntry[]; next_cursor: string | null }>(
        `/v1/neighbours/${neighbour}/entries?limit=50`,
      ),
    enabled: neighbour !== null,
    retry: false, // a 404 (unshipped neighbour) is an answer, not a failure
    staleTime: 30 * 1000,
  });
}

/** Find one entry in a served page (null → the card degrades, never errors). */
export function findEntry(entries: LedgerEntry[] | undefined, id: string): LedgerEntry | null {
  return entries?.find((e) => e.id === id) ?? null;
}


/**
 * Merge a synchronous send response into the thread cache directly (plan §3)
 * — the user message and the neighbour's reply append to the most recent
 * page, no round-trip wait. The next invalidation reconciles from server.
 */
export function mergeSendIntoCache(
  queryClient: QueryClient,
  neighbour: string,
  send: {
    userMessageId: string;
    text: string;
    clientSentAt: string;
    refMessageId?: string | null;
    result: SendResult;
  },
): void {
  queryClient.setQueryData<InfiniteData<ThreadPage>>(threadKey(neighbour), (data) => {
    if (!data || data.pages.length === 0) return data;
    const userMessage: ThreadMessage = {
      id: send.userMessageId,
      role: 'user',
      body: send.text,
      state: 'sent',
      created_at: send.clientSentAt,
      photo_id: null,
      content_type: null,
      ref_message_id: send.refMessageId ?? null,
      blocks: null,
    };
    const reply: ThreadMessage = {
      id: send.result.reply.id,
      role: 'assistant',
      body: send.result.reply.body,
      state: 'sent',
      created_at: send.result.reply.created_at,
      photo_id: null,
      content_type: null,
      ref_message_id: send.userMessageId,
      // The POST response carries no blocks (they're written at reply-
      // construction sites and ride sync) — the next refetch picks them up.
      blocks: null,
    };
    // Dedupe: a fast SSE refetch may have already landed these rows.
    const known = new Set(data.pages.flatMap((p) => p.messages.map((m) => m.id)));
    const additions = [userMessage, reply].filter((m) => !known.has(m.id));
    if (additions.length === 0) return data;
    const pages = data.pages.map((page, i) =>
      i === 0 ? { ...page, messages: [...page.messages, ...additions] } : page,
    );
    return { ...data, pages };
  });
}

/** Run B #3 — Milo's dashboard payload (macros, targets, C90's profile, the
 *  energy basis). Shapes live in lib/dashboard.ts, which stays api-free so it
 *  can be unit-tested. */
export function useMiloToday() {
  return useQuery({
    queryKey: ['today', 'milo'],
    queryFn: () => apiFetch<MiloToday>('/v1/neighbours/milo/today'),
    staleTime: 60 * 1000,
  });
}

/** Run B #4 — Penny's dashboard payload (today, yesterday, budget position). */
export function usePennyToday() {
  return useQuery({
    queryKey: ['today', 'penny'],
    queryFn: () => apiFetch<PennyToday>('/v1/neighbours/penny/today'),
    staleTime: 60 * 1000,
  });
}

/** C43 — the live category list, for "Where it went". Run B #5: a custom
 *  window appends from/to and waits for the window to exist before fetching. */
export function useCategories(range: PennyRange | 'all', custom?: { from: string; to: string }) {
  const url =
    range === 'custom' && custom
      ? `/v1/neighbours/penny/categories?range=custom&from=${custom.from}&to=${custom.to}`
      : `/v1/neighbours/penny/categories?range=${range}`;
  return useQuery({
    queryKey: ['categories', range, custom?.from, custom?.to],
    queryFn: () => apiFetch<{ categories: CategoryRow[]; archived: string[] }>(url),
    enabled: range !== 'custom' || !!custom,
    staleTime: 60 * 1000,
  });
}

/** Run B #4 (sub-slice B, plans/2026-08-28-penny-charts-series.md) — Penny's
 *  trend series: the daily bars, merchants, window counts and (month+budget
 *  only) the running total. Every figure the charts show comes from here or
 *  /categories — never from maths over a page of /entries (the 28i rule). */
export function usePennySeries(range: PennyRange, custom?: { from: string; to: string }) {
  const url =
    range === 'custom' && custom
      ? `/v1/neighbours/penny/series?range=custom&from=${custom.from}&to=${custom.to}`
      : `/v1/neighbours/penny/series?range=${range}`;
  return useQuery({
    queryKey: ['series', 'penny', range, custom?.from, custom?.to],
    queryFn: () => apiFetch<PennySeries>(url),
    // No fetch before the window exists — an unfired query is the honest
    // empty state.
    enabled: range !== 'custom' || !!custom,
    staleTime: 60 * 1000,
  });
}

/** Run B #4 (sub-slice C, plans/2026-08-28-penny-charts-series.md) — the
 *  range-scoped, searchable log. `type` is 'all' | 'photos' | a category
 *  name; `q` arrives already trimmed + debounced by the screen (≥1 char or
 *  empty). First page only, limit=50 — the drawing pages nothing, and the
 *  summary line never sums a partial page (the 28i rule; the rest is a
 *  later slice's). `useNeighbourEntries` above is untouched: chat cards
 *  depend on its exact key/shape. */
export function usePennyLog(range: PennyRange, q: string, type: string, custom?: { from: string; to: string }) {
  let url =
    range === 'custom' && custom
      ? `/v1/neighbours/penny/entries?range=custom&from=${custom.from}&to=${custom.to}&limit=50`
      : `/v1/neighbours/penny/entries?range=${range}&limit=50`;
  if (q) url += `&q=${encodeURIComponent(q)}`;
  if (type === 'photos') url += '&with_photo=true';
  else if (type !== 'all') url += `&category=${encodeURIComponent(type)}`;
  return useQuery({
    queryKey: ['penny-log', range, q, type, custom?.from, custom?.to],
    queryFn: () => apiFetch<{ entries: LedgerEntry[]; next_cursor: string | null }>(url),
    enabled: range !== 'custom' || !!custom,
    staleTime: 30 * 1000,
  });
}

/** Run B #8 — Milo's range-scoped, searchable log. `type` is the bounded
 *  server contract ('all' | 'food' | 'body' | 'photos'), unlike Penny where
 *  user-named categories ride `category=`. First page only; paginated pages
 *  intentionally suppress summary totals rather than showing partial facts. */
export function useMiloLog(range: PennyRange, q: string, type: MiloLogType, custom?: { from: string; to: string }) {
  let url =
    range === 'custom' && custom
      ? `/v1/neighbours/milo/entries?range=custom&from=${custom.from}&to=${custom.to}&limit=50`
      : `/v1/neighbours/milo/entries?range=${range}&limit=50`;
  if (q) url += `&q=${encodeURIComponent(q)}`;
  if (type !== 'all') url += `&type=${type}`;
  return useQuery({
    queryKey: ['milo-log', range, q, type, custom?.from, custom?.to],
    queryFn: () => apiFetch<{ entries: LedgerEntry[]; next_cursor: string | null }>(url),
    enabled: range !== 'custom' || !!custom,
    staleTime: 30 * 1000,
  });
}

/** Run B #2 — Mira's journal, grouped by the user's own day. */
export function useJournal() {
  return useQuery({
    queryKey: ['journal', 'mira'],
    queryFn: ({ signal }) => collectJournalPages(
      cursor => apiFetch<JournalPage>(`/v1/neighbours/mira/journal${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal }),
      signal,
    ),
    staleTime: 60 * 1000,
  });
}

/** Run B #15/#17 — the coin wallet and its history. */
export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiFetch<Wallet>('/v1/wallet'),
    staleTime: 30 * 1000,
  });
}

/** Run B #11/#12 — the settings bag. */
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<UserSettings>('/v1/settings'),
    staleTime: 60 * 1000,
  });
}

/** Your rules (3 Sep 2026) — the standing filing words, listed and killable. */
export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: () => apiFetch<{ rules: Rule[] }>('/v1/rules'),
    staleTime: 30 * 1000,
  });
}

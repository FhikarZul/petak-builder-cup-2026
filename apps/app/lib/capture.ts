// App slice 3 (plan §2) — the capture flow's upload state machine, PURE (the
// unit-test target). One capture = one outbox item of kind 'capture'
// (lib/outbox.ts:11), persisted PER TRANSITION so a kill/restart resumes
// mid-flow ("leaving the app doesn't stop it", #76). The impure driver
// (fetch/PUT/expo-crypto) lives in lib/captureRun.ts; this module owns the
// shapes and every transition decision.
//
// Transition order (the caption race is real — the worker reads the caption
// at extraction time): create → PUT bytes → POST the photo message
// (photo_id + caption, C53) → accept. A PUT failure leaves NO message
// behind; the card shows its failure line locally (§5).
//
// `step` names the last COMPLETED transition; nextAction() names what runs.
// Resume re-enters at the persisted step: an expired upload_url re-POSTs
// create with the SAME client_key — the replay returns a fresh url while
// 'awaiting_upload', never a new photo row.

export type CaptureStep = 'preparing' | 'picked' | 'created' | 'uploaded' | 'messaged' | 'accepted';

/** The outbox payload (plan §2 verbatim) + the fields the flow accumulates. */
export interface CapturePayload {
  step: CaptureStep;
  client_key: string;
  sha256: string;
  /** Bytes being PUT. Absent means the photo default (image/jpeg); documents
   *  ride the same pipeline as 'application/pdf' (3 Sep 2026 attach sheet). */
  content_type?: 'image/jpeg' | 'application/pdf';
  /** A document's display name (the composer's chip, the feed card's label). */
  filename?: string;
  /** The message route. `UNADDRESSED` lets the server interpret ordinary
   * caption words, including serialized @ mentions. */
  neighbour: string;
  /** C53: the message body and extraction context; empty when no words were entered. */
  caption: string;
  local_uri: string;
  photo_id?: string;
  /** In hand between 'created' and 'uploaded'; a presigned PUT url. */
  upload_url?: string;
  /** The photo message's id (from the POST response) — the server-twin key. */
  message_id?: string;
  /** Terminal failure line state — the card's "That photo didn't upload." */
  failed?: string | null;
  /** Transient upload failure, retained until the next resume attempt. */
  retry_pending?: boolean;
  /** The last state the server reported (accept/duplicate response). */
  server_state?: string;
  /** Duplicate short-circuit: the card attached to an EXISTING photo. */
  duplicate?: boolean;
  ref_message_id?: string;
  /** Run A #31: explicit consent to spend a kept credit if today's allowance
   *  is exhausted. False/absent means the worker may hold the photo until
   *  reset when credit prompting is on. */
  use_kept_credit?: boolean;
  platform?: 'android' | 'ios' | 'web';
  source?: 'camera' | 'gallery' | 'share_sheet';
  photo_size_bytes?: number;
  /** Send timing starts when local Sending is published; persisted across upload steps. */
  timing_started_at_ms?: number;
  timing_resumed?: boolean;
}

/** What the driver runs next for a persisted payload. */
export type CaptureAction = 'prepare' | 'create' | 'upload' | 'message' | 'accept' | 'done';

/** C65 — the sentinel a merged-feed capture carries instead of a neighbour.
 *  It is not a neighbour name: it means "nobody named, let the server route".
 *  Cards resolve their speaker after the reply lands. */
export const UNADDRESSED = '__route__';

/** C65 — where a photo's message is POSTed. A capture that names nobody goes
 *  to the un-addressed endpoint and the server routes it (one domain, two, or
 *  Ollie); one that knows its neighbour keeps the addressed path. Pure, so the
 *  choice is testable without the native capture runner. */
export function photoMessagePath(neighbour: string): string {
  return neighbour === UNADDRESSED ? '/v1/messages' : `/v1/neighbours/${neighbour}/messages`;
}

/** A fresh capture renders immediately; unprepared bytes are persisted before
 * native preparation begins. Existing prepared callers retain the picked step. */
export function newCapture(input: {
  clientKey: string;
  startedAtMs?: number;
  sha256?: string;
  neighbour: string;
  caption: string;
  refMessageId?: string;
  localUri: string;
  useKeptCredit?: boolean;
  platform?: 'android' | 'ios' | 'web';
  source?: 'camera' | 'gallery' | 'share_sheet';
  contentType?: 'image/jpeg' | 'application/pdf';
  filename?: string;
}): CapturePayload {
  return {
    step: input.sha256 ? 'picked' : 'preparing',
    client_key: input.clientKey,
    ...(input.startedAtMs !== undefined ? { timing_started_at_ms: input.startedAtMs } : {}),
    sha256: input.sha256 ?? '',
    neighbour: input.neighbour,
    caption: input.caption,
    ...(input.refMessageId ? {ref_message_id:input.refMessageId} : {}),
    ...(input.useKeptCredit ? { use_kept_credit: true } : {}),
    ...(input.platform ? { platform: input.platform } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.contentType ? { content_type: input.contentType } : {}),
    ...(input.filename ? { filename: input.filename } : {}),
    local_uri: input.localUri,
    failed: null,
  };
}

/** A capture carrying a document (PDF) instead of a photo — same pipeline,
 *  same dedupe, different bytes and a different card. */
export function isDocument(p: CapturePayload): boolean {
  return p.content_type === 'application/pdf';
}

/**
 * The next action for a persisted payload. Held photos post NO client photo
 * message (accept posts it to the Mira thread server-side — the
 * messages_one_photo index would conflict), so 'uploaded' goes straight to
 * accept. A 'created' payload without an upload_url re-creates (the replay
 * returns a fresh url for the same client_key).
 */
export function nextAction(p: CapturePayload): CaptureAction {
  switch (p.step) {
    case 'preparing':
      return 'prepare';
    case 'picked':
      return 'create';
    case 'created':
      return p.upload_url ? 'upload' : 'create';
    case 'uploaded':
      // C64: every photo takes the same path — a photo addressed to Mira no
      // longer skips the message step to avoid a read.
      return 'message';
    case 'messaged':
      return 'accept';
    case 'accepted':
      return 'done';
  }
}

export interface CreateResult {
  photo_id: string;
  upload_url?: string;
  upload_complete?: boolean;
  carrying_message_id?: string;
  duplicate?: boolean;
  state?: string;
}

/**
 * After POST /v1/photos. Duplicate short-circuit (the gate): same bytes,
 * same photo — the card attaches to the existing photo and the flow ENDS,
 * no PUT, no second anything.
 */
export function afterCreate(p: CapturePayload, res: CreateResult): CapturePayload {
  // A finalized upload may have survived a crash before admission. Resume the
  // idempotent message/accept steps; a duplicate hash alone is not acceptance.
  if (res.upload_complete === true && res.state === 'awaiting_upload') {
    return {...p, step: res.carrying_message_id ? 'messaged' : 'uploaded',
      message_id: res.carrying_message_id, photo_id: res.photo_id, upload_url: undefined,
      duplicate: false, server_state: res.state};
  }
  if (res.duplicate) {
    return {
      ...p,
      step: isDuplicateExpenseLookup(p.caption) ? 'messaged' : 'accepted',
      photo_id: res.photo_id,
      duplicate: true,
      server_state: res.state,
      upload_url: undefined,
    };
  }
  if (res.state && ['queued', 'waiting', 'processing', 'filed'].includes(res.state)) {
    return {...p, step: 'accepted', photo_id: res.photo_id, server_state: res.state,
      upload_url: undefined, duplicate: false};
  }
  // Accept owns the one inline retry and returns the honest terminal state
  // after that retry is spent. Never re-upload or create another message.
  if (res.state === 'failed') {
    return {...p, step: 'messaged', photo_id: res.photo_id, server_state: res.state,
      upload_url: undefined, duplicate: false};
  }
  return { ...p, step: 'created', photo_id: res.photo_id, upload_url: res.upload_url };
}

/** After a successful PUT — the url is spent. */
export function afterUpload(p: CapturePayload): CapturePayload {
  return { ...p, step: 'uploaded', upload_url: undefined };
}

/** After the photo message POST (C53 — one photo per message, body = caption). */
export function afterMessage(p: CapturePayload, userMessageId: string): CapturePayload {
  return { ...p, step: 'messaged', message_id: userMessageId };
}

export interface AcceptResult {
  user_message_id?: string;
  state: string; // 'queued' | 'filed' | 'failed' | 'held'
}

/** After accept — terminal. state:'held' resolves the Mira path (§6). */
export function afterAccept(p: CapturePayload, res: AcceptResult): CapturePayload {
  return { ...p, step: 'accepted', server_state: res.state, ...(res.user_message_id ? {message_id:res.user_message_id} : {}) };
}

/** Terminal failure — the card's failure line; Try again re-enters at 'created'. */
export function withFailure(p: CapturePayload, message: string): CapturePayload {
  return { ...p, failed: message };
}

/**
 * Try again (§5): re-enter at step 'created' with the SAME client_key —
 * never a credit. The persisted upload_url (if any) is likely what expired,
 * so it is dropped: nextAction then re-POSTs create for a fresh one.
 */
export function retryFromCreated(p: CapturePayload): CapturePayload {
  return { ...p, step: p.step === 'preparing' ? 'preparing' : 'created', failed: null, upload_url: undefined };
}

// ---- card-state mapping (plan §5/§8 — a unit-test target) -------------------

// C64 retired 'held' — every photo is read, so nothing reaches that state.
export type CardState = 'picked' | 'sent' | 'reading' | 'failed';

/**
 * Capture step + server state → the card's one state. 'picked' covers every
 * pre-accept step (schedule Sending…); 'sent' is the tick, the whole
 * notification; 'reading' only while the server says processing.
 */
export function cardState(p: CapturePayload, serverState: string | null): CardState {
  if (p.failed) return 'failed';
  if (p.step !== 'accepted') return 'picked';
  const s = serverState ?? p.server_state ?? null;
  // 'queued' joins 'processing' here (6 Sep 2026). The founder: "when i send an
  // image, at times there is no indicator that the neighbours are working on
  // it. basically no indication at all."
  //
  // "At times" was the clue. The card only ever showed work once the WORKER had
  // claimed the job — so a quick queue looked fine and a busy one looked like
  // nothing had happened at all. A photo that has been accepted is going to be
  // read; saying so is honest, and the alternative was silence.
  //
  // 'waiting' deliberately does NOT count: that photo is parked until the next
  // allowance reset, hours or days away, and calling that "reading" would be a
  // worse lie than the silence this fixes. It keeps the 'sent' card, and C41's
  // "Photos waiting" surface is where it is actually handled.
  if (s === 'processing' || s === 'queued') return 'reading';
  return 'sent';
}

/** Remove a local capture only after its presence is confirmed server-side.
 * Two shapes: (1) an assistant reply that refs the capture's user message;
 * (2) — for photo-with-no-words sends, which get NO assistant reply (2 Sep
 * 2026 ruling, the extraction pipeline answers instead) — the server USER
 * message carrying the photo itself. Without (2) the local card pins to the
 * feed bottom forever, below newer messages, looking like the photo was sent
 * again and again. The user message alone for QUEUED photos is too early:
 * those still need their local honesty card and working state, which is why
 * (2) matches on the filed chat message, not on upload progress. */
export function reconcileLocalCaptures<T extends { payload: { message_id?: string; photo_id?: string } }>(
  captures: T[],
  messages: { role: string; ref_message_id: string | null; photo_id?: string | null }[],
): T[] {
  const repliedTo = new Set(
    messages
      .filter((message) => message.role === 'assistant' && message.ref_message_id !== null)
      .map((message) => message.ref_message_id as string),
  );
  const serverPhotos = new Set(
    messages.filter((m) => m.role === 'user' && m.photo_id).map((m) => m.photo_id as string),
  );
  const next = captures.filter((capture) => {
    if (capture.payload.photo_id && serverPhotos.has(capture.payload.photo_id)) return false;
    return !capture.payload.message_id || !repliedTo.has(capture.payload.message_id);
  });
  return next.length === captures.length ? captures : next;
}

/** The outbox item for one capture (id = client_key, like a message send). */
export function captureOutboxItem(p: CapturePayload): {
  id: string;
  kind: 'capture';
  path: string;
  payload: CapturePayload;
} {
  return { id: p.client_key, kind: 'capture', path: '/v1/photos', payload: p };
}

/** Duplicate-byte uploads have already been read. Explicit expense questions
 * reuse that evidence rather than disappearing at the upload gate. */
export function isDuplicateExpenseLookup(caption: string): boolean {
  const text = caption.trim().replace(/^@?penny[, :]+/i, '');
  const question = /^(have|has|did|was|were|is|are|can|could|check|find|show|look up|search|where)\b/i.test(text)
    || /\b(?:can|could) you (?:find|check|look up|show)\b/i.test(text);
  return question && /\b(paid|pay|settled|recorded|invoice|bill|expense|books|receipt|payment|sent this before)\b/i.test(text);
}

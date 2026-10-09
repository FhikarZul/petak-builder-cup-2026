// App slice 3 (plan §2/§4) — the capture flow's impure driver: hashing,
// the presigned PUT, and the API calls around lib/capture.ts's PURE state
// machine. Kept out of capture.ts because that module is the vitest target
// (node environment) and this file touches expo-crypto / expo-file-system.
//
// - sha256 over base64 (plan §4 — the create schema demands /^[0-9a-f]{64}$/;
//   RN has no built-in). The legacy FS API is the canonical base64 reader.
// - PUT via fetch+Blob with RAW BYTES (plan §4): a presigned R2 PUT wants the
//   signed headers untouched; FileSystem.uploadAsync's multipart would break
//   the signature.
// - OS background grace only (C61): an in-flight PUT relies on the ~30s
//   grace; anything incomplete resumes from the outbox on next foreground.
//   NO background-task module.
import * as Crypto from 'expo-crypto';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { ApiError, apiFetch } from './api';
import {
  afterAccept,
  afterCreate,
  afterMessage,
  afterUpload,
  captureOutboxItem,
  nextAction,
  retryFromCreated,
  withFailure,
  photoMessagePath,
  isDocument,
  type AcceptResult,
  type CapturePayload,
  type CreateResult,
} from './capture';
import type { SendResult } from './thread';
import { enqueue, remove, update } from './outbox';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import { DOWNSCALE_QUALITY, targetSize } from './downscale';
import { appPlatform, notePhotoSentForSession } from './analytics';

/** Decode before trusting size or format metadata from a picker/share sheet.
 * Only an under-cap file with JPEG bytes can pass through unchanged. Failure
 * propagates to the caller; uploading the unprepared original can mislabel a
 * HEIC as JPEG or bypass the upload size cap. */
export async function downscaleForUpload(uri: string, _size?: { width: number; height: number }): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  const refs: ImageRef[] = [];
  try {
    let image = await ctx.renderAsync();
    refs.push(image);
    if (!Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0) {
      throw new Error('Image dimensions could not be decoded');
    }
    const target = targetSize(image);
    if (!target && await isJpeg(uri)) return uri;
    if (target) {
      ctx.resize(target);
      image = await ctx.renderAsync();
      refs.push(image);
    }
    const out = await image.saveAsync({ compress: DOWNSCALE_QUALITY, format: SaveFormat.JPEG });
    if (!Number.isFinite(out.width) || !Number.isFinite(out.height) || !(out.width > 0) || !(out.height > 0) || targetSize(out) || !await isJpeg(out.uri)) {
      throw new Error('Image preparation did not produce a capped JPEG');
    }
    return out.uri;
  } finally {
    for (const ref of new Set(refs)) ref.release();
    ctx.release();
  }
}

/** Read the JPEG SOI + marker prefix, never infer MIME from a URI extension. */
async function isJpeg(uri: string): Promise<boolean> {
  const header = await readAsStringAsync(uri, { encoding: EncodingType.Base64, position: 0, length: 3 });
  return header.startsWith('/9j/'); // ff d8 ff
}

/** One preparation boundary for capture and report attachments. The returned
 * URI is both hashed here and persisted for every upload/retry. */
export async function preparePhotoForUpload(uri: string): Promise<{
  uri: string; sha256: string; contentType: 'image/jpeg';
}> {
  const preparedUri = await downscaleForUpload(uri);
  return { uri: preparedUri, sha256: await sha256OfUri(preparedUri), contentType: 'image/jpeg' };
}

/** sha256 (hex) over the file's base64 read — deterministic per bytes. */
export async function sha256OfUri(uri: string): Promise<string> {
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

/** Marks a PUT that got a response (not a network drop) — terminal after retry. */
export class UploadFailedError extends Error {
  constructor(public readonly status: number) {
    super(`upload failed: ${status}`);
    this.name = 'UploadFailedError';
  }
}

/** Raw-bytes PUT to the presigned url (plan §4 — never multipart). The
 * declared Content-Type must describe the prepared bytes sent to the server. */
/** Exported since 6 Sep 2026: Tell Ollie's attached picture takes the same
 *  presigned PUT. Sharing it rather than writing a second uploader is the
 *  point — a raw-bytes PUT with the wrong headers fails in ways that are hard
 *  to see, and there is now exactly one place that gets it right. */
class SourceFileError extends Error {
  constructor() { super('Could not prepare this file.'); }
}

export async function putBytes(localUri: string, uploadUrl: string, contentType?: string): Promise<number> {
  const source = await fetch(localUri);
  if (!source.ok) throw new SourceFileError();
  const blob = await source.blob();
  if (blob.size === 0) throw new SourceFileError();
  const headers = contentType ? { 'Content-Type': contentType } : undefined;
  const res = await fetch(uploadUrl, { method: 'PUT', body: blob, headers });
  if (!res.ok) throw new UploadFailedError(res.status);
  return blob.size;
}

function createPhoto(p: CapturePayload): Promise<CreateResult> {
  return apiFetch<CreateResult>('/v1/photos', {
    headers: { 'X-Petak-Capture-Key': p.client_key },
    method: 'POST',
    body: JSON.stringify({
      client_key: p.client_key,
      sha256: p.sha256,
      // Documents ride the photo pipeline (3 Sep 2026); absent = image/jpeg.
      ...(p.content_type ? { content_type: p.content_type } : {}),
    }),
  });
}

/** The unaddressed endpoint answers { routed, turns: [...] }; the addressed
 * per-neighbour endpoint answers one bare turn. Both carry user_message_id —
 * the unaddressed one nests it inside turns[0]. */
interface PhotoMessageResponse {
  user_message_id?: string;
  turns?: { user_message_id?: string }[];
}

async function postPhotoMessage(p: CapturePayload): Promise<{ user_message_id: string }> {
  // C65 — a photo sent from the merged feed names nobody, so it goes to the
  // un-addressed endpoint, exactly like a text send. A captionless photo rides
  // a single space: servers that allow an empty body (2 Sep 2026 ruling) read
  // it as photo-only and skip the chat narration; older servers still accept
  // it under the text≥1 rule. Either way the user owes no words.
  const res = await apiFetch<PhotoMessageResponse>(photoMessagePath(p.neighbour), {
    headers: { 'X-Petak-Capture-Key': p.client_key },
    method: 'POST',
    body: JSON.stringify({
      client_key: p.client_key,
      text: p.caption.length > 0 ? p.caption : ' ',
      client_sent_at: new Date().toISOString(),
      photo_id: p.photo_id,
      ...(p.ref_message_id ? {ref_message_id:p.ref_message_id} : {}),
    }),
  });
  const userMessageId = res.user_message_id ?? res.turns?.[0]?.user_message_id;
  if (!userMessageId) throw new Error('photo message was not filed');
  return { user_message_id: userMessageId };
}

function acceptPhoto(p: CapturePayload): Promise<AcceptResult & { photo_id: string }> {
  return apiFetch(`/v1/photos/${p.photo_id}/accept`, {
    headers: { 'X-Petak-Capture-Key': p.client_key },
    method: 'POST',
    body: JSON.stringify({
      use_kept_credit: p.use_kept_credit === true,
      ...(p.ref_message_id ? {ref_message_id:p.ref_message_id} : {}),
      platform: p.platform ?? appPlatform(),
      source: p.source ?? 'gallery',
      photo_size_bytes: p.photo_size_bytes ?? 0,
      ...(p.duplicate ? {lookup_caption:p.caption, lookup_client_key:p.client_key} : {}),
    }),
  });
}

export interface DriveHooks {
  /** Persist + reflect every transition (the card reads this). */
  onPayload: (p: CapturePayload) => void | Promise<void>;
  onTiming?: (timing: CaptureStageTiming) => void;
}

export interface CaptureStageTiming {
  stage: 'create' | 'upload' | 'message' | 'accept';
  capture_key: string; started_at_ms: number; at_ms: number;
  photo_id?: string;
  duration_ms: number;
  success: boolean;
  resumed: boolean;
  upload_attempts?: number;
}

function noteTiming(hooks: DriveHooks, p: CapturePayload, stage: CaptureStageTiming['stage'], start: number, success: boolean, uploadAttempts?: number): void {
  try { hooks.onTiming?.({ stage, capture_key:p.client_key, started_at_ms:start, at_ms:Date.now(), photo_id: p.photo_id, duration_ms: Math.max(0, Date.now() - start), success,
    resumed: p.timing_resumed === true, ...(uploadAttempts !== undefined ? { upload_attempts: uploadAttempts } : {}) }); }
  catch { /* Telemetry must never change a capture outcome. */ }
}

/**
 * Run a capture from its persisted step to 'accepted'. Throws on TRANSIENT
 * failure (network drop — the outbox item stays, next foreground resumes);
 * terminal failures (4xx, a twice-failed PUT) are written into the payload
 * via withFailure and returned — the card shows its failure line.
 */
export async function driveCapture(
  payload: CapturePayload,
  hooks: DriveHooks,
): Promise<CapturePayload> {
  let p: CapturePayload = { ...payload, retry_pending: false };
  try {
    await hooks.onPayload(p);
    for (;;) {
      const action = nextAction(p);
      if (action === 'done') return p;
      if (action === 'prepare') {
        try {
          const prepared = isDocument(p)
            ? { uri: p.local_uri, sha256: await sha256OfUri(p.local_uri), contentType: 'application/pdf' as const }
            : await preparePhotoForUpload(p.local_uri);
          p = { ...p, step: 'picked', local_uri: prepared.uri, sha256: prepared.sha256, content_type: prepared.contentType };
        } catch {
          p = withFailure(p, 'Could not prepare this file.');
          await hooks.onPayload(p);
          return p;
        }
      } else if (action === 'create') {
        const start=Date.now();
        try { p=afterCreate(p,await createPhoto(p));noteTiming(hooks,p,'create',start,true); }
        catch(error){noteTiming(hooks,p,'create',start,false);throw error;}
      } else if (action === 'upload') {
        const uploadStart = Date.now();
        let uploadAttempts = 1;
        let photoSizeBytes = p.photo_size_bytes ?? 0;
        const contentType = p.content_type ?? 'image/jpeg';
        try {
          try {
            photoSizeBytes = await putBytes(p.local_uri, p.upload_url as string, contentType);
          } catch (error) {
            if (error instanceof UploadFailedError) {
              // Likely an expired url: re-POST create with the SAME client_key
              // (the replay returns a fresh url while 'awaiting_upload'),
              // retry the PUT ONCE (C18 inline retry), then terminal.
              p = afterCreate(p, await createPhoto(p));
              await hooks.onPayload(p);
              if (nextAction(p) !== 'upload') continue; // duplicate gate
              uploadAttempts += 1;
              photoSizeBytes = await putBytes(p.local_uri, p.upload_url as string, contentType);
            } else {
              throw error; // network drop — transient, resume later
            }
          }
        } catch (error) {
          noteTiming(hooks, p, 'upload', uploadStart, false, uploadAttempts);
          throw error;
        }
        noteTiming(hooks, p, 'upload', uploadStart, true, uploadAttempts);
        p = { ...afterUpload(p), photo_size_bytes: photoSizeBytes };
      } else if (action === 'message') {
        const start=Date.now();
        try { const res=await postPhotoMessage(p);p=afterMessage(p,res.user_message_id);noteTiming(hooks,p,'message',start,true); }
        catch(error){noteTiming(hooks,p,'message',start,false);throw error;}
      } else {
        const acceptStart = Date.now();
        try {
          p = afterAccept(p, await acceptPhoto(p));
          noteTiming(hooks, p, 'accept', acceptStart, true);
        } catch (error) {
          noteTiming(hooks, p, 'accept', acceptStart, false);
          throw error;
        }
      }
      await hooks.onPayload(p);
    }
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      // A duplicate sha256 resolves to the EXISTING photo row; the second
      // message against it then 409s with photo_already_carried. That is a
      // terminal, honest failure — the card says so, never a faked 'Sent'.
      p = withFailure(
        p,
        error.status === 409 && error.code === 'photo_already_carried'
          ? 'That file is already attached to an earlier message.'
          : error.message,
      );
      await hooks.onPayload(p);
      return p;
    }
    if (error instanceof UploadFailedError || error instanceof SourceFileError) {
      p = withFailure(p, error.message);
      await hooks.onPayload(p);
      return p;
    }
    p = { ...p, retry_pending: true };
    await hooks.onPayload(p);
    throw error; // transient — the outbox keeps the capture
  }
}

// In-flight guard: mount + focus + pick can all ask to resume the same
// capture; one driver per client_key, ever.
const inFlight = new Set<string>();

export interface CaptureRunner {
  /** Reflect a payload change into screen state (the card). */
  onPayload: (p: CapturePayload) => void;
  /** Terminal accept: clean up and refresh the merged feed. */
  onAccepted: (p: CapturePayload) => void;
  onTiming?: (timing: CaptureStageTiming) => void;
}

/**
 * Enqueue + drive a fresh capture. The outbox item persists per transition;
 * 'accepted' removes it — the server twin (the photo message) takes over,
 * and the server twin takes over in the merged feed.
 */
export async function startCapture(p: CapturePayload, runner: CaptureRunner): Promise<void> {
  if (inFlight.has(p.client_key)) return;
  inFlight.add(p.client_key);
  p = { ...p, timing_started_at_ms: p.timing_started_at_ms ?? Date.now(), timing_resumed: false };
  try {
    await enqueue(captureOutboxItem(p));
    const done = await driveCapture(p, {
      onTiming: runner.onTiming,
      onPayload: async (next) => {
        await update(next.client_key, { payload: next });
        runner.onPayload(next);
      },
    });
    if (done.step === 'accepted') {
      notePhotoSentForSession();
      await remove(done.client_key);
      runner.onAccepted(done);
    }
  } catch {
    // transient — the item stays queued and resumes on the next foreground
  } finally {
    inFlight.delete(p.client_key);
  }
}

/** Resume an unfinished capture from the outbox (kill/restart, foreground). */
export async function resumeCapture(
  item: { id: string; payload: unknown },
  runner: CaptureRunner,
): Promise<void> {  const original = item.payload as CapturePayload;
  const p = { ...original, timing_resumed: true };
  if (p.step === 'accepted' || p.failed || inFlight.has(p.client_key)) return;
  inFlight.add(p.client_key);
  try {
    runner.onPayload(p);
    const done = await driveCapture(p, {
      onTiming: runner.onTiming,
      onPayload: async (next) => {
        await update(next.client_key, { payload: next });
        runner.onPayload(next);
      },
    });
    if (done.step === 'accepted') {
      notePhotoSentForSession();
      await remove(done.client_key);
      runner.onAccepted(done);
    }
  } catch {
    // transient — the item stays queued for the next foreground
  } finally {
    inFlight.delete(p.client_key);
  }
}

/**
 * Try again (plan §5): re-enter at step 'created' with the SAME client_key
 * — never a credit, never a new photo row (the create replay refreshes the
 * upload url for the same row).
 */
export async function retryCapture(p: CapturePayload, runner: CaptureRunner): Promise<void> {
  const again = retryFromCreated(p);
  await update(again.client_key, { payload: again, lastError: null });
  runner.onPayload(again);
  await resumeCapture({ id: again.client_key, payload: again }, runner);
}

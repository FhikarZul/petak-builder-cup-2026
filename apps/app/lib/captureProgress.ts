import type { CaptureProgress, CaptureProgressStage } from '@petak/config/capture-progress';

const labels: Record<CaptureProgressStage, string> = {
  awaiting_upload: 'Sending…',
  accepted: 'Received · waiting to read',
  reading: 'Reading photo…',
  enriching: 'Checking the details…',
  publication_waiting: 'Preparing the reply…',
  published: 'Read complete',
  clarification_needed: 'Needs your answer',
  failed: 'Couldn’t finish this photo',
  outcome_unknown: 'Couldn’t confirm the result',
  waiting_allowance: 'Waiting for a photo credit',
};

/** Only a matching server snapshot can name progress. Never infer success
 * from a missing job or a completed upload. */
export function captureProgressView(photoId: string, progress?: CaptureProgress) {
  if (!progress || progress.photo_id !== photoId || !(progress.stage in labels)) return null;
  return {
    text: labels[progress.stage],
    active: ['accepted', 'reading', 'enriching', 'publication_waiting'].includes(progress.stage),
    failed: progress.stage === 'failed',
  };
}

/** An older HTTP snapshot cannot rewind the same capture. A later snapshot
 * may resume work after a question, so stages have no artificial ordering. */
export function preserveNewerProgress<T extends { photo_id: string; progress?: CaptureProgress }>(previous: T | undefined, next: T): T {
  if (previous?.photo_id === next.photo_id && previous.progress && next.progress &&
    Date.parse(previous.progress.observed_at) > Date.parse(next.progress.observed_at)) return previous;
  return next;
}

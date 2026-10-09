import type { CaptureProgressStage } from '@petak/config/capture-progress';
/** Progress is the authoritative read outcome; legacy states remain a fallback
 * when an older server has not supplied it. Polling never advances a stage. */
export function photoStateRefetchInterval(state: string | undefined, stage?: CaptureProgressStage): number | false {
  if (stage) return ['awaiting_upload', 'accepted', 'reading', 'enriching', 'publication_waiting'].includes(stage) ? 5_000 : false;
  return state === 'processing' || state === 'queued' ? 5_000 : false;
}

/** Completed history retains the existing signed-image cache window. SSE and
 * reconnect invalidate it explicitly; remounting a terminal card does not. */
export function photoStateStaleTime(stage?: CaptureProgressStage): number {
  return stage && photoStateRefetchInterval(undefined, stage) === false ? 30 * 60 * 1000 : 0;
}

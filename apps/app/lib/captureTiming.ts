import type { CaptureProgress } from '@petak/config/capture-progress';
/** Phone-side timing, distinct from server filing and provider latency.
 * Only captures initiated in this screen lifetime can produce visible-result
 * timings. A background gap/resume is retained but never called foreground latency. */
export interface TimedCapture {
  client_key: string;
  photo_id?: string;
  timing_started_at_ms?: number;
  timing_resumed?: boolean;
  duplicate?: boolean;
}
export class CaptureTimingObserver {
  private pending = new Map<string, { started: number; continuous: boolean }>();
  private completed = new Set<string>();
  private lastBackgroundAt = -Infinity;
  note(p: TimedCapture, now: number): void {
    if (p.duplicate || !p.photo_id || !Number.isFinite(p.timing_started_at_ms) || p.timing_started_at_ms! > now) return;
    if (this.completed.has(p.photo_id)) return;
    if (this.pending.has(p.photo_id)) {
      if (p.timing_resumed) this.pending.get(p.photo_id)!.continuous = false;
      return;
    }
    // Bound memory for captures held until allowance reset or never completed.
    if (this.pending.size >= 100) this.pending.delete(this.pending.keys().next().value!);
    this.pending.set(p.photo_id, { started: p.timing_started_at_ms!, continuous: !p.timing_resumed && p.timing_started_at_ms! > this.lastBackgroundAt });
  }
  background(now = Date.now()): void {
    this.lastBackgroundAt = now;
    for (const p of this.pending.values()) p.continuous = false;
  }
  viewable(rows: readonly { isViewable: boolean; item: { kind: string; message?: { role: string; blocks: unknown } } }[], now: number) {
    return this.visible(rows.flatMap(row => row.isViewable && row.item.kind === 'message' && row.item.message ? [row.item.message] : []), now);
  }
  visible(messages: readonly { role: string; blocks: unknown }[], now: number): {
    photo_id: string; duration_ms: number; started_at_ms:number; at_ms:number; foreground_continuous: boolean;
  }[] {
    const results = [];
    for (const m of messages) {
      if (m.role !== 'assistant' || !Array.isArray(m.blocks)) continue;
      for (const b of m.blocks) {
        if (!b || b.kind !== 'capture_context' || typeof b.photo_id !== 'string') continue;
        const p = this.pending.get(b.photo_id);
        if (!p || now < p.started) continue;
        this.pending.delete(b.photo_id);
        this.completed.add(b.photo_id);
        if (this.completed.size > 100) this.completed.delete(this.completed.values().next().value!);
        results.push({ photo_id: b.photo_id, started_at_ms:p.started, at_ms:now, duration_ms: now - p.started, foreground_continuous: p.continuous });
      }
    }
    return results;
  }
}

export interface CaptureVisibilityTiming {
  stage: 'local_ack_visible' | 'progress_visible';
  capture_key?: string;
  photo_id?: string;
  duration_ms?: number;
  started_at_ms?: number;
  at_ms: number;
  foreground_continuous?: boolean;
  progress_stage?: CaptureProgress['stage'];
  previous_progress_stage?: CaptureProgress['stage'];
  progress_observed_at?: string;
  transition_seq?: number;
  repeated_layout_count?: number;
  stale_layout_count?: number;
}

/** Layout proves the status was rendered; list viewability proves its card is
 * on screen. Neither network arrival nor offscreen pre-render emits a metric.
 * This observer measures only; it never controls the displayed progress. */
export class CaptureVisibilityObserver {
  private visible = new Set<string>();
  private locals = new Map<string, TimedCapture>();
  private acknowledged = new Set<string>();
  private progress = new Map<string, { snapshot: CaptureProgress; shown?: CaptureProgress['stage']; sequence: number; repeated: number; stale: number; rendered: boolean }>();
  private lastBackgroundAt = -Infinity;
  constructor(private readonly emit: (event: CaptureVisibilityTiming) => void) {}
  background(now = Date.now()) { this.lastBackgroundAt = now; this.visible.clear(); }
  setVisible(keys: string[], now: number) { this.visible = new Set(keys); this.flush(now); }
  localLayout(payload: TimedCapture, now: number) {
    if (this.acknowledged.has(payload.client_key)) return;
    if (this.locals.size >= 100) this.locals.delete(this.locals.keys().next().value!);
    this.locals.set(payload.client_key, payload);
    this.flush(now);
  }
  progressUnavailable(photoId: string) {
    const row = this.progress.get(photoId);
    if (row) row.rendered = false;
  }
  progressLayout(snapshot: CaptureProgress, now: number) {
    const current = this.progress.get(snapshot.photo_id);
    if (current) {
      if (Date.parse(snapshot.observed_at) < Date.parse(current.snapshot.observed_at)) { current.stale++; return; }
      if (current.snapshot.stage === snapshot.stage) current.repeated++;
      current.snapshot = snapshot;
      current.rendered = true;
    } else {
      if (this.progress.size >= 100) this.progress.delete(this.progress.keys().next().value!);
      this.progress.set(snapshot.photo_id, { snapshot, sequence: 0, repeated: 0, stale: 0, rendered: true });
    }
    this.flush(now);
  }
  private report(event: CaptureVisibilityTiming) {
    try { this.emit(event); } catch { /* Instrumentation cannot change the capture. */ }
  }
  private flush(now: number) {
    for (const [key, payload] of this.locals) {
      if (!this.visible.has(`capture:${key}`) || !Number.isFinite(payload.timing_started_at_ms) || now < payload.timing_started_at_ms!) continue;
      this.locals.delete(key);
      if (this.acknowledged.size >= 100) this.acknowledged.delete(this.acknowledged.values().next().value!);
      this.acknowledged.add(key);
      this.report({ stage: 'local_ack_visible', capture_key: key, started_at_ms: payload.timing_started_at_ms,
        duration_ms: now - payload.timing_started_at_ms!, at_ms: now,
        foreground_continuous: !payload.timing_resumed && payload.timing_started_at_ms! > this.lastBackgroundAt });
    }
    for (const [id, row] of this.progress) {
      if (!row.rendered || !this.visible.has(`photo:${id}`) || row.shown === row.snapshot.stage) continue;
      const previous = row.shown;
      row.shown = row.snapshot.stage;
      this.report({ stage: 'progress_visible', photo_id: id, at_ms: now, progress_stage: row.snapshot.stage,
        previous_progress_stage: previous, progress_observed_at: row.snapshot.observed_at,
        transition_seq: ++row.sequence, repeated_layout_count: row.repeated, stale_layout_count: row.stale });
    }
  }
}

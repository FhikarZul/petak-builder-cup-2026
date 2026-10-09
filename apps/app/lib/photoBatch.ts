// App slice 3 (plan §5) — the #77 batch collapse, PURE (the unit-test
// target). Consecutive own photo cards with no intervening message in the
// same minute collapse into ONE "+N photos · {time} · Sent" card. The
// grouping runs over the merged message list — identical live (local
// capture cards) and from history (server photo messages), no
// server-carried batch id.

export interface BatchableItem {
  id: string;
  /** ISO timestamp — the interleave + minute key. */
  createdAt: string;
  /**
   * An own photo card eligible for the batch. Server user-photo messages
   * always qualify; a LOCAL capture card qualifies only once sent (an
   * unsent/failed card renders alone and breaks the run like any message —
   * a "+N … Sent" line over an unsent photo would lie).
   */
  batchable: boolean;
}

export type PhotoRow<T extends BatchableItem> =
  | { kind: 'single'; item: T }
  | { kind: 'batch'; items: T[]; count: number; minute: string };

/** Local HH:MM — the same clock the thread's timestamps render. */
export function minuteLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Same wall-clock minute (local time) — the batch's time boundary. */
export function sameMinute(a: string, b: string): boolean {
  return minuteLabel(a) === minuteLabel(b);
}

/**
 * Collapse the batchable runs. A run breaks on ANY non-batchable item
 * (an intervening reply, an unsent card) and on the minute boundary; a
 * run of one renders as a single card.
 */
export function collapsePhotoBatches<T extends BatchableItem>(items: T[]): PhotoRow<T>[] {
  const out: PhotoRow<T>[] = [];
  let run: T[] = [];

  const flush = () => {
    if (run.length === 0) return;
    if (run.length === 1) {
      out.push({ kind: 'single', item: run[0] });
    } else {
      out.push({
        kind: 'batch',
        items: run,
        count: run.length,
        minute: minuteLabel(run[run.length - 1].createdAt),
      });
    }
    run = [];
  };

  for (const item of items) {
    const prev = run[run.length - 1];
    if (item.batchable && (run.length === 0 || sameMinute(prev.createdAt, item.createdAt))) {
      run.push(item);
    } else {
      flush();
      if (item.batchable) run.push(item);
      else out.push({ kind: 'single', item });
    }
  }
  flush();
  return out;
}

/** Run C #77 draws FOUR thumbnails then a "+N" overflow tile. Pure, so the
 *  arithmetic is tested rather than inlined in the card:
 *  9 photos → 4 shown, overflow 5. 4 photos → 4 shown, no tile. */
export const BATCH_TILES_SHOWN = 4;

export function batchTiles(count: number, shown = BATCH_TILES_SHOWN): { shown: number; overflow: number } {
  const visible = Math.min(count, shown);
  return { shown: visible, overflow: Math.max(0, count - visible) };
}

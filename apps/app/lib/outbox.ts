// Durable on-device outbox (C61 offline: honest degradation, no sync engine).
// Sends (photos, messages) enqueue here, flush on reconnect, and the UI reads
// list() for the visible "waiting to send" state.
//
// Storage choice: expo-file-system (JSON document) — it ships with the expo
// package, so no extra dependency; AsyncStorage was the alternative but is
// not in the plan's dependency list and adds a native module for no gain at
// this volume. Interface + persistence only; no UI.
import { File, Paths } from 'expo-file-system';
import { flushVerdict, MAX_SEND_ATTEMPTS } from './outboxPolicy';

export type OutboxKind = 'message' | 'capture';

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  /** Endpoint path the item POSTs to, e.g. "/v1/threads/penny/messages". */
  path: string;
  /** JSON-serialisable request body. */
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

export type OutboxSender = (item: OutboxItem) => Promise<void>;

const file = new File(Paths.document, 'petak-outbox.json');

async function readAll(): Promise<OutboxItem[]> {
  if (!file.exists) return [];
  try {
    const parsed: unknown = JSON.parse(await file.text());
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    return []; // corrupt file degrades to an empty outbox, never a crash
  }
}

async function writeAll(items: OutboxItem[]): Promise<void> {
  if (!file.exists) file.create({ overwrite: true });
  file.write(JSON.stringify(items));
}

/** Everything still waiting to send — the data behind the "waiting" state. */
export async function list(): Promise<OutboxItem[]> {
  return readAll();
}

export async function enqueue(
  item: Omit<OutboxItem, 'createdAt' | 'attempts' | 'lastError'>,
): Promise<OutboxItem> {
  const items = await readAll();
  const full: OutboxItem = {
    ...item,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  items.push(full);
  await writeAll(items);
  return full;
}

/**
 * Flush in FIFO order.
 *
 * A TRANSIENT failure stops the flush and the item stays queued: ordering is
 * preserved and later items never overtake. That is what the original guard
 * was for, and it is right.
 *
 * A PERMANENT failure DROPS the item and the flush CONTINUES (internal-reference).
 * Before this, one malformed send — a task button carrying a task_id the
 * server refused — set `failed = true` and every message queued behind it was
 * skipped, on that flush and on every flush afterwards, because the poisoned
 * item stayed at the head and failed again immediately. The app stopped
 * sending permanently, with no way out but clearing app data, and every bubble
 * showed the queued clock forever while nothing was being attempted at all.
 *
 * `kinds` narrows the flush: other kinds stay queued UNATTEMPTED and never
 * block (capture items drive their own multi-step machine, not a POST).
 *
 * `onDropped` is how a dropped message stops being silent — the caller marks
 * its bubble failed rather than leaving it looking like it is still on its way.
 */
export async function flush(
  send: OutboxSender,
  opts?: { kinds?: OutboxKind[]; onDropped?: (item: OutboxItem, error: unknown) => void },
): Promise<{ sent: number; remaining: number; dropped: number }> {
  const items = await readAll();
  let sent = 0;
  let dropped = 0;
  const remaining: OutboxItem[] = [];
  let blocked = false;

  for (const item of items) {
    if (blocked || (opts?.kinds && !opts.kinds.includes(item.kind))) {
      remaining.push(item);
      continue;
    }
    try {
      await send(item);
      sent++;
    } catch (error) {
      const attempts = item.attempts + 1;
      // Two ways to be hopeless: the request is wrong, or it has failed so
      // many times that the reason no longer matters. The rule is pure and
      // lives in outboxPolicy so it can actually be tested — this file imports
      // expo-file-system and cannot be.
      if (flushVerdict(error, attempts) === 'drop') {
        dropped++;
        opts?.onDropped?.(item, error);
        continue; // NOT pushed back — and the flush carries on
      }
      blocked = true;
      remaining.push({
        ...item,
        attempts,
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await writeAll(remaining);
  return { sent, remaining: remaining.length, dropped };
}

/** Persist a transition in place (capture items persist per step, C18). */
export async function update(
  id: string,
  patch: Partial<Omit<OutboxItem, 'id'>>,
): Promise<void> {
  await writeAll(
    (await readAll()).map((item) => (item.id === id ? { ...item, ...patch, id: item.id } : item)),
  );
}

export async function remove(id: string): Promise<void> {
  await writeAll((await readAll()).filter((item) => item.id !== id));
}

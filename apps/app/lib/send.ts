// Message send payloads (plan §6, PURE — a unit-test target). Kept separate
// from lib/outbox.ts because outbox.ts imports expo-file-system (native) and
// the plan's tests run PURE modules only, in a node environment.
//
// client_key is the idempotency anchor (C18): generated once per user tap,
// carried on every retry unchanged — a terminal-failure retry reuses the
// SAME key so the server can never double-record a send.

import { COINS_PER_CREDIT_RUNG } from './dashboard';

/** RFC 4122 v4 from Math.random — no dependency; an idempotency key, not a secret. */
export function newClientKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface MessagePayload {
  client_key: string;
  text: string;
  client_sent_at: string;
  ref_message_id?: string;
  task_id?: string; // QA-07/08 — a button-tap answer carries the task it answers
}

export interface MessageOutboxItem {
  id: string;
  kind: 'message';
  path: string;
  payload: MessagePayload;
}

/** The outbox item for one text send. ref_message_id rides along only when set (C19). */
export function buildMessageOutboxItem(input: {
  neighbour: string;
  text: string;
  clientKey: string;
  clientSentAt: string;
  refMessageId?: string | null;
  taskId?: string | null;
}): MessageOutboxItem {
  return {
    id: input.clientKey, // one send = one key = one outbox entry
    kind: 'message',
    path: `/v1/neighbours/${input.neighbour}/messages`,
    payload: {
      client_key: input.clientKey,
      text: input.text,
      client_sent_at: input.clientSentAt,
      ...(input.refMessageId ? { ref_message_id: input.refMessageId } : {}),
      ...(input.taskId ? { task_id: input.taskId } : {}),
    },
  };
}

/**
 * C65 — the UN-ADDRESSED send, for C63's merged feed. Identical to the
 * addressed item but pointed at /v1/messages, where the server routes.
 *
 * This is why routing lives on the server: the outbox needs no idea that
 * routing exists. A message queued offline carries no neighbour, flushes
 * whenever the network returns, and is routed then — with the same
 * client_key, so a retry can never file it twice (the server re-uses its
 * first routing decision rather than asking the model again).
 */
export function buildUnaddressedOutboxItem(input: {
  text: string;
  clientKey: string;
  clientSentAt: string;
  refMessageId?: string | null;
  taskId?: string | null;
}): MessageOutboxItem {
  return {
    id: input.clientKey,
    kind: 'message',
    path: '/v1/messages',
    payload: {
      client_key: input.clientKey,
      text: input.text,
      client_sent_at: input.clientSentAt,
      ...(input.refMessageId ? { ref_message_id: input.refMessageId } : {}),
      ...(input.taskId ? { task_id: input.taskId } : {}),
    },
  };
}

// --- Run A #30-31: out-of-photos sheet state -------------------------------

export interface SendPhotoSheetInput {
  cap: number;
  used: number;
  keptCredits: number;
  coins: number;
}

export interface SendPhotoSheetState {
  mode: 'normal' | 'out';
  leftToday: number;
  keptCredits: number;
  coins: number;
  canUseKeptCredit: boolean;
  canExchange: boolean;
  exchangeShortBy: number;
  /** Billing/invite rows stay hidden until RevenueCat and household pricing
   *  exist. This sheet may spend only assets the user already has. */
  showBillingRows: false;
}

export function exchangeShortfall(coins: number): number {
  return Math.max(0, COINS_PER_CREDIT_RUNG - coins);
}

export function sendPhotoSheetState(input: SendPhotoSheetInput): SendPhotoSheetState {
  const leftToday = Math.max(0, input.cap - input.used);
  const shortBy = exchangeShortfall(input.coins);
  return {
    mode: leftToday > 0 ? 'normal' : 'out',
    leftToday,
    keptCredits: input.keptCredits,
    coins: input.coins,
    canUseKeptCredit: leftToday === 0 && input.keptCredits > 0,
    canExchange: shortBy === 0,
    exchangeShortBy: shortBy,
    showBillingRows: false,
  };
}

export function buildWalletExchangePayload(clientKey: string, rungs = 1): { rungs: number; client_key: string } {
  return { rungs, client_key: clientKey };
}

// --- C111: a rejected send, and what the app can do about it ----------------
//
// The founder typed something and nothing happened. Two 400s twenty seconds
// apart in the server log — the send, then his retry — and the retry could
// never have worked: a 400 is a MALFORMED BODY, so re-sending the identical
// body fails identically, forever. The only affordance offered was
// "couldn't send · tap to retry".
//
// The server now names the failing field (`{ error, field }`). These two
// functions decide what to do with that, and they live here so the decision
// is testable without a device.

/** Fields the message can simply DROP and be sent again without.
 *
 *  Both are decorations on a message, never the message itself: `ref_message_id`
 *  is a quote of another bubble, `task_id` says which question is being
 *  answered. Losing either costs a nicety. Losing the message costs the words
 *  somebody typed. */
const DROPPABLE = new Set(['ref_message_id', 'task_id']);

export type SendRecovery =
  | { kind: 'retry' }
  | { kind: 'retry_without'; field: string }
  | { kind: 'permanent' };

/**
 * What to do when a send is rejected.
 *
 * A 5xx or a network failure is transient — retry means something. A 400 is
 * not: unless the offending field is one we can drop, retrying is theatre.
 */
export function recoveryFor(status: number, field?: string | null): SendRecovery {
  if (status < 400 || status >= 500) return { kind: 'retry' };
  if (field && DROPPABLE.has(field)) return { kind: 'retry_without', field };
  return { kind: 'permanent' };
}

/** The body to re-send, with the offending decoration removed. */
export function withoutField(payload: Record<string, unknown>, field: string): Record<string, unknown> {
  const next = { ...payload };
  delete next[field];
  return next;
}

/** What the failed bubble says. Never "tap to retry" on something that cannot
 *  succeed — an affordance that always fails is worse than an honest dead end,
 *  because the user keeps paying attention to it. */
export function failureLine(r: SendRecovery): string {
  switch (r.kind) {
    case 'retry':
      return "couldn't send · tap to retry";
    case 'retry_without':
      // It is about to be re-sent automatically, without the quote.
      return 'sending without the quote…';
    case 'permanent':
      return "couldn't send · this message can't be delivered";
  }
}

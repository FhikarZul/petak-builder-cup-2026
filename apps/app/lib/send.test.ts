// lib/send.ts — plan §9: outbox payload construction + client_key stability.
// PURE module, node environment.
import { describe, expect, it } from 'vitest';
import {
  buildMessageOutboxItem,
  buildUnaddressedOutboxItem,
  buildWalletExchangePayload,
  exchangeShortfall,
  newClientKey,
  sendPhotoSheetState,
} from './send';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newClientKey', () => {
  it('generates RFC 4122 v4 uuids', () => {
    expect(newClientKey()).toMatch(UUID_V4);
    expect(newClientKey()).not.toBe(newClientKey());
  });
});

describe('buildMessageOutboxItem', () => {
  const input = {
    neighbour: 'penny',
    text: 'taxi was $18',
    clientKey: 'd6f0f0b8-9f2b-4f7a-9c2e-0f3a1b2c3d4e',
    clientSentAt: '2026-08-26T10:15:00.000Z',
  };

  it('builds the message outbox item the server expects', () => {
    const item = buildMessageOutboxItem(input);
    expect(item).toEqual({
      id: input.clientKey,
      kind: 'message',
      path: '/v1/neighbours/penny/messages',
      payload: {
        client_key: input.clientKey,
        text: 'taxi was $18',
        client_sent_at: '2026-08-26T10:15:00.000Z',
      },
    });
  });

  it('client_key is stable: the same send always carries the same key (C18 idempotency)', () => {
    const a = buildMessageOutboxItem(input);
    const b = buildMessageOutboxItem(input);
    expect(a.payload.client_key).toBe(input.clientKey);
    expect(b.payload.client_key).toBe(input.clientKey);
    expect(a).toEqual(b);
  });

  it('carries ref_message_id only when a reference is pinned (C19)', () => {
    const withRef = buildMessageOutboxItem({ ...input, refMessageId: '11111111-2222-4333-8444-555555555555' });
    expect(withRef.payload.ref_message_id).toBe('11111111-2222-4333-8444-555555555555');
    const withoutRef = buildMessageOutboxItem({ ...input, refMessageId: null });
    expect('ref_message_id' in withoutRef.payload).toBe(false);
  });
});

describe('C65 — the un-addressed item (merged feed)', () => {
  it('points at /v1/messages and carries no neighbour', () => {
    const item = buildUnaddressedOutboxItem({
      text: 'how much this week?',
      clientKey: 'k-1',
      clientSentAt: '2026-08-27T09:00:00.000Z',
    });
    expect(item.path).toBe('/v1/messages');
    expect(item.id).toBe('k-1');
    expect(item.payload).toEqual({
      client_key: 'k-1',
      text: 'how much this week?',
      client_sent_at: '2026-08-27T09:00:00.000Z',
    });
  });

  it('keeps the same client_key as the addressed item — one tap, one key (C18)', () => {
    const a = buildUnaddressedOutboxItem({ text: 'x', clientKey: 'k-2', clientSentAt: 'iso' });
    const b = buildMessageOutboxItem({ neighbour: 'penny', text: 'x', clientKey: 'k-2', clientSentAt: 'iso' });
    expect(a.id).toBe(b.id);
    expect(a.payload.client_key).toBe(b.payload.client_key);
  });
});

describe('Run A #30-31 — out-of-photos sheet state', () => {
  it('stays as the normal source picker while daily photos remain', () => {
    expect(sendPhotoSheetState({ cap: 5, used: 4, keptCredits: 8, coins: 140 })).toEqual({
      mode: 'normal',
      leftToday: 1,
      keptCredits: 8,
      coins: 140,
      canUseKeptCredit: false,
      canExchange: true,
      exchangeShortBy: 0,
      showBillingRows: false,
    });
  });

  it('out-of-photos exposes kept-credit use but no billing/invite rows', () => {
    expect(sendPhotoSheetState({ cap: 5, used: 5, keptCredits: 8, coins: 20 })).toEqual({
      mode: 'out',
      leftToday: 0,
      keptCredits: 8,
      coins: 20,
      canUseKeptCredit: true,
      canExchange: false,
      exchangeShortBy: 30,
      showBillingRows: false,
    });
  });

  it('coins exchange is all-or-refuse at the flat rung', () => {
    expect(exchangeShortfall(140)).toBe(0);
    expect(exchangeShortfall(20)).toBe(30);
  });

  it('builds the exchange payload with rungs, never a client-named price', () => {
    expect(buildWalletExchangePayload('exchange-key')).toEqual({ rungs: 1, client_key: 'exchange-key' });
  });
});

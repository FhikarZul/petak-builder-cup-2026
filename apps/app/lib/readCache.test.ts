import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { encodeReadCache, restoreReadCache } from './readCache';

describe('account read cache', () => {
  it('restores the most recent 200 messages and dashboard without fetching', () => {
    const original = new QueryClient();
    const pages = Array.from({ length: 5 }, (_, page) => ({
      messages: Array.from({ length: 50 }, (_, i) => ({ id: String(250 - page * 50 - 49 + i), body: 'saved message' })),
      cursor: String(250 - page * 50 - 49), has_more: true,
    }));
    original.setQueryData(['feed'], { pages, pageParams: [null, '201', '151', '101', '51'] });
    original.setQueryData(['today', 'milo'], { energy: { calories: 1200 } });
    const restarted = new QueryClient();
    expect(restoreReadCache('alice', encodeReadCache('alice', original, true), restarted)).toEqual({ restored: true, previouslyBootstrapped: true });
    const feed = restarted.getQueryData<{ pages: typeof pages; pageParams: unknown[] }>(['feed'])!;
    expect(feed.pages.flatMap(page => page.messages)).toHaveLength(200);
    expect(feed.pages[0].messages.at(-1)?.id).toBe('250');
    expect(feed.pages.at(-1)?.messages[0].id).toBe('51');
    expect(feed.pageParams).toHaveLength(4);
    expect(restarted.getQueryData(['today', 'milo'])).toEqual({ energy: { calories: 1200 } });
  });

  it('never restores another account, corrupt JSON or a future schema', () => {
    const original = new QueryClient();
    original.setQueryData(['feed'], { pages: [], pageParams: [] });
    for (const raw of [encodeReadCache('alice', original, true), '{broken', '{"version":999,"userId":"bob"}']) {
      const restarted = new QueryClient();
      expect(restoreReadCache('bob', raw, restarted)).toEqual({ restored: false, previouslyBootstrapped: false });
      expect(restarted.getQueryCache().getAll()).toHaveLength(0);
    }
  });

  it('omits transient activity, photo URLs, auth and outbox state', () => {
    const original = new QueryClient();
    for (const key of [['activity'], ['photo', 'p1'], ['auth'], ['outbox'], ['feed', 'head']]) original.setQueryData(key, { secret: 'do not persist' });
    original.setQueryData(['today', 'penny'], { total: 10 });
    const raw = encodeReadCache('alice', original, false);
    expect(raw).not.toContain('do not persist');
    expect(raw).toContain('total');
  });

  it('stays bounded and never claims bootstrap/consent based merely on cached messages', () => {
    const original = new QueryClient();
    original.setQueryData(['journal', 'mira'], { words: 'x'.repeat(3_000_000) });
    const raw = encodeReadCache('alice', original, false);
    expect(new TextEncoder().encode(raw).length).toBeLessThanOrEqual(2_000_000);
    const restarted = new QueryClient();
    expect(restoreReadCache('alice', raw, restarted).previouslyBootstrapped).toBe(false);
    expect(restarted.getQueryData(['journal', 'mira'])).toBeUndefined();
  });
  it('keeps the paging cursor at the oldest retained message when a page is trimmed', () => {
    const client = new QueryClient();
    const messages = Array.from({ length: 230 }, (_, i) => ({ id: String(i + 1) }));
    client.setQueryData(['feed'], { pages: [{ messages, cursor: '1', has_more: false }], pageParams: [null] });
    const restored = new QueryClient();
    restoreReadCache('alice', encodeReadCache('alice', client, true), restored);
    expect(restored.getQueryData(['feed'])).toMatchObject({ pages: [{ cursor: '31', has_more: true }] });
  });

  it('removes expiring URLs within nested dashboard records', () => {
    const client = new QueryClient();
    client.setQueryData(['journal', 'mira'], { entries: [{ photo_id: 'p1', image_url: 'private-signed-url' }] });
    const raw = encodeReadCache('alice', client, true);
    expect(raw).not.toContain('private-signed-url');
    expect(raw).toContain('p1');
  });

  it('validates the complete snapshot before restoring any rows', () => {
    const client = new QueryClient();
    const raw = JSON.stringify({ version: 1, userId: 'alice', previouslyBootstrapped: true, queries: [
      { key: ['today', 'milo'], data: { calories: 100 }, updatedAt: 1 },
      { key: ['auth'], data: 'forbidden', updatedAt: 1 },
    ] });
    expect(restoreReadCache('alice', raw, client).restored).toBe(false);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

});

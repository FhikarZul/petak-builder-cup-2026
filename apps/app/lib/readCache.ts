import type { QueryClient } from '@tanstack/react-query';

const MAX_BYTES = 2_000_000;
const MAX_QUERIES = 20;
const READ_KEYS = new Set(['today', 'settings', 'street', 'wallet', 'tasks', 'journal', 'entries', 'milo-log', 'penny-log', 'categories', 'series']);
type CachedQuery = { key: unknown[]; data: unknown; updatedAt: number };
const allowed = (key: unknown[]): boolean => key[0] === 'feed' ? key.length === 1 : typeof key[0] === 'string' && READ_KEYS.has(key[0]);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

// Signed media URLs expire and must be obtained again through the photo query.
function sanitise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitise);
  if (!object(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/^(image_url|signed_url|download_url|upload_url|access_token|refresh_token)$/i.test(key))
    .map(([key, child]) => [key, sanitise(child)]));
}

function boundedFeed(data: unknown): unknown {
  if (!object(data) || !Array.isArray(data.pages) || !Array.isArray(data.pageParams)) return undefined;
  let remaining = 200;
  const pages: unknown[] = [];
  for (const page of data.pages) {
    if (!object(page) || !Array.isArray(page.messages)) return undefined;
    if (!remaining) break;
    const messages = page.messages.slice(-remaining);
    const truncated = messages.length < page.messages.length;
    pages.push({ ...page, messages, ...(truncated ? { cursor: messages[0]?.id, has_more: true } : {}) });
    remaining -= messages.length;
  }
  return { ...data, pages, pageParams: data.pageParams.slice(0, pages.length) };
}

export function encodeReadCache(userId: string, client: QueryClient, previouslyBootstrapped: boolean): string {
  const snapshot = { version: 1, userId, previouslyBootstrapped, queries: [] as CachedQuery[] };
  const candidates = client.getQueryCache().getAll()
    .filter(query => query.state.status === 'success' && allowed([...query.queryKey]))
    .sort((a, b) => Number(b.queryKey[0] === 'feed') - Number(a.queryKey[0] === 'feed') || b.state.dataUpdatedAt - a.state.dataUpdatedAt);
  for (const query of candidates) {
    if (snapshot.queries.length === MAX_QUERIES) break;
    const data = query.queryKey[0] === 'feed' ? boundedFeed(query.state.data) : query.state.data;
    if (data === undefined) continue;
    snapshot.queries.push({ key: [...query.queryKey], data: sanitise(data), updatedAt: query.state.dataUpdatedAt });
    // Conservative UTF-8 bound, also works in React Native without TextEncoder.
    if (JSON.stringify(snapshot).length * 3 > MAX_BYTES) snapshot.queries.pop();
  }
  return JSON.stringify(snapshot);
}

export function restoreReadCache(userId: string, raw: string, client: QueryClient) {
  const rejected = { restored: false, previouslyBootstrapped: false };
  try {
    if (raw.length > MAX_BYTES) return rejected;
    const snapshot: unknown = JSON.parse(raw);
    if (!object(snapshot) || snapshot.version !== 1 || snapshot.userId !== userId ||
      typeof snapshot.previouslyBootstrapped !== 'boolean' || !Array.isArray(snapshot.queries) || snapshot.queries.length > MAX_QUERIES) return rejected;
    const rows: CachedQuery[] = [];
    for (const row of snapshot.queries) {
      if (!object(row) || !Array.isArray(row.key) || !allowed(row.key) ||
        typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt) || row.updatedAt < 0 || row.data === undefined) return rejected;
      const data = row.key[0] === 'feed' ? boundedFeed(row.data) : row.data;
      if (data === undefined) return rejected;
      rows.push({ key: row.key, data: sanitise(data), updatedAt: row.updatedAt });
    }
    for (const row of rows) client.setQueryData(row.key, row.data, { updatedAt: Math.min(Date.now(), row.updatedAt) });
    return { restored: true, previouslyBootstrapped: snapshot.previouslyBootstrapped };
  } catch { return rejected; }
}

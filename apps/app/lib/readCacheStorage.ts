import { File, Paths } from 'expo-file-system';
import type { QueryClient } from '@tanstack/react-query';
import { encodeReadCache, restoreReadCache } from './readCache';

const cacheFile = (userId: string) => new File(Paths.document, `petak-read-cache-${encodeURIComponent(userId)}.json`);
export async function loadReadCache(userId: string, client: QueryClient) {
  try {
    const file = cacheFile(userId);
    if (file.exists) return restoreReadCache(userId, await file.text(), client);
  } catch { /* A missing/corrupt cache must never prevent sign-in. */ }
  return { restored: false, previouslyBootstrapped: false };
}
export function saveReadCache(userId: string, client: QueryClient, previouslyBootstrapped: boolean) {
  try {
    const encoded = encodeReadCache(userId, client, previouslyBootstrapped);
    const file = cacheFile(userId);
    file.create({ overwrite: true });
    file.write(encoded);
  } catch { /* Storage can be full; the live query state remains usable. */ }
}

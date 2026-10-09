import { afterEach, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const platform = vi.hoisted(() => ({ OS: 'ios' }));
vi.mock('react-native', () => ({ Platform: platform }));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomValues: (array: Uint32Array) => webcrypto.getRandomValues(array as Uint32Array<ArrayBuffer>),
  digest: (algorithm: string, bytes: BufferSource) => webcrypto.subtle.digest(algorithm, bytes as never),
}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it.each(['ios', 'android'])('generates an S256 OAuth challenge on %s without native WebCrypto', async os => {
  platform.OS = os;
  vi.stubGlobal('crypto', undefined);
  vi.stubGlobal('TextEncoder', undefined);
  // Loading the same bootstrap that supabase.tsx imports must precede createClient.
  await import('./nativeCrypto');
  const stored = new Map<string, string>();
  const network = vi.fn(() => { throw new Error('No auth network allowed'); });
  const client = createClient('https://pkce.example.test', 'local-test-key', {
    global: { fetch: network },
    auth: { flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => { stored.set(key, value); }, removeItem: key => { stored.delete(key); } } },
  });
  const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } });
  expect(error).toBeNull();
  const url = new URL(data.url!);
  expect(url.searchParams.get('code_challenge_method')).toBe('s256');
  const verifierValue = [...stored.entries()].find(([key]) => key.includes('code-verifier'))![1];
  const verifier = JSON.parse(verifierValue).split('/')[0];
  expect(verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
  expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier).digest('base64url'));
  expect(network).not.toHaveBeenCalled();
});

it('preserves existing runtime crypto and encoding implementations', async () => {
  const existing = globalThis.crypto;
  const encoder = globalThis.TextEncoder;
  await import('./nativeCrypto');
  expect(globalThis.crypto).toBe(existing);
  expect(globalThis.crypto.subtle).toBe(existing.subtle);
  expect(globalThis.TextEncoder).toBe(encoder);
});

it('encodes UTF-8 and respects whole characters when filling a destination', async () => {
  platform.OS = 'ios';
  vi.stubGlobal('TextEncoder', undefined);
  await import('./nativeCrypto');
  const encoder = new TextEncoder();
  expect([...encoder.encode('Aé😀\ud800')]).toEqual([65, 195, 169, 240, 159, 152, 128, 239, 191, 189]);
  const destination = new Uint8Array(4);
  expect(encoder.encodeInto('é😀', destination)).toEqual({ read: 1, written: 2 });
  expect([...destination]).toEqual([195, 169, 0, 0]);
});
it('matches the RFC 7636 SHA-256 challenge', async () => {
  platform.OS = 'android';
  vi.stubGlobal('crypto', undefined);
  await import('./nativeCrypto');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'));
  expect(Buffer.from(digest).toString('base64url')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});
it('does not install native implementations on web', async () => {
  platform.OS = 'web';
  vi.stubGlobal('crypto', undefined);
  vi.stubGlobal('TextEncoder', undefined);
  await import('./nativeCrypto');
  expect(globalThis.crypto).toBeUndefined();
  expect(globalThis.TextEncoder).toBeUndefined();
});

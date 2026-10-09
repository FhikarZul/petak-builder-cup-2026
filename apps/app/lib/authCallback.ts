import { getPetakAppProfile } from './appProfile';

export type AuthCallback =
  | { kind: 'code'; code: string }
  | { kind: 'none' };

export interface AuthSessionClient {
  exchangeCodeForSession(code: string): Promise<{ error: Error | null } | { data?: unknown; error: Error | null }>;
}

function collectParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  return new URLSearchParams(parsed.search);
}

export function parseAuthCallback(url: string, expectedScheme = getPetakAppProfile().scheme): AuthCallback {
  const parsed = new URL(url);
  if (parsed.protocol !== `${expectedScheme}:` || parsed.hostname !== 'login') return { kind: 'none' };

  const params = collectParams(url);
  const error = params.get('error_description') ?? params.get('error_code') ?? params.get('error');
  if (error) throw new Error(error);

  const code = params.get('code');
  if (code) return { kind: 'code', code };

  return { kind: 'none' };
}

export async function completeAuthFromUrl(auth: AuthSessionClient, url: string, expectedScheme = getPetakAppProfile().scheme): Promise<'session' | 'ignored'> {
  const callback = parseAuthCallback(url, expectedScheme);
  if (callback.kind === 'none') return 'ignored';

  const result = await auth.exchangeCodeForSession(callback.code);
  if (result.error) throw result.error;
  return 'session';
}

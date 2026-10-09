// The ONE typed client (C61): every server call goes through apiFetch with
// the Supabase access token as Bearer. Base URL from EXPO_PUBLIC_API_URL.
//
// Types: reuse the shared C16 contract types from @petak/config where they
// exist (extraction contract below). apps/server exports no response types
// today (private package, no types export) — endpoint response shapes are
// declared here as they are consumed, never re-defining contract types.
import type { ExtractionDomain, PhotoClass } from '@petak/config/extraction';
import { supabase } from './supabase';
import { requestActivity, requestActor } from './requestActivity';

export type { ExtractionDomain, PhotoClass };

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export function apiUrl(path: string): string {
  return `${baseUrl}${path}`;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** The server's own `error` string, when it sent one. Several endpoints
     *  distinguish refusals by CODE rather than by status (referrals returns
     *  400 for four different reasons), and a screen that cannot tell them
     *  apart has to say "that didn't work" to a user whose code was fine. */
    public readonly code?: string,
    /** The field the server named as invalid, when it named one (C111). A 400
     *  that says WHICH field is recoverable — a quote of an unsynced message
     *  can be dropped and the words sent anyway. A 400 that says nothing is a
     *  dead end, and the app must not pretend otherwise. */
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let actor = requestActor(path, init.method);
  let clientKey = '';
  if (typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      clientKey = body.client_key ?? '';
      // Captures have their own per-photo status, including local Sending.
      if ((typeof body.photo_id === 'string' && /^\/v1\/(messages|neighbours\/[^/]+\/messages)$/.test(path)) ||
        /^\/v1\/photos\/[^/]+\/accept$/.test(path)) actor = null;
    } catch { /* server validates bodies */ }
  }
  return actor
    ? requestActivity.run(actor.id, actor.kind, () => fetchResponse<T>(path, init), `${path}:${clientKey}`,
      !/^\/v1\/(messages|photos)(?:\/|$)/.test(path))
    : fetchResponse<T>(path, init);
}

async function fetchResponse<T>(path: string, init: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener('abort', abort, { once: true });
  // Model work is bounded server-side at 60s. Give writes room to finish,
  // but do not let a dead connection leave the UI working indefinitely.
  const timer = setTimeout(abort, (init.method ?? 'GET').toUpperCase() === 'GET' ? 15_000 : 120_000);
  try {
    const res = await fetch(apiUrl(path), { ...init, headers, signal: controller.signal });
    if (!res.ok) {
      const detail = await res
        .clone()
        .json()
        .then((b: unknown) =>
          typeof b === 'object' && b !== null ? (b as { error?: string; field?: string }) : {},
        )
        .catch(() => ({}) as { error?: string; field?: string });
      throw new ApiError(
        res.status,
        `${init.method ?? 'GET'} ${path} failed: ${res.status}`,
        detail.error,
        detail.field,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}

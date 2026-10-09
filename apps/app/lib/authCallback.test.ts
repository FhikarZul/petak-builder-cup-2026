import { describe, expect, it, vi } from 'vitest';
import { completeAuthFromUrl, parseAuthCallback } from './authCallback';

describe('parseAuthCallback', () => {
  it('ignores implicit-token fragments even on the login deep link', () => {
    expect(parseAuthCallback('petak-builder-cup://login#access_token=at&refresh_token=rt')).toEqual({ kind: 'none' });
  });

  it('reads a PKCE code from a production deep-link query when the production scheme is active', () => {
    expect(parseAuthCallback('petak://login?code=abc', 'petak')).toEqual({ kind: 'code', code: 'abc' });
  });

  it('throws provider errors instead of creating a session', () => {
    expect(() => parseAuthCallback('petak-builder-cup://login?error_code=access_denied&error_description=Nope')).toThrow('Nope');
  });

  it('ignores non-auth app links', () => {
    expect(parseAuthCallback('petak-builder-cup://photos-waiting?photo=1')).toEqual({ kind: 'none' });
  });
});

describe('completeAuthFromUrl', () => {
  it('never plants a session from implicit-token callbacks', async () => {
    const auth = {
      setSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
      exchangeCodeForSession: vi.fn(),
    };

    await expect(completeAuthFromUrl(auth, 'petak-builder-cup://login#access_token=at&refresh_token=rt')).resolves.toBe('ignored');
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('exchanges PKCE code callbacks', async () => {
    const auth = {
      setSession: vi.fn(),
      exchangeCodeForSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
    };

    await expect(completeAuthFromUrl(auth, 'petak-builder-cup://login?code=abc')).resolves.toBe('session');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('returns ignored when the URL is not an auth callback', async () => {
    const auth = {
      setSession: vi.fn(),
      exchangeCodeForSession: vi.fn(),
    };

    await expect(completeAuthFromUrl(auth, 'petak://settings')).resolves.toBe('ignored');
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

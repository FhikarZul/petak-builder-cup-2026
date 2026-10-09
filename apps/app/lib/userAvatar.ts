/** Provider metadata is optional; chat never depends on an avatar being available. */
export function userAvatarUrl(metadata: Record<string, unknown> | undefined): string | null {
  for (const key of ['avatar_url','picture']) {
    const value=metadata?.[key];
    if(typeof value !== 'string') continue;
    try { const url=new URL(value); if(url.protocol === 'https:') return value; } catch { /* neutral fallback */ }
  }
  return null;
}

export function userAvatarPresentation(userId: string | undefined, metadata: Record<string, unknown> | undefined, failedIdentity: string | null) {
  const url = userAvatarUrl(metadata);
  const identity = `${userId ?? ''}:${url ?? ''}`;
  return { identity, uri: identity === failedIdentity ? null : url };
}

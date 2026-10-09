export function authRedirectForState(opts: {
  loading: boolean;
  hasSession: boolean;
  firstSegment: string | undefined;
}): '/' | '/login' | null {
  if (opts.loading) return null;
  const inLogin = opts.firstSegment === 'login';
  if (!opts.hasSession && !inLogin) return '/login';
  if (opts.hasSession && inLogin) return '/';
  return null;
}

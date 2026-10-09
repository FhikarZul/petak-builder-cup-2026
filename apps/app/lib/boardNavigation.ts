/** Run A #33 / C101: navigation locates a real message; it never authors one. */
export const BOARD_ORIGIN_UNAVAILABLE = 'The original message is no longer available.';

export function validBoardOrigin(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** Suppress re-renders of one request, not later visits to the same question. */
export function boardAnswerRequest(answer: unknown, consumed: string | null) {
  const target = validBoardOrigin(answer);
  if (target === null) return { target: null, consumed: null };
  return { target: target === consumed ? null : target, consumed: target };
}

/** Clear chat remains persisted. Only the explicitly selected original is
 * revealed for as long as its board reply chip is pinned. */
export function boardVisibleMessages<T extends { id: string; created_at: string }>(
  messages: T[], clearedAt: string | null, target: string | null,
): T[] {
  return clearedAt ? messages.filter(m => m.created_at > clearedAt || m.id === target) : messages;
}

export function boardNavigationStep<T extends { id: string }>(state: {
  target: string; messages: T[]; hasData: boolean; isError: boolean; isFetching: boolean; hasNextPage: boolean;
}): { kind: 'found'; message: T } | { kind: 'wait' | 'load' | 'missing' | 'error' } {
  const message = state.messages.find(m => m.id === state.target);
  if (message) return { kind: 'found', message };
  if (state.isFetching) return { kind: 'wait' };
  if (state.isError) return { kind: 'error' };
  if (!state.hasData) return { kind: 'wait' };
  return { kind: state.hasNextPage ? 'load' : 'missing' };
}

export function boardScrollRecoveryOffset(index: number, averageItemLength: number, attempts: number): number | null {
  return attempts >= 3 ? null : Math.max(0, index * averageItemLength);
}

/** A manual reply selection ends the board reveal and any unfinished jump. */
export function leaveBoardNavigation(state: {
  setBoardTarget: (value: null) => void;
  setPendingTarget: (value: null) => void;
  scrollPending: { current: boolean };
  scrollTimer: { current: ReturnType<typeof setTimeout> | null };
  currentBoardScroll: { current: { target: string | null; index: number | null } };
}): void {
  state.setBoardTarget(null);
  state.setPendingTarget(null);
  state.scrollPending.current = false;
  if (state.scrollTimer.current) clearTimeout(state.scrollTimer.current);
  state.scrollTimer.current = null;
  // Invalidate synchronously: a timer must not see the previous target before
  // React commits the state updates above.
  state.currentBoardScroll.current = { target: null, index: null };
}

export function canPageHistoryFromScroll(state: {
  pendingTarget: string | null; hasNextPage: boolean; isFetching: boolean; isError: boolean;
}): boolean {
  // The user may retry an older-page failure by reaching the end again.
  // Automatic board lookup uses boardNavigationStep and still stops on error.
  return !state.pendingTarget && state.hasNextPage && !state.isFetching;
}

export function beginMessageNavigation(target: string, state: Omit<Parameters<typeof leaveBoardNavigation>[0], 'setPendingTarget'> & {
  setPendingTarget: (value: string | null) => void;
  scrollAttempts: { current: number };
}): void {
  leaveBoardNavigation(state);
  state.scrollAttempts.current = 0;
  state.setPendingTarget(target);
}

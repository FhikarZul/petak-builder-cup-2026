import { describe, expect, it } from 'vitest';
import { boardAnswerRequest, boardNavigationStep, boardVisibleMessages, validBoardOrigin } from './boardNavigation';

const original = { id: 'question', created_at: '2026-09-01', body: 'Which shop was it?' };
const recent = { id: 'recent', created_at: '2026-09-22', body: 'Other message' };
const state = { messages: [recent], hasData: true, isError: false, isFetching: false, hasNextPage: true };

describe('board answer navigation', () => {
  it('accepts a repeated tap after the route parameter has been consumed', () => {
    const first = boardAnswerRequest('question', null);
    expect(first.target).toBe('question');
    expect(boardAnswerRequest('question', first.consumed).target).toBeNull();
    const cleared = boardAnswerRequest(undefined, first.consumed);
    expect(boardAnswerRequest('question', cleared.consumed).target).toBe('question');
  });

  it('rejects missing and malformed task origins rather than navigating without a target', () => {
    for (const origin of [null, undefined, '', '   ', [], 123]) expect(validBoardOrigin(origin)).toBeNull();
    expect(validBoardOrigin('question')).toBe('question');
  });

  it('pins the exact loaded original, not similar text or task title', () => {
    expect(boardNavigationStep({ ...state, messages: [recent, original], target: 'question' }))
      .toEqual({ kind: 'found', message: original });
  });

  it('walks older pages, waiting for an in-flight request, until the original arrives', () => {
    expect(boardNavigationStep({ ...state, target: 'question' }).kind).toBe('load');
    expect(boardNavigationStep({ ...state, target: 'question', isFetching: true }).kind).toBe('wait');
    expect(boardNavigationStep({ ...state, target: 'question', messages: [original, recent] }))
      .toEqual({ kind: 'found', message: original });
  });

  it('waits for initial history and distinguishes unavailable from failed history', () => {
    expect(boardNavigationStep({ ...state, target: 'question', hasData: false }).kind).toBe('wait');
    expect(boardNavigationStep({ ...state, target: 'question', hasData: false, isError: true }).kind).toBe('error');
    expect(boardNavigationStep({ ...state, target: 'question', hasNextPage: false }).kind).toBe('missing');
    expect(boardNavigationStep({ ...state, target: 'question', isError: true }).kind).toBe('error');
  });

  it('reveals only the exact hidden origin, preserving the clear-chat cut and original object', () => {
    const otherOld = { ...original, id: 'other-old' };
    const messages = [otherOld, original, recent];
    expect(boardVisibleMessages(messages, '2026-09-10', 'question')).toEqual([original, recent]);
    expect(boardVisibleMessages(messages, '2026-09-10', 'question')[0]).toBe(original);
    expect(boardVisibleMessages(messages, '2026-09-10', null)).toEqual([recent]);
    expect(boardVisibleMessages(messages, null, null)).toEqual(messages);
  });
});

// FlatList cannot jump directly to distant, unmeasured rows. Resetting to zero
// on every failure never brings that row into its measurement window.
describe('board scroll recovery', () => {
  it('moves into the target measurement window and stops after bounded attempts', async () => {
    const { boardScrollRecoveryOffset } = await import('./boardNavigation');
    expect(boardScrollRecoveryOffset(80, 100, 0)).toBe(8000);
    expect(boardScrollRecoveryOffset(80, 100, 2)).toBe(8000);
    expect(boardScrollRecoveryOffset(80, 100, 3)).toBeNull();
  });
});

it('replacing a board reply hides the cleared original and cancels its pending scroll', async () => {
  const { vi } = await import('vitest');
  const { leaveBoardNavigation } = await import('./boardNavigation');
  vi.useFakeTimers();
  try {
    let boardTarget: string | null = original.id;
    let pendingTarget: string | null = 'older-question';
    let scrolls = 0;
    const scrollPending = { current: true };
    const scrollTimer = { current: setTimeout(() => { scrolls += 1; }, 300) as ReturnType<typeof setTimeout> | null };
    const currentBoardScroll = { current: { target: original.id as string | null, index: 80 as number | null } };
    leaveBoardNavigation({
      setBoardTarget: value => { boardTarget = value; },
      setPendingTarget: value => { pendingTarget = value; },
      scrollPending, scrollTimer, currentBoardScroll,
    });
    expect(boardVisibleMessages([original, recent], '2026-09-10', boardTarget)).toEqual([recent]);
    expect(pendingTarget).toBeNull();
    expect(scrollPending.current).toBe(false);
    expect(currentBoardScroll.current).toEqual({ target: null, index: null });
    vi.runAllTimers();
    expect(scrolls).toBe(0);
    expect(scrollTimer.current).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it('allows a deliberate older-history retry after failure while automatic board lookup stops', async () => {
  const { canPageHistoryFromScroll } = await import('./boardNavigation');
  const failed = { pendingTarget: null, hasNextPage: true, isFetching: false, isError: true };
  expect(canPageHistoryFromScroll(failed)).toBe(true);
  expect(canPageHistoryFromScroll({ ...failed, isFetching: true })).toBe(false);
  expect(canPageHistoryFromScroll({ ...failed, pendingTarget: 'question' })).toBe(false);
  expect(canPageHistoryFromScroll({ ...failed, hasNextPage: false })).toBe(false);
  expect(boardNavigationStep({ ...state, target: 'question', isError: true }).kind).toBe('error');
});

it('each quote jump gets fresh recovery, including the same quote after exhaustion', async () => {
  const { vi } = await import('vitest');
  const { beginMessageNavigation } = await import('./boardNavigation');
  vi.useFakeTimers();
  try {
    let boardTarget: string | null = original.id;
    let pendingTarget: string | null = null;
    let staleScrolls = 0;
    const controls = {
      setBoardTarget: (value: null) => { boardTarget = value; },
      setPendingTarget: (value: string | null) => { pendingTarget = value; },
      scrollPending: { current: true },
      scrollTimer: { current: setTimeout(() => { staleScrolls++; }, 300) as ReturnType<typeof setTimeout> | null },
      currentBoardScroll: { current: { target: original.id as string | null, index: 80 as number | null } },
      scrollAttempts: { current: 3 },
    };
    for (const target of ['quote-a', 'quote-a', 'quote-b']) {
      controls.scrollAttempts.current = 3;
      beginMessageNavigation(target, controls);
      expect(pendingTarget).toBe(target);
      expect(boardTarget).toBeNull();
      expect(controls.scrollAttempts.current).toBe(0);
      expect(controls.scrollPending.current).toBe(false);
      expect(controls.currentBoardScroll.current).toEqual({ target: null, index: null });
      expect(controls.scrollTimer.current).toBeNull();
    }
    vi.runAllTimers();
    expect(staleScrolls).toBe(0);
  } finally { vi.useRealTimers(); }
});

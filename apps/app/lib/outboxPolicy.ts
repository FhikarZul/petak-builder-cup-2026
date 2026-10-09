// When does a queued message stop being worth retrying? (internal-reference)
//
// PURE, and separate from outbox.ts on purpose: that file imports
// expo-file-system, so it cannot be tested in this repo's node-only setup —
// which is exactly why the rule below shipped untested and cost the founder a
// permanently stuck app. The decision is the part worth testing; the file I/O
// is not.
//
// THE BUG THIS ENCODES. flush() stopped on the FIRST failure and skipped every
// later item, on that flush and on every flush afterwards, because the failing
// item stayed at the head and failed again immediately. One malformed send —
// a task button carrying a task_id the server refused — and the app stopped
// sending anything, ever, with no way out but clearing app data.

/** How many times an item may fail before it is dropped, whatever the cause.
 *
 *  The backstop for a failure nobody predicted — which is exactly the category
 *  this bug came from. Nothing may hold the queue hostage indefinitely. */
export const MAX_SEND_ATTEMPTS = 8;

/**
 * Was this failure PERMANENT — will retrying ever help?
 *
 * A 4xx means the request itself is wrong: the same bytes will be refused
 * identically, forever. A network error or a 5xx is the server or the
 * connection having a bad minute, and the message deserves another go.
 *
 * C111 made exactly this judgement at the SEND SITE, and the outbox never
 * learned it — which is how the app came to retry, forever, something it had
 * already decided was hopeless. One rule, now in one place.
 */
export function isPermanentFailure(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

/** What the flush should do with an item that just failed. */
export type FlushVerdict = 'drop' | 'stop';

/**
 * Drop it and carry on, or keep it and halt?
 *
 * DROP a permanent failure: it will never succeed, and keeping it costs every
 * message behind it. STOP on a transient one: ordering matters, and sending
 * message 5 after message 4 failed would deliver them out of order. That
 * ordering guard is what the original code was protecting, and it was right —
 * it simply had no way to tell the two cases apart.
 */
export function flushVerdict(error: unknown, attempts: number): FlushVerdict {
  if (isPermanentFailure(error)) return 'drop';
  return attempts >= MAX_SEND_ATTEMPTS ? 'drop' : 'stop';
}

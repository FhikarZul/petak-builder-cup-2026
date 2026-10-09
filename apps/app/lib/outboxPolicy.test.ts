// internal-reference — one rejected message blocked the outbox forever.
//
// Founder: "now there is so many respond from me but everything is stucked!!!
// why????????" His account held ZERO user messages against four on-screen
// bubbles, and Cloud Run showed four 400s — the SAME poisoned item retried
// over and over, while every message he typed after it was never attempted.
//
// The app stopped sending permanently, with no way out but clearing app data.
import { describe, expect, it } from 'vitest';
import { flushVerdict, isPermanentFailure, MAX_SEND_ATTEMPTS } from './outboxPolicy';

/** The shape apiFetch throws — ApiError carries `status`. */
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe('which failures are worth retrying', () => {
  it('a 4xx is permanent — the same bytes will be refused identically, forever', () => {
    expect(isPermanentFailure(httpError(400))).toBe(true);
    expect(isPermanentFailure(httpError(422))).toBe(true);
  });

  it('a 5xx is not — the server is having a bad minute', () => {
    expect(isPermanentFailure(httpError(500))).toBe(false);
    expect(isPermanentFailure(httpError(503))).toBe(false);
  });

  it('a network error is not — there is no status at all', () => {
    // The case the original ordering guard existed for, and it was right.
    expect(isPermanentFailure(new Error('Network request failed'))).toBe(false);
    expect(isPermanentFailure(null)).toBe(false);
    expect(isPermanentFailure(undefined)).toBe(false);
  });
});

describe('the verdict on a failed item', () => {
  it('DROPS a rejected message so the queue can drain — THE BUG', () => {
    // Before this, a 400 set `failed = true` and every message behind it was
    // skipped forever. This one assertion is the whole incident.
    expect(flushVerdict(httpError(400), 1)).toBe('drop');
  });

  it('STOPS on a transient failure — ordering is preserved', () => {
    // Sending message 5 after message 4 failed would deliver them out of
    // order. That is what the original guard was protecting; it simply had no
    // way to tell a bad minute from a bad request.
    expect(flushVerdict(httpError(503), 1)).toBe('stop');
    expect(flushVerdict(new Error('offline'), 1)).toBe('stop');
  });

  it('drops anything that has failed too many times, whatever the cause', () => {
    // The backstop for a failure nobody predicted — which is exactly the
    // category this bug came from. Nothing holds the queue hostage forever.
    expect(flushVerdict(new Error('offline'), MAX_SEND_ATTEMPTS)).toBe('drop');
    expect(flushVerdict(new Error('offline'), MAX_SEND_ATTEMPTS - 1)).toBe('stop');
  });

  it('gives a transient failure a real number of chances first', () => {
    // Too low and a tunnel or a lift drops a message the user wrote.
    expect(MAX_SEND_ATTEMPTS).toBeGreaterThan(3);
    expect(MAX_SEND_ATTEMPTS).toBeLessThan(20);
  });
});

describe('the queue drains, which is the point', () => {
  /** flush()'s ordering decision, without the filesystem. */
  function drain(queue: { id: string; status?: number }[]) {
    const sent: string[] = [];
    const dropped: string[] = [];
    const remaining: string[] = [];
    let blocked = false;
    for (const item of queue) {
      if (blocked) {
        remaining.push(item.id);
        continue;
      }
      if (item.status === undefined) {
        sent.push(item.id);
        continue;
      }
      const err = httpError(item.status);
      if (flushVerdict(err, 1) === 'drop') dropped.push(item.id);
      else {
        blocked = true;
        remaining.push(item.id);
      }
    }
    return { sent, dropped, remaining };
  }

  it('a poisoned item is dropped and everything behind it still sends', () => {
    const out = drain([{ id: 'poison', status: 400 }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
    expect(out.dropped).toEqual(['poison']);
    expect(out.sent, 'messages queued behind a rejected one were not sent').toEqual(['b', 'c', 'd']);
    expect(out.remaining).toEqual([]);
  });

  it('a transient failure still halts the flush', () => {
    const out = drain([{ id: 'a' }, { id: 'b', status: 503 }, { id: 'c' }]);
    expect(out.sent).toEqual(['a']);
    expect(out.remaining).toEqual(['b', 'c']);
  });

  it('several poisoned in a row all drop, and the good one still goes', () => {
    const out = drain([{ id: 'x', status: 400 }, { id: 'y', status: 422 }, { id: 'good' }]);
    expect(out.dropped).toEqual(['x', 'y']);
    expect(out.sent).toEqual(['good']);
  });
});

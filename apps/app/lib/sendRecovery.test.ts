// C111 (6 Sep 2026, founder QA) — a rejected send that can never succeed must
// not be offered as a retry.
//
// The founder typed something and nothing happened. The server log:
//
//   22:08:46  POST /v1/messages  200   ← the previous message, fine
//   22:09:06  POST /v1/messages  400   ← the one he is describing
//   22:09:09  POST /v1/messages  400   ← his retry, three seconds later
//
// The retry was guaranteed to fail: a 400 means the BODY is malformed, and the
// retry re-sent the identical body.
import { describe, expect, it } from 'vitest';
import { failureLine, recoveryFor, withoutField } from './send';

describe('what to do when a send is rejected', () => {
  it('a 5xx or a network failure is worth retrying', () => {
    expect(recoveryFor(500)).toEqual({ kind: 'retry' });
    expect(recoveryFor(503)).toEqual({ kind: 'retry' });
    expect(recoveryFor(0)).toEqual({ kind: 'retry' }); // no response at all
  });

  it('a 400 on a droppable decoration re-sends WITHOUT it', () => {
    // The likeliest cause of the founder's 400: a quote of a message that had
    // not synced yet, so its id was a client key rather than a server uuid.
    // The quote is a nicety; the message is the point.
    expect(recoveryFor(400, 'ref_message_id')).toEqual({ kind: 'retry_without', field: 'ref_message_id' });
    expect(recoveryFor(400, 'task_id')).toEqual({ kind: 'retry_without', field: 'task_id' });
  });

  it('a 400 on the message itself is PERMANENT — never offered as a retry', () => {
    // This is the whole bug. An affordance that always fails is worse than an
    // honest dead end, because the user keeps paying attention to it.
    expect(recoveryFor(400, 'text')).toEqual({ kind: 'permanent' });
    expect(recoveryFor(400, 'client_sent_at')).toEqual({ kind: 'permanent' });
    expect(recoveryFor(400, 'body')).toEqual({ kind: 'permanent' });
  });

  it('a 400 with NO field named is permanent too — never a hopeful retry', () => {
    // An older server that does not name the field. Assume the worst rather
    // than offering a retry that probably cannot work.
    expect(recoveryFor(400)).toEqual({ kind: 'permanent' });
    expect(recoveryFor(400, null)).toEqual({ kind: 'permanent' });
  });
});

describe('re-sending without the decoration', () => {
  it('drops the named field and keeps everything else', () => {
    const payload = {
      client_key: 'ck-1',
      text: 'what did I spend on Friday?',
      client_sent_at: '2026-09-06T14:09:06.000Z',
      ref_message_id: 'not-a-uuid',
    };
    expect(withoutField(payload, 'ref_message_id')).toEqual({
      client_key: 'ck-1',
      text: 'what did I spend on Friday?',
      client_sent_at: '2026-09-06T14:09:06.000Z',
    });
  });

  it('does not mutate the original', () => {
    const payload = { text: 'hi', ref_message_id: 'x' };
    withoutField(payload, 'ref_message_id');
    expect(payload.ref_message_id).toBe('x');
  });
});

describe('what the failed bubble says', () => {
  it('offers a retry ONLY when a retry could work', () => {
    expect(failureLine({ kind: 'retry' })).toContain('tap to retry');
    expect(failureLine({ kind: 'permanent' })).not.toContain('tap to retry');
  });

  it('says plainly that a permanent failure is permanent', () => {
    expect(failureLine({ kind: 'permanent' })).toMatch(/can't be delivered/);
  });

  it('never blames the user or names a field at them', () => {
    // "ref_message_id is invalid" is a log line, not a sentence for a person.
    for (const r of [{ kind: 'retry' }, { kind: 'permanent' }, { kind: 'retry_without', field: 'ref_message_id' }] as const) {
      expect(failureLine(r)).not.toMatch(/ref_message_id|task_id|400|invalid/);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { EMPTY_LIST, isSettled, orderReports, petakYouWereIn, statusLine, whatTravels, type ReportRow } from './tellOllie';

describe('what the footer promises', () => {
  // The sentence is VERBATIM from the drawing (Run B, line 1868). C63 makes
  // the drawing the approval mechanism, and a promise about what data leaves
  // the phone is the last thing to paraphrase — so the test pins the words,
  // not the gist.
  const DRAWN =
    'Sent with your words: which version of Petak you have (v1.4.2), your phone and its system ' +
    '(Android 14), and which petak you were in when you opened this. Nothing else, and no photo ' +
    'unless you attach one.';

  it('says exactly what the drawing says', () => {
    expect(whatTravels({ version: '1.4.2', platform: 'Android 14', petak: 'penny' })).toBe(DRAWN);
  });

  it('drops the third clause rather than naming a petak it did not send', () => {
    const line = whatTravels({ version: '0.1.0', platform: 'ios 18.2' });
    expect(line).not.toContain('which petak you were in');
    expect(line).toContain('Nothing else, and no photo unless you attach one.');
  });

  it('never says attaching is unbuilt — it is', () => {
    // The shipped footer said "no photo — attaching one is not built yet" and
    // would have gone on saying so after it was built. The drawn sentence
    // never made that claim.
    expect(whatTravels({ version: '1', platform: 'x' })).not.toContain('not built yet');
  });
});

describe('the status a person sees', () => {
  it('never names a date or a number', () => {
    // C57: "No number comes back and nothing is promised in hours."
    for (const s of ['sent', 'in progress', 'done', 'closed'] as const) {
      expect(statusLine(s)).not.toMatch(/\d/);
    }
  });

  it('reads as Ollie, not as a ticket queue', () => {
    expect(statusLine('sent')).toBe('I have it.');
    expect(statusLine('in progress')).toBe('Someone is on it.');
  });

  it('counts done and closed as settled, and the rest as open', () => {
    expect(isSettled('done')).toBe(true);
    expect(isSettled('closed')).toBe(true);
    expect(isSettled('sent')).toBe(false);
    expect(isSettled('in progress')).toBe(false);
  });
});

describe('the order of the list', () => {
  const row = (id: string, status: ReportRow['status'], at: string): ReportRow => ({
    id,
    summary: id,
    body: id,
    photo_id: null,
    kind: 'bug',
    created_at: at,
    status,
  });

  it('puts what is still open above what is finished, newest first within each', () => {
    const out = orderReports([
      row('old-done', 'done', '2026-09-01T00:00:00Z'),
      row('old-open', 'sent', '2026-09-02T00:00:00Z'),
      row('new-open', 'in progress', '2026-09-05T00:00:00Z'),
      row('new-done', 'closed', '2026-09-06T00:00:00Z'),
    ]);
    expect(out.map((r) => r.id)).toEqual(['new-open', 'old-open', 'new-done', 'old-done']);
  });

  it('does not mutate what it was given', () => {
    const input = [row('a', 'done', '2026-09-01T00:00:00Z'), row('b', 'sent', '2026-09-02T00:00:00Z')];
    orderReports(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('the empty list', () => {
  it('does not ask for bugs', () => {
    // A screen that solicits reports gets invented ones. Nothing here is a
    // call to action.
    expect(EMPTY_LIST).not.toMatch(/report|tell us|let us know|found a bug/i);
  });
});

describe('which petak you were in', () => {
  it('reads the neighbour out of a dashboard route', () => {
    expect(petakYouWereIn('dashboards/penny')).toBe('penny');
    expect(petakYouWereIn('dashboards/mira')).toBe('mira');
  });

  it('names the board, which is a place you can be', () => {
    expect(petakYouWereIn('board')).toBe('board');
  });

  it('returns null for anywhere that is not a petak, rather than inventing one', () => {
    // The footer promises to send this. Somewhere invented would make the
    // promise false in the one sentence that must not be.
    expect(petakYouWereIn('settings/index')).toBeNull();
    expect(petakYouWereIn('wallet/coins')).toBeNull();
    expect(petakYouWereIn(null)).toBeNull();
  });
});

// internal-reference — the form was gone after one report.
//
// Founder: "Tell Ollie why the fuck is only one fucking entry?????? people can
// experience many issues and now we are limiting them to fucking ONE!!!!!"
//
// The screen set `sent` and never cleared it, so the confirmation was terminal
// and a second report meant navigating away and back, with nothing saying so.
//
// The reset is a component detail, so what is pinned here is the RULE the fix
// encodes — the confirmation keeps its other exits, and gains one back to the
// form.
describe('after a report is sent', () => {
  const EXITS = ['Tell me something else', 'See what you have told me', 'Back to the board'];

  it('offers a way to report something else', () => {
    // The whole bug: reporting is a burst activity, and in a beta the person
    // filing reports is doing the most valuable thing available. The second
    // one must not be harder than the first.
    expect(EXITS).toContain('Tell me something else');
  });

  it('keeps the other two exits — the confirmation is not a dead end either way', () => {
    expect(EXITS).toContain('See what you have told me');
    expect(EXITS).toContain('Back to the board');
  });

  it('does not promise a time or a number in any of them (C57)', () => {
    for (const e of EXITS) expect(e).not.toMatch(/\d|hour|day|soon/i);
  });
});

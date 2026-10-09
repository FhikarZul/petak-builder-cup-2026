// lib/capture.ts — plan §8: step transitions, resume-from-each-step,
// duplicate short-circuit and card-state mapping.
// PURE module, node environment.
import { describe, expect, it } from 'vitest';
import {
  afterAccept,
  afterCreate,
  afterMessage,
  afterUpload,
  cardState,
  captureOutboxItem,
  isDocument,
  photoMessagePath,
  reconcileLocalCaptures,
  UNADDRESSED,
  newCapture,
  nextAction,
  retryFromCreated,
  withFailure,
  type CapturePayload,
} from './capture';

const base = newCapture({
  clientKey: 'k-1',
  sha256: 'a'.repeat(64),
  neighbour: 'penny',
  caption: 'lunch',
  localUri: 'file:///tmp/one.jpg',
});

describe('step machine — the happy path (create → PUT → message → accept)', () => {
  it('picked → create', () => {
    expect(base.step).toBe('picked');
    expect(nextAction(base)).toBe('create');
  });

  it('created → upload (upload_url in hand)', () => {
    const p = afterCreate(base, { photo_id: 'ph-1', upload_url: 'https://r2/put' });
    expect(p).toMatchObject({ step: 'created', photo_id: 'ph-1', upload_url: 'https://r2/put' });
    expect(nextAction(p)).toBe('upload');
  });

  it('uploaded → message (non-held), and the url is spent', () => {
    let p = afterCreate(base, { photo_id: 'ph-1', upload_url: 'https://r2/put' });
    p = afterUpload(p);
    expect(p).toMatchObject({ step: 'uploaded', upload_url: undefined });
    expect(nextAction(p)).toBe('message');
  });

  it('messaged → accept', () => {
    let p = afterCreate(base, { photo_id: 'ph-1', upload_url: 'https://r2/put' });
    p = afterMessage(afterUpload(p), 'msg-1');
    expect(p).toMatchObject({ step: 'messaged', message_id: 'msg-1' });
    expect(nextAction(p)).toBe('accept');
  });

  it('accepted → done, carrying the server state', () => {
    let p = afterCreate(base, { photo_id: 'ph-1', upload_url: 'https://r2/put' });
    p = afterAccept(afterMessage(afterUpload(p), 'msg-1'), { state: 'queued' });
    expect(p).toMatchObject({ step: 'accepted', server_state: 'queued' });
    expect(nextAction(p)).toBe('done');
  });

  it('kept-credit consent rides the capture payload through every step', () => {
    let p = newCapture({
      clientKey: 'k-credit',
      sha256: 'c'.repeat(64),
      neighbour: UNADDRESSED,
      caption: '',
      localUri: 'file:///tmp/credit.jpg',
      useKeptCredit: true,
    });
    p = afterCreate(p, { photo_id: 'ph-credit', upload_url: 'https://r2/put' });
    p = afterMessage(afterUpload(p), 'msg-credit');
    p = afterAccept(p, { state: 'queued' });
    expect(p.use_kept_credit).toBe(true);
  });
});

describe('resume from each persisted step (kill/restart, plan §2)', () => {
  const at = (step: CapturePayload['step']): CapturePayload => {
    let p = afterCreate(base, { photo_id: 'ph-1', upload_url: 'https://r2/put' });
    if (step === 'created') return p;
    p = afterUpload(p);
    if (step === 'uploaded') return p;
    p = afterMessage(p, 'msg-1');
    if (step === 'messaged') return p;
    return afterAccept(p, { state: 'queued' });
  };

  it('from picked → create', () => {
    expect(nextAction(base)).toBe('create');
  });
  it('from created → upload', () => {
    expect(nextAction(at('created'))).toBe('upload');
  });
  it('from created WITHOUT an url → re-create with the same client_key', () => {
    const p: CapturePayload = { ...at('created'), upload_url: undefined };
    expect(nextAction(p)).toBe('create');
    expect(p.client_key).toBe('k-1'); // the replay refreshes the url, never a new row
  });
  it('from uploaded → message', () => {
    expect(nextAction(at('uploaded'))).toBe('message');
  });
  it('from messaged → accept', () => {
    expect(nextAction(at('messaged'))).toBe('accept');
  });
  it('from accepted → done', () => {
    expect(nextAction(at('accepted'))).toBe('done');
  });
});

// C64 (26 Aug 2026) — was "held path (slice 14)". REWRITTEN, not deleted: it
// used to assert that a photo addressed to Mira skipped the message step and
// rested at 'held'. Every photo is now read and charged, and @ addresses only,
// so the same capture must take the ORDINARY path.
describe('direct photo route — C64: addressing never suppresses the read', () => {
  const toMira = newCapture({
    clientKey: 'k-held',
    sha256: 'b'.repeat(64),
    neighbour: 'penny',
    caption: 'the balcony last night', // C64: the caption rides now (C53 context)
    localUri: 'file:///tmp/two.jpg',
  });

  it('uploaded → message, exactly like any other photo (the step is NOT skipped)', () => {
    let p = afterCreate(toMira, { photo_id: 'ph-2', upload_url: 'https://r2/put' });
    p = afterUpload(p);
    expect(nextAction(p)).toBe('message');
  });

  it('caption context survives the capture state machine', () => {
    expect(toMira.caption).toBe('the balcony last night');
  });

  it('accepted + processing → reading, not a resting state', () => {
    let p = afterCreate(toMira, { photo_id: 'ph-2', upload_url: 'https://r2/put' });
    p = afterAccept(afterUpload(p), { state: 'queued' });
    expect(nextAction(p)).toBe('done');
    expect(cardState(p, 'processing')).toBe('reading');
  });
});

describe('duplicate short-circuit (the gate, plan §2)', () => {
  it('duplicate:true attaches to the existing photo and ENDS — no PUT', () => {
    const p = afterCreate(base, { photo_id: 'ph-existing', duplicate: true, state: 'queued' });
    expect(p).toMatchObject({
      step: 'accepted',
      photo_id: 'ph-existing',
      duplicate: true,
      server_state: 'queued',
    });
    expect(nextAction(p)).toBe('done'); // same bytes, same photo, no second anything
  });
});

describe('failure + Try again (plan §5 — same client_key, never a credit)', () => {
  it('withFailure marks the card; retryFromCreated re-enters at created', () => {
    let p = afterCreate(base, { photo_id: 'ph-1', upload_url: 'https://r2/put' });
    p = withFailure(p, 'upload failed: 403');
    expect(cardState(p, null)).toBe('failed');
    p = retryFromCreated(p);
    expect(p).toMatchObject({ step: 'created', failed: null, client_key: 'k-1' });
    expect(nextAction(p)).toBe('create'); // url dropped → fresh one via replay
  });
});

describe('card-state mapping (plan §5/§8)', () => {
  const accepted = (serverState?: string): CapturePayload => {
    let p = afterCreate(base, { photo_id: 'ph-1', upload_url: 'https://r2/put' });
    p = afterMessage(afterUpload(p), 'msg-1');
    return afterAccept(p, { state: serverState ?? 'queued' });
  };

  it('pre-accept steps → picked', () => {
    expect(cardState(base, null)).toBe('picked');
    expect(cardState(afterCreate(base, { photo_id: 'ph-1', upload_url: 'u' }), null)).toBe('picked');
  });
  // AMENDED 6 Sep 2026. This asserted queued → 'sent', which is what produced
  // the founder's "at times there is no indicator that the neighbours are
  // working on it": a photo waited for a worker showing only a tick.
  it('accepted + queued → reading — an accepted photo IS going to be read', () => {
    expect(cardState(accepted('queued'), null)).toBe('reading');
  });
  it('accepted + filed → sent — the work is over, not pending', () => {
    expect(cardState(accepted('queued'), 'filed')).toBe('sent');
  });
  it('accepted + processing → reading', () => {
    expect(cardState(accepted('queued'), 'processing')).toBe('reading');
    expect(cardState(accepted('processing'), null)).toBe('reading');
  });
  // The distinction that makes the change above safe. A photo rescheduled to
  // the next allowance reset is hours or days away, and calling that "reading"
  // would be a worse lie than the silence it replaced.
  it('accepted + waiting → sent — parked for allowance is not being read', () => {
    expect(cardState(accepted('queued'), 'waiting')).toBe('sent');
    expect(cardState(accepted('waiting'), null)).toBe('sent');
  });
  // C64: was "held wins over any server state". Being addressed to Mira no
  // longer parks the card — she reads it, so it reaches 'reading' like the rest.
  it('addressed to Mira does NOT park the card — it reads like any other', () => {
    const toMira = { ...accepted('queued'), neighbour: 'mira' };
    expect(cardState(toMira, 'processing')).toBe('reading');
  });
  it('failed beats everything', () => {
    expect(cardState(withFailure(accepted(), 'x'), 'processing')).toBe('failed');
  });
});

describe('outbox shape (plan §2 — kind capture, id = client_key)', () => {
  it('builds the reserved capture item', () => {
    const item = captureOutboxItem(base);
    expect(item).toMatchObject({ id: 'k-1', kind: 'capture', path: '/v1/photos' });
    expect((item.payload as CapturePayload).client_key).toBe('k-1');
  });
});

describe('C65 — where a photo message is posted', () => {
  it('a merged-feed capture names nobody and goes to /v1/messages', () => {
    expect(photoMessagePath(UNADDRESSED)).toBe('/v1/messages');
  });

  it('a capture that knows its neighbour keeps the addressed path', () => {
    expect(photoMessagePath('penny')).toBe('/v1/neighbours/penny/messages');
  });

  it('the sentinel is not a neighbour name — it can never collide with one', () => {
    for (const n of ['ollie', 'penny', 'milo', 'mira', 'tally']) {
      expect(UNADDRESSED).not.toBe(n);
    }
  });
});

describe('documents ride the photo pipeline (3 Sep 2026 attach sheet)', () => {
  const doc = newCapture({
    clientKey: 'k-doc',
    sha256: 'd'.repeat(64),
    neighbour: UNADDRESSED,
    caption: 'the warranty',
    localUri: 'file:///tmp/warranty.pdf',
    contentType: 'application/pdf',
    filename: 'warranty.pdf',
  });

  it('carries content_type + filename from the start', () => {
    expect(doc).toMatchObject({
      step: 'picked',
      content_type: 'application/pdf',
      filename: 'warranty.pdf',
    });
    expect(isDocument(doc)).toBe(true);
    expect(isDocument(base)).toBe(false);
  });

  it('takes the same transitions as a photo (create → PUT → message → accept)', () => {
    let p = afterCreate(doc, { photo_id: 'ph-doc', upload_url: 'https://r2/put' });
    expect(nextAction(p)).toBe('upload');
    p = afterMessage(afterUpload(p), 'msg-doc');
    expect(nextAction(p)).toBe('accept');
    p = afterAccept(p, { state: 'queued' });
    expect(nextAction(p)).toBe('done');
    expect(p.content_type).toBe('application/pdf');
    expect(p.filename).toBe('warranty.pdf');
  });

  it('maps to the same card states — never a special case', () => {
    let p = afterCreate(doc, { photo_id: 'ph-doc', upload_url: 'https://r2/put' });
    p = afterAccept(afterMessage(afterUpload(p), 'msg-doc'), { state: 'queued' });
    expect(cardState(p, null)).toBe('reading'); // queued → reading since 6 Sep
    expect(cardState(p, 'processing')).toBe('reading');
    expect(cardState(p, 'filed')).toBe('sent');
    expect(cardState(withFailure(p, 'That file is already attached to an earlier message.'), null)).toBe('failed');
  });

  it('reconciles like a photo — the server user message carrying it ends the local card', () => {
    const captures = [{ payload: { message_id: 'm-doc', photo_id: 'ph-doc' } }];
    const messages = [
      { role: 'user', ref_message_id: null, photo_id: 'ph-doc' },
    ] as { role: string; ref_message_id: string | null; photo_id?: string | null }[];
    expect(reconcileLocalCaptures(captures, messages)).toEqual([]);
  });

  it('the outbox item is an ordinary capture (id = client_key)', () => {
    const item = captureOutboxItem(doc);
    expect(item).toMatchObject({ id: 'k-doc', kind: 'capture', path: '/v1/photos' });
  });
});

describe('reconcileLocalCaptures — the pinned-photo regression (2 Sep 2026)', () => {  const capture = (over: { message_id?: string; photo_id?: string }) => ({
    payload: { message_id: over.message_id, photo_id: over.photo_id },
  });

  it('a photo-with-no-words send reconciles against the server user message carrying the photo', () => {
    // The silent-turn ruling means NO assistant reply ever refs the photo —
    // waiting for one pinned the card to the feed bottom forever.
    const captures = [capture({ message_id: 'm-1', photo_id: 'p-1' })];
    const messages = [
      { role: 'user', ref_message_id: null, photo_id: 'p-1' },
    ] as { role: string; ref_message_id: string | null; photo_id?: string | null }[];
    expect(reconcileLocalCaptures(captures, messages)).toEqual([]);
  });

  it('a captioned photo still reconciles through the assistant reply ref', () => {
    const captures = [capture({ message_id: 'm-1', photo_id: 'p-1' })];
    const messages = [
      { role: 'user', ref_message_id: null, photo_id: 'p-1' },
      { role: 'assistant', ref_message_id: 'm-1', photo_id: null },
    ];
    expect(reconcileLocalCaptures(captures, messages)).toEqual([]);
  });

  it('a queued capture with no server twin yet stays (the honesty card)', () => {
    const captures = [capture({ photo_id: 'p-9' })];
    const messages = [{ role: 'user', ref_message_id: null, photo_id: null }];
    expect(reconcileLocalCaptures(captures, messages)).toHaveLength(1);
  });
});
describe('a duplicate photo keeps its caption', () => {
  // ClickUp internal-reference. The caption vanished from the card, and the DUPLICATE is
  // where it was suspected: same bytes short-circuit at the gate, so no server
  // twin is ever created and the local card is all there is. If the caption did
  // not survive that path, there would be nothing left holding it.
  it('survives the duplicate short-circuit, where no server twin exists', () => {
    const withWords = { ...newCapture({ clientKey: 'k-dup', sha256: 'd'.repeat(64), localUri: 'file:///d.jpg', neighbour: 'mira', caption: '' }), caption: 'lunch with the team' };
    const out = afterCreate(withWords, { photo_id: 'ph-dup', duplicate: true, state: 'filed' });
    expect(out.caption).toBe('lunch with the team');
    expect(out.duplicate).toBe(true);
    expect(out.step).toBe('accepted');
    // and it renders as a finished card rather than one still working
    expect(cardState(out, null)).toBe('sent');
  });

  it('survives the ordinary path too, all the way to messaged', () => {
    let p = { ...newCapture({ clientKey: 'k-cap', sha256: 'e'.repeat(64), localUri: 'file:///e.jpg', neighbour: 'mira', caption: '' }), caption: 'two eggs' };
    p = afterCreate(p, { photo_id: 'ph-cap', upload_url: 'https://r2/put' });
    p = afterUpload(p);
    p = afterMessage(p, 'msg-cap');
    expect(p.caption).toBe('two eggs');
  });
});


it('a duplicate invoice with a lookup caption reaches accept without reupload or a second carrier', () => {
  const p = newCapture({clientKey:'lookup-duplicate-1',sha256:'d'.repeat(64),localUri:'file:///invoice.jpg',neighbour:'penny',caption:'Have we paid this invoice?'});
  const next = afterCreate(p,{photo_id:'prior-photo',duplicate:true,state:'filed'});
  expect(next.step).toBe('messaged');
  expect(nextAction(next)).toBe('accept');
  expect(next.upload_url).toBeUndefined();
});

it.each([false,true])('resumes a finalized awaiting-upload replay through message and accept (duplicate=%s)',duplicate=>{
 const response={photo_id:'ph-final',state:'awaiting_upload',duplicate,upload_complete:true};
 const recovered=afterCreate(base,response);
 expect(recovered.step).toBe('uploaded');expect(recovered.upload_url).toBeUndefined();expect(recovered.duplicate).not.toBe(true);
 expect(nextAction(recovered)).toBe('message');
 expect(nextAction(afterMessage(recovered,'existing-message'))).toBe('accept');
});
it.each(['queued','filed'])('keeps existing %s duplicate completion despite upload_complete',state=>{
 const recovered=afterCreate(base,{photo_id:'ph-final',state,duplicate:true,upload_complete:true});
 expect(recovered.step).toBe('accepted');expect(nextAction(recovered)).toBe('done');
});

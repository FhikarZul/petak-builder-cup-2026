import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  manipulate: vi.fn(), read: vi.fn(), digest: vi.fn(), api: vi.fn(),
}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: native.manipulate }, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-file-system/legacy', () => ({ readAsStringAsync: native.read, EncodingType: { Base64: 'base64' } }));
vi.mock('expo-crypto', () => ({ digestStringAsync: native.digest, CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, CryptoEncoding: { HEX: 'hex' } }));
vi.mock('./api', () => ({ apiFetch: native.api, ApiError: class extends Error {} }));
vi.mock('./outbox', () => ({ enqueue: vi.fn(), remove: vi.fn(), update: vi.fn() }));
vi.mock('./analytics', () => ({ appPlatform: () => 'ios', notePhotoSentForSession: vi.fn() }));
import { downscaleForUpload, preparePhotoForUpload, driveCapture, resumeCapture } from './captureRun';
import { newCapture } from './capture';

it('reports a failed upload without allowing broken telemetry to break a successful capture', async () => {
  native.api.mockImplementation(async (path: string) => path === '/v1/photos'
    ? { photo_id: 'photo', upload_url: 'https://upload.test/photo' }
    : path === '/v1/messages' ? { turns: [{ user_message_id: 'message' }] } : { state: 'queued' });
  const payload = newCapture({ clientKey: 'upload-failure', neighbour: '__route__', caption: 'private', sha256: 'a'.repeat(64), localUri: 'file:///photo.jpg' });
  const onTiming = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await expect(driveCapture(payload, { onPayload: vi.fn(), onTiming })).rejects.toThrow('offline');
  expect(onTiming).toHaveBeenCalledWith(expect.objectContaining({ stage: 'upload', success: false }));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['photo']) })));
  const done = await driveCapture(payload, { onPayload: vi.fn(), onTiming: () => { throw new Error('telemetry broken'); } });
  expect(done.step).toBe('accepted');
});

function image(width: number, height: number) {
  const saveAsync = vi.fn().mockResolvedValue({ uri: 'file:///prepared.jpg', width, height });
  const ref = { width, height, saveAsync, release: vi.fn() };
  const ctx = { resize: vi.fn(), renderAsync: vi.fn().mockResolvedValue(ref), release: vi.fn() };
  ctx.resize.mockImplementation((size) => {
    ctx.renderAsync.mockResolvedValue({ ...ref, ...size });
    saveAsync.mockResolvedValue({ uri: 'file:///prepared.jpg', ...size });
    return ctx;
  });
  native.manipulate.mockReturnValue(ctx);
  return { ctx, saveAsync };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  native.read.mockImplementation(async (uri: string) => uri.endsWith('.heic') ? 'AAAAHGZ0eXA=' : '/9j/');
});

describe('capture image preparation', () => {
  it('decodes a share-sheet photo with missing metadata and caps its real long edge', async () => {
    const { ctx, saveAsync } = image(1848, 2448);
    expect(await downscaleForUpload('file:///shared.jpg', { width: 0, height: 0 })).toBe('file:///prepared.jpg');
    expect(ctx.resize).toHaveBeenCalledWith({ width: 1546, height: 2048 });
    expect(saveAsync).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
  });

  it('uses decoded dimensions even if picker metadata incorrectly reports a small image', async () => {
    const { ctx } = image(4032, 3024);
    await downscaleForUpload('file:///camera.jpg', { width: 800, height: 600 });
    expect(ctx.resize).toHaveBeenCalledWith({ width: 2048, height: 1536 });
  });

  it('converts an under-cap HEIC, regardless of its dimensions', async () => {
    const { ctx, saveAsync } = image(800, 600);
    expect(await downscaleForUpload('file:///photo.heic', { width: 800, height: 600 })).toBe('file:///prepared.jpg');
    expect(ctx.resize).not.toHaveBeenCalled();
    expect(saveAsync).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
  });

  it('trusts decoded bytes rather than a misleading JPEG extension', async () => {
    image(800, 600);
    native.read.mockImplementation(async (uri) => uri === 'file:///not-really.jpg' ? 'AAAAHGZ0eXA=' : '/9j/');
    expect(await downscaleForUpload('file:///not-really.jpg', { width: 800, height: 600 })).toBe('file:///prepared.jpg');
  });

  it('keeps a verified small JPEG without re-encoding it', async () => {
    const { saveAsync } = image(800, 600);
    expect(await downscaleForUpload('file:///small.jpg', { width: 0, height: 0 })).toBe('file:///small.jpg');
    expect(native.manipulate).toHaveBeenCalledWith('file:///small.jpg');
    expect(saveAsync).not.toHaveBeenCalled();
  });

  it('rejects decode and save failures instead of uploading the original unsupported file', async () => {
    const { ctx, saveAsync } = image(800, 600);
    ctx.renderAsync.mockRejectedValueOnce(new Error('decode failed'));
    await expect(downscaleForUpload('file:///photo.heic', { width: 0, height: 0 })).rejects.toThrow('decode failed');
    saveAsync.mockRejectedValueOnce(new Error('save failed'));
    await expect(downscaleForUpload('file:///photo.heic', { width: 800, height: 600 })).rejects.toThrow('save failed');
  });

  it('rejects invalid decoded dimensions and output bytes that are not JPEG', async () => {
    image(Number.NaN, 600);
    await expect(downscaleForUpload('file:///photo.heic', { width: 0, height: 0 })).rejects.toThrow();
    image(800, 600);
    native.read.mockResolvedValue('AAAAHGZ0eXA=');
    await expect(downscaleForUpload('file:///photo.heic', { width: 800, height: 600 })).rejects.toThrow();
  });
});

it('hashes and uploads the same prepared JPEG bytes, including a PUT retry', async () => {
  image(800, 600);
  const bytes = new Uint8Array([255, 216, 255, 1, 2, 3]);
  const base64 = Buffer.from(bytes).toString('base64');
  native.read.mockImplementation(async (uri: string) => uri === 'file:///prepared.jpg' ? base64 : 'AAAAHGZ0eXA=');
  native.digest.mockResolvedValue('a'.repeat(64));
  const prepared = await preparePhotoForUpload('file:///photo.heic');
  expect(prepared).toEqual({ uri: 'file:///prepared.jpg', sha256: 'a'.repeat(64), contentType: 'image/jpeg' });
  expect(native.digest).toHaveBeenCalledWith('SHA-256', base64, { encoding: 'hex' });
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  let uploads = 0;
  const fetchMock = vi.fn(async (uri: string) => {
    if (uri === prepared.uri) return { ok: true, status: 200, blob: async () => blob };
    return { ok: ++uploads > 1, status: uploads === 1 ? 403 : 200 };
  });
  vi.stubGlobal('fetch', fetchMock);
  native.api.mockImplementation(async (path: string) => {
    if (path === '/v1/photos') return { photo_id: 'photo', upload_url: 'https://upload.test/photo' };
    if (path === '/v1/messages') return { turns: [{ user_message_id: 'message' }] };
    return { state: 'queued' };
  });
  const onTiming = vi.fn();
  const done = await driveCapture(newCapture({
    clientKey: 'prepared-photo', neighbour: '__route__', caption: '',
    sha256: prepared.sha256, localUri: prepared.uri, contentType: prepared.contentType,
  }), { onPayload: vi.fn(), onTiming });
  expect(done.step).toBe('accepted');
  expect(onTiming).toHaveBeenCalledWith(expect.objectContaining({ stage: 'upload', success: true, photo_id: 'photo', upload_attempts: 2, duration_ms: expect.any(Number) }));
  expect(onTiming).toHaveBeenCalledWith(expect.objectContaining({ stage: 'accept', success: true, photo_id: 'photo', duration_ms: expect.any(Number) }));
  expect(onTiming).toHaveBeenCalledWith(expect.objectContaining({ stage: 'create', success: true, capture_key: 'prepared-photo', started_at_ms: expect.any(Number), at_ms: expect.any(Number) }));
  expect(onTiming).toHaveBeenCalledWith(expect.objectContaining({ stage: 'message', success: true }));
  expect(JSON.stringify(onTiming.mock.calls)).not.toMatch(/upload.test|file:\/\/|sha256|caption/);
  expect(fetchMock.mock.calls.filter(([uri]) => uri === prepared.uri)).toHaveLength(2);
  expect(fetchMock).toHaveBeenCalledWith('https://upload.test/photo', {
    method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' },
  });
  const create = native.api.mock.calls.filter(([path]) => path === '/v1/photos');
  expect(create).toHaveLength(2);
  for (const [, opts] of create) expect(JSON.parse(opts.body)).toMatchObject({ sha256: prepared.sha256, content_type: 'image/jpeg' });
  expect(native.manipulate).toHaveBeenCalledTimes(1);
});

it('persists a transient wait and resumes once with the same capture identity', async () => {
  const p = newCapture({ clientKey: 'resume-once', sha256: 'hash', neighbour: '__route__', caption: '', localUri: 'file:///one.jpg' });
  const onPayload = vi.fn();
  native.api.mockRejectedValueOnce(new Error('network offline'));
  await expect(driveCapture(p, { onPayload })).rejects.toThrow('network offline');
  const waiting = onPayload.mock.calls.at(-1)?.[0];
  expect(waiting).toMatchObject({ client_key: p.client_key, retry_pending: true, step: 'picked' });
  let resolve!: (value: unknown) => void;
  native.api.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const runner = { onPayload: vi.fn(), onAccepted: vi.fn() };
  const first = resumeCapture({ id: p.client_key, payload: waiting }, runner);
  const duplicate = resumeCapture({ id: p.client_key, payload: waiting }, runner);
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  resolve({ photo_id: 'existing-photo', duplicate: true, state: 'filed' });
  await Promise.all([first, duplicate]);
  expect(native.api).toHaveBeenCalledTimes(2); // initial failure + one resume
  expect(runner.onAccepted).toHaveBeenCalledTimes(1);
  expect(runner.onAccepted.mock.calls[0][0]).toMatchObject({ client_key: p.client_key, retry_pending: false });
});

it('sends a duplicate lookup caption to accept and reuses its stable request key', async () => {
  native.api.mockImplementation(async (path: string) => path === '/v1/photos'
    ? {photo_id:'existing-invoice',duplicate:true,state:'filed'}
    : {state:'filed',lookup:true,user_message_id:'lookup-user-message'});
  const done=await driveCapture(newCapture({clientKey:'duplicate-query-1',sha256:'hash',neighbour:'penny',caption:'Have we paid this invoice?',localUri:'file:///invoice.jpg'}),{onPayload:vi.fn()});
  expect(native.api.mock.calls.map(([path])=>path)).toEqual(['/v1/photos','/v1/photos/existing-invoice/accept']);
  expect(JSON.parse(native.api.mock.calls[1][1].body)).toMatchObject({lookup_caption:'Have we paid this invoice?',lookup_client_key:'duplicate-query-1'});
  expect(done).toMatchObject({step:'accepted',message_id:'lookup-user-message'});
});

it('keeps a pinned quote through photo upload, carrier message and accept', async () => {
  native.api.mockImplementation(async (path:string)=>path==='/v1/messages'?{turns:[{user_message_id:'carrier'}]}:{state:'queued'});
  const p={...newCapture({clientKey:'quoted-photo-1',sha256:'hash',neighbour:'__route__',caption:'Have we paid this?',localUri:'file:///receipt.jpg',refMessageId:'quoted-message'}),step:'uploaded' as const,photo_id:'photo'};
  await driveCapture(p,{onPayload:vi.fn()});
  expect(native.api.mock.calls).toHaveLength(2);
  for(const [,options] of native.api.mock.calls)expect(JSON.parse(options.body)).toMatchObject({ref_message_id:'quoted-message'});
});

it.each([false,true])('resumes finalized upload recovery through message and accept without PUT (duplicate=%s)',async duplicate=>{
 const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);let creates=0;
 native.api.mockImplementation(async(path:string)=>{
  if(path==='/v1/photos' && ++creates>1)throw new Error('unexpected repeated create');
  if(path==='/v1/photos')return {photo_id:'recovered-photo',state:'awaiting_upload',duplicate,upload_complete:true};
  if(path==='/v1/messages')return {turns:[{user_message_id:'existing-message'}]};
  if(path==='/v1/photos/recovered-photo/accept')return {state:'queued'};
  throw new Error('unexpected request');
 });
 const done=await driveCapture(newCapture({clientKey:'recover-finalized',neighbour:'__route__',caption:'original caption',sha256:'a'.repeat(64),localUri:'file:///gone.jpg'}),{onPayload:vi.fn()});
 expect(done.step).toBe('accepted');expect(done.server_state).toBe('queued');
 expect(native.api.mock.calls.map(c=>c[0])).toEqual(['/v1/photos','/v1/messages','/v1/photos/recovered-photo/accept']);
 expect(fetchMock).not.toHaveBeenCalled();
});
it('recovers a finalized SHA duplicate with its original carrying message, without substituting the new caption',async()=>{
 const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
 native.api.mockImplementation(async(path:string)=>{
  if(path==='/v1/photos')return {photo_id:'recovered-photo',state:'awaiting_upload',duplicate:true,upload_complete:true,carrying_message_id:'original-message'};
  if(path==='/v1/photos/recovered-photo/accept')return {state:'queued'};
  throw new Error('must reuse original carrying message');
 });
 const done=await driveCapture(newCapture({clientKey:'different-client-key',neighbour:'__route__',caption:'different caption',sha256:'a'.repeat(64),localUri:'file:///gone.jpg'}),{onPayload:vi.fn()});
 expect(done.step).toBe('accepted');expect(done.message_id).toBe('original-message');
 expect(native.api.mock.calls.map(c=>c[0])).toEqual(['/v1/photos','/v1/photos/recovered-photo/accept']);
 expect(JSON.stringify(native.api.mock.calls[1])).not.toContain('different caption');expect(fetchMock).not.toHaveBeenCalled();
});
it.each(['queued','waiting','processing','filed'])('stops replaying create after authoritative same-key %s acceptance',async state=>{
 const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);let creates=0;
 native.api.mockImplementation(async(path:string)=>{
  if(path==='/v1/photos' && ++creates===1)return {photo_id:'accepted-photo',state,duplicate:false};
  throw new Error('unexpected repeated create or acceptance');
 });
 const done=await driveCapture(newCapture({clientKey:'same-accepted-key',neighbour:'__route__',caption:'caption',sha256:'a'.repeat(64),localUri:'file:///gone.jpg'}),{onPayload:vi.fn()});
 expect(done.step).toBe('accepted');expect(done.server_state).toBe(state);
 expect(native.api).toHaveBeenCalledTimes(1);expect(fetchMock).not.toHaveBeenCalled();
});
it.each(['queued','failed'])('same-key failed replay delegates the existing inline retry, ending %s',async outcome=>{
 const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);let creates=0;
 native.api.mockImplementation(async(path:string)=>{
  if(path==='/v1/photos' && ++creates===1)return {photo_id:'failed-photo',state:'failed',duplicate:false};
  if(path==='/v1/photos/failed-photo/accept')return {state:outcome};
  throw new Error('unexpected repeated create or message');
 });
 const done=await driveCapture(newCapture({clientKey:'same-failed-key',neighbour:'__route__',caption:'caption',sha256:'a'.repeat(64),localUri:'file:///gone.jpg'}),{onPayload:vi.fn()});
 expect(done.step).toBe('accepted');expect(done.server_state).toBe(outcome);
 expect(native.api.mock.calls.map(c=>c[0])).toEqual(['/v1/photos','/v1/photos/failed-photo/accept']);expect(fetchMock).not.toHaveBeenCalled();
});

it('persists Sending before preparation and resumes the same capture through preparation', async () => {
  const p = newCapture({ clientKey: 'prepare-first', neighbour: '__route__', caption: 'Dinner', localUri: 'file:///photo.heic' });
  expect(p.step).toBe('preparing');
  image(800, 600);
  native.digest.mockResolvedValue('b'.repeat(64));
  native.api.mockResolvedValue({ photo_id: 'known', duplicate: true, state: 'filed' });
  const states: unknown[] = [];
  const result = await driveCapture(p, { onPayload: next => { states.push({...next}); } });
  expect(states[0]).toMatchObject({step:'preparing',client_key:'prepare-first',local_uri:'file:///photo.heic'});
  expect(states[1]).toMatchObject({step:'picked',client_key:'prepare-first',local_uri:'file:///prepared.jpg',sha256:'b'.repeat(64)});
  expect(result).toMatchObject({step:'accepted',client_key:'prepare-first'});
});

it('a preparation interruption retains the same key and retries preparation before creating a photo',async()=>{
 const p=newCapture({clientKey:'prepare-retry',neighbour:'__route__',caption:'',localUri:'file:///photo.heic'});
 const {ctx}=image(800,600);ctx.renderAsync.mockRejectedValueOnce(new Error('interrupted'));
 const failed=await driveCapture(p,{onPayload:vi.fn()});
 expect(failed).toMatchObject({step:'preparing',failed:'Could not prepare this file.',client_key:'prepare-retry'});
 expect(native.api).not.toHaveBeenCalled();
 const {retryFromCreated}=await import('./capture');
 native.digest.mockResolvedValue('c'.repeat(64));native.api.mockResolvedValue({photo_id:'known',duplicate:true,state:'filed'});
 const runner={onPayload:vi.fn(),onAccepted:vi.fn()};
 await resumeCapture({id:p.client_key,payload:retryFromCreated(failed)},runner);
 expect(runner.onAccepted).toHaveBeenCalledWith(expect.objectContaining({client_key:'prepare-retry',step:'accepted',sha256:'c'.repeat(64),timing_resumed:true}));
});

it('resumes after prepared bytes were persisted without preparing or hashing them a second time',async()=>{
 image(800,600);native.digest.mockResolvedValue('d'.repeat(64));
 native.api.mockRejectedValueOnce(new Error('connection lost'));
 const states: ReturnType<typeof newCapture>[]=[];
 const p=newCapture({clientKey:'prepared-resume',neighbour:'__route__',caption:'Dinner',localUri:'file:///photo.heic'});
 await expect(driveCapture(p,{onPayload:next=>{states.push({...next});}})).rejects.toThrow('connection lost');
 const persisted=states.at(-1)!;
 expect(persisted).toMatchObject({step:'picked',local_uri:'file:///prepared.jpg',sha256:'d'.repeat(64)});
 native.api.mockResolvedValueOnce({photo_id:'known',duplicate:true,state:'filed'});
 const runner={onPayload:vi.fn(),onAccepted:vi.fn()};
 await resumeCapture({id:p.client_key,payload:persisted},runner);
 expect(native.manipulate).toHaveBeenCalledTimes(1);expect(native.digest).toHaveBeenCalledTimes(1);
 expect(runner.onAccepted).toHaveBeenCalledWith(expect.objectContaining({client_key:'prepared-resume',sha256:'d'.repeat(64),timing_resumed:true}));
});

// z8v0kmrnvd: a URI can disappear after preparation or while the app is closed.
it('never uploads a missing shared source response as JPEG or accepts it', async () => {
  const p = { ...newCapture({ clientKey: 'missing-share', sha256: 'hash', neighbour: '__route__', caption: '', localUri: 'file:///gone.jpg', source: 'share_sheet' }), step: 'created' as const, photo_id: 'photo', upload_url: 'https://upload.test/photo' };
  const fetchMock = vi.fn(async (uri: string) => uri === p.local_uri
    ? { ok: false, status: 404, blob: async () => new Blob(['File not found']) }
    : { ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
  native.api.mockImplementation(async (path: string) => path === '/v1/messages' ? { turns: [{ user_message_id: 'bad-message' }] } : { state: 'queued' });
  const done = await driveCapture(p, { onPayload: vi.fn() });
  expect(done.failed).toBe('Could not prepare this file.');
  expect(done.step).toBe('created');
  expect(fetchMock.mock.calls.map(([uri]) => uri)).toEqual([p.local_uri]);
  expect(native.api).not.toHaveBeenCalled();
});

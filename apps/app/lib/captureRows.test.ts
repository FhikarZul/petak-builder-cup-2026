import { describe, expect, it } from 'vitest';
import { newCapture, reconcileLocalCaptures } from './capture';
import { localCaptureRows, localCaptureRouting, type LocalCapture } from './captureRows';

const capture = (id: string): LocalCapture => ({
  createdAt: '2026-09-16T07:40:00.000Z',
  payload: { ...newCapture({clientKey:id,sha256:'a'.repeat(64),localUri:`file:///${id}.jpg`,neighbour:'penny',caption:'receipt'}),photo_id:id,message_id:`m-${id}`,step:'accepted',server_state:'filed' },
});
const server = [{role:'user',photo_id:'p1',ref_message_id:null}];

describe('actual local row composition after server history', () => {
  it('late onPayload cannot reintroduce a reconciled photo, even with unchanged feed identity', () => {
    let locals = [capture('p1')];
    locals = reconcileLocalCaptures(locals, server);
    expect(localCaptureRows(locals, server)).toEqual([]);
    locals = [...locals, capture('p1')]; // the second acceptance callback
    expect(localCaptureRows(locals, server)).toEqual([]);
    expect(localCaptureRouting(locals,server,false,123)).toBeNull();
  });
  it('callback-first handoff removes only the acknowledged photo before batching', () => {
    const locals = [capture('p1'),capture('p2'),capture('p3')];
    expect(localCaptureRows(locals, [])).toHaveLength(1);
    expect(localCaptureRows(locals, server)).toEqual([expect.objectContaining({kind:'batch',count:2,uris:['file:///p2.jpg','file:///p3.jpg']})]);
  });
  it('keeps a failed capture without a server twin and preserves its caption', () => {
    const failed = capture('p2');
    failed.payload.failed = 'Could not upload';
    expect(localCaptureRows([failed],server)).toEqual([{kind:'capture',capture:failed}]);
  });
});

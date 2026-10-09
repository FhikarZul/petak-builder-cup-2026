import { expect, it } from 'vitest';
import { newCapture } from './capture';
import { captureStatus } from './captureStatus';
const capture = newCapture({ clientKey: 'one', sha256: 'hash', neighbour: '__route__', caption: 'Dinner receipt', localUri: 'file:///one.jpg' });
it('explains network waiting and preserves the caption as context', () => {
  expect(captureStatus(capture, true)).toEqual({ title: 'Dinner receipt', reason: 'Waiting for connection. Sending resumes when you reconnect.', failed: false });
});
it('distinguishes upload, transient retry and terminal failure', () => {
  expect(captureStatus(capture, false)?.reason).toBe('Sending photo…');
  expect(captureStatus({ ...capture, retry_pending: true }, false)?.reason).toBe('Waiting to retry. Sending resumes on reconnect or when you return to the app.');
  expect(captureStatus({ ...capture, failed: 'rejected' }, true)).toMatchObject({ failed: true, reason: 'Photo did not send. Use Try again on its card.' });
});
it('does not count accepted work as an unsent upload', () => {
  for (const server_state of ['waiting', 'queued', 'processing', 'filed']) expect(captureStatus({ ...capture, step: 'accepted', server_state }, false)).toBeNull();
});
it('uses the document name and labels documents accurately', () => {
  expect(captureStatus({ ...capture, caption: '', content_type: 'application/pdf', filename: 'bill.pdf' }, false)).toEqual({ title: 'bill.pdf', reason: 'Sending document…', failed: false });
});

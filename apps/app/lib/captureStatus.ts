import { isDocument, type CapturePayload } from './capture';

/** Only local unsent work. Server read/allowance states have their own surfaces. */
export function captureStatus(p: CapturePayload, offline: boolean): { title: string; reason: string; failed: boolean } | null {
  if (p.step === 'accepted') return null;
  const document = isDocument(p);
  const title = p.caption.trim() || p.filename || (document ? 'Document' : 'Photo');
  const reason = p.failed
    ? `${document ? 'Document' : 'Photo'} did not send. Use Try again on its card.`
    : offline ? 'Waiting for connection. Sending resumes when you reconnect.'
    : p.retry_pending ? 'Waiting to retry. Sending resumes on reconnect or when you return to the app.'
    : `Sending ${document ? 'document' : 'photo'}…`;
  return { title, reason, failed: !!p.failed };
}

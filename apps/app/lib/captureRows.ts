import { cardState, isDocument, reconcileLocalCaptures, type CapturePayload } from './capture';
import { photoRoutingLine } from './indicator';
import { collapsePhotoBatches } from './photoBatch';

export interface LocalCapture { payload: CapturePayload; createdAt: string }
export type LocalCaptureRow =
  | { kind: 'capture'; capture: LocalCapture }
  | { kind: 'batch'; key: string; count: number; minute: string; uris: string[] };

/** Local rows appended after server history by the chat feed. */
export function localCaptureRows(captures: LocalCapture[], messages: { role: string; ref_message_id: string | null; photo_id?: string | null }[]): LocalCaptureRow[] {
  const out: LocalCaptureRow[] = [];
    // Reconcile at row composition too: a late acceptance callback can re-add
    // a local card after the feed effect has already consumed its server twin.
    const ordered = [...reconcileLocalCaptures(captures, messages)].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const group of collapsePhotoBatches(
      ordered.map((c) => ({
        id: c.payload.client_key,
        createdAt: c.createdAt,
        // Documents never join a photo batch — the batch card would hand
        // their PDF uris to an Image. They render as their own cards.
        batchable: cardState(c.payload, null) === 'sent' && c.payload.server_state === 'filed' && !isDocument(c.payload),
        ref: c,
      })),
    )) {
      if (group.kind === 'batch') {
        out.push({
          kind: 'batch',
          key: `batch-${group.items[0].id}`,
          count: group.count,
          minute: group.minute,
          uris: group.items.map((i) => i.ref.payload.local_uri),
        });
      } else {
        out.push({ kind: 'capture', capture: group.item.ref });
      }
    }
  return out;
}

/** The same handoff governs feedback: hidden local twins must not keep working forever. */
export function localCaptureRouting(captures: LocalCapture[], messages: Parameters<typeof reconcileLocalCaptures>[1], alreadyRouting: boolean, now: number) {
  return photoRoutingLine(reconcileLocalCaptures(captures, messages).map(c => ({state:cardState(c.payload,null),duplicate:c.payload.duplicate})), alreadyRouting, now);
}

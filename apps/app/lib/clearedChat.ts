// Client-side "clear chat" marker (founder ruling 1 Sep 2026): tapping Clear
// chat hides everything currently loaded — the server keeps the full history
// and new messages still arrive. Only an ISO timestamp is stored: rendering
// filters messages older than it, so a clear is a view cut, never a deletion.
//
// Same storage choice as lib/outbox.ts: expo-file-system JSON document, no
// extra dependency.
import { File, Paths } from 'expo-file-system';

const file = new File(Paths.document, 'petak-chat-clear.json');

/** The cut point, or null when the feed has never been cleared on this device. */
export async function getClearedAt(): Promise<string | null> {
  if (!file.exists) return null;
  try {
    const parsed: unknown = JSON.parse(await file.text());
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null; // corrupt file degrades to "never cleared", never a crash
  }
}

export async function setClearedAt(iso: string): Promise<void> {
  if (!file.exists) file.create({ overwrite: true });
  file.write(JSON.stringify(iso));
}

// App slice 3 (plan §7) — the #77 queue note's "or leave them" dismissal,
// CLIENT-SIDE for the day, no server round-trip ("Nothing is deleted and
// nothing was charged… The queue reads itself at midnight"). The server
// keys the note message per anchored day (queue-note:{user}:{day}), so
// remembering the dismissed MESSAGE id is exactly "for that day" —
// tomorrow's note is a new message. Same storage choice as the outbox:
// expo-file-system JSON document, corrupt → empty.
import { File, Paths } from 'expo-file-system';

const file = new File(Paths.document, 'petak-dismissals.json');

async function readAll(): Promise<string[]> {
  if (!file.exists) return [];
  try {
    const parsed: unknown = JSON.parse(await file.text());
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Ids of queue-note messages hidden locally for the remainder of their batch/day key. */
export async function getDismissedQueueNotes(): Promise<Set<string>> {
  return new Set(await readAll());
}

export async function dismissQueueNote(messageId: string): Promise<void> {
  const ids = await readAll();
  if (ids.includes(messageId)) return;
  if (!file.exists) file.create({ overwrite: true });
  file.write(JSON.stringify([...ids, messageId]));
}

import type { ActivityKind, NeighbourId } from './neighbours';
import type { WorkingNeighbour } from './indicator';

export interface BackgroundActivity {
  id: string;
  photo_id?: string;
  neighbour: NeighbourId;
  kind: ActivityKind;
  state: 'queued' | 'running' | 'waiting' | 'retrying' | 'failed';
  started_at: string;
}

export function shouldRefreshActivityFeed(previous: BackgroundActivity[] | undefined, current: BackgroundActivity[]): boolean {
  // A job may start AND finish between two idle snapshots. With SSE down,
  // only the periodic feed read can discover that completed reply.
  return current.length === 0 || JSON.stringify(previous) !== JSON.stringify(current);
}

export function activityLines(local: WorkingNeighbour[], background: BackgroundActivity[]): WorkingNeighbour[] {
  const byNeighbour = new Map(local.map(row => [row.id, { ...row }]));
  for (const work of background) {
    if (work.photo_id || work.state !== 'running' || byNeighbour.has(work.neighbour)) continue;
    byNeighbour.set(work.neighbour, { id: work.neighbour, kind: work.kind,
      startedAt: Date.parse(work.started_at), count: 1, total: 1 });
  }
  return [...byNeighbour.values()].sort((a,b) => a.startedAt-b.startedAt);
}

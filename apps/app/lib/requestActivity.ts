import type { ActivityKind, NeighbourId } from './neighbours';

export interface RequestActivity {
  key: number;
  id: NeighbourId;
  kind: ActivityKind;
  startedAt: number;
  failed?: boolean;
  refreshFailed?: boolean;
  operation: string;
}

export function createRequestActivity() {
  let next = 0;
  let rows: RequestActivity[] = [];
  const listeners = new Set<() => void>();
  let refresh: (() => Promise<void>) | undefined;
  const emit = () => { for (const listener of listeners) listener(); };
  return {
    snapshot: () => rows,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setRefresh: (fn: (() => Promise<void>) | undefined) => { refresh = fn; },
    dismiss: (key: number) => { rows = rows.filter(row => row.key !== key); emit(); },
    refreshed: (keys: number[]) => { rows = rows.filter(row => !(row.refreshFailed && keys.includes(row.key))); emit(); },
    clear: () => { rows = []; emit(); },
    async run<T>(id: NeighbourId, kind: ActivityKind, work: () => Promise<T>, operation = `${id}:${kind}`, reportFailure = true): Promise<T> {
      const key = ++next;
      rows = [...rows.filter(row => !(row.operation === operation && (row.failed || row.refreshFailed))),
        { key, id, kind, operation, startedAt: Date.now() }];
      emit();
      let result: T;
      try {
        result = await work();
      } catch (error) {
        rows = reportFailure ? rows.map(row => row.key === key ? { ...row, failed: true } : row) : rows.filter(row=>row.key!==key);
        emit();
        throw error;
      }
      // A failed read-back must never turn a successful mutation into a retry
      // (and a possible duplicate write). The activity query owns read errors.
      try { await refresh?.(); } catch {
        rows = rows.map(row=>row.key===key ? {...row,refreshFailed:true} : row);
        emit();
        return result;
      }
      rows = rows.filter(row => row.key !== key);
      emit();
      return result;
    },
  };
}

export const requestActivity = createRequestActivity();

export function requestActor(path: string, method = 'GET'): {id: NeighbourId; kind: ActivityKind} | null {
  if (!['POST','PATCH','PUT','DELETE'].includes(method.toUpperCase())) return null;
  const neighbour = path.match(/^\/v1\/neighbours\/(penny|milo|mira|tally|ollie)(?:\/|$)/)?.[1] as NeighbourId | undefined;
  if (neighbour) return {id:neighbour,kind:'text'};
  if (/^\/v1\/(messages(?:$|\?)|tasks\/|photos\/.+\/accept|photos\/read)/.test(path)) return {id:'ollie',kind:'route'};
  return null;
}

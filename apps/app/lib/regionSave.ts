export type RegionPatch = { currency?: string; timezone?: string };
export type RegionSaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Only a confirmed write changes the displayed home settings. */
export function createRegionSaver(deps: { write: (patch: RegionPatch) => Promise<unknown>; accepted: (patch: RegionPatch) => void; state: (state: RegionSaveState) => void }) {
  let busy = false;
  let failed: RegionPatch | null = null;
  async function save(patch: RegionPatch): Promise<boolean> {
    if (busy) return false;
    busy = true;
    deps.state('saving');
    const selected = { ...patch };
    try {
      await deps.write(selected);
    } catch {
      failed = selected;
      busy = false;
      deps.state('error');
      return false;
    }
    failed = null;
    busy = false;
    deps.accepted(selected);
    deps.state('saved');
    return true;
  }
  return { save, retry: () => failed ? save(failed) : Promise.resolve(false) };
}

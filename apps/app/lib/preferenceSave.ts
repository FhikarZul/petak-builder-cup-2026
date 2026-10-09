import type { AppearanceMode } from './appearance';

export type PreferencePatch = { appearance?: AppearanceMode; credit_prompt?: boolean; c41?: { auto_link: boolean }; notifications?: { subjects: Record<string, boolean> } };
export type PreferenceChange = { label: string; patch: PreferencePatch };
export type PreferenceSaveState = { status: 'idle' } | { status: 'saving' | 'error'; change: PreferenceChange };

/** One pending write; failed previews roll back and retry the same selection. */
export function createPreferenceSaver(deps: {
  write: (patch: PreferencePatch) => Promise<unknown>;
  preview: (change: PreferenceChange) => () => void;
  accepted: (patch: PreferencePatch) => void;
  state: (state: PreferenceSaveState) => void;
}) {
  let busy = false;
  let failed: PreferenceChange | null = null;
  async function save(change: PreferenceChange): Promise<boolean> {
    if (busy) return false;
    busy = true;
    deps.state({ status: 'saving', change });
    const rollback = deps.preview(change);
    try {
      await deps.write(change.patch);
    } catch {
      rollback();
      failed = change;
      busy = false;
      deps.state({ status: 'error', change });
      return false;
    }
    deps.accepted(change.patch);
    failed = null;
    busy = false;
    deps.state({ status: 'idle' });
    return true;
  }
  return { save, retry: () => failed ? save(failed) : Promise.resolve(false) };
}

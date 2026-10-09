import { expect, it, vi } from 'vitest';
import { createPreferenceSaver } from './preferenceSave';

it('rolls back a failed appearance preview and retries the selected choice', async () => {
  let appearance = 'system';
  const accepted = vi.fn(); const state = vi.fn();
  const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  const saver = createPreferenceSaver({ write, accepted, state, preview: change => {
    const previous = appearance;
    appearance = change.patch.appearance ?? appearance;
    return () => { appearance = previous; };
  } });
  const change = { label: 'appearance', patch: { appearance: 'dark' as const } };
  const pending = saver.save(change);
  expect(appearance).toBe('dark');
  expect(await pending).toBe(false);
  expect(appearance).toBe('system');
  expect(accepted).not.toHaveBeenCalled();
  expect(state).toHaveBeenLastCalledWith({ status: 'error', change });
  expect(await saver.retry()).toBe(true);
  expect(appearance).toBe('dark');
  expect(write.mock.calls).toEqual([[change.patch], [change.patch]]);
  expect(accepted).toHaveBeenCalledWith(change.patch);
});

it('guards competing saves synchronously, before React can disable the controls', async () => {
  let finish!: () => void;
  const write = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const preview = vi.fn(() => vi.fn()); const accepted = vi.fn();
  const saver = createPreferenceSaver({ write, accepted, preview, state: vi.fn() });
  const first = saver.save({ label: 'photo credits', patch: { credit_prompt: false } });
  expect(await saver.save({ label: 'meal linking', patch: { c41: { auto_link: true } } })).toBe(false);
  expect(write).toHaveBeenCalledOnce();
  expect(preview).toHaveBeenCalledOnce();
  finish();
  expect(await first).toBe(true);
  expect(accepted).toHaveBeenCalledWith({ credit_prompt: false });
  expect(await saver.retry()).toBe(false);
});

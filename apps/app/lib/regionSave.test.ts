import { expect, it, vi } from 'vitest';
import { createRegionSaver } from './regionSave';

it('blocks conflicting taps and exposes pending until the accepted write finishes', async () => {
  let finish!: () => void;
  const write = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const accepted = vi.fn(); const state = vi.fn();
  const saver = createRegionSaver({ write, accepted, state });
  const first = saver.save({ currency: 'SGD' });
  expect(state).toHaveBeenLastCalledWith('saving');
  expect(await saver.save({ currency: 'USD' })).toBe(false);
  expect(write).toHaveBeenCalledTimes(1);
  expect(accepted).not.toHaveBeenCalled();
  finish();
  expect(await first).toBe(true);
  expect(accepted).toHaveBeenCalledWith({ currency: 'SGD' });
  expect(state).toHaveBeenLastCalledWith('saved');
});

it('preserves the old value on failure and retries the exact selected setting', async () => {
  const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  const accepted = vi.fn(); const state = vi.fn();
  const saver = createRegionSaver({ write, accepted, state });
  expect(await saver.save({ timezone: 'Asia/Singapore' })).toBe(false);
  expect(accepted).not.toHaveBeenCalled();
  expect(state).toHaveBeenLastCalledWith('error');
  expect(await saver.retry()).toBe(true);
  expect(write.mock.calls).toEqual([[{ timezone: 'Asia/Singapore' }], [{ timezone: 'Asia/Singapore' }]]);
  expect(accepted).toHaveBeenCalledTimes(1);
});

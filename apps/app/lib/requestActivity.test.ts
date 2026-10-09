import { expect, it } from 'vitest';
import { createRequestActivity, requestActor } from './requestActivity';

it('keeps concurrent actions visible until their response is refreshed, then clears only the finished action', async () => {
  const tracker=createRequestActivity();
  let finish!: () => void;
  const held=new Promise<void>(r=>{finish=r;});
  let refresh!: () => void;
  tracker.setRefresh(()=>new Promise<void>(r=>{refresh=r;}));
  const first=tracker.run('milo','text',()=>held);
  expect(tracker.snapshot()).toHaveLength(1);
  finish(); await Promise.resolve();
  expect(tracker.snapshot()).toHaveLength(1);
  const second=tracker.run('penny','text',()=>new Promise<void>(()=>{}));
  void second;
  refresh(); await first;
  expect(tracker.snapshot().map(r=>r.id)).toEqual(['penny']);
});

it('turns a failed request into a dismissible failure, never an endless animation', async () => {
  const tracker=createRequestActivity();
  await expect(tracker.run('milo','text',async()=>{throw new Error('network');})).rejects.toThrow('network');
  expect(tracker.snapshot()).toEqual([expect.objectContaining({id:'milo',failed:true})]);
  tracker.dismiss(tracker.snapshot()[0].key);
  expect(tracker.snapshot()).toEqual([]);
});

it('tracks profile, task and move-in work, without marking read-only polling as work', () => {
  expect(requestActor('/v1/neighbours/milo/profile-form','POST')).toEqual({id:'milo',kind:'text'});
  expect(requestActor('/v1/neighbours/penny/move-in','POST')?.id).toBe('penny');
  expect(requestActor('/v1/tasks/task1/act','POST')?.id).toBe('ollie');
  expect(requestActor('/v1/activity')).toBeNull();
  expect(requestActor('/v1/neighbours/milo/today')).toBeNull();
});

it('clears a failed attempt when the same action is retried successfully', async () => {
  const tracker=createRequestActivity();
  await tracker.run('milo','text',async()=>{throw Error('no');}).catch(()=>{});
  await tracker.run('milo','text',async()=>{});
  expect(tracker.snapshot()).toEqual([]);
});

it('preserves a visible refresh failure without retrying a write that succeeded', async () => {
  const tracker=createRequestActivity();
  tracker.setRefresh(async()=>{throw Error('read-back unavailable');});
  expect(await tracker.run('milo','text',async()=> 'saved')).toBe('saved');
  expect(tracker.snapshot()).toEqual([expect.objectContaining({refreshFailed:true})]);
  expect(tracker.snapshot()[0].failed).toBeUndefined();
});

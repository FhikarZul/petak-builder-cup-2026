import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}}}));
import { apiFetch } from './api';
import { requestActivity } from './requestActivity';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();requestActivity.clear();});

it('aborts a hung operation and exposes failure instead of animating forever', async () => {
  vi.useFakeTimers();
  let aborted=false;
  vi.stubGlobal('fetch', (_url: string, init: RequestInit) => new Promise((_resolve,reject)=>{
    init.signal?.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));});
  }));
  const request=apiFetch('/v1/neighbours/milo/profile-form',{method:'POST',body:'{}'});
  const rejection=expect(request).rejects.toThrow('aborted');
  await vi.advanceTimersByTimeAsync(120_001);
  expect(aborted).toBe(true);
  await rejection;
  expect(requestActivity.snapshot()[0].failed).toBe(true);
});

it('lets a capture card own its upload/message/accept progress without a second routing indicator',async()=>{
 let finish!: (r:Response)=>void;
 vi.stubGlobal('fetch',()=>new Promise<Response>(resolve=>{finish=resolve;}));
 for(const path of ['/v1/messages','/v1/photos/photo-a/accept']) {
  const sending=apiFetch(path,{method:'POST',body:JSON.stringify({photo_id:'photo-a',client_key:'capture-a'})});
  await Promise.resolve();await Promise.resolve();
  expect(requestActivity.snapshot()).toEqual([]);
  finish(new Response('{}',{status:200}));await sending;
 }
});

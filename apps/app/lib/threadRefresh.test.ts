import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
vi.mock('./api',()=>({apiFetch:vi.fn()}));
vi.mock('./supabase',()=>({useSession:()=>null}));
import { apiFetch } from './api';
import { refreshFeedHead } from './thread';

it('a post-commit refresh never joins a head fetch started before the commit', async () => {
  const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
  let release!: (value:unknown)=>void;
  vi.mocked(apiFetch).mockImplementationOnce(()=>new Promise(r=>{release=r;}));
  vi.mocked(apiFetch).mockResolvedValueOnce({messages:[{id:'reply',created_at:'2026-09-15T12:00:01Z'}],cursor:null,has_more:false});
  const earlier=refreshFeedHead(qc);
  const afterCommit=refreshFeedHead(qc,true);
  const calls=vi.mocked(apiFetch).mock.calls.length;
  release({messages:[],cursor:null,has_more:false});
  await Promise.all([earlier,afterCommit]);
  expect(calls).toBe(2);
  expect(qc.getQueryData<{pages:{messages:{id:string}[]}[]}>(['feed'])?.pages[0].messages).toEqual([expect.objectContaining({id:'reply'})]);
  qc.clear();
});

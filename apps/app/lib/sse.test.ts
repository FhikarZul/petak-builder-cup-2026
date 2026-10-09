import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectEventStream, startEventStream } from './sse';

class FakeXmlHttpRequest {
  static instances: FakeXmlHttpRequest[] = [];

  responseText = '';
  onprogress: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn();

  constructor() {
    FakeXmlHttpRequest.instances.push(this);
  }
}

async function connectedXhr(): Promise<FakeXmlHttpRequest> {
  await Promise.resolve();
  await Promise.resolve();
  expect(FakeXmlHttpRequest.instances).toHaveLength(1);
  return FakeXmlHttpRequest.instances[0];
}

function eventFrame(event: string, data: Record<string, unknown>): string {
  return `id: 12\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe('mobile SSE client', () => {
  beforeEach(() => {
    FakeXmlHttpRequest.instances = [];
    vi.stubGlobal('XMLHttpRequest', FakeXmlHttpRequest);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fires onOpen once per connection, not once per progress chunk', async () => {
    const onOpen = vi.fn();
    const stop = connectEventStream({
      url: 'https://api.example/v1/events',
      getToken: async () => 'token',
      onEvent: vi.fn(),
      onOpen,
    });
    const xhr = await connectedXhr();

    xhr.responseText = ': hb\n\n';
    xhr.onprogress?.();
    xhr.responseText += ': hb\n\n';
    xhr.onprogress?.();

    expect(onOpen).toHaveBeenCalledTimes(1);
    stop();
  });

  it.each([
    ['message.new', { neighbour: 'penny' }, []],
    ['task.opened', { task_id: 't1' }, [['tasks']]],
    ['task.resolved', { task_id: 't1' }, [['tasks']]],
    ['credits.changed', { photo_id: 'p1' }, [['street'], ['wallet']]],
    ['photo.reading', { photo_id: 'p1' }, [['photo', 'p1']]],
  ] as const)('maps %s to current query keys', async (event, data, expectedKeys) => {
    const invalidateQueries = vi.fn();
    const refreshFeed = vi.fn();
    const stop = startEventStream(
      { invalidateQueries } as unknown as QueryClient,
      { url: 'https://api.example/v1/events', getToken: async () => 'token', refreshFeed },
    );
    const xhr = await connectedXhr();

    xhr.responseText = eventFrame(event, data);
    xhr.onprogress?.();

    for (const queryKey of expectedKeys) expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    if (event === 'message.new') expect(refreshFeed).toHaveBeenCalledOnce();
    stop();
  });

  it('invalidates the affected resident read models after a filing', async () => {
    const invalidateQueries = vi.fn();
    const stop = startEventStream(
      { invalidateQueries } as unknown as QueryClient,
      { url: 'https://api.example/v1/events', getToken: async () => 'token' },
    );
    const xhr = await connectedXhr();

    xhr.responseText = eventFrame('entry.filed', { neighbour: 'penny', entry_id: 'e1' });
    xhr.onprogress?.();

    for (const queryKey of [
      ['entries', 'penny'],
      ['today', 'penny'],
      ['categories'],
      ['series', 'penny'],
      ['penny-log'],
    ]) {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    }
    stop();
  });
});

 it.each(['penny', 'milo'])('refreshes loaded %s pages when an entry changes', async neighbour => {
    FakeXmlHttpRequest.instances = [];
    vi.stubGlobal('XMLHttpRequest', FakeXmlHttpRequest);
    const invalidateQueries = vi.fn();
    const stop = startEventStream(
      { invalidateQueries } as unknown as QueryClient,
      { url: 'https://api.example/v1/events', getToken: async () => 'token' },
    );
    const xhr = await connectedXhr();
    xhr.responseText = ': hb\n\n';
    xhr.onprogress?.();
    invalidateQueries.mockClear();
    xhr.responseText += eventFrame('entry.amended', { neighbour, entry_id: 'e1' });
    xhr.onprogress?.();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['feed'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['thread', neighbour] });
    if (neighbour === 'milo') expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trail'] });
    stop();
    vi.unstubAllGlobals();
 });

it('refreshes loaded historical receipt pages after reconnecting', async () => {
  vi.useFakeTimers();
  FakeXmlHttpRequest.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXmlHttpRequest);
  const invalidateQueries = vi.fn(), onOpen = vi.fn();
  const stop = startEventStream({ invalidateQueries } as unknown as QueryClient, {
    url:'https://api.example/v1/events', getToken:async ()=>'token', onOpen,
  });
  const xhr = await connectedXhr();
  xhr.responseText = ': hb\n\n';
  xhr.onprogress?.();
  expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['feed']});
  expect(onOpen).toHaveBeenCalledOnce();
  invalidateQueries.mockClear();
  xhr.onerror?.();
  await vi.advanceTimersByTimeAsync(1000);
  expect(FakeXmlHttpRequest.instances).toHaveLength(2);
  const reconnected = FakeXmlHttpRequest.instances[1];
  reconnected.responseText = ': hb\n\n';
  reconnected.onprogress?.();
  expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['feed']});
  expect(onOpen).toHaveBeenCalledTimes(2);
  stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('ordinary new messages refresh the head without refetching loaded history', async () => {
  FakeXmlHttpRequest.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXmlHttpRequest);
  const invalidateQueries=vi.fn(), refreshFeed=vi.fn();
  const stop=startEventStream({invalidateQueries} as unknown as QueryClient,{url:'https://api.example/v1/events',getToken:async()=>'token',refreshFeed});
  const xhr=await connectedXhr();
  xhr.responseText=': hb\n\n'; xhr.onprogress?.(); invalidateQueries.mockClear();
  xhr.responseText+=eventFrame('message.new',{neighbour:'penny'}); xhr.onprogress?.();
  expect(refreshFeed).toHaveBeenCalledOnce();
  expect(invalidateQueries).not.toHaveBeenCalledWith({queryKey:['feed']});
  stop(); vi.unstubAllGlobals();
});

it('correlates SSE/refetch without leaking payloads or repeating a refresh when timing throws',async()=>{
 FakeXmlHttpRequest.instances=[];vi.stubGlobal('XMLHttpRequest',FakeXmlHttpRequest);
 const rows:unknown[]=[],refreshFeed=vi.fn(async()=>{}),invalidateQueries=vi.fn();
 const stop=startEventStream({invalidateQueries} as unknown as QueryClient,{url:'https://api.test/events',getToken:async()=>'token',refreshFeed,
 onTiming:t=>{rows.push(t);throw Error('sink');}});
 const xhr=await connectedXhr();xhr.responseText=eventFrame('message.new',{message_id:'00000000-0000-4000-8000-000000000001',body:'SECRET',photo_id:'SECRET'});xhr.onprogress?.();
 await Promise.resolve();await Promise.resolve();
 expect(refreshFeed).toHaveBeenCalledTimes(1);expect(rows).toEqual([
 expect.objectContaining({stage:'sse_received',event_seq:'12',message_id:'00000000-0000-4000-8000-000000000001'}),
 expect.objectContaining({stage:'refetch',success:true})]);expect(JSON.stringify(rows)).not.toContain('SECRET');
 expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['threads']});stop();vi.unstubAllGlobals();
});

it('refreshes only the hinted photo and restores photo/activity snapshots on reconnect', async () => {
  FakeXmlHttpRequest.instances=[];vi.stubGlobal('XMLHttpRequest',FakeXmlHttpRequest);
  const invalidateQueries=vi.fn(),refreshFeed=vi.fn();
  const stop=startEventStream({invalidateQueries} as unknown as QueryClient,{url:'https://api.test/events',getToken:async()=>'token',refreshFeed});
  const xhr=await connectedXhr();xhr.responseText=': hb\n\n';xhr.onprogress?.();
  expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['photo']});
  expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['activity']});
  invalidateQueries.mockClear();
  xhr.responseText+=eventFrame('photo.progress',{photo_id:'photo-a'});xhr.onprogress?.();
  expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['photo','photo-a']});
  expect(invalidateQueries).not.toHaveBeenCalledWith({queryKey:['photo','photo-b']});
  expect(refreshFeed).not.toHaveBeenCalled();
  stop();vi.unstubAllGlobals();
});

it('restores two independent cached photo outcomes from snapshots, ignoring event stage claims',async()=>{
 const {QueryClient,QueryObserver}=await import('@tanstack/react-query');
 const {preserveNewerProgress}=await import('./captureProgress');
 FakeXmlHttpRequest.instances=[];vi.stubGlobal('XMLHttpRequest',FakeXmlHttpRequest);
 const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const snapshot=(id:string,stage:string,second:number)=>({photo_id:id,progress:{photo_id:id,stage,observed_at:`2026-10-08T12:00:0${second}.000Z`}});
 let a=snapshot('a','reading',1),b=snapshot('b','reading',1);
 const observers=['a','b'].map(id=>new QueryObserver(qc,{queryKey:['photo',id],queryFn:async()=>id==='a'?a:b,
  structuralSharing:(previous,next)=>preserveNewerProgress(previous as never,next as never)}));
 const unsubscribe=observers.map(observer=>observer.subscribe(()=>{}));
 await Promise.all(observers.map(observer=>observer.refetch()));
 const stop=startEventStream(qc,{url:'https://api.test/events',getToken:async()=>'token'});
 const xhr=await connectedXhr();xhr.responseText=': hb\n\n';xhr.onprogress?.();
 await vi.waitFor(()=>expect(qc.isFetching()).toBe(0));
 a=snapshot('a','clarification_needed',2);
 xhr.responseText+=eventFrame('photo.progress',{photo_id:'a',stage:'published'});xhr.onprogress?.();
 await vi.waitFor(()=>expect(qc.getQueryData(['photo','a'])).toEqual(a));
 expect(qc.getQueryData(['photo','b'])).toEqual(b);
 a=snapshot('a','enriching',3);b=snapshot('b','outcome_unknown',2);
 await qc.invalidateQueries({queryKey:['photo']}); // reconnect's authoritative restore
 expect(qc.getQueryData(['photo','a'])).toEqual(a);
 expect(qc.getQueryData(['photo','b'])).toEqual(b);
 const resumed=a;a=snapshot('a','reading',1);
 await qc.invalidateQueries({queryKey:['photo','a']});
 expect(qc.getQueryData(['photo','a'])).toEqual(resumed);
 stop();unsubscribe.forEach(fn=>fn());qc.clear();vi.unstubAllGlobals();
});

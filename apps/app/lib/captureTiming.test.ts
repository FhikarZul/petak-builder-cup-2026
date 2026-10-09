import { describe, expect, it } from 'vitest';
import { CaptureTimingObserver } from './captureTiming';

describe('capture timing at the visible feed boundary', () => {
  it('correlates a capture reply and reports the first result once, without content', () => {
    const observer = new CaptureTimingObserver();
    observer.note({ client_key: 'send', photo_id: 'photo', timing_started_at_ms: 1000 }, 1100);
    const reply = { role: 'assistant', body: 'private', blocks: [{ kind: 'capture_context', photo_id: 'photo' }] };
    expect(observer.visible([reply], 2500)).toEqual([{ photo_id: 'photo', started_at_ms:1000, at_ms:2500, duration_ms: 1500, foreground_continuous: true }]);
    expect(observer.visible([reply], 3000)).toEqual([]);
    observer.note({ client_key: 'send', photo_id: 'photo', timing_started_at_ms: 1000 }, 3000);
    expect(observer.visible([reply], 3500)).toEqual([]);
  });
  it('ignores user photos, unrelated replies and unknown historical captures', () => {
    const observer = new CaptureTimingObserver();
    observer.note({ client_key: 'send', photo_id: 'photo', timing_started_at_ms: 1000 }, 1100);
    expect(observer.visible([{ role: 'user', blocks: [{ kind: 'capture_context', photo_id: 'photo' }] },
      { role: 'assistant', blocks: [{ kind: 'capture_context', photo_id: 'other' }] }], 2000)).toEqual([]);
  });
  it('marks resumed and background-interrupted waits separately from foreground latency', () => {
    const observer = new CaptureTimingObserver();
    observer.note({ client_key: 'send', photo_id: 'photo', timing_started_at_ms: 1000, timing_resumed: true }, 1100);
    expect(observer.visible([{ role: 'assistant', blocks: [{ kind: 'capture_context', photo_id: 'photo' }] }], 2000)[0].foreground_continuous).toBe(false);
    observer.note({ client_key: 'next', photo_id: 'next', timing_started_at_ms: 2000 }, 2000);
    observer.background();
    expect(observer.visible([{ role: 'assistant', blocks: [{ kind: 'capture_context', photo_id: 'next' }] }], 3000)[0].foreground_continuous).toBe(false);
  });
});

it('records a result only when the list reports that assistant row visible, once per photo',()=>{
 const observer=new CaptureTimingObserver();
 observer.note({client_key:'a',photo_id:'a',timing_started_at_ms:1000},1000);
 const item={kind:'message' as const,message:{role:'assistant',blocks:[{kind:'capture_context',photo_id:'a'}]}};
 expect(observer.viewable([{isViewable:false,item}],2000)).toEqual([]);
 expect(observer.viewable([{isViewable:true,item}],2400)).toEqual([expect.objectContaining({photo_id:'a',at_ms:2400,duration_ms:1400})]);
 expect(observer.viewable([{isViewable:true,item}],2800)).toEqual([]);
});

it('excludes a background interruption during preparation before the server assigned a photo id',()=>{
 const observer=new CaptureTimingObserver();
 observer.note({client_key:'a',timing_started_at_ms:1000},1000);
 observer.background(1200);
 observer.note({client_key:'a',photo_id:'a',timing_started_at_ms:1000},1400);
 expect(observer.visible([{role:'assistant',blocks:[{kind:'capture_context',photo_id:'a'}]}],2000)[0].foreground_continuous).toBe(false);
});

it('counts local acknowledgement only after both layout and viewport visibility, never as server acceptance',async()=>{
 const {CaptureVisibilityObserver}=await import('./captureTiming');
 const events:unknown[]=[];const observer=new CaptureVisibilityObserver(event=>events.push(event));
 observer.localLayout({client_key:'send',timing_started_at_ms:1000},1050);
 expect(events).toEqual([]);
 observer.setVisible(['capture:send'],1100);
 expect(events).toEqual([expect.objectContaining({stage:'local_ack_visible',capture_key:'send',duration_ms:100,at_ms:1100})]);
 observer.localLayout({client_key:'send',timing_started_at_ms:1000},1150);
 expect(events).toHaveLength(1);
});

it('audits only rendered backend transitions for each visible photo, with no invented cold-resume latency',async()=>{
 const {CaptureVisibilityObserver}=await import('./captureTiming');
 const events:any[]=[];const observer=new CaptureVisibilityObserver(event=>events.push(event));
 const snapshot=(photo_id:string,stage:any,second:number)=>({photo_id,stage,observed_at:`2026-10-08T12:00:0${second}.000Z`});
 observer.setVisible(['photo:a'],1000);
 observer.progressLayout(snapshot('a','accepted',1),1100);
 observer.progressLayout(snapshot('b','published',1),1200);
 observer.progressLayout(snapshot('a','accepted',2),1300);
 observer.progressLayout(snapshot('a','reading',1),1400);
 observer.progressLayout(snapshot('a','clarification_needed',3),1500);
 observer.progressLayout(snapshot('a','enriching',4),1600);
 expect(events.map(e=>[e.photo_id,e.progress_stage,e.transition_seq])).toEqual([['a','accepted',1],['a','clarification_needed',2],['a','enriching',3]]);
 expect(events[0].duration_ms).toBeUndefined();
 expect(events[1]).toMatchObject({previous_progress_stage:'accepted',repeated_layout_count:1,stale_layout_count:1,at_ms:1500});
 observer.setVisible(['photo:b'],1700);
 expect(events.at(-1)).toMatchObject({photo_id:'b',progress_stage:'published',transition_seq:1,at_ms:1700});
});

it('never reports a pending rendered status after that photo has changed to a progress-read error',async()=>{
 const {CaptureVisibilityObserver}=await import('./captureTiming');
 const events:unknown[]=[];const observer=new CaptureVisibilityObserver(event=>events.push(event));
 observer.progressLayout({photo_id:'a',stage:'reading',observed_at:'2026-10-08T12:00:00Z'},1000);
 observer.progressUnavailable('a');observer.setVisible(['photo:a'],1100);
 expect(events).toEqual([]);
});

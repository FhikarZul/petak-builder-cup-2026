import { describe, expect, it } from 'vitest';
import { activityLines, shouldRefreshActivityFeed, type BackgroundActivity } from './activity';
import { reconcileLocalCaptures } from './capture';
import { photoRoutingLine, noteSendStart } from './indicator';

const running: BackgroundActivity = {id:'job1',neighbour:'ollie',kind:'route',state:'running',started_at:'2026-09-15T12:00:00Z'};

describe('activity across the server acknowledgement boundary', () => {
  it('refreshes an idle feed even when a job starts and finishes between polls with no SSE', () => {
    expect(shouldRefreshActivityFeed([], [])).toBe(true);
  });
  it('keeps processing visible after the server photo replaces its local capture, including a cold resume', () => {
    const captures = reconcileLocalCaptures([{payload:{photo_id:'photo1'}}], [{role:'user',photo_id:'photo1',ref_message_id:null}]);
    expect(captures).toEqual([]);
    const optimistic = photoRoutingLine(captures.map(() => ({state:'sent'})),false,1);
    expect(activityLines(optimistic ? [optimistic] : [], [running])).toEqual([
      expect.objectContaining({id:'ollie',kind:'route',count:1}),
    ]);
    expect(activityLines([], [])).toEqual([]);
  });
  it('does not animate deferred, queued, retrying or failed work', () => {
    for (const state of ['queued','waiting','retrying','failed'] as const) {
      expect(activityLines([], [{...running,state}])).toEqual([]);
    }
  });
  it('coalesces the local/server handoff and keeps concurrently working neighbours visible', () => {
    const local=noteSendStart([], 'ollie','route',1);
    const rows=activityLines(local,[running,{...running,id:'job2',neighbour:'milo',kind:'text'}]);
    expect(rows.map(r=>r.id)).toEqual(['ollie','milo']);
    expect(rows.filter(r=>r.id==='ollie')).toHaveLength(1);
  });
});

it('leaves photo progress to its own card without duplicating a neighbour indicator',()=>{
 expect(activityLines([],[{...running,photo_id:'photo-a'},{...running,id:'job2',photo_id:'photo-b'}])).toEqual([]);
 expect(activityLines([],[running])).toHaveLength(1);
});

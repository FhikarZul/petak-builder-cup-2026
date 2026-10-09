import {describe,expect,it} from 'vitest';
import {captureProgressView, preserveNewerProgress} from './captureProgress';
import type {CaptureProgress} from '@petak/config/capture-progress';
const progress=(photo_id:string,stage:CaptureProgress['stage'],second=0):CaptureProgress=>({photo_id,stage,observed_at:`2026-10-08T12:00:0${second}.000Z`});
describe('per-photo backend progress',()=>{
 it('never maps upload acknowledgement or unknown outcome to filing success',()=>{
  for(const stage of ['awaiting_upload','accepted','outcome_unknown'] as const) {
   expect(captureProgressView('a',progress('a',stage))?.text).not.toMatch(/Filed|Saved/);
  }
  expect(captureProgressView('a',progress('a','outcome_unknown'))).toMatchObject({active:false,failed:false});
 });
 it('separates the clarification, failed and published outcomes and stops their working state',()=>{
  expect(captureProgressView('a',progress('a','clarification_needed'))).toMatchObject({text:'Needs your answer',active:false,failed:false});
  expect(captureProgressView('a',progress('a','failed'))).toMatchObject({text:'Couldn’t finish this photo',active:false,failed:true});
  expect(captureProgressView('a',progress('a','published'))).toMatchObject({text:'Read complete',active:false,failed:false});
 });
 it('does not name unseen contents or borrow another photo’s stage',()=>{
  expect(captureProgressView('a',progress('b','published'))).toBeNull();
  expect(captureProgressView('a',progress('a','reading'))).toMatchObject({text:'Reading photo…',active:true});
 });
 it('uses snapshot time instead of a stage rank so an answered clarification can resume',()=>{
  const old={photo_id:'a',progress:progress('a','clarification_needed',2)};
  const next={photo_id:'a',progress:progress('a','enriching',3)};
  expect(preserveNewerProgress(old,next)).toBe(next);
  expect(preserveNewerProgress(next,old)).toBe(next);
  const other={photo_id:'b',progress:progress('b','accepted',1)};
  expect(preserveNewerProgress(next,other)).toBe(other);
 });
});

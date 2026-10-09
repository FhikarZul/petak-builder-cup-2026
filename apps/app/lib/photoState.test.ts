import { describe, expect, it } from 'vitest';
import { photoStateRefetchInterval } from './photoState';

describe('photo processing polling', () => {
  it('keeps polling while a queued job has not been claimed', () => {
    expect(photoStateRefetchInterval('queued')).toBe(5_000);
  });

  it('keeps polling while the worker is processing', () => {
    expect(photoStateRefetchInterval('processing')).toBe(5_000);
  });

  it('stops polling at terminal and parked states', () => {
    expect(photoStateRefetchInterval('filed')).toBe(false);
    expect(photoStateRefetchInterval('failed')).toBe(false);
    expect(photoStateRefetchInterval('waiting')).toBe(false);
  });
});

it('uses backend progress to stop uncertain/clarification outcomes even if the old photo state still says processing',()=>{
  for (const stage of ['published','clarification_needed','failed','outcome_unknown','waiting_allowance'] as const) {
    expect(photoStateRefetchInterval('processing',stage)).toBe(false);
  }
  expect(photoStateRefetchInterval('filed','enriching')).toBe(5_000);
});

it('keeps completed photo snapshots fresh on historical card remounts, with event invalidation still available',async()=>{
 const {photoStateStaleTime}=await import('./photoState');
 expect(photoStateStaleTime('published')).toBe(30*60*1000);
 expect(photoStateStaleTime('reading')).toBe(0);
 expect(photoStateStaleTime(undefined)).toBe(0);
});

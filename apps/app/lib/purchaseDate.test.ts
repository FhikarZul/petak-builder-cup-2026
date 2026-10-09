import { describe, expect, it } from 'vitest';
import { entryDayKey, logDayLabel } from './dashboard';

describe('Penny purchase day display', () => {
  it('uses the server purchase day without parsing it as a UTC instant', () => {
    expect(entryDayKey('2026-09-19T01:00:00Z', '2026-09-14')).toBe('2026-09-14');
  });
  it('uses the server anchored fallback day even when the device calendar differs', () => {
    expect(entryDayKey('2026-09-19T01:00:00Z', '2026-09-18')).toBe('2026-09-18');
  });
});

it('labels Today from the server anchor rather than the device calendar', () => {
  // Device clock here is Sept18; Singapore's anchored today is already Sept19.
  const deviceNow = new Date(2026, 8, 18, 12);
  expect(logDayLabel('2026-09-19', deviceNow, '2026-09-19')).toBe('Today · Sat 19 Sep');
  expect(logDayLabel('2026-09-18', deviceNow, '2026-09-19')).toBe('Fri 18 Sep');
});

import { expect, it } from 'vitest';
import { toggleMiloFoodFilter } from './miloEnergyFilter';

it('opens Food from All, then clears it on a second In tap', () => {
  const selected = toggleMiloFoodFilter('all');
  expect(selected).toBe('food');
  expect(toggleMiloFoodFilter(selected)).toBe('all');
});
it('replaces an unrelated Body or Photos filter with Food', () => {
  expect(toggleMiloFoodFilter('body')).toBe('food');
  expect(toggleMiloFoodFilter('photos')).toBe('food');
});
it('clears Food even when it was selected through the ordinary log chip', () => {
  expect(toggleMiloFoodFilter('food')).toBe('all');
});

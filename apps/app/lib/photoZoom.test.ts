import { expect, it } from 'vitest';
import { clampZoom, clampPan, zoomAround, fitImage } from './photoZoom';

it('keeps the image between its fitted size and 5x while rejecting invalid scale', () => {
  expect(clampZoom(0.4)).toBe(1);
  expect(clampZoom(9)).toBe(5);
  expect(clampZoom(2.4)).toBe(2.4);
  expect(clampZoom(Number.NaN)).toBe(1);
});
it('keeps a zoomed image within the viewport and resets translation when fitted', () => {
  expect(clampPan(500, 300, 300, 2)).toBe(150);
  expect(clampPan(-500, 300, 300, 2)).toBe(-150);
  expect(clampPan(40, 300, 300, 1)).toBe(0);
});
it('zooms around the touched point instead of jumping to the centre', () => {
  expect(zoomAround(0, 50, 1, 2)).toBe(-50);
  expect(zoomAround(-50, 50, 2, 1)).toBe(0);
});

it('bounds a landscape photo by its contained dimensions, including letterboxing', () => {
  const fitted = fitImage(300, 700, 300, 150);
  expect(fitted).toEqual({ width: 300, height: 150 });
  expect(clampPan(1400, 700, fitted.height, 5)).toBe(25);
  expect(clampPan(-1400, 700, fitted.height, 5)).toBe(-25);
  expect(clampPan(1400, 700, fitted.height, 2)).toBe(0);
  expect(clampPan(1400, 300, fitted.width, 5)).toBe(600);
});
it('centres a portrait photo on its letterboxed axis until zoom fills the viewport', () => {
  const fitted = fitImage(700, 300, 150, 300);
  expect(fitted).toEqual({ width: 150, height: 300 });
  expect(clampPan(1400, 700, fitted.width, 2)).toBe(0);
  expect(clampPan(1400, 700, fitted.width, 5)).toBe(25);
});
it('recalculates fitted dimensions and clamps old offsets after the viewport changes', () => {
  const before = fitImage(300, 700, 3000, 1500);
  const oldX = clampPan(900, 300, before.width, 2);
  expect(oldX).toBe(150);
  const after = fitImage(700, 300, 3000, 1500);
  expect(after).toEqual({ width: 600, height: 300 });
  expect(clampPan(oldX, 700, after.width, 2)).toBe(150);
  expect(clampPan(900, 700, after.width, 2)).toBe(250);
  expect(clampPan(250, 300, before.width, 2)).toBe(150);
  expect(clampPan(50, 700, before.height, 2)).toBe(0);
});
it('keeps an image centred until both intrinsic dimensions and layout are known', () => {
  expect(fitImage(300, 700, 0, 0)).toEqual({ width: 0, height: 0 });
  expect(fitImage(0, 0, 300, 150)).toEqual({ width: 0, height: 0 });
  expect(clampPan(200, 700, 0, 5)).toBe(0);
});

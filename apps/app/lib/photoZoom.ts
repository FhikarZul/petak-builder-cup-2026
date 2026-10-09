/** Worklet-safe bounds shared by the full-screen viewer's pinch and pan. */
export function clampZoom(scale: number): number {
  'worklet';
  return Number.isFinite(scale) ? Math.max(1, Math.min(5, scale)) : 1;
}
export function clampPan(offset: number, viewport: number, fitted: number, scale: number): number {
  'worklet';
  const bound = Math.max(0, (fitted * scale - viewport) / 2);
  return Math.max(-bound, Math.min(bound, offset));
}
export function zoomAround(offset: number, focal: number, before: number, after: number): number {
  'worklet';
  return focal - (focal - offset) * after / before;
}

/** The same centred contain fit used by React Native Image. Unknown size cannot pan. */
export function fitImage(viewportWidth: number, viewportHeight: number, imageWidth: number, imageHeight: number): { width: number; height: number } {
  'worklet';
  if (![viewportWidth, viewportHeight, imageWidth, imageHeight].every(value => Number.isFinite(value) && value > 0)) {
    return { width: 0, height: 0 };
  }
  const ratio = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight);
  return { width: imageWidth * ratio, height: imageHeight * ratio };
}

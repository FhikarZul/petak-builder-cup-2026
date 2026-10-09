import { expect, it } from 'vitest';
import { compactCaptureDetails } from './captureDetails';

it('collapses only tagged captures and keeps unanswered detail questions visible', () => {
  expect(compactCaptureDetails(null, [])).toBe(false);
  const marker = [{ kind: 'capture_context', photo_id: 'photo-1' }];
  expect(compactCaptureDetails(marker, [{ question: null }])).toBe(true);
  expect(compactCaptureDetails(marker, [{ question: 'How much?' }])).toBe(false);
  expect(compactCaptureDetails([{ kind: 'capture_context' }], [])).toBe(false);
});

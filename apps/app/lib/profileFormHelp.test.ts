import { expect, it } from 'vitest';
import { showFieldReason, showSkipHelp } from './profileFormHelp';
it('keeps the birthdate explanation only once when the parent already says it', () => {
  const body = "What's your date of birth? It keeps the maths current each year. Skip if you'd rather not say.";
  expect(showFieldReason('Keeps the maths current each year.', body)).toBe(false);
  expect(showFieldReason('Same reason — the maths.', body)).toBe(true);
  expect(showSkipHelp(body)).toBe(false);
});
it('keeps helpful explanations when the parent has not supplied them', () => {
  expect(showFieldReason('Keeps the maths current each year.', 'Here are your numbers.')).toBe(true);
  expect(showSkipHelp('Here are your numbers.')).toBe(true);
  expect(showSkipHelp('Leave anything blank.')).toBe(false);
});

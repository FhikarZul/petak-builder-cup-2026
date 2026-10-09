import { expect, it } from 'vitest';
import { referralShareMessage } from './referralShare';
it('shares a referral destination plus a readable code without promising a reward on signup', () => {
  const message = referralShareMessage('K7MRQ2NX');
  expect(message).toContain('https://petak.app/r/K7MRQ2NX');
  expect(message).toContain('my referral code is K7MRQ2NX');
  expect(message).toContain('Have a code?');
  expect(message).toContain('first month');
  expect(message).not.toMatch(/coins|both get/);
});
it('encodes the code as one URL path segment', () => {
  expect(referralShareMessage('A/B?C')).toContain('https://petak.app/r/A%2FB%3FC');
});

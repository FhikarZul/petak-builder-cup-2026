import { describe, expect, it } from 'vitest';
import { isAppleSignInVisible } from './authProviders';

describe('isAppleSignInVisible', () => {
  it('shows native Apple sign-in only on iOS', () => {
    expect(isAppleSignInVisible('ios')).toBe(true);
    expect(isAppleSignInVisible('android')).toBe(false);
    expect(isAppleSignInVisible('web')).toBe(false);
  });
});

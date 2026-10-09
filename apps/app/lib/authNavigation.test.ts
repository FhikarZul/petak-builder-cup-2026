import { describe, expect, it } from 'vitest';
import { authRedirectForState } from './authNavigation';

describe('authRedirectForState', () => {
  it('does nothing while the session is still loading', () => {
    expect(authRedirectForState({ loading: true, hasSession: false, firstSegment: undefined })).toBeNull();
  });

  it('sends unauthenticated protected routes to login', () => {
    expect(authRedirectForState({ loading: false, hasSession: false, firstSegment: undefined })).toBe('/login');
    expect(authRedirectForState({ loading: false, hasSession: false, firstSegment: '(drawer)' })).toBe('/login');
  });

  it('sends authenticated users away from login to the feed', () => {
    expect(authRedirectForState({ loading: false, hasSession: true, firstSegment: 'login' })).toBe('/');
  });

  it('does not redirect when already on the right side of the gate', () => {
    expect(authRedirectForState({ loading: false, hasSession: false, firstSegment: 'login' })).toBeNull();
    expect(authRedirectForState({ loading: false, hasSession: true, firstSegment: undefined })).toBeNull();
  });
});

// C112 — the app can say which build it is.
import { describe, expect, it } from 'vitest';
import { buildIdentity, buildIdentityForReport } from './appVersion';

describe('what Settings shows', () => {
  it('pairs the version with the build number', () => {
    // The whole point: `0.1.0` alone cannot tell build 19 from 20 from 21, and
    // an evening was spent guessing exactly that.
    expect(buildIdentity({ version: '0.1.0', android: { versionCode: 20 } })).toBe('0.1.0 (20)');
    expect(buildIdentity({ version: '0.1.0', ios: { buildNumber: '20' } })).toBe('0.1.0 (20)');
  });

  it('shows the version alone on a local build, rather than inventing a number', () => {
    // Expo leaves the build number unset locally so it cannot collide with a
    // real one. Rendering "(1)" there would look like a real build.
    expect(buildIdentity({ version: '0.1.0' })).toBe('0.1.0');
    expect(buildIdentity({ version: '0.1.0', android: { versionCode: null } })).toBe('0.1.0');
  });

  it('says "—" when there is no config at all, rather than guessing', () => {
    expect(buildIdentity(null)).toBe('—');
    expect(buildIdentity({ version: '  ' })).toBe('—');
  });
});

describe('what a bug report carries', () => {
  it('sends the number separately, so it can be filtered on', () => {
    expect(buildIdentityForReport({ version: '0.1.0', android: { versionCode: 20 } })).toEqual({
      app_version: '0.1.0',
      build_number: '20',
    });
  });

  it('sends null rather than a fake number for a local build', () => {
    // A report claiming build "1" from a laptop would send someone hunting a
    // build that never existed.
    expect(buildIdentityForReport({ version: '0.1.0' }).build_number).toBeNull();
  });
});

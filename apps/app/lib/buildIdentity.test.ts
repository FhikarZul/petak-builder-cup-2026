// C112 — one version, one build number, both platforms.
//
// Two defects these tests exist for:
//
//   internal-reference — the version was declared in app.config.ts AND package.json and
//   the two already disagreed (0.1.0 vs 0.0.0). Harmless only because nothing
//   read package.json's copy, which is exactly why nobody saw it go stale.
//
//   internal-reference — iOS had no build number at all, so every iOS build claimed "1"
//   and the second TestFlight upload of a version would have been rejected, at
//   the end of a long signed build.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { getAndroidVersionCode, getAppVersion, getIosBuildNumber, MAX_BUILD_NUMBER } from '../plugins/buildIdentity';

describe('the release version', () => {
  it('comes from package.json, and is a real semver', () => {
    expect(getAppVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('refuses a version that is not x.y.z rather than shipping it', () => {
    // A malformed version reaches the store listing and the build identity in
    // every bug report. Failing the build is much cheaper than shipping "0.0.0"
    // or an empty string.
    const bad = join(__dirname, '..', 'app.profiles.json'); // valid JSON, no version key
    expect(() => getAppVersion(bad)).toThrow('version must be x.y.z');
  });
});

describe('the build number, shared by both platforms', () => {
  it('is the SAME number for Android and iOS', () => {
    // The point of one counter: `0.2.0 (24)` must name one artifact. QA and
    // prod are separate bundle ids, so a release is built twice — with separate
    // counters both builds would answer to the same name.
    const env = { PETAK_BUILD_NUMBER: '24' };
    expect(getAndroidVersionCode(env)).toBe(24);
    expect(getIosBuildNumber(env)).toBe('24');
  });

  it('gives iOS a STRING — CFBundleVersion is a string and Expo passes it through', () => {
    expect(typeof getIosBuildNumber({ PETAK_BUILD_NUMBER: '7' })).toBe('string');
    expect(typeof getAndroidVersionCode({ PETAK_BUILD_NUMBER: '7' })).toBe('number');
  });

  it('leaves a LOCAL build on Expo defaults', () => {
    // No CI number means somebody is running it on their laptop. Inventing a
    // number there would collide with a real build.
    expect(getAndroidVersionCode({})).toBeUndefined();
    expect(getIosBuildNumber({})).toBeUndefined();
  });

  it('still accepts the old per-platform variables', () => {
    // codemagic.yaml set PETAK_ANDROID_VERSION_CODE before this change. A
    // rename that breaks the running pipeline is a worse bug than the one it
    // fixes, so both names work.
    expect(getAndroidVersionCode({ PETAK_ANDROID_VERSION_CODE: '19' })).toBe(19);
    expect(getIosBuildNumber({ PETAK_IOS_BUILD_NUMBER: '19' })).toBe('19');
  });

  it.each(['0', '-1', '1.5', 'build-42', String(MAX_BUILD_NUMBER + 1)])(
    'rejects %s on both platforms',
    (value) => {
      expect(() => getAndroidVersionCode({ PETAK_BUILD_NUMBER: value })).toThrow('PETAK_BUILD_NUMBER');
      expect(() => getIosBuildNumber({ PETAK_BUILD_NUMBER: value })).toThrow('PETAK_BUILD_NUMBER');
    },
  );

  it('respects Android\'s ceiling, which binds the shared counter', () => {
    // iOS has no equivalent limit; one shared counter means the smaller bound
    // is the real one.
    expect(getAndroidVersionCode({ PETAK_BUILD_NUMBER: String(MAX_BUILD_NUMBER) })).toBe(MAX_BUILD_NUMBER);
  });
});

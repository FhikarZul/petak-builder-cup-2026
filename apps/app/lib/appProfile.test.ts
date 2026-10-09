import { describe, expect, it } from 'vitest';
import { getPetakAppProfile, type PetakAppEnv } from './appProfile';

describe('getPetakAppProfile', () => {
  it('defaults to QA so local and beta builds cannot pretend to be production', () => {
    expect(getPetakAppProfile({}).env).toBe('qa');
  });

  it('uses the QA app identity for beta distribution', () => {
    expect(getPetakAppProfile({ EXPO_PUBLIC_PETAK_ENV: 'qa' })).toEqual({
      env: 'qa',
      name: 'Petak Builder Cup Demo',
      slug: 'petak-builder-cup-2026',
      scheme: 'petak-builder-cup',
      iosBundleIdentifier: 'com.example.petakbuildercup2026.ios',
      androidPackage: 'com.example.petakbuildercup2026.android',
    });
  });

  it('uses the production app identity only when explicitly requested', () => {
    expect(getPetakAppProfile({ EXPO_PUBLIC_PETAK_ENV: 'prod' })).toEqual({
      env: 'prod',
      name: 'Petak Builder Cup Demo',
      slug: 'petak-builder-cup-2026',
      scheme: 'petak-builder-cup',
      iosBundleIdentifier: 'com.example.petakbuildercup2026.ios',
      androidPackage: 'com.example.petakbuildercup2026.android',
    });
  });

  it('accepts PETAK_APP_ENV for native prebuild tooling', () => {
    expect(getPetakAppProfile({ PETAK_APP_ENV: 'production' }).env).toBe('prod');
  });

  it('rejects unknown environments instead of guessing', () => {
    expect(() => getPetakAppProfile({ EXPO_PUBLIC_PETAK_ENV: 'staging' as PetakAppEnv })).toThrow(
      'Unsupported Petak app environment: staging',
    );
  });
});

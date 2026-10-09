import profiles from '../app.profiles.json';

export type PetakAppEnv = 'qa' | 'prod' | 'production';

export interface PetakAppProfile {
  env: 'qa' | 'prod';
  name: string;
  slug: string;
  scheme: string;
  iosBundleIdentifier: string;
  androidPackage: string;
}

export type PetakAppProfileEnv = Record<string, string | undefined>;

const PROFILES = profiles as Record<PetakAppProfile['env'], PetakAppProfile>;

function normalizeEnv(value: string | undefined): PetakAppProfile['env'] {
  if (value === undefined || value === '' || value === 'qa') return 'qa';
  if (value === 'prod' || value === 'production') return 'prod';
  throw new Error(`Unsupported Petak app environment: ${value}`);
}

export function getPetakAppProfile(env: PetakAppProfileEnv = process.env): PetakAppProfile {
  const key = normalizeEnv(env.EXPO_PUBLIC_PETAK_ENV ?? env.PETAK_APP_ENV ?? env.APP_ENV);
  return PROFILES[key];
}

// What build am I? (C112)
//
// The founder, looking at Settings: "why the app version is showing as v0.1.0
// (20), is this correct?" — and then the sharper one: "if we all version number
// be v 0.1.0 (200++) that will be fucking stupid."
//
// Both land on the same gap. The app showed `v0.1.0` and nothing else, so it
// could not tell build 19 from 20 from 21 — the exact ambiguity that had a
// whole evening spent guessing which build was installed. And the version was
// a manual step with no defined trigger, so it would have sat at 0.1.0 while
// the build counter climbed.
//
// The version now moves (tools/changelog.mjs bump, derived from the changelog)
// and this puts the PAIR where a person looks: `0.1.0 (20)` in Settings, and on
// every Tell Ollie report so a bug arrives already knowing which build it came
// from.
//
// Read from the config the BUNDLE was built with — no new dependency, and the
// same values app.config.ts set at build time.

export interface BuildIdentitySource {
  version?: string | null;
  ios?: { buildNumber?: string | null } | null;
  android?: { versionCode?: number | null } | null;
}

/**
 * `0.1.0 (20)`, or `0.1.0` when there is no build number.
 *
 * A local dev build genuinely has no number — Expo leaves it unset so it cannot
 * collide with a real one — and inventing a "(1)" there would be worse than
 * saying nothing: it would look like a real build.
 */
export function buildIdentity(config: BuildIdentitySource | null | undefined): string {
  const version = config?.version?.trim();
  if (!version) return '—'; // no config at all: say so rather than guess
  const build = config?.ios?.buildNumber ?? config?.android?.versionCode;
  return build === undefined || build === null || build === '' ? version : `${version} (${build})`;
}

/** The same pair for a bug report — machine-ish rather than display. */
export function buildIdentityForReport(config: BuildIdentitySource | null | undefined): {
  app_version: string;
  build_number: string | null;
} {
  const version = config?.version?.trim() ?? '—';
  const build = config?.ios?.buildNumber ?? config?.android?.versionCode;
  return {
    app_version: version,
    build_number: build === undefined || build === null || build === '' ? null : String(build),
  };
}

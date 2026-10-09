// Reads the app version from its package and validates optional build numbers.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Android's hard ceiling. iOS has no equivalent limit, but one shared counter
// means one shared bound — the smaller of the two is the real one.
const MAX_BUILD_NUMBER = 2_100_000_000;

/** The release version, from the one file that owns it. */
function getAppVersion(packageJsonPath = join(__dirname, '..', 'package.json')) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const version = pkg.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`apps/app/package.json version must be x.y.z — got ${JSON.stringify(version)}`);
  }
  return version;
}

/** Shared validation: a build number is a positive integer under the ceiling. */
function parseBuildNumber(raw, name) {
  if (raw === undefined || raw === '') return undefined; // local build — Expo's default
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_BUILD_NUMBER) {
    throw new Error(`${name} must not exceed ${MAX_BUILD_NUMBER}`);
  }
  return value;
}

/** Android wants a number. */
function getAndroidVersionCode(env = process.env) {
  return parseBuildNumber(env.PETAK_BUILD_NUMBER ?? env.PETAK_ANDROID_VERSION_CODE, 'PETAK_BUILD_NUMBER');
}

/** iOS wants the same value as a STRING — CFBundleVersion is a string, and
 *  Expo passes it through verbatim. */
function getIosBuildNumber(env = process.env) {
  const value = parseBuildNumber(env.PETAK_BUILD_NUMBER ?? env.PETAK_IOS_BUILD_NUMBER, 'PETAK_BUILD_NUMBER');
  return value === undefined ? undefined : String(value);
}

module.exports = { getAppVersion, getAndroidVersionCode, getIosBuildNumber, MAX_BUILD_NUMBER };

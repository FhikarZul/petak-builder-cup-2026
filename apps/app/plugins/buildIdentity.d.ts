export function getAppVersion(packageJsonPath?: string): string;
export function getAndroidVersionCode(env?: Record<string, string | undefined>): number | undefined;
export function getIosBuildNumber(env?: Record<string, string | undefined>): string | undefined;
export const MAX_BUILD_NUMBER: number;

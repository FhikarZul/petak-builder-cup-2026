import { expect, it } from 'vitest';
import { compileModsAsync, withPlugins } from 'expo/config-plugins';
import config from '../app.config';

it('generates photo permissions without microphone access', async () => {
  const app = config({ config: { name: 'Petak', slug: 'petak', _internal: { projectRoot: process.cwd() } }, projectRoot: process.cwd(), staticConfigPath: null, packageJsonPath: 'package.json' });
  // Execute the actual configured permission plugins without generating a native project.
  const plugins = app.plugins!.filter((p): p is [string, Record<string, unknown>] => Array.isArray(p) && ['expo-image-picker', 'expo-media-library'].includes(p[0] as string));
  const generated = await compileModsAsync(withPlugins({ ...app, plugins: [] }, plugins), {
    projectRoot: process.cwd(), platforms: ['ios'], introspect: true,
  });
  const plist = generated.ios!.infoPlist!;
  expect(plist.NSMicrophoneUsageDescription).toBeUndefined();
  expect(plist.NSCameraUsageDescription).toBeTruthy();
  expect(plist.NSPhotoLibraryUsageDescription).toBeTruthy();
  expect(plist.NSPhotoLibraryAddUsageDescription).toBeTruthy();
});

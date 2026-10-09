import type { ConfigContext, ExpoConfig } from 'expo/config';
import profiles from './app.profiles.json';
import { getAndroidVersionCode, getAppVersion, getIosBuildNumber } from './plugins/buildIdentity';

type PetakAppEnv = 'qa' | 'prod';

interface PetakAppProfile {
  env: PetakAppEnv;
  name: string;
  slug: string;
  scheme: string;
  iosBundleIdentifier: string;
  androidPackage: string;
}

function getProfile(): PetakAppProfile {
  const value = process.env.EXPO_PUBLIC_PETAK_ENV ?? process.env.PETAK_APP_ENV ?? process.env.APP_ENV;
  if (value === undefined || value === '' || value === 'qa') return profiles.qa as PetakAppProfile;
  if (value === 'prod' || value === 'production') return profiles.prod as PetakAppProfile;
  throw new Error(`Unsupported Petak app environment: ${value}`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = getProfile();

  const expoConfig = {
    ...config,
    name: profile.name,
    slug: profile.slug,
    // C112 — ONE source, apps/app/package.json. It was hardcoded here while
    // package.json said 0.0.0, and the two had already drifted.
    version: getAppVersion(),
    orientation: 'portrait',
    scheme: profile.scheme,
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    icon: '../../packages/assets/logo/app-icon.png',
    ios: {
      supportsTablet: false,
      usesAppleSignIn: true,
      bundleIdentifier: profile.iosBundleIdentifier,
      // The same counter Android uses. Without this every iOS build claimed
      // build "1" and the second TestFlight upload of a version would have
      // been rejected (internal-reference).
      buildNumber: getIosBuildNumber(),
      icon: '../../packages/assets/logo/app-icon.png',
    },
    android: {
      package: profile.androidPackage,
      versionCode: getAndroidVersionCode(),
      icon: '../../packages/assets/logo/app-icon.png',
      adaptiveIcon: {
        foregroundImage: '../../packages/assets/logo/app-icon-foreground.png',
        backgroundColor: '#F7F2E7',
      },
      allowBackup: false,
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    },
    plugins: [
      'expo-router',
      'expo-apple-authentication',
      'expo-secure-store',
      'expo-font',
      [
        'expo-share-intent',
        {
          androidIntentFilters: ['image/*', 'application/pdf'],
          androidMultiIntentFilters: ['image/*'],
          iosActivationRules: {
            NSExtensionActivationSupportsImageWithMaxCount: 100,
            NSExtensionActivationSupportsFileWithMaxCount: 1,
          },
          iosShareExtensionName: 'Share to Petak',
          iosHideView: true,
        },
      ],
      [
        'expo-image-picker',
        {
          microphonePermission: false,
          cameraPermission: 'Allow Petak to use your camera to send a photo.',
          photosPermission: 'Allow Petak to pick photos from your library to send them.',
        },
      ],
      [
        'expo-media-library',
        {
          // WRITE only. Petak never READS the library through this plugin —
          // picking a photo to send goes through expo-image-picker, which asks
          // separately. The one thing this grants is saving a photo the user
          // already sent, which is the only way to get a camera capture OUT of
          // Petak: launchCameraAsync writes to the app cache, not the roll
          // (Run A #8, founder ruling 4 Sep).
          savePhotosPermission: 'Allow Petak to save a photo you sent back to your photo library.',
          isAccessMediaLocationEnabled: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  };
  return expoConfig as ExpoConfig;
};

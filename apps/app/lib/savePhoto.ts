// Run A #8's download, ruled 4 Sep 2026.
//
// Why this exists at all: a photo taken in Petak's camera lives NOWHERE ELSE.
// launchCameraAsync is called without saveToPhotos, so the capture goes to the
// app's cache and never to the camera roll. Share does not close the gap — it
// is handed a presigned REMOTE url, which iOS treats as a link rather than
// image data, so "Save Image" is not reliably in that sheet. Download is the
// only way a user gets their own photo back.
//
// The permission asked for is WRITE ONLY. Petak never reads the library here;
// picking a photo to send is expo-image-picker's separate prompt.
//
// Both native modules are imported LAZILY, matching pickDocument(): an APK
// installed before this shipped has no native side, and a missing module must
// degrade to an honest line, never a crash.

export type SavePhotoOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string };

/** The four things that can happen, and the exact words for each. Pure, so the
 *  wording is pinned by test rather than discovered on a device. */
export const SAVE_PHOTO_LINES = {
  saved: 'Saved to your photos.',
  denied: 'Petak needs permission to save to your photos. You can turn it on in Settings.',
  unavailable: 'Saving needs the latest app build.',
  failed: 'That did not save. Try again in a moment.',
} as const;

export function savedLine(): SavePhotoOutcome {
  return { ok: true, message: SAVE_PHOTO_LINES.saved };
}
export function deniedLine(): SavePhotoOutcome {
  return { ok: false, message: SAVE_PHOTO_LINES.denied };
}
export function unavailableLine(): SavePhotoOutcome {
  return { ok: false, message: SAVE_PHOTO_LINES.unavailable };
}
export function failedLine(): SavePhotoOutcome {
  return { ok: false, message: SAVE_PHOTO_LINES.failed };
}

/**
 * Download a remote photo and save it to the camera roll.
 *
 * The url is presigned and expires, so it is fetched to the cache first and
 * saved from disk — MediaLibrary cannot take a remote url. The cache copy is
 * left for the OS to reap: deleting it here would race the save on Android,
 * where the library keeps a reference until the scan completes.
 */
export async function savePhotoToLibrary(remoteUrl: string): Promise<SavePhotoOutcome> {
  // The LEGACY subpath, deliberately. In SDK 57 `saveToLibraryAsync` imported
  // from the package root is a deprecation stub that THROWS at runtime — it
  // typechecks, so nothing catches it before a device does, and the failure
  // would have looked like a permanent "that did not save". The deprecation
  // message names `expo-media-library/legacy` as the supported import; the
  // class-based `Asset.create()` is the other route and is worth moving to
  // when this file is next opened.
  let MediaLibrary: typeof import('expo-media-library/legacy');
  let FS: typeof import('expo-file-system');
  try {
    MediaLibrary = await import('expo-media-library/legacy');
    FS = await import('expo-file-system');
  } catch {
    return unavailableLine();
  }

  try {
    // writeOnly: Petak is saving, never browsing. On iOS this is the
    // "Add Photos Only" prompt, which is the smaller ask of the two.
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return deniedLine();

    const file = await FS.File.downloadFileAsync(remoteUrl, FS.Paths.cache);
    await MediaLibrary.saveToLibraryAsync(file.uri);
    return savedLine();
  } catch {
    // A network drop, an expired presign, or a native module that imported but
    // is absent underneath. One honest line covers all three; the user's
    // recourse is identical.
    return failedLine();
  }
}

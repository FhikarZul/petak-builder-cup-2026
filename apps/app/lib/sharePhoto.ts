import { apiFetch } from './api';

export const SHARE_PHOTO_FAILED = "That photo couldn't be shared. Try again.";
const SHARE_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

type ImageFormat = { extension: string; mimeType: string; UTI: string };
function imageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return { extension: 'jpg', mimeType: 'image/jpeg', UTI: 'public.jpeg' };
  }
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) {
    return { extension: 'png', mimeType: 'image/png', UTI: 'public.png' };
  }
  if ([82, 73, 70, 70].every((byte, i) => bytes[i] === byte)
    && [87, 69, 66, 80].every((byte, i) => bytes[i + 8] === byte)) {
    return { extension: 'webp', mimeType: 'image/webp', UTI: 'org.webmproject.webp' };
  }
  return null;
}

/** Share the original image bytes through the native file API. A caption is
 * intentionally not sent as a separate text share: Expo's file API has no
 * caption field, and Android's text API ignores a remote image URL.
 *
 * Cache files survive the sheet closing because recipients can read them
 * later on Android. Only files older than a day are removed on a later share.
 * No new read or capture is created, and no image is re-encoded. */
export async function sharePhoto(viewer: { uri: string; caption: string; photoId?: string | null }): Promise<void> {
  // Lazy imports let an older installed binary fail into the retry feedback.
  const [Sharing, FS, Crypto, { ImageManipulator }] = await Promise.all([
    import('expo-sharing'), import('expo-file-system'), import('expo-crypto'), import('expo-image-manipulator'),
  ]);
  if (!await Sharing.isAvailableAsync()) throw new Error('Native sharing is unavailable');
  const cache = new FS.Directory(FS.Paths.cache, 'petak-shares');
  cache.create({ idempotent: true, intermediates: true });
  for (const item of cache.list()) {
    if (!(item instanceof FS.File)) continue;
    // Copying can preserve a source photo's mtime (including 1970). Only our
    // own creation timestamp says how long a recipient has had this file.
    const createdAt = item.uri.split('/').pop()?.match(/^(\d{13})-/)?.[1];
    if (createdAt && Number(createdAt) < Date.now() - SHARE_CACHE_AGE_MS) {
      try { item.delete(); } catch { /* stale-cache cleanup must not block sharing */ }
    }
  }
  const id = `${Date.now()}-${Crypto.randomUUID()}`;
  const downloaded = new FS.File(cache, `${id}.download`);
  let file: import('expo-file-system').File | null = null;
  let recipientStarted = false;
  try {
    const remote = /^https?:\/\//i.test(viewer.uri);
    let uri = viewer.uri;
    if (remote && viewer.photoId) {
      // The viewer may have stayed open beyond the presigned URL's expiry.
      uri = (await apiFetch<{ image_url: string }>(`/v1/photos/${viewer.photoId}`)).image_url;
    }
    if (remote) await FS.File.downloadFileAsync(uri, downloaded);
    else await new FS.File(uri).copy(downloaded);

    const handle = downloaded.open(FS.FileMode.ReadOnly);
    let format: ImageFormat | null;
    try { format = imageFormat(handle.readBytes(16)); } finally { handle.close(); }
    if (!format) throw new Error('The shared file is not a supported image');
    file = new FS.File(cache, `${id}.${format.extension}`);
    await downloaded.copy(file);
    downloaded.delete();
    const ctx = ImageManipulator.manipulate(file.uri);
    try {
      const decoded = await ctx.renderAsync();
      try {
        if (!Number.isFinite(decoded.width) || !Number.isFinite(decoded.height) || decoded.width <= 0 || decoded.height <= 0) {
          throw new Error('The shared image could not be decoded');
        }
      } finally { decoded.release(); }
    } finally { ctx.release(); }
    // Resolving the sheet also includes cancellation; never claim delivery.
    recipientStarted = true;
    await Sharing.shareAsync(file.uri, { mimeType: format.mimeType, UTI: format.UTI });
  } finally {
    // Before the native sheet starts, nobody can be using these temporary
    // files. Afterwards retain the shared file, even if the native call fails.
    for (const temporary of recipientStarted ? [downloaded] : [downloaded, file]) {
      try { if (temporary?.exists) temporary.delete(); } catch { /* preserve the original result */ }
    }
  }
}

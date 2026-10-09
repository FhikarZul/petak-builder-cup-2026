import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  share: vi.fn(), legacyShare: vi.fn(), available: vi.fn(), download: vi.fn(), api: vi.fn(),
  decode: vi.fn(), close: vi.fn(), counter: 0,
  files: new Map<string, { bytes: Uint8Array; at: number }>(),
}));
vi.mock('react-native', () => ({ Share: { share: mocks.legacyShare } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => `share-${++mocks.counter}` }));
vi.mock('expo-sharing', () => ({ shareAsync: mocks.share, isAvailableAsync: mocks.available }));
vi.mock('./api', () => ({ apiFetch: mocks.api }));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: () => ({ renderAsync: mocks.decode, release: vi.fn() }) } }));
vi.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map((p) => typeof p === 'string' ? p : p.uri).join('/'); }
    get exists() { return mocks.files.has(this.uri); }
    get modificationTime() { return mocks.files.get(this.uri)?.at ?? null; }
    delete() { mocks.files.delete(this.uri); }
    open() { return { readBytes: (n: number) => mocks.files.get(this.uri)!.bytes.slice(0, n), close: mocks.close }; }
    async copy(out: File) { await Promise.resolve(); mocks.files.set(out.uri, { ...mocks.files.get(this.uri)! }); }
    static downloadFileAsync = mocks.download;
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map((p) => typeof p === 'string' ? p : p.uri).join('/'); }
    create() {}
    list() { return [...mocks.files.keys()].filter((uri) => uri.startsWith(`${this.uri}/`)).map((uri) => new File(uri)); }
  }
  return { File, Directory, FileMode: { ReadOnly: 'r' }, Paths: { cache: 'file:///cache' } };
});
import { sharePhoto } from './sharePhoto';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);
const WEBP = new Uint8Array([82, 73, 70, 70, 10, 0, 0, 0, 87, 69, 66, 80, 1, 2]);
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.resetAllMocks(); mocks.files.clear(); mocks.counter = 0;
  mocks.available.mockResolvedValue(true);
  mocks.decode.mockResolvedValue({ width: 800, height: 600, release: vi.fn() });
  mocks.share.mockResolvedValue(undefined);
  mocks.download.mockImplementation(async (_url, file) => { mocks.files.set(file.uri, { bytes: JPEG, at: Date.now() }); return file; });
});

describe('outbound photo sharing', () => {
  it.each(['', 'Lunch receipt'])('shares image bytes for caption %j, not an empty text/remote URL', async (caption) => {
    await sharePhoto({ uri: 'https://photos.test/presigned', caption });
    expect(mocks.share).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/petak-shares\/.*\.jpg$/), { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
    const sharedUri = mocks.share.mock.calls[0][0];
    expect(mocks.files.get(sharedUri)?.bytes).toEqual(JPEG);
    expect(mocks.legacyShare).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it.each([[PNG, 'png', 'image/png', 'public.png'], [WEBP, 'webp', 'image/webp', 'org.webmproject.webp']] as const)(
    'uses actual bytes rather than the remote extension', async (bytes, ext, mimeType, UTI) => {
      mocks.download.mockImplementationOnce(async (_url, file) => { mocks.files.set(file.uri, { bytes, at: Date.now() }); return file; });
      await sharePhoto({ uri: 'https://photos.test/wrong.jpg', caption: '' });
      expect(mocks.share).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`\\.${ext}$`)), { mimeType, UTI });
      expect(mocks.files.get(mocks.share.mock.calls[0][0])?.bytes).toEqual(bytes);
    },
  );

  it('refreshes a photo URL before downloading so an expired viewer URL can recover', async () => {
    mocks.api.mockResolvedValue({ image_url: 'https://photos.test/fresh' });
    await sharePhoto({ uri: 'https://photos.test/expired', caption: '', photoId: 'photo-id' });
    expect(mocks.api).toHaveBeenCalledWith('/v1/photos/photo-id');
    expect(mocks.download).toHaveBeenCalledWith('https://photos.test/fresh', expect.anything());
  });

  it('copies a local file and awaits the copy before presenting the share sheet', async () => {
    mocks.files.set('file:///picked.heic', { bytes: PNG, at: Date.now() });
    await sharePhoto({ uri: 'file:///picked.heic', caption: '' });
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.files.get(mocks.share.mock.calls[0][0])?.bytes).toEqual(PNG);
    expect(mocks.files.has('file:///picked.heic')).toBe(true);
  });

  it('keeps the shared file after the sheet closes and cleans only old cache files on a later attempt', async () => {
    const old = `file:///cache/petak-shares/${Date.now() - 2 * 86400000}-old.jpg`;
    mocks.files.set(old, { bytes: JPEG, at: Date.now() - 2 * 86400000 });
    await sharePhoto({ uri: 'https://photos.test/a', caption: '' });
    const firstUri = mocks.share.mock.calls[0][0];
    expect(mocks.files.has(old)).toBe(false);
    expect(mocks.files.has(firstUri)).toBe(true);
    await sharePhoto({ uri: 'https://photos.test/b', caption: '' });
    expect(mocks.files.has(firstUri)).toBe(true);
  });

  it('retains a fresh share of an old local photo until 24 hours after sharing, not its copied mtime', async () => {
    const sharedAt = 1_800_000_000_000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(sharedAt);
    mocks.files.set('file:///old-camera.jpg', { bytes: JPEG, at: 0 });
    await sharePhoto({ uri: 'file:///old-camera.jpg', caption: '' });
    const firstUri = mocks.share.mock.calls[0][0];
    expect(mocks.files.get(firstUri)?.at).toBe(0); // Foundation preserves the source mtime.
    now.mockReturnValue(sharedAt + 3600000);
    await sharePhoto({ uri: 'https://photos.test/second', caption: '' });
    expect(mocks.files.has(firstUri)).toBe(true);
    now.mockReturnValue(sharedAt + 86400001);
    await sharePhoto({ uri: 'https://photos.test/third', caption: '' });
    expect(mocks.files.has(firstUri)).toBe(false);
    expect(mocks.files.has('file:///old-camera.jpg')).toBe(true);
  });

  it('does not share an HTML/error response or a file the native decoder rejects', async () => {
    mocks.download.mockImplementationOnce(async (_url, file) => { mocks.files.set(file.uri, { bytes: new TextEncoder().encode('<html>denied'), at: Date.now() }); return file; });
    await expect(sharePhoto({ uri: 'https://photos.test/a', caption: '' })).rejects.toThrow();
    expect(mocks.files.size).toBe(0);
    mocks.decode.mockRejectedValueOnce(new Error('invalid image'));
    await expect(sharePhoto({ uri: 'https://photos.test/b', caption: '' })).rejects.toThrow();
    expect(mocks.files.size).toBe(0);
    expect(mocks.share).not.toHaveBeenCalled();
  });

  it('allows retry after download failure and treats a dismissed native sheet as no error', async () => {
    mocks.download.mockRejectedValueOnce(new Error('network'));
    await expect(sharePhoto({ uri: 'https://photos.test/a', caption: '' })).rejects.toThrow('network');
    await expect(sharePhoto({ uri: 'https://photos.test/a', caption: '' })).resolves.toBeUndefined();
    expect(mocks.share).toHaveBeenCalledOnce();
  });

  it('fails without downloading when native sharing is unavailable', async () => {
    mocks.available.mockResolvedValue(false);
    await expect(sharePhoto({ uri: 'https://photos.test/a', caption: '' })).rejects.toThrow();
    expect(mocks.download).not.toHaveBeenCalled();
  });
});

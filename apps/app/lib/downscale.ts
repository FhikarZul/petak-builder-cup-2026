// Photo downscale before upload (founder, 27 Aug 2026).
//
// The app was sending FULL-RESOLUTION camera photos: `quality: 0.85` is JPEG
// compression only, it does not touch the dimensions. A modern phone photo is
// 4032x3024 (12MP) and a Pro is 8064x6048 — roughly 2-4 MB and 8-15 MB
// respectively, per photo, for something the vision model downsamples on
// arrival anyway.
//
// Three reasons this matters, in order of how much:
//   1. UPLOADS FAIL. A 4 MB PUT on patchy mobile data is the single most
//      likely thing to strand a capture. C18's retry machinery exists; a
//      smaller file simply succeeds more often.
//   2. STORAGE IS FOREVER and photos are UNCAPPED (C41). Twenty photos a day
//      at 3 MB is ~22 GB per user per year, kept indefinitely.
//   3. The pixels are DISCARDED anyway — vision models resize internally to
//      around one to two megapixels before they look at anything.
//
// THE RISK, and why the cap is not lower: RECEIPTS. Line items in small
// thermal print are the one case where too small is a CORRECTNESS bug, not a
// quality one — Penny's numbers come from that text. 2048 on the long edge
// keeps a full-frame receipt legible while cutting a 12MP photo by ~6x.
//
// This module is PURE so the decision is unit-tested; the resize itself lives
// in captureRun.ts beside the other impure work.

/** Long edge, in pixels, that a photo is reduced to before upload. */
export const LONG_EDGE_CAP = 2048;
/** JPEG quality for the re-encode. Applied when resizing or converting a non-JPEG. */
export const DOWNSCALE_QUALITY = 0.8;

export interface Size {
  width: number;
  height: number;
}

/**
 * The size to resize to, or NULL when the photo should be left alone.
 *
 * Never upscales: a photo already under the cap is uploaded untouched, so a
 * small screenshot is not re-encoded (and degraded) for nothing.
 */
export function targetSize(size: Size, cap: number = LONG_EDGE_CAP): Size | null {
  const { width, height } = size;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !(width > 0) || !(height > 0)) return null; // caller must decode unknown dimensions
  const longEdge = Math.max(width, height);
  if (longEdge <= cap) return null;
  const scale = cap / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

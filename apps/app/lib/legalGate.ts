export interface LegalGateStatus {
  is_reviewer: boolean;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
}

export function shouldBlockForLegal(status: LegalGateStatus): boolean {
  if (status.is_reviewer) return false;
  return !status.terms_accepted_at || !status.privacy_accepted_at;
}

// --- reading the documents, not just ticking a box (6 Sep 2026) -------------
//
// The consent screen used to enable its checkbox the moment it opened, so both
// documents could be accepted in one tap with neither having been on screen.
// The founder: "they need to scroll to the bottom for both of them before they
// can click accept."
//
// These live here rather than in the component because this repo tests pure
// logic and not RN trees — and because the two edge cases below are exactly the
// sort that are easy to get wrong and invisible by eye.

/** How close to the bottom still counts as the end. Demanding the last exact
 *  pixel makes the button feel broken on a device with any bounce. */
export const SCROLL_END_SLOP = 24;

/**
 * Has this scroll position reached the end of the document?
 *
 * The short-document case is the one that bites: a text shorter than the
 * viewport can never be scrolled, so waiting for a scroll event would leave
 * Accept disabled forever on a tall phone.
 */
export function hasReachedEnd(m: {
  viewportHeight: number;
  contentHeight: number;
  scrollOffset: number;
}): boolean {
  if (m.viewportHeight <= 0) return false; // not laid out yet — decide nothing
  if (m.contentHeight <= m.viewportHeight + SCROLL_END_SLOP) return true; // nothing to scroll
  return m.scrollOffset + m.viewportHeight >= m.contentHeight - SCROLL_END_SLOP;
}

/** Accept is live only when BOTH documents have been read to the end. */
export function canAcceptLegal(read: { terms: boolean; privacy: boolean }): boolean {
  return read.terms && read.privacy;
}

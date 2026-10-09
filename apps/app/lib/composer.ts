// lib/composer.ts — the composer's right-hand button state machine (the
// photo-first rework, 3 Sep 2026) and the focus transitions that drive it.
// PURE module, node environment.
//
// The 44px right-hand button:
//   content (text typed or attachment) → Indigo send arrow
//   else focused                        → send arrow (a disabled-styled no-op)
//   else                                → the camera, which opens IMMEDIATELY
//
// The REVERT half of the machine: blur AND keyboard hide both end the focused
// state. On device, tapping the feed does not reliably blur the TextInput
// (the keyboard may stay up or the field keeps focus), but the keyboard
// closing IS the field losing its turn — so keyboardDidHide is an explicit
// transition here, not an accident of the platform.

/** The focus events the Composer reacts to. */
export type ComposerFocusEvent = 'focus' | 'blur' | 'keyboardHide';

/** Every event except 'focus' ends the focused state. */
export function nextFocused(_focused: boolean, event: ComposerFocusEvent): boolean {
  return event === 'focus';
}

/** The right button: camera only when there is nothing to send AND the
 *  keyboard is down; the send arrow in every other state. */
export function rightButton(focused: boolean, canSend: boolean): 'camera' | 'send' {
  return canSend || focused ? 'send' : 'camera';
}

/** What the field asks for, given what is waiting to be sent (6 Sep 2026).
 *
 *  Founder: "when we are taking photo i would like to have textbox at the photo
 *  UI (so as i take photo - i can type things)… i want to streamline the
 *  process." The field now focuses itself when a photo lands, and it says what
 *  it is for while one is attached — the caption is extraction CONTEXT (C53),
 *  not decoration, so it is worth naming rather than leaving as "Message…".
 *
 *  "optional" is in the words on purpose. Most photos will not carry a caption
 *  and the send button is already live without one; a field that appears with
 *  the keyboard could otherwise read as something that must be filled in.
 *
 *  CLAUDE.md's rule — the placeholder is "Message…", never "Message Ollie…" —
 *  is about never naming a neighbour, since whoever's domain it is answers.
 *  Nobody is named here.
 */
export function composerPlaceholder(state: { hasAttachment: boolean; hasMentionChips: boolean }): string {
  // A mention chip already fills the row; a placeholder beside it is clutter.
  if (state.hasMentionChips) return '';
  if (state.hasAttachment) return 'Say something about it — optional';
  return 'Message…';
}

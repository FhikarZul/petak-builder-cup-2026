// lib/composer.ts — the right-button state machine across focus/blur/
// keyboard-hide transitions. PURE module, node environment.
import { describe, expect, it } from 'vitest';
import { nextFocused, rightButton, composerPlaceholder} from './composer';

describe('nextFocused', () => {
  it('focus enters the focused state', () => {
    expect(nextFocused(false, 'focus')).toBe(true);
  });
  it('blur ends the focused state', () => {
    expect(nextFocused(true, 'blur')).toBe(false);
  });
  it('keyboard hide ends the focused state even when blur never fired', () => {
    // The 3 Sep bug: tapping away does not reliably blur the TextInput, so
    // the button stayed "send" forever. The keyboard closing IS the field
    // losing its turn.
    expect(nextFocused(true, 'keyboardHide')).toBe(false);
  });
  it('blur on an unfocused composer stays unfocused', () => {
    expect(nextFocused(false, 'blur')).toBe(false);
  });
});

describe('rightButton', () => {
  it('empty + unfocused → camera', () => {
    expect(rightButton(false, false)).toBe('camera');
  });
  it('empty + focused → send arrow (a no-op tap)', () => {
    expect(rightButton(true, false)).toBe('send');
  });
  it('content → send arrow, focused or not', () => {
    expect(rightButton(true, true)).toBe('send');
    expect(rightButton(false, true)).toBe('send');
  });
  it('a full focus cycle returns to the camera', () => {
    let focused = nextFocused(false, 'focus');
    expect(rightButton(focused, false)).toBe('send');
    focused = nextFocused(focused, 'blur');
    expect(rightButton(focused, false)).toBe('camera');
    focused = nextFocused(true, 'keyboardHide');
    expect(rightButton(focused, false)).toBe('camera');
  });
});

describe('what the field asks for', () => {
  it('says what a caption is for while a photo is waiting', () => {
    // 6 Sep 2026 — the field now focuses itself when a photo lands, so it
    // arrives unannounced. Saying what it wants is the difference between a
    // helpful keyboard and a surprising one.
    expect(composerPlaceholder({ hasAttachment: true, hasMentionChips: false })).toBe('Say something about it — optional');
  });

  it('says "optional" out loud, because it is', () => {
    // Most photos carry no caption and send is already live without one. A
    // field that appears with the keyboard could otherwise read as required.
    expect(composerPlaceholder({ hasAttachment: true, hasMentionChips: false })).toContain('optional');
  });

  it('is the plain "Message…" the rest of the time', () => {
    expect(composerPlaceholder({ hasAttachment: false, hasMentionChips: false })).toBe('Message…');
  });

  it('names no neighbour, ever — whoever\'s domain it is answers', () => {
    // CLAUDE.md: the placeholder is "Message…", never "Message Ollie…".
    for (const state of [
      { hasAttachment: true, hasMentionChips: false },
      { hasAttachment: false, hasMentionChips: false },
      { hasAttachment: true, hasMentionChips: true },
    ]) {
      const p = composerPlaceholder(state).toLowerCase();
      for (const n of ['ollie', 'penny', 'milo', 'mira', 'tally']) expect(p).not.toContain(n);
    }
  });

  it('steps aside for a mention chip, which already fills the row', () => {
    expect(composerPlaceholder({ hasAttachment: false, hasMentionChips: true })).toBe('');
    expect(composerPlaceholder({ hasAttachment: true, hasMentionChips: true })).toBe('');
  });
});

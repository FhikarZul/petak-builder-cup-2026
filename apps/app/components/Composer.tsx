// Composer (plan §5 + the C19 reference strip from §7), Run A #15/#16/#33.
// - Placeholder is exactly "Message…" (canon) — never "Message Ollie…".
// - The field grows to four lines, then scrolls (mirror #16, max 132px).
// - PHOTO-FIRST (founder ruling, 3 Sep 2026): a paperclip sits INSIDE the
//   field's left edge and opens the attach sheet (photos, PDF, and the
//   camera only while the keyboard is up). The 44px right-hand button is a
//   state machine: content (text typed or attachment) → Indigo send arrow;
//   else focused → send arrow (a no-op tap); else → the camera, which opens
//   the camera IMMEDIATELY, no sheet.
// - A picked photo shows as a thumbnail INSIDE the field, a document as a
//   chip, so an attachment and its caption go together in one send; the
//   photo carries the chips + text as ordinary wire text (C53).
// - Typing @ raises the neighbour panel above the composer; a pick rides as
//   an accent-left-bordered chip (sprite + name) at the front of the input.
//   Canon: @ is a shortcut, never syntax — a plain name mid-sentence needs
//   no chip, so the picker only triggers on a leading @ token.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NEIGHBOURS, type NeighbourId } from '../lib/neighbours';
import { serializeSegments, type Segment } from '../lib/mentions';
import { nextFocused, rightButton, composerPlaceholder} from '../lib/composer';
import { useTheme } from '../lib/theme';
import { Icon } from './Icon';

/** Display-ready form of the pinned C19 reference (resolved by the screen). */
export interface ComposerReference {
  /** "Replying to {name}" — the neighbour's name, or "you". */
  name: string;
  /** Text excerpt, or "your photo · {time}" for a photo message. */
  excerpt: string;
  /** Owner's 2px domain border — borderEmphasis when the owner is the user (the user has no colour). */
  accent: string;
  /** Photo thumbnail when the referenced message carries one. */
  photoUri: string | null;
}

const MAX_FIELD_HEIGHT = 132; // mirror #16 — four lines, then it scrolls

/** The draft a photo pick carries: the mention chips + the typed caption. */
export interface ComposerDraft {
  chips: NeighbourId[];
  text: string;
}

/** A photo waiting in the composer for its caption + the send tap. */
export interface ComposerPhotoDraft {
  /** Local uri of the first picked asset (the thumbnail). */
  uri: string;
  /** More than one picked asset — shown as a count badge on the thumbnail. */
  count: number;
}

/** A document waiting in the composer for its caption + the send tap. */
export interface ComposerDocumentDraft {
  /** Display filename (the chip's label). */
  name: string;
}

export function Composer({
  pickerOrder,
  initialText = '',
  initialChips = [],
  reference,
  photoDraft,
  documentDraft,
  onClearReference,
  onRemovePhoto,
  onRemoveDocument,
  onSend,
  onSendPhoto,
  onAttach,
  onCamera,
  onFocusChange,
}: {
  pickerOrder: NeighbourId[];
  /** Optional draft supplied by a dashboard action; it is local until sent. */
  initialText?: string;
  initialChips?: NeighbourId[];
  reference: ComposerReference | null;
  /** A picked photo waiting to send — renders a thumbnail inside the field. */
  photoDraft: ComposerPhotoDraft | null;
  /** A picked document waiting to send — renders a chip inside the field. */
  documentDraft?: ComposerDocumentDraft | null;
  onClearReference: () => void;
  onRemovePhoto: () => void;
  onRemoveDocument?: () => void;
  onSend: (wireText: string) => void;
  /** Sends the attachment with the current chips + text as its caption. */
  onSendPhoto: (chips: NeighbourId[], text: string) => void;
  /** Opens the attach sheet (the paperclip). */
  onAttach?: () => void;
  /** The right-button camera: opens the camera IMMEDIATELY, no sheet. */
  onCamera?: () => void;
  /** The screen mirrors focus — the attach sheet shows "Take a photo" only
   *  while the keyboard is up (the unfocused composer has its own camera
   *  button instead). */
  onFocusChange?: (focused: boolean) => void;
}) {
  const t = useTheme();
  const [chips, setChips] = useState<NeighbourId[]>(initialChips);
  const [text, setText] = useState(initialText);
  const appliedInitial = useRef<string | null>(initialText || null);
  useEffect(() => {
    const key = `${initialText}|${initialChips.join(',')}`;
    if (!initialText && initialChips.length === 0) return;
    if (appliedInitial.current === key) return;
    appliedInitial.current = key;
    setText(initialText);
    setChips(initialChips);
  }, [initialText, initialChips]);
  const [focused, setFocused] = useState(false);

  // The picker rises on a leading @ token ("@", "@mi") and closes as soon as
  // the token is completed or abandoned (a space ends it).
  const pickerOpen = /^@\S*$/.test(text);

  const canSendText = text.trim().length > 0;
  const hasAttachment = photoDraft !== null || (documentDraft ?? null) !== null;
  const canSend = canSendText || hasAttachment;
  // The right button: camera only when there is nothing to send AND the
  // keyboard is down; the send arrow in every other state.
  const showCamera = rightButton(focused, canSend) === 'camera';

  // Tapping away on the feed does not reliably blur the TextInput (the
  // keyboard may stay or the field keeps focus), so onBlur alone left the
  // button stuck on "send". The keyboard closing IS the field losing its
  // turn — keyboardDidHide reverts the button even when blur never fired.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      setFocused((prev) => nextFocused(prev, 'keyboardHide'));
      onFocusChange?.(false);
    });
    return () => sub.remove();
  }, [onFocusChange]);

  // Take the photo, then type — one place, one send (6 Sep 2026).
  //
  // Founder: "when we are taking photo i would like to have textbox at the
  // photo UI (so as i take photo - i can type things). right now, i take photo,
  // i click okay, and then go to textbox and type and then click send. i want
  // to streamline the process."
  //
  // The composer ALREADY shows the attached photo and already takes the typed
  // words as its caption (C53). The whole friction was the "go to" — the camera
  // closed, the photo sat there, and the field waited to be found and tapped.
  // Focusing it the instant an attachment lands removes exactly that step: the
  // keyboard comes up with the photo in view above it.
  //
  // Fires on the TRANSITION to attached, not on every render — re-focusing a
  // field somebody has deliberately dismissed is its own annoyance.
  //
  // A caption stays optional. Most photos will not have one, and the send
  // button is already live the moment a photo is attached, so this costs
  // nothing to ignore: dismiss the keyboard and send.
  const inputRef = useRef<TextInput>(null);
  const wasAttached = useRef(false);
  useEffect(() => {
    if (hasAttachment && !wasAttached.current) inputRef.current?.focus();
    wasAttached.current = hasAttachment;
  }, [hasAttachment]);

  const insertMention = (id: NeighbourId) => {
    setChips((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setText('');
  };

  const removeChip = (id: NeighbourId) => setChips((prev) => prev.filter((c) => c !== id));

  const send = () => {
    if (!canSend) return;
    if (hasAttachment) {
      // Attachment-first: the photo or document is the message; the words
      // ride it as the caption (C53). The screen clears the attached draft.
      onSendPhoto(chips, text.trim());
      setChips([]);
      setText('');
      return;
    }
    if (!canSendText) return;
    const segments: Segment[] = [
      ...chips.map((id): Segment => ({ kind: 'mention', neighbour: id })),
      { kind: 'text', text: `${chips.length > 0 ? ' ' : ''}${text.trim()}` },
    ];
    onSend(serializeSegments(segments));
    setChips([]);
    setText('');
  };

  const pickerRows = useMemo(
    () => pickerOrder.map((id) => NEIGHBOURS[id]),
    [pickerOrder],
  );

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.color.borderStructure }}>
      {reference ? (
        <View style={styles.referenceRow}>
          <View
            style={[
              styles.referenceStrip,
              { borderLeftColor: reference.accent, backgroundColor: t.color.surfaceInset },
            ]}
          >
            {reference.photoUri ? (
              <Image source={{ uri: reference.photoUri }} style={styles.referenceThumb} />
            ) : null}
            <View style={styles.referenceText}>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontWeight: '500',
                  fontSize: 12.5,
                }}
              >
                Replying to {reference.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12.5,
                }}
              >
                {reference.excerpt}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onClearReference}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply reference"
          >
            <Icon name="close" size={20} color={t.color.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      {pickerOpen && pickerRows.length > 0 ? (
        <View style={{ backgroundColor: t.color.surfaceCard }}>
          <Text
            style={[
              styles.pickerLabel,
              {
                color: t.color.textSecondary,
                borderBottomColor: t.color.borderStructure,
                fontFamily: t.typography.textLabel.fontFamily,
                fontSize: t.typography.textLabel.fontSize,
                letterSpacing: 1,
              },
            ]}
          >
            YOUR NEIGHBOURS
          </Text>
          <ScrollView style={{ maxHeight: 4 * 48 }} keyboardShouldPersistTaps="handled">
            {pickerRows.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => insertMention(n.id)}
                accessibilityRole="button"
                accessibilityLabel={`Mention ${n.name}`}
                style={[styles.pickerRow, { borderLeftColor: t.color[n.domain] }]}
              >
                <Image
                  source={n.head}
                  style={[styles.pickerHead, { borderColor: t.color.borderStructure }]}
                />
                <View>
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontWeight: '500',
                      fontSize: 14,
                    }}
                  >
                    {n.name}
                  </Text>
                  <Text
                    style={{
                      color: t.color.textSecondary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontSize: 12.5,
                    }}
                  >
                    {n.descriptor}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <View
          style={[
            styles.field,
            {
              backgroundColor: t.color.surfaceCard,
              borderColor: t.color.borderStructure,
              maxHeight: MAX_FIELD_HEIGHT,
            },
          ]}
        >
          {onAttach ? (
            <Pressable
              onPress={onAttach}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Attach a photo or document"
              style={styles.attach}
            >
              <Icon name="attach_file" size={20} color={t.color.textSecondary} />
            </Pressable>
          ) : null}
          {photoDraft ? (
            <View style={[styles.photoChip, { borderColor: t.color.borderStructure }]}>
              <Image source={{ uri: photoDraft.uri }} style={styles.photoThumb} />
              {photoDraft.count > 1 ? (
                <View style={[styles.photoCount, { backgroundColor: t.color.textPrimary }]}>
                  <Text
                    style={{
                      color: t.color.surfacePage,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontWeight: '500',
                      fontSize: 10,
                    }}
                  >
                    {photoDraft.count}
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={onRemovePhoto}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                style={[styles.photoRemove, { backgroundColor: t.color.surfacePage, borderColor: t.color.borderStructure }]}
              >
                <Icon name="close" size={12} color={t.color.textPrimary} />
              </Pressable>
            </View>
          ) : null}
          {documentDraft ? (
            <View
              style={[
                styles.docChip,
                { borderColor: t.color.borderStructure, backgroundColor: t.color.surfacePage },
              ]}
            >
              <Icon name="description" size={16} color={t.color.textPrimary} />
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 13,
                }}
              >
                {documentDraft.name}
              </Text>
              <Pressable
                onPress={onRemoveDocument}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remove document"
              >
                <Icon name="close" size={14} color={t.color.textSecondary} />
              </Pressable>
            </View>
          ) : null}
          {chips.map((id) => {
            const n = NEIGHBOURS[id];
            return (
              <Pressable
                key={id}
                onPress={() => removeChip(id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove mention ${n.name}`}
                style={[
                  styles.chip,
                  {
                    borderColor: t.color.borderStructure,
                    borderLeftColor: t.color[n.domain],
                    backgroundColor: t.color.surfacePage,
                  },
                ]}
              >
                <Image source={n.head} style={styles.chipHead} />
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontWeight: '500',
                    fontSize: 14,
                  }}
                >
                  {n.name}
                </Text>
              </Pressable>
            );
          })}
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={composerPlaceholder({ hasAttachment, hasMentionChips: chips.length > 0 })}
            placeholderTextColor={t.color.textSecondary}
            multiline
            onFocus={() => {
              setFocused((prev) => nextFocused(prev, 'focus'));
              onFocusChange?.(true);
            }}
            onBlur={() => {
              setFocused((prev) => nextFocused(prev, 'blur'));
              onFocusChange?.(false);
            }}
            onKeyPress={({ nativeEvent }) => {
              // Backspace on an empty field pops the last mention chip.
              if (nativeEvent.key === 'Backspace' && text.length === 0 && chips.length > 0) {
                setChips((prev) => prev.slice(0, -1));
              }
            }}
            style={{
              flex: 1,
              minWidth: 96,
              padding: 0,
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 15,
              lineHeight: 23,
            }}
          />
        </View>
        {showCamera && onCamera ? (
          // Nothing to send and the keyboard is down: the camera, opening
          // IMMEDIATELY (no sheet — the sheet's camera row only appears while
          // the field is focused).
          <Pressable
            onPress={onCamera}
            accessibilityRole="button"
            accessibilityLabel="Take a photo"
            style={[styles.send, { backgroundColor: t.color.surfaceCard, borderWidth: 1, borderColor: t.color.borderStructure }]}
          >
            <Icon name="photo_camera" size={22} color={t.color.textPrimary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={hasAttachment ? 'Send attachment' : 'Send'}
            style={[
              styles.send,
              { backgroundColor: canSend ? t.color.interactive : t.color.disabledBg },
            ]}
          >
            <Icon name="arrow_upward" size={22} color={t.color.textOnInteractive} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  referenceStrip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderLeftWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 0,
  },
  referenceThumb: { width: 36, height: 36 },
  referenceText: { flex: 1, minWidth: 0 },
  pickerLabel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    textTransform: 'uppercase',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 2,
  },
  pickerHead: { width: 32, height: 32, borderWidth: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
  },
  field: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderLeftWidth: 2,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 3,
  },
  chipHead: { width: 18, height: 18 },
  photoChip: { width: 44, height: 44 },
  photoThumb: { width: '100%', height: '100%' },
  photoCount: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  photoRemove: {
    position: 'absolute',
    left: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attach: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 220,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// App slice 2 (plan §5, mirror #69/#70) — the in-reply action rows. A tap
// sends the label as an ORDINARY reply through the outbox (#70: typed words
// answer the same question; §1: Undo sends the word "undo" — the mirror's
// no-bubble treatment is the flagged founder note, not improvised past).
// Buttons sit INSIDE the reply below a hairline, never a toast. A block
// whose task is KNOWN closed (absent from GET /v1/tasks) renders inert —
// one undo per action, a second tap does nothing; nothing expires locally.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { objectiveDetail } from '../lib/objectives';
import type { TaskActionsBlock, UndoBlock } from '../lib/blocks';
import type { Theme } from '../lib/theme';
import { countWord } from '../lib/dashboard';
import { Icon } from './Icon';

/**
 * App slice 3 (plan §7, mirror #77) — the queue note's actions, rendered
 * LOCALLY (never a reply, no task, no server round-trip): `Choose which {n}`
 * opens the #32 picker; `or leave them` dismisses the note for the day. The
 * row renders only when the queue outruns what reads today (economy.md: a
 * real choice) — the parent decides that and renders nothing otherwise.
 */
export function QueueNoteActionsRow({
  waiting,
  onChoose,
  onLeave,
  t,
}: {
  waiting: number;
  onChoose: () => void;
  onLeave: () => void;
  t: Theme;
}) {
  // #77 draws this as a quiet row, not two buttons: a text link on the left,
  // secondary text on the right, space-between under a hairline. The note is
  // "a row you can ignore" — a filled button and an outlined button gave it
  // the weight of a question that must be answered, which is the opposite.
  // Both halves stay tappable; hitSlop keeps a 44pt target under the drawn
  // type sizes rather than padding the row taller than it is drawn.
  return (
    <View style={[styles.queueRow, { borderTopColor: t.color.borderStructure }]}>
      <Pressable onPress={onChoose} accessibilityRole="button" hitSlop={12}>
        <Text
          style={{
            color: t.color.interactive,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '500',
            fontSize: 14,
          }}
        >
          {`Choose which ${countWord(waiting)}`}
        </Text>
      </Pressable>
      <Pressable onPress={onLeave} accessibilityRole="button" hitSlop={12}>
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '400',
            fontSize: 12.5,
          }}
        >
          or leave them
        </Text>
      </Pressable>
    </View>
  );
}

/** #70 — the ask's buttons beside the referenced line. First label is the
 * implied yes (filled), the rest outline; labels are server copy (DRAFT). */
export function TaskActionsRow({
  block,
  open,
  onSend,
  t,
}: {
  block: TaskActionsBlock;
  open: boolean;
  /** QA-07/08: button taps include the task_id so the server answers the right task. */
  onSend: (label: string, taskId?: string) => void;
  t: Theme;
}) {
  // A yes/no PAIR keeps the drawn filled-then-outlined weighting: one of them
  // is the expected answer. THREE OR MORE are equal choices — none of them is
  // the default, and filling the first would say otherwise (#35).
  const choices = block.labels.length > 2;

  // 6 Sep 2026 — a set the app can explain rather than merely list. Rendered as
  // an accordion because the founder asked for the neighbour-picker shape:
  // something you can READ before you commit to it. Only 'objective' carries
  // this today; any other set falls through to the plain row below, so the
  // server can send a token this build has never heard of without breaking.
  if (block.explain === 'objective') {
    return <ExplainedChoices block={block} open={open} onSend={onSend} t={t} />;
  }

  return (
    <View style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
      {block.labels.map((label, i) => (
        <Pressable
          key={label}
          disabled={!open}
          onPress={() => onSend(label, block.taskId)}
          accessibilityRole="button"
          style={[
            styles.button,
            choices || i > 0
              ? { borderWidth: 2, borderColor: t.color.interactive }
              : { backgroundColor: t.color.interactive },
            !open && { opacity: 0.5 },
          ]}
        >
          <Text
            style={{
              color: !choices && i === 0 ? t.color.textOnInteractive : t.color.interactive,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 15,
            }}
          >
            {label}
          </Text>
        </Pressable>
      ))}
      {block.skip ? (
        // Dashed, and in the QUIET colour — skipping is always available and
        // never the thing being encouraged (C47: every question visibly
        // skippable, none of them nagged).
        <Pressable
          disabled={!open}
          onPress={() => onSend(block.skip as string, block.taskId)}
          accessibilityRole="button"
          style={[
            styles.button,
            { borderWidth: 2, borderStyle: 'dashed', borderColor: t.color.borderStructure },
            !open && { opacity: 0.5 },
          ]}
        >
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 15,
            }}
          >
            {block.skip}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** #69 — Undo is a button on the reply; the word still works, but you never
 * have to remember it. */
export function UndoRow({
  block,
  open,
  onSend,
  t,
}: {
  block: UndoBlock;
  open: boolean;
  /** QA-07/08: undo taps include the task_id so the server undoes the right task. */
  onSend: (label: string, taskId?: string) => void;
  t: Theme;
}) {
  return (
    <View style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
      <Pressable
        disabled={!open}
        onPress={() => onSend('undo', block.taskId)}
        accessibilityRole="button"
        accessibilityLabel="Undo"
        style={[
          styles.undoButton,
          { borderColor: t.color.interactive },
          !open && { opacity: 0.5 },
        ]}
      >
        <Icon name="undo" size={17} color={t.color.interactive} />
        <Text
          style={{
            color: t.color.interactive,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '500',
            fontSize: 14,
          }}
        >
          Undo
        </Text>
      </Pressable>
      <Text
        style={{
          flex: 1,
          color: t.color.textSecondary,
          fontFamily: t.typography.textSmall.fontFamily,
          fontSize: 12,
          lineHeight: 17,
        }}
      >
        Or say undo. The button does not expire.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  button: {
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 4,
  },
});

/**
 * Choices you can read before you pick (6 Sep 2026).
 *
 * Each row expands to say what the choice MEANS and what Milo will track — the
 * two things that were invisible when this was four bare words. Picking is
 * still one tap on the row's own button; expanding is optional and changes
 * nothing.
 *
 * A label with no explanation still renders and is still pickable. That matters
 * because the labels are server copy the founder may reword: an unmatched label
 * loses its detail, never its button.
 */
function ExplainedChoices({
  block,
  open,
  onSend,
  t,
}: {
  block: TaskActionsBlock;
  open: boolean;
  onSend: (label: string, taskId?: string) => void;
  t: Theme;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // internal-reference — SELECT, then CONFIRM. The row used to SEND on tap, so a second
  // tap sent a second message; the founder's own transcript carries "Get
  // stronger" twice, one minute apart, because he tapped twice. His words:
  // "the left part is a button, so i can click multiple times which is
  // stupid!! it should open up like picking a neighbour and then there is a
  // confirmation button at the bottom."
  //
  // That is the invite flow's shape, which the user has already learned during
  // first-run — so this costs them no new interaction, and it removes the
  // ambiguity that caused the bug: with an explicit commit, "did that
  // register?" stops being a question the interface leaves open.
  const [picked, setPicked] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.color.borderStructure, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
      {block.labels.map((label) => {
        const detail = objectiveDetail(label);
        const isOpen = expanded === label;
        return (
          <View
            key={label}
            style={{ borderWidth: 1, borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceCard }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                disabled={!open || sending}
                // Picks, never sends. Tapping the SAME one again re-picks it
                // rather than clearing: these are exclusive choices, and a
                // choice that unselects itself is a toggle wearing the wrong
                // hat.
                onPress={() => setPicked(label)}
                accessibilityRole="radio"
                accessibilityState={{ checked: picked === label, disabled: !open || sending }}
                accessibilityLabel={`Choose ${label}`}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  opacity: open && !sending ? 1 : 0.5,
                  backgroundColor: picked === label ? t.color.fillBody : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: t.color.interactive,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: picked === label ? '600' : '500',
                    fontSize: 15,
                  }}
                >
                  {picked === label ? `✓ ${label}` : label}
                </Text>
              </Pressable>
              {detail ? (
                <Pressable
                  onPress={() => setExpanded(isOpen ? null : label)}
                  accessibilityRole="button"
                  accessibilityLabel={isOpen ? `Hide what ${label} means` : `What ${label} means`}
                  accessibilityState={{ expanded: isOpen }}
                  hitSlop={10}
                  style={{ paddingVertical: 13, paddingHorizontal: 14 }}
                >
                  <Text style={{ color: t.color.textSecondary, fontSize: 13 }}>{isOpen ? 'Less' : 'What this means'}</Text>
                </Pressable>
              ) : null}
            </View>
            {isOpen && detail ? (
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingBottom: 13,
                  gap: 7,
                  borderTopWidth: 1,
                  borderTopColor: t.color.borderStructure,
                  paddingTop: 11,
                }}
              >
                <Text style={{ color: t.color.textPrimary, fontSize: 14, lineHeight: 21 }}>{detail.means}</Text>
                <Text style={{ color: t.color.textSecondary, fontSize: 13, lineHeight: 20 }}>{detail.tracks}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
      {/* The commit. Nothing is sent until this is pressed, so a mis-tap costs
          a tap rather than a message — and `sending` makes it single-shot, so
          a double-tap cannot send twice. That is not belt-and-braces: sending
          twice is exactly what happened. */}
      <Pressable
        disabled={!open || !picked || sending}
        accessibilityRole="button"
        accessibilityState={{ disabled: !open || !picked || sending }}
        onPress={() => {
          if (!picked || sending) return;
          setSending(true);
          onSend(picked, block.taskId);
        }}
        style={{
          height: t.spacing.controlH,
          borderRadius: t.spacing.radiusControl,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: picked && open && !sending ? t.color.interactive : t.color.borderStructure,
        }}
      >
        <Text
          style={{
            color: picked && open && !sending ? t.color.textOnInteractive : t.color.textSecondary,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '600',
            fontSize: 15,
          }}
        >
          {sending ? 'Sent' : picked ? `Tell Milo: ${picked}` : 'Pick one'}
        </Text>
      </Pressable>
      {block.skip ? (
        <Pressable
          disabled={!open || sending}
          onPress={() => {
            if (sending) return;
            setSending(true);
            onSend(block.skip as string, block.taskId);
          }}
          accessibilityRole="button"
          style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingVertical: 8, opacity: open && !sending ? 1 : 0.5 }}
        >
          <Text style={{ color: t.color.textSecondary, fontSize: 14, textDecorationLine: 'underline' }}>
            {block.skip}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

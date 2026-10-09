// Message-level chips (#50, and the #44/#45/#49/#53/#58 bucket). The SERVER
// emits semantic tokens; this file owns the words and the icons, so copy
// changes never need a server deploy and an unknown token simply does not
// render — the server can ship ahead of the app.
//
// Icons come from Material Symbols Sharp. These are SYSTEM-rendered chips, so
// they draw freely from the set: the fixed whitelist governs icons a MODEL
// picks inside a reply, never chrome the client renders itself.
import { StyleSheet, Text, View } from 'react-native';
import type { CostChipsBlock } from '../lib/blocks';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';

const CHIPS: Record<string, { icon: string; label: string }> = {
  // #50 — the standing auto-link, announced on every filing line
  linked_automatically: { icon: 'link', label: 'linked automatically' },
  settings_link_plates: { icon: 'settings', label: 'Settings · link plates to receipts' },
  // the small-chips bucket
  absolute: { icon: 'check', label: 'absolute' }, // #44 — pairs with the count in the body
  no_plate_yet: { icon: 'schedule', label: 'no plate photo yet' }, // #45
  plate_photo: { icon: 'image', label: 'plate photo' }, // #49, beside receipt · evidence
  two_knocks: { icon: 'schedule', label: 'two knocks, then silence' }, // #53
  reversible: { icon: 'history', label: 'reversible until you say otherwise' }, // #58
  // #23 — a merchant rule. The count itself is in the chip's own line on the
  // server side; this says WHAT KIND of change just happened, because "a rule,
  // not one entry" is the thing a user needs to understand.
  rule_not_one_entry: { icon: 'check', label: 'a rule, not one entry' },
  rule_only: { icon: 'check', label: 'a rule — nothing to move yet' },
  // C78 (#20) — a food photo that was not eaten. The chip says what did NOT
  // happen to the LEDGER; it deliberately makes no claim about credits,
  // because the photo WAS read (C64: one photo, one look, one credit).
  plan_not_counted: { icon: 'schedule', label: 'a plan · nothing counted' },
  no_entry: { icon: 'close', label: 'no entry' },
  // C82 (#21) — the promise made visible: asked once, then never again.
  remembered_not_asked_again: { icon: 'check', label: 'Remembered · not asked again' },
  // #17's "One reading · one credit" is deliberately ABSENT (founder, 5 Sep):
  // the credit counter above the composer already ticks down, so a chip saying
  // the same thing on a single-neighbour read is a parrot. #19's chip below
  // stays, because a counter that drops by one cannot explain why TWO replies
  // cost one — that is the only case where the number could surprise.
  // C64/#19 — one photo that two neighbours both filed from. Without this the
  // second reply reads as a second charge; the whole point of C64 is that it
  // is not one. Milo took the plate, Mira took the evening, you paid once.
  // C41/#11 — the split. Saying "Separate" is the one answer to that ask that
  // costs something: two photos stay two reads. The merge says nothing about
  // credits because nothing extra was spent.
  // #43 — the state a confirm ask leaves behind: what IS filed, and what is
  // still open. The ask used to say neither, so an unanswered question looked
  // like nothing had happened at all — when in fact the entry was already
  // filed and only the name was missing (C99).
  filed_amount: { icon: 'receipt_long', label: 'filed · {amount}' },
  waiting_on_a_name: { icon: 'schedule', label: 'waiting on a name' },
  two_entries_two_credits: { icon: 'filter_2', label: 'Two entries, two credits' },
  one_photo_two_neighbours: { icon: 'check', label: 'One photo · one credit · two neighbours' },
  // C87 (#44) — C15 provenance on a confirmation: the record now says
  // something the photo never did. FORUM, never a mic — voice notes are
  // deferred (14 Aug), so a spoken fact's provenance is always "in chat".
  told_in_chat: { icon: 'forum', label: 'you told her in chat' },
};

// Footnotes under a reply's buttons (#72). Same contract as CHIPS above: the
// server sends a token, this file owns the words, an unknown token renders
// nothing. Separate map because a note is not a chip — no icon, no border,
// secondary text below the actions rather than beside the line.
const NOTES: Record<string, string> = {
  // #72 — said with the standing offer, so the user knows the question is not
  // going to come back at them. The offer promises this; Settings keeps it.
  offer_asked_once: 'Either way I only ask this once. It is in Settings after that.',
};

export function MessageNote({ token, t }: { token: string; t: Theme }) {
  const words = NOTES[token];
  if (!words) return null;
  return (
    <Text
      style={{
        color: t.color.textSecondary,
        fontFamily: t.typography.textBody.fontFamily,
        fontSize: 12.5,
        lineHeight: 19,
        paddingHorizontal: 12,
        paddingBottom: 11,
      }}
    >
      {words}
    </Text>
  );
}

/** #69 — the record-honesty strip on a reply that WAS an undo. Drawn as an
 *  inset row under a hairline: the `undo` glyph, then "Undone 21:05 · you
 *  tapped Undo". The time is the REPLY's own — the undo is what this message
 *  is, so there is no second clock to keep in step. */
export function UndoneStrip({ at, t }: { at: string; t: Theme }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderTopWidth: 1,
        borderTopColor: t.color.borderStructure,
        backgroundColor: t.color.surfaceInset,
      }}
    >
      <Icon name="undo" size={15} color={t.color.textSecondary} />
      <Text
        style={{
          color: t.color.textSecondary,
          fontFamily: t.typography.textBody.fontFamily,
          fontSize: 12.5,
        }}
      >
        {`Undone ${at} · you tapped Undo`}
      </Text>
    </View>
  );
}

/** C85 (#13) — the cost of a multi-photo entry. Same chip furniture as the
 *  semantic ones, but the numbers come from the server because a lookup table
 *  cannot hold "3". */
export function CostChips({ block, t }: { block: CostChipsBlock; t: Theme }) {
  const chips = [
    { icon: 'toll', label: `${block.credits} credits spent` },
    {
      icon: 'receipt_long',
      label: `${block.photos} photos · ${block.entries} ${block.entries === 1 ? 'entry' : 'entries'}`,
    },
  ];
  return (
    <View style={styles.row}>
      {chips.map((chip) => (
        <View
          key={chip.label}
          style={[
            styles.chip,
            { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
          ]}
        >
          <Icon name={chip.icon} size={14} color={t.color.textSecondary} />
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 11.5,
              fontVariant: ['tabular-nums'],
            }}
          >
            {chip.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function MessageChips({ tokens, values, t }: { tokens: string[]; values?: Record<string, string>; t: Theme }) {
  // #43 — a label may hold {placeholders} the server fills. A chip whose value
  // never arrived is DROPPED rather than drawn with a hole in it: "filed · " is
  // worse than no chip, because it looks like a number that failed rather than
  // one that was never sent.
  const known = tokens
    .map((token) => CHIPS[token])
    .filter(Boolean)
    .map((chip) => ({
      ...chip,
      label: chip.label.replace(/\{(\w+)\}/g, (whole, key: string) => values?.[key] ?? whole),
    }))
    .filter((chip) => !/\{\w+\}/.test(chip.label));
  if (known.length === 0) return null;
  return (
    <View style={styles.row}>
      {known.map((chip, i) => (
        <View
          key={`${chip.label}-${i}`}
          style={[
            styles.chip,
            { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
          ]}
        >
          <Icon name={chip.icon} size={14} color={t.color.textSecondary} />
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 11.5,
            }}
          >
            {chip.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

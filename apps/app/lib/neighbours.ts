// Neighbour identity (plan §2): the static canon map of the five. Manifests
// (packages/config/neighbours/*.yaml) are not exposed with domains or role
// words to the app, so this mirrors canon in one place:
// - canon/world/neighbours.md — the five, domains, role words (22 Aug ruling)
// - CLAUDE.md — colour is DOMAIN, never character; head avatars are
//   packages/assets/sprites/{name}_head.png and nothing else.
// Tally is in the map (she is canon) but `p0: false` — she is absent in P0
// and nothing may surface her (picker, threads) until the community play.
import type { Tokens } from '@petak/design-system/tokens';
import ollieHead from '../../../packages/assets/sprites/ollie_head.png';
import pennyHead from '../../../packages/assets/sprites/penny_head.png';
import miloHead from '../../../packages/assets/sprites/milo_head.png';
import miraHead from '../../../packages/assets/sprites/mira_head.png';
import tallyHead from '../../../packages/assets/sprites/tally_head.png';

export type NeighbourId = 'ollie' | 'penny' | 'milo' | 'mira' | 'tally';

type Theme = Tokens[keyof Tokens];

export type DomainTokenKey = {
  [K in keyof Theme['color']]: K extends `domain${string}` ? K : never;
}[keyof Theme['color']];

export interface Neighbour {
  id: NeighbourId;
  /** Display name — "Ollie". */
  name: string;
  /** The fixed role word (canon ruling): "front door", "money", … */
  roleWord: string;
  /** Token key for this neighbour's domain accent (t.color[domain]). */
  domain: DomainTokenKey;
  /** The @-picker descriptor line (Run A #15). */
  descriptor: string;
  /** Head sprite — the ONLY avatar source (packages/assets/sprites). */
  head: number;
  /** False = not surfaced anywhere in P0 (Tally). */
  p0: boolean;
}

export const NEIGHBOURS: Record<NeighbourId, Neighbour> = {
  ollie: {
    id: 'ollie',
    name: 'Ollie',
    roleWord: 'front door',
    domain: 'domainSystem',
    descriptor: 'the front door',
    head: ollieHead,
    p0: true,
  },
  penny: {
    id: 'penny',
    name: 'Penny',
    roleWord: 'money',
    domain: 'domainMoney',
    descriptor: 'money, receipts and budgets',
    head: pennyHead,
    p0: true,
  },
  milo: {
    id: 'milo',
    name: 'Milo',
    roleWord: 'body',
    domain: 'domainBody',
    descriptor: 'meals, sleep and training',
    head: miloHead,
    p0: true,
  },
  mira: {
    id: 'mira',
    name: 'Mira',
    roleWord: 'mind',
    domain: 'domainMind',
    descriptor: 'your journal',
    head: miraHead,
    p0: true,
  },
  tally: {
    id: 'tally',
    name: 'Tally',
    roleWord: 'shared money',
    domain: 'domainSharedMoney',
    descriptor: 'shared bills and splitting',
    head: tallyHead,
    p0: false, // C23 — absent until the community play ships
  },
};

/** Canon order — the fallback when no recency signal exists. */
export const NEIGHBOUR_ORDER: NeighbourId[] = ['ollie', 'penny', 'milo', 'mira', 'tally'];

/** What the neighbour is doing while a turn is in flight (26 Aug ruling). */
export type ActivityKind = 'text' | 'photo' | 'lookup' | 'route';

// Slice 2 (plan §8): #78 SUPERSEDES slice 1's indicator — the ruled verbs
// map onto #78's sentence patterns, and the three dots are DRAWN by the
// indicator component, never typed into the string ("writing…" →
// "{Name}'s writing"). The client can't name the thing a photo holds
// (receipt vs plate), so the generic "the photo" stands where #78 names
// it. 'route' ships as drawn — "Ollie's finding the right neighbour" has
// no slice-1 verb counterpart (flagged for the founder, never improvised
// past) and no client signal triggers it yet. The lit-pane square beside
// the line takes the domain accent at FULL strength (the one place an
// accent may).
/** #78's ordinal, spelled out to ten. Past ten a word is harder to read at a
 *  glance than the numeral, and a batch that size is rare enough not to warrant
 *  the vocabulary. */
const ORDINAL_WORDS = [
  'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];

function ordinalWord(n: number): string {
  if (n >= 1 && n <= ORDINAL_WORDS.length) return ORDINAL_WORDS[n - 1];
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/**
 * `ordinal` is which send of a batch is in hand (#78's "the fifth one"). It
 * rides ONLY the photo line: a lookup or a text turn has no "one" to be the
 * nth of. Omitted, or 1, gives the plain line — a single photo is not "the
 * first one".
 *
 * The drawn sentences that name a photo's CONTENTS — "reading the receipt",
 * "counting the plate" — stay unbuilt. Naming the class requires the vision
 * call to have returned, which C66 forbids announcing before it has; the
 * founder ruled 4 Sep that the line is two-phase instead, generic until the
 * intent is known. The ordinal needs no read at all, which is why it is the
 * half that ships.
 */
/**
 * #78's SECOND phase. The founder ruled 4 Sep that the line starts generic
 * while routing and becomes the responsible neighbour's named action once the
 * intent is known.
 *
 * The drawn sentence list names a photo verb for exactly two neighbours —
 * "Penny's reading the receipt" and "Milo's counting the plate". The NOUNS are
 * blocked by C66 (naming what a photo holds needs the read that has not
 * returned yet); the VERBS are not, so the verbs ship and the nouns do not.
 *
 * Nobody else gets a verb. Mira's drawn line is a LOOKUP ("looking for
 * March"), and Tally has none — inventing one would put words in a
 * neighbour's mouth that no drawing approved.
 */
const PHOTO_VERB: Partial<Record<NeighbourId, string>> = {
  milo: 'counting it',
};

export function activityLine(id: NeighbourId, kind: ActivityKind, ordinal?: number): string {
  const name = NEIGHBOURS[id]?.name ?? id;
  switch (kind) {
    case 'photo': {
      // The ordinal outranks the verb: in a nine-photo batch, WHICH one is
      // being read is the thing that makes the wait legible (#78).
      if (ordinal && ordinal > 1) return `${name}'s reading the ${ordinalWord(ordinal)} one`;
      const verb = PHOTO_VERB[id];
      return verb ? `${name}'s ${verb}` : `${name}'s reading the photo`;
    }
    case 'lookup':
      // #78 draws "Mira's looking for March" — the user's own QUERY, which is
      // C66-safe. The client is never handed the query, so the generic stands
      // until a server signal carries it. Flagged, never improvised.
      return `${name}'s looking`;
    case 'route':
      return "Ollie's finding the right neighbour"; // as drawn, #78
    default:
      return `${name}'s writing`;
  }
}

/** Pronouns for a named neighbour, lowercase for mid-sentence use.
 *
 *  A screen about ONE neighbour must speak about that neighbour: Run B #9's
 *  Moving out copy hardcoded she/her, so Milo's screen read "Her records stay"
 *  and "She leaves at the end of the period you have paid for" (PAR-B09).
 *
 *  This is the single source. `MoveInPicker`'s PROFILE table still carries its
 *  own `subject`/`possessive` fields — a duplicate that should fold into this
 *  helper the next time that file is open. */
export function pronouns(id: NeighbourId): {
  subject: string;
  object: string;
  possessive: string;
} {
  switch (id) {
    case 'milo':
    case 'ollie':
      return { subject: 'he', object: 'him', possessive: 'his' };
    default:
      return { subject: 'she', object: 'her', possessive: 'her' };
  }
}

/** "His count, not mine" (#71) — the possessive for an evidence card's owner. */
export function possessive(id: NeighbourId): string {
  switch (id) {
    case 'milo':
    case 'ollie':
      return 'His';
    default:
      return 'Her';
  }
}

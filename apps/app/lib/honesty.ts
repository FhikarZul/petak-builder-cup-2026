// App slice 2 (plan §3, §6) — the record-honesty family, PURE (the
// unit-test target). One visual language, three states; semantics are
// icon + text only (never a fill, border colour or semantic hue). The
// templates below are the plan's EXACT words — copy elsewhere stays DRAFT.
import type { EntryCardBlock } from './blocks';

export type StripState = 'edited' | 'estimate' | 'refined';

/** One version of an entry, as served by GET /v1/entries/:id/trail (G2). */
export interface TrailVersion {
  id: string;
  value: Record<string, unknown>;
  source: 'photo_read' | 'you_said';
  created_at: string;
}

/** The strip's icon per state (Material Symbols Sharp names — icon + text only). */
export function stripIcon(state: StripState): string {
  switch (state) {
    case 'edited':
      return 'edit_note';
    case 'estimate':
      return 'receipt_long';
    case 'refined':
      return 'history';
  }
}

// The three exact templates (plan §3):
// - edited:   "Was <old> · edited <time> · <provenance>. Counts now."
// - estimate: "Estimated from the bill · a plate photo would settle it. Counts until then."
// - refined:  "Earlier read <value> · refined by your plate photo. Stays visible, does not count."
export function stripText(strip: {
  state: StripState;
  old?: string;
  time?: string;
  provenance?: string;
  value?: string;
}): string {
  switch (strip.state) {
    case 'edited':
      return `Was ${strip.old ?? ''} · edited ${strip.time ?? ''} · ${strip.provenance ?? ''}. Counts now.`;
    case 'estimate':
      return 'Estimated from the bill · a plate photo would settle it. Counts until then.';
    case 'refined':
      return `Earlier read ${strip.value ?? ''} · refined by your plate photo. Stays visible, does not count.`;
  }
}

/** #73's honesty strip under an objective amendment. A first derivation has
 * no before-state, so C88 requires silence rather than amendment language. */
export function objectiveStripText(oldObjective: string | null, time: string): string | null {
  if (!oldObjective) return null;
  return `Objective was ${oldObjective} · changed ${time}, you told me in chat. The old targets stop counting from today, not backwards.`;
}

/** #61's sheet footer — the exact line, never paraphrased. */
export const TRAIL_FOOTER =
  'The photo is kept as it was read. Editing the number never edits the photo.';

// ---- derived state ---------------------------------------------------------

/** A compact display value for one trail version / entry payload. */
export function trailValueLabel(payload: Record<string, unknown>): string {
  if (typeof payload.value === 'number') {
    if (payload.metric === 'weight' && (payload.unit === 'kg' || payload.unit === 'lb')) return `${payload.value} ${payload.unit}`;
    if (payload.metric === 'body_fat' && payload.unit === 'percent') return `${payload.value}%`;
  }
  const amount = payload.amount;
  if (typeof amount === 'number') {
    const currency = typeof payload.currency === 'string' ? payload.currency : '';
    return moneyLabel(currency, amount);
  }
  const calories = payload.calories;
  if (typeof calories === 'number') return `${calories} kcal`;
  const name = payload.merchant ?? payload.dish ?? payload.title;
  if (typeof name === 'string' && name.length > 0) return name;
  return 'the earlier read';
}

function moneyLabel(currency: string, amount: number): string {
  const fixed = amount.toFixed(2);
  if (currency === 'SGD') return `S$${fixed}`;
  if (currency === 'USD') return `$${fixed}`;
  return currency ? `${currency} ${fixed}` : fixed;
}

export interface DerivedStrip {
  state: StripState;
  /** edited/refined only — the display fields the templates take. */
  old?: string;
  time?: string;
  provenance?: string;
  value?: string;
}

/**
 * The strip for an entry card, derived from the version trail (G2) and the
 * block's own honesty field:
 * - newest version is your word over an older one → edited
 * - newest version is a photo read over an older one → refined
 * - a lone version the server flagged provisional → estimate
 * - anything else → no strip (silence about the ordinary case)
 * edited/refined are tappable (the trail is right here); estimate never is.
 */
export function stripFromTrail(
  versions: TrailVersion[] | undefined,
  blockHonesty: EntryCardBlock['honesty'],
): DerivedStrip | null {
  if (versions && versions.length > 1) {
    const [now, before] = versions;
    if (now.source === 'you_said') {
      return {
        state: 'edited',
        old: trailValueLabel(before.value),
        time: hhmm(now.created_at),
        provenance: 'you told me in chat',
      };
    }
    return { state: 'refined', value: trailValueLabel(before.value) };
  }
  if (blockHonesty === 'estimate') return { state: 'estimate' };
  return null;
}

// ---- the sheet's provenance + time lines -----------------------------------

/** #61 row provenance: where THAT version came from. */
export function trailSourceLine(source: TrailVersion['source']): string {
  return source === 'you_said' ? 'You told me in chat' : 'Read from your photo';
}

/** "18:20, today" · "19:41, Sat 8 Aug" — the sheet row's time line. */
export function trailTimeLine(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? `${hhmm(iso)}, today` : `${hhmm(iso)}, ${dayLabel(d)}`;
}

/** "Sat 8 Aug" — entry card + sheet context dates. */
export function dayLabel(d: Date): string {
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${weekday} ${d.getDate()} ${month}`;
}

export function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The API speaks ISO 8601; older servers/builds emit Postgres text
 *  ("2026-08-30 19:28:34.591328+00"), which Hermes cannot Date-parse — on
 *  device that is "Invalid Date" labels, and NaN arithmetic downstream throws
 *  "Date value out of bounds", crashing whole screens. Parse both shapes. */
export function parseServerDate(s: string): Date {
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct;
  const pg = s
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+(?=([+-]\d{2}(:?\d{2})?|Z)?$)/, '$1') // micros → millis
    .replace(/([+-]\d{2})$/, '$1:00'); // "+00" → "+00:00"
  return new Date(pg);
}

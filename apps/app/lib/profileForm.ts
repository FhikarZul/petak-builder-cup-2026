// The one-go form's fields — labels, reasons and shapes (6 Sep 2026).
//
// Founder: "Milo ask a list of questions (birthdate, gender, height and weight)
// - i think we should ask this in one go, instead of a series of question,
// perhaps a form? make the experience seamless and avoid back and forth."
//
// The words live here, not on the server, like every other block's copy: the
// server sends field TOKENS and the app says how to ask for them.
//
// Each field keeps its ONE-CLAUSE REASON, which C47 requires of every question
// Milo asks. A form makes those easy to drop — four labels and a Submit would
// be a smaller screen and a worse one, because the reason is what makes an
// intrusive question answerable rather than merely asked.
export type ProfileFieldKey = 'birthdate' | 'sex' | 'height' | 'weight';

export interface ProfileFieldSpec {
  key: ProfileFieldKey;
  label: string;
  /** C47's one clause: why he is asking. Never omitted. */
  reason: string;
  kind: 'date' | 'choice' | 'number';
  choices?: string[];
  unit?: string;
  placeholder?: string;
}

export const PROFILE_FIELDS: Record<ProfileFieldKey, ProfileFieldSpec> = {
  birthdate: {
    key: 'birthdate',
    label: 'Date of birth',
    reason: 'Keeps the maths current each year.',
    kind: 'date',
    placeholder: 'YYYY-MM-DD',
  },
  sex: {
    key: 'sex',
    label: 'Male or female',
    reason: 'Moves the baseline by about 165 calories — that is the only reason he asks.',
    kind: 'choice',
    choices: ['Male', 'Female'],
  },
  height: {
    key: 'height',
    label: 'Height',
    reason: 'Same reason — the maths.',
    kind: 'number',
    unit: 'cm',
    placeholder: '170',
  },
  weight: {
    key: 'weight',
    label: 'Weight',
    reason: "Last of the numbers — it's what makes the targets honest.",
    kind: 'number',
    unit: 'kg',
    placeholder: '70',
  },
};

/** The server's field order, kept. C47 puts weight LAST, deliberately. */
export function specsFor(fields: string[]): ProfileFieldSpec[] {
  return fields.map((f) => PROFILE_FIELDS[f as ProfileFieldKey]).filter((s): s is ProfileFieldSpec => !!s);
}

export interface ProfileDraft {
  birthdate?: string;
  sex?: string;
  height?: string;
  weight?: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function realDate(year: number, month: number, day: number): string | null {
  if (year < 1900) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  if (d.getTime() > Date.now()) return null; // the future is not a birthday
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

// 8 Sep 2026 (internal-reference) — the old rule kept a birthdate only when it arrived
// as strict YYYY-MM-DD and dropped anything else SILENTLY. The founder typed
// "14 Dec 1984", the payload lost it, and Milo answered "birthdate not said".
// Parse the way a person writes a date; day-first for the numeric forms,
// because that is the convention where Petak is born.
/** Parse a birthdate as written, to ISO YYYY-MM-DD. Null when it is not a date. */
export function parseBirthdate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return realDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(s);
  if (m) return realDate(Number(m[3]), Number(m[2]), Number(m[1])); // day-first
  m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return realDate(Number(m[3]), month, Number(m[1]));
  }
  return null;
}

export interface ProfileValidation {
  payload: Record<string, string | number>;
  /** Per-field messages for filled input that could not be read. An empty box
   *  is a skip and earns no error; a FILLED box that reads as nothing must be
   *  explained — dropped silently is how the form lost the founder's
   *  birthdate on 8 Sep 2026. */
  errors: Partial<Record<ProfileFieldKey, string>>;
}

export function validateDraft(draft: ProfileDraft): ProfileValidation {
  const payload: Record<string, string | number> = {};
  const errors: ProfileValidation['errors'] = {};
  if (draft.birthdate?.trim()) {
    const iso = parseBirthdate(draft.birthdate);
    if (iso) payload.birth_date = iso;
    else errors.birthdate = 'He can read 14 Dec 1984 or 1984-12-14 — not that.';
  }
  if (draft.sex === 'Male' || draft.sex === 'Female') payload.sex = draft.sex.toLowerCase();
  if (draft.height?.trim()) {
    const h = Number(draft.height);
    if (Number.isFinite(h) && h > 0 && h <= 300) payload.height_cm = h;
    else errors.height = 'A number in centimetres — 163, say.';
  }
  if (draft.weight?.trim()) {
    const w = Number(draft.weight);
    if (Number.isFinite(w) && w > 0 && w <= 700) payload.weight_kg = w;
    else errors.weight = 'A number in kilograms — 75, say.';
  }
  return { payload, errors };
}

/** What the server's PATCH shape calls these. Only filled fields travel —
 *  every one is skippable, so an empty box is an answer, not an error. */
export function toProfilePayload(draft: ProfileDraft): Record<string, string | number> {
  return validateDraft(draft).payload;
}

/** Anything TYPED — raw, not sanitized. The button answers "did you write
 *  something"; validateDraft answers "could he read it" when you tap. */
export function hasAnything(draft: ProfileDraft): boolean {
  return ['birthdate', 'sex', 'height', 'weight'].some((k) => {
    const v = draft[k as ProfileFieldKey];
    return typeof v === 'string' && v.trim().length > 0;
  });
}

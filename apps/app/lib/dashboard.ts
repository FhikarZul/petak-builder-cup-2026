// Run B #3 — the dashboard payload shapes, and the surface's honesty rules.
// PURE (the unit-test target): no api client, no React.
import { parseServerDate } from './honesty';
import type { Profile } from './profile';
import type { MonthComparison } from './monthComparison';
/** C90 — the inputs a target was derived FROM. Every field is skippable, so
 *  null is a real, displayable state: "not said", never a guess. */
export interface MiloProfile {
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
}

/** C73/C89 on the surface: a number built on an assumption says so HERE, not
 *  only in the working. */
export interface EnergyBasis {
  bmr: number;
  tdee: number;
  activity_factor: number;
  sex_assumed: boolean;
  activity_assumed: boolean;
}

/** C92 — one reading. The unit is what the user SAID; nothing converts it. */
export interface BodyReading {
  value: number;
  unit: 'kg' | 'lb' | 'percent';
  at: string;
}

/** Latest and the one before it — a trend needs exactly two, and `previous`
 *  is null until the second reading exists. One reading is not a trend. */
export interface BodySeries {
  weight: { latest: BodyReading; previous: BodyReading | null } | null;
  body_fat: { latest: BodyReading; previous: BodyReading | null } | null;
}

export interface MiloToday {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entries: number;
  meal_times: string[];
  /** C47 — Milo's dish-level observation, absent until a rated meal exists. */
  best_rated?: { dish: string; rating: number };
  /** C11: present ONLY when an active objective derived them. */
  targets?: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
  /** Present only once an objective exists — targets or not. */
  profile?: MiloProfile;
  /** Absent when age/height/weight are not all on file. */
  basis?: EnergyBasis;
  /** C92 — absent until a reading exists. */
  body?: BodySeries;
  /** C93 — the body-fat target the user STATED or TOOK. Absent until then:
   *  nothing computes this one, which is the ruling, not a gap. */
  body_fat_target_pct?: number;
}

/** Keep Milo's objective target distinct from the energy card's estimated
 * burn. They answer different questions and must never look like the same
 * number. */
export function energyTargetLine(target: number | null | undefined): string | null {
  return typeof target === 'number' && Number.isFinite(target)
    ? `Target ${Math.round(target).toLocaleString('en-US')} kcal · Out is estimated burn`
    : null;
}

// The query itself lives in lib/thread.ts with the other hooks: this module
// stays free of the api client so it can be unit-tested (api → supabase.tsx,
// which the node-environment test runner will not parse).

// --- Penny (Run B #4) ---

export interface PennySummary {
  total: number;
  currency: string;
  entries: number;
  other_currencies?: string[];
}

export interface PennyBudget {
  amount: number;
  fx?: { estimated_entries: number; unconverted_entries: number };
  currency: string;
  spent: number;
  left: number;
  expected: number;
  /** Positive = under the even-pace mark. */
  delta: number;
  per_day_left: number;
  days_left: number;
  spent_pct: number;
  expected_pct: number;
}

export interface PennyToday {
  spent_today: PennySummary;
  yesterday: PennySummary;
  /** category null = the "waiting on a name" group — the app labels it (C39). */
  biggest: { category: string | null; total: number } | null;
  receipts_kept: number;
  /** C50: only when a budget is effective. Absent is the drawn empty state. */
  budget?: PennyBudget;
}

export interface CategoryRow {
  category: string | null;
  entries: number;
  total: number;
  other_currencies?: string[];
}

// --- Penny's trend series (sub-slice B, plans/2026-08-28-penny-charts-series.md) ---

/** The ranges the series endpoint serves. `all` is refused there — a series
 *  needs a window, and `all` has none (C75: label and window must agree).
 *  Run B #5 added `custom`: a typed from/to window (range=custom&from=&to=). */
export type PennyRange = 'today' | 'week' | 'month' | 'year' | 'custom';

/** A day WITH home-currency spend — days with no spend have no row (fork 1:
 *  the drawing averages over days-with-spend, C63). Ascending by day. */
export interface SeriesDay {
  /** The user's own day, YYYY-MM-DD in their anchored timezone. */
  day: string;
  total: number;
}

export interface MerchantRow {
  merchant: string;
  visits: number;
  /** Home-currency only (D3: foreign is named, never converted). */
  total: number;
}

/** Fork 4: served ONLY for range=month with an effective budget — no budget,
 *  no card ("not drawn rather than drawn empty"). */
export interface RunningSeries {
  budget: number;
  /** Cumulative home-currency total per day WITH spend, ascending. */
  points: SeriesDay[];
  /** Even-pace expectation to date — the SAME expression as /today's
   *  budget.expected, so the two surfaces cannot disagree. */
  pace: number;
}

export interface PennySeries {
  comparison?: MonthComparison;
  range: PennyRange;
  /** The window in the user's anchored dates, so rangeSub and the server's
   *  filter are the same fact (C75). */
  window: { from: string; to: string };
  currency: string;
  daily: SeriesDay[];
  /** NULL when daily is empty — an average over nothing is not a number. */
  daily_avg: number | null;
  window_total: number;
  fx?: { estimated_entries: number; unconverted_entries: number };
  other_currencies?: string[];
  merchants: MerchantRow[];
  /** Whole-window counts for the type chips — never over a page. */
  log_counts: { all: number; with_photo: number };
  running?: RunningSeries;
}

// --- Mira (Run B #2) ---

export interface JournalEntry {
  id: string;
  at: string;
  /** The CLEANED sentence — your words with the spelling fixed (C95) — or,
   *  for a photo, what she saw. Never merged with `raw`. */
  scene: string | null;
  /** What you actually wrote, verbatim. Null when there is nothing the
   *  cleaned line does not already say. */
  raw: string | null;
  /** C95 — one of a small closed set, or null. Null is a real answer. */
  emotion: string | null;
  emotion_evidence?: string | null;
  interpretation?: { summary: string; evidence: { source: 'caption' | 'photo'; detail: string }[] } | null;
  photo_id: string | null;
}

export interface JournalDay {
  /** The user's own day, YYYY-MM-DD in their anchored timezone. */
  day: string;
  entries: JournalEntry[];
}

// --- Wallet (Run B #15–#17) ---

/** C05's ladder, quoted from canon/product/economy.md — never restated with
 *  different numbers. The server owns the exchange; these are for the words. */
export const COINS_PER_PHOTO = 10;

export const COINS_PER_CREDIT_RUNG = 50;
export const CREDITS_PER_RUNG = 5;
export const REFERRAL_COINS = 100;

export interface Wallet {
  coins: number;
  kept_credits: number;
  history: { id: string; delta: number; kind: string; created_at: string }[];
}

export interface Allowance {
  used: number;
  cap: number;
  /** What is yours before anyone moved in. */
  base: number;
  /** +10/day per PAID neighbour — the free petak adds none (C05). */
  from_neighbours: number;
  paid_residents: number;
}

export interface Street {
  residents: { neighbour: string; display_name: string; moved_in_at: string; free_petak: boolean }[];
  allowance: Allowance;
  coins: number;
  kept_credits: number;
}

// --- Settings (Run B #11/#12) ---

export interface UserSettings {
  credit_prompt: boolean;
  settings: {
    quiet_hours?: { start: string; end: string };
    notifications?: { subjects?: Record<string, boolean> };
    c41?: { auto_link?: boolean };
    reminders?: { water?: { enabled: boolean; window_start: string; window_end: string; interval_hours: number } };
    mira_mode?: string;
    /** Run B Settings → Appearance: 'light' | 'dark' | 'system' (absent = system). */
    appearance?: string;
    /** The user's card (3 Sep 2026) — whole-object replace via PATCH /v1/settings. */
    profile?: Profile;
  } | null;
  /** 1 Sep 2026 ruling: timezone + currency are user settings, not bootstrap
   *  inference. Currency is the unit amounts are tracked in GOING FORWARD
   *  (the ledger never revalues history); timezone anchors "today". */
  region: { timezone: string; currency: string } | null;
}

// --- the surface's honesty rules, PURE (the unit-test target) ---
// Both live here rather than in their components for the reason lib/blocks.ts
// gives: these are the places the dashboard could quietly invent something,
// so they are the places that get tested.

const NOT_SAID = 'not said';

function sexWord(sex: string | null): string {
  if (sex === 'male') return 'male';
  if (sex === 'female') return 'female';
  // A skipped answer means C89's averaged baseline. Say so plainly rather
  // than print one of two words Milo was never given (C90).
  return NOT_SAID;
}

/** C90 — the four facts a target was derived FROM, in the order Milo asks. */
/** The card's quiet top-right line — "34 yrs · 172 cm" in the drawing.
 *
 *  Age and height only: they are the two facts that do not move, so they can
 *  sit once at the top and give the card's body to what does. Either may be
 *  unanswered (every objective question is skippable, C47), so this returns
 *  whichever exist and an empty string when neither does — never "not said" in
 *  a summary line, which would be noise where the fact row already says it. */
export function youSummary(profile: MiloProfile): string {
  const parts: string[] = [];
  if (profile.age !== null) parts.push(`${profile.age} yrs`);
  if (profile.height_cm !== null && profile.height_cm !== undefined) parts.push(`${profile.height_cm} cm`);
  return parts.join(' · ');
}

export function youFacts(profile: MiloProfile): { label: string; value: string; said: boolean }[] {
  return [
    { label: 'Age', value: profile.age !== null ? `${profile.age} yrs` : NOT_SAID, said: profile.age !== null },
    { label: 'Sex', value: sexWord(profile.sex), said: profile.sex === 'male' || profile.sex === 'female' },
    {
      label: 'Height',
      value: profile.height_cm !== null ? `${profile.height_cm} cm` : NOT_SAID,
      said: profile.height_cm !== null,
    },
    {
      label: 'Weight',
      value: profile.weight_kg !== null ? `${profile.weight_kg} kg` : NOT_SAID,
      said: profile.weight_kg !== null,
    },
  ];
}

/** C73/C89 — the burn line, naming whichever assumption is actually in play.
 *  Nothing assumed → no disclaimer: a generic "this is an estimate" on a
 *  number the user fully specified is noise, and noise makes the real
 *  warnings easier to ignore. */
export function burnNote(basis: EnergyBasis): string {
  const assumed = [
    basis.sex_assumed ? 'an averaged baseline, since he has not asked your sex' : null,
    basis.activity_assumed ? 'a desk job until you tell him otherwise' : null,
  ].filter((a): a is string => a !== null);
  const head = `Resting burn about ${basis.bmr.toLocaleString('en-US')} kcal a day — estimated from your age, height and weight, not measured.`;
  return assumed.length > 0 ? `${head} Out assumes ${assumed.join(', and ')}.` : head;
}

function mealClock(time: string): string {
  const hhmm = time.match(/^(\d{2}):(\d{2})$/);
  const parsed = hhmm
    ? { hour: Number(hhmm[1]), minute: hhmm[2] }
    : (() => {
        const date = new Date(time);
        if (Number.isNaN(date.getTime())) return null;
        return { hour: date.getHours(), minute: `${date.getMinutes()}`.padStart(2, '0') };
      })();
  if (!parsed) return time;
  const { hour, minute } = parsed;
  const period = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 || 12;
  return `${h12}:${minute} ${period}`;
}

// --- Macro target rows + commentary (Run B #3) --------------------------------

export interface MiloMacroRow {
  key: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g';
  label: string;
  unit: string;
  value: number;
  target: number | null;
  /** 0–100, clamped. */
  pct: number;
  stateIcon: 'arrow_downward' | 'arrow_upward' | 'task_alt';
  stateColor: 'textSecondary' | 'warning' | 'success';
}

const MACRO_META: Record<MiloMacroRow['key'], { label: string; unit: string; displayUnit: string }> = {
  calories: { label: 'Energy', unit: '', displayUnit: ' kcal' },
  protein_g: { label: 'Protein', unit: ' g', displayUnit: ' g' },
  carbs_g: { label: 'Carbs', unit: ' g', displayUnit: ' g' },
  fat_g: { label: 'Fat', unit: ' g', displayUnit: ' g' },
};

function macroState(value: number, target: number | null | undefined): Pick<MiloMacroRow, 'stateIcon' | 'stateColor' | 'pct'> {
  if (target == null) {
    return { stateIcon: 'task_alt', stateColor: 'textSecondary', pct: 0 };
  }
  const ratio = target > 0 ? value / target : 0;
  const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  // Within 2% counts as "on target" — a single gram over on a 190 g carb target
  // is not a meaningful overshoot, but 5% over on fat is.
  if (ratio < 0.98) return { stateIcon: 'arrow_downward', stateColor: 'textSecondary', pct };
  if (ratio > 1.02) return { stateIcon: 'arrow_upward', stateColor: 'warning', pct };
  return { stateIcon: 'task_alt', stateColor: 'success', pct };
}

export function miloMacroRows(today: MiloToday): MiloMacroRow[] {
  const targets = today.targets;
  return (['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map((key) => {
    const meta = MACRO_META[key];
    const value = today[key];
    const target = targets?.[key] ?? null;
    const state = macroState(value, target);
    return { key, label: meta.label, unit: meta.unit, value, target, ...state };
  });
}

/** Short commentary on where the day stands against targets. Built from the
 *  same numbers the rows show — no new computation, no food advice. */
export function miloMacroNote(today: MiloToday): string | null {
  const rows = miloMacroRows(today);
  const withTarget = rows.filter((r) => r.target !== null);
  if (withTarget.length === 0) return null;

  // The "biggest gap" is the largest RELATIVE shortfall, not the largest
  // absolute number: 60 g short on a 130 g protein target is a bigger gap
  // than 70 kcal short on a 1700 kcal target.
  const short = withTarget
    .filter((r) => r.stateIcon === 'arrow_downward')
    .map((r) => {
      const target = r.target ?? 0;
      const diff = target - r.value;
      return { ...r, diff, rel: target > 0 ? diff / target : 0 };
    })
    .sort((a, b) => b.rel - a.rel)[0];
  const overs = withTarget
    .filter((r) => r.stateIcon === 'arrow_upward')
    .map((r) => ({ ...r, diff: r.value - (r.target ?? 0) }));

  const part = (r: { label: string; key: MiloMacroRow['key']; diff: number; stateIcon: MiloMacroRow['stateIcon'] }) => {
    const diff = Math.round(r.diff);
    const unit = r.key === 'calories' ? ' kcal' : ' g';
    return `${diff.toLocaleString('en-US')}${unit} ${r.stateIcon === 'arrow_upward' ? 'over' : 'short'}`;
  };

  if (!short && overs.length === 0) return 'Everything is on target today.';

  const pieces: string[] = [];
  if (short) pieces.push(`${short.label} is the gap — ${part(short)}.`);
  for (const o of overs) {
    pieces.push(`${o.label} ran ${part(o)}.`);
  }
  return pieces.join(' ');
}

/** Run B #3 — the compact meals strip directly above the log.
 *  Zero meals means no strip: an empty row would make "zero" look observed. */
export function mealStripParts(today: Pick<MiloToday, 'entries' | 'meal_times' | 'best_rated'>): {
  left: string;
  right: string | null;
} | null {
  if (today.entries <= 0) return null;
  const noun = `${today.entries} ${today.entries === 1 ? 'meal' : 'meals'}`;
  const times = today.meal_times.map(mealClock);
  return {
    left: [noun, ...times].join(' · '),
    right: today.best_rated ? `Best rated: ${today.best_rated.dish} ${Math.round(today.best_rated.rating)}/5` : null,
  };
}

// --- Milo's log/timeline (Run B #8) ---

export type MiloLogType = 'all' | 'food' | 'body' | 'photos';

export interface MiloLogEntry {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
  has_photo: boolean;
  photo_id?: string | null;
  /** Founder, 3 Sep 2026 — the log draws the photo itself: presigned URL +
   *  what it IS (a PDF is an inert document chip, never an Image). */
  image_url?: string | null;
  content_type?: string | null;
  superseded_by?: string | null;
  voided?: boolean;
  /** Server-side extraction identity; all meal projections from one receipt
   * share it so the dashboard can show one meal and expand its lines. */
  meal_group_id?: string | null;
}

export interface MiloLogRow {
  id: string;
  sourceKind: string;
  type: 'food' | 'body' | 'other';
  icon: string;
  title: string;
  subtitle: string | null;
  time: string;
  energy: string | null;
  hasPhoto: boolean;
  photoId: string | null;
  imageUrl: string | null;
  contentType: string | null;
  detail: string | null;
  rating: number | null;
  ratingWhy: string | null;
  macros: { label: string; value: string }[];
  reading: string | null;
  mealGroupId?: string | null;
  items?: { id: string; title: string; energy: string | null; detail: string | null; macros: { label: string; value: string }[] }[];
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function metricLabel(metric: string | null): string {
  if (metric === 'body_fat') return 'Body fat';
  if (metric === 'weight') return 'Weight';
  return metric ? metric.replace(/_/g, ' ') : 'Body reading';
}

function mealMacros(payload: Record<string, unknown>): { label: string; value: string }[] {
  return [
    ['Protein', num(payload.protein_g)],
    ['Carbs', num(payload.carbs_g)],
    ['Fat', num(payload.fat_g)],
  ]
    .filter((m): m is [string, number] => m[1] !== null)
    .map(([label, value]) => ({ label, value: `${Math.round(value)}g` }));
}

export function miloLogRow(entry: MiloLogEntry): MiloLogRow | null {
  if (entry.voided || entry.superseded_by) return null;
  const p = entry.payload;
  if (entry.kind === 'meal') {
    const title = text(p.dish) ?? text(p.description) ?? 'Meal';
    const calories = num(p.calories);
    const macros = mealMacros(p);
    const macroLine = macros.length > 0 ? macros.map((m) => `${m.value} ${m.label[0]}`).join(' / ') : null;
    const detail = [text(p.description), text(p.portion)].filter((v): v is string => !!v && v !== title).join(' · ') || null;
    return {
      id: entry.id,
      sourceKind: entry.kind,
      type: 'food',
      icon: 'restaurant',
      title,
      subtitle: [calories !== null ? `${Math.round(calories)} kcal` : null, macroLine].filter(Boolean).join(' · ') || null,
      time: mealClock(entry.created_at),
      energy: calories !== null ? `+${Math.round(calories)} kcal` : null,
      hasPhoto: entry.has_photo,
      photoId: entry.photo_id ?? null,
      imageUrl: entry.image_url ?? null,
      contentType: entry.content_type ?? null,
      detail,
      rating: num(p.rating),
      ratingWhy: text(p.rating_why),
      macros,
      reading: null,
      mealGroupId: entry.meal_group_id ?? null,
    };
  }
  if (entry.kind === 'body') {
    const metric = text(p.metric);
    const value = num(p.value);
    const unit = text(p.unit);
    const reading = value !== null ? `${value}${unit === '%' || unit === 'percent' ? '%' : unit ? ` ${unit}` : ''}` : null;
    return {
      id: entry.id,
      sourceKind: entry.kind,
      type: 'body',
      icon: 'monitor_weight',
      title: metricLabel(metric),
      subtitle: reading,
      time: mealClock(entry.created_at),
      energy: null,
      hasPhoto: entry.has_photo,
      photoId: entry.photo_id ?? null,
      imageUrl: entry.image_url ?? null,
      contentType: entry.content_type ?? null,
      detail: text(p.provenance),
      rating: null,
      ratingWhy: null,
      macros: [],
      reading,
    };
  }
  return {
    id: entry.id,
    sourceKind: entry.kind,
    type: 'other',
    icon: 'notes',
    title: entry.kind.replace(/_/g, ' '),
    subtitle: null,
    time: mealClock(entry.created_at),
    energy: null,
    hasPhoto: entry.has_photo,
    photoId: entry.photo_id ?? null,
    imageUrl: entry.image_url ?? null,
    contentType: entry.content_type ?? null,
    detail: null,
    rating: null,
    ratingWhy: null,
    macros: [],
    reading: null,
  };
}

export function miloLogGroups(entries: MiloLogEntry[], now: Date): { day: string; label: string; rows: MiloLogRow[] }[] {
  const groups: { day: string; label: string; rows: MiloLogRow[] }[] = [];
  for (const entry of entries) {
    const row = miloLogRow(entry);
    if (!row) continue;
    const day = entryDayKey(entry.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else groups.push({ day, label: logDayLabel(day, now), rows: [row] });
  }
  for (const group of groups) {
    const combined: { index: number; row: MiloLogRow }[] = [];
    const byMeal = new Map<string, MiloLogRow[]>();
    const mealIndexes = new Map<string, number>();
    group.rows.forEach((row, index) => {
      if (row.type === 'food' && row.mealGroupId) {
        const rows = byMeal.get(row.mealGroupId) ?? [];
        rows.push(row);
        byMeal.set(row.mealGroupId, rows);
        if (!mealIndexes.has(row.mealGroupId)) mealIndexes.set(row.mealGroupId, index);
      } else combined.push({ index, row });
    });
    for (const [mealGroupId, rows] of byMeal) {
      let row: MiloLogRow;
      if (rows.length === 1) row = rows[0];
      else {
        const calories = rows.reduce((sum, row) => sum + Number((row.energy ?? '').replace(/[^0-9.-]/g, '') || 0), 0);
        const macros = ['Protein', 'Carbs', 'Fat'].map((label) => ({
          label,
          value: `${rows.reduce((sum, row) => sum + Number(row.macros.find((m) => m.label === label)?.value.replace(/[^0-9.-]/g, '') || 0), 0)}g`,
        })).filter((m) => Number(m.value.replace('g', '')) > 0);
        row = {
          ...rows[0],
          id: mealGroupId,
          title: `Meal · ${rows.length} items`,
          subtitle: `${calories} kcal`,
          energy: `+${calories} kcal`,
          detail: null,
          items: rows.map(({ id, title, energy, detail, macros }) => ({ id, title, energy, detail, macros })),
          macros,
          rating: null,
          ratingWhy: null,
        };
      }
      combined.push({ index: mealIndexes.get(mealGroupId) ?? Number.MAX_SAFE_INTEGER, row });
    }
    group.rows = combined.sort((a, b) => a.index - b.index).map(({ row }) => row);
  }
  return groups;
}

export function miloLogTypeChips(entries: MiloLogEntry[]): { key: MiloLogType; label: string; icon: string; count: number }[] {
  const live = entries.filter((e) => !e.voided && !e.superseded_by);
  const countRows = (rows: MiloLogEntry[]) => new Set(rows.map(e =>
    e.kind === 'meal' && e.meal_group_id
      ? JSON.stringify(['meal', entryDayKey(e.created_at), e.meal_group_id])
      : JSON.stringify(['entry', e.id]),
  )).size;
  return [
    { key: 'all', label: 'All', icon: 'list', count: countRows(live) },
    { key: 'food', label: 'Food', icon: 'restaurant', count: countRows(live.filter((e) => e.kind === 'meal')) },
    { key: 'body', label: 'Body', icon: 'monitor_weight', count: countRows(live.filter((e) => e.kind === 'body')) },
    { key: 'photos', label: 'Photos', icon: 'image', count: countRows(live.filter((e) => e.has_photo)) },
  ];
}

export function miloLogSummaryLine(count: number, nextCursor: string | null): string | null {
  if (nextCursor) return null;
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

// --- C92: the weight and body-fat boxes ---

const UNIT_WORD: Record<BodyReading['unit'], string> = { kg: 'kg', lb: 'lb', percent: '%' };

/** How a reading reads: "74.2 kg", "21.4%". */
export function readingText(r: BodyReading): string {
  const unit = UNIT_WORD[r.unit];
  return unit === '%' ? `${r.value}%` : `${r.value} ${unit}`;
}

/** Roughly how long ago, in the words a person would use. Deliberately coarse:
 *  a scale reading is a morning, not a timestamp. */
export function agoWords(iso: string, now: Date): string | null {
  const then = new Date(iso);
  const days = Math.round((now.getTime() - then.getTime()) / 86_400_000);
  if (!Number.isFinite(days)) return null;
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return then.toLocaleDateString(undefined, { month: 'long' });
}

/** The movement line — or null when there is nothing honest to say.
 *
 *  TWO cases return null, and both matter:
 *  · one reading is not a trend;
 *  · two readings in different units were never in the same terms, and
 *    subtracting them would be arithmetic on a record that does not exist.
 *  A zero change is NOT null — "no change since Tuesday" is a real answer. */
export function trendText(series: { latest: BodyReading; previous: BodyReading | null }, now: Date): {
  icon: string;
  text: string;
} | null {
  const prev = series.previous;
  if (!prev || prev.unit !== series.latest.unit) return null;
  const delta = Math.round((series.latest.value - prev.value) * 10) / 10;
  const when = agoWords(prev.at, now);
  const since = when ? ` since ${when}` : '';
  if (delta === 0) return { icon: 'trending_flat', text: `no change${since}` };
  const unit = UNIT_WORD[series.latest.unit];
  const amount = unit === '%' ? `${Math.abs(delta)}%` : `${Math.abs(delta)} ${unit}`;
  return { icon: delta > 0 ? 'arrow_upward' : 'arrow_downward', text: `${amount}${since}` };
}

// --- Penny's honesty rules ---

/** C39: an uncategorised entry is not "Uncategorised" — it is waiting on a
 *  word from the user, and the label says which. */
export const WAITING_ON_A_NAME = 'Waiting on a name';

export function categoryLabel(category: string | null): string {
  return category ?? WAITING_ON_A_NAME;
}

// 3 Sep 2026 — the second line of a filing: "Children · tuition". Null
// subcategory is the common case and changes nothing.
export function categorySubLabel(category: string | null, subcategory: string | null): string {
  if (!category) return categoryLabel(null);
  return subcategory ? `${category} · ${subcategory}` : category;
}

/** Money, in the currency it was recorded in. NEVER converted: there is no FX
 *  table at P0 (D3), so a foreign amount is shown in its own currency or not
 *  at all — a converted number would be one Penny cannot defend. */
export function money(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** C39's Today comparison, computed from the two full-set server totals. */
export function pennyTodayDelta(today: number, yesterday: number, currency: string): string {
  const more = today >= yesterday;
  return `${money(currency, Math.abs(today - yesterday))} ${more ? 'more' : 'less'} spent today`;
}

/** Subset metric tiles are toggles; totals never call this helper. */
export function togglePennyMetricFilter(current: string, target: string): string {
  return current === target ? 'all' : target;
}

/** The budget line under the bar. Positive delta = under the mark.
 *  C06: this states the position and stops — no praise for being under, no
 *  warning for being over. Being over your own pace is information. */
export function paceNote(b: PennyBudget): string {
  const days = `${b.days_left} day${b.days_left === 1 ? '' : 's'} left`;
  if (b.delta === 0) return `Exactly on the mark · ${days}`;
  const amount = money(b.currency, Math.abs(b.delta));
  return `${amount} ${b.delta > 0 ? 'under' : 'over'} the even mark · ${days}`;
}

/** A category's share of the visible total, for its bar. Presentation only —
 *  the totals themselves all came from the ledger. */
export function categoryShare(row: CategoryRow, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((row.total / total) * 1000) / 10));
}

// --- Penny's chart maths (sub-slice B) — the drawn computations, mirrored ---
// These live here, not in the components, because a chart is exactly where a
// surface could quietly invent something; so they are what gets tested.

/** The daily-spend card's deviation bars — the drawing's maths
 *  (:2720-2729): each day deviates from the window's daily average, the
 *  tallest bar is the worst deviation, and the floor keeps a real-but-tiny
 *  deviation visible. `heightPct` is that pixel height as a 0–1 fraction of
 *  the 56px maximum, for RN. `over` is strictly positive — a zero deviation
 *  draws no bar at all (the drawing hides both halves for ±0). */
export function deviationBars(
  daily: SeriesDay[],
  dailyAvg: number,
): { day: string; total: number; dev: number; over: boolean; heightPct: number }[] {
  const devs = daily.map((d) => d.total - dailyAvg);
  const worst = Math.max(...devs.map(Math.abs), 0) || 1; // the drawing's `|| 1` guard
  return daily.map((d, i) => {
    const dev = devs[i];
    return {
      day: d.day,
      total: d.total,
      dev,
      over: dev > 0,
      heightPct: Math.max(3, Math.round((Math.abs(dev) / worst) * 56)) / 56,
    };
  });
}

/** The per-bar label: `+x` / `−x` / `±x`, with the drawing's minus sign
 *  (:2725). No currency — the bar sits under a header that already named it. */
export function deviationLabel(dev: number): string {
  const sign = dev > 0 ? '+' : dev < 0 ? '−' : '±';
  return `${sign}${Math.abs(dev).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The running-total polyline as rotated-View segments (no SVG at P0).
 *  Points are mapped into the card's box with the drawing's maths
 *  (:2617-2618): column i centres at step·(i+0.5), value v sits at
 *  height − v/max·(height−10). Each segment is its midpoint, its length,
 *  and its angle in degrees (RN's y axis points DOWN, so a rising line has
 *  a negative angle). x/y are the segment's centre — position the View by
 *  its centre and rotate in place. */
export function polylineSegments(
  points: SeriesDay[],
  width: number,
  height: number,
  maxValue: number,
): { x: number; y: number; length: number; angleDeg: number }[] {
  const step = width / points.length;
  const xy = points.map((p, i) => ({
    x: step * (i + 0.5),
    y: height - (maxValue > 0 ? (p.total / maxValue) * (height - 10) : 0),
  }));
  const segments: { x: number; y: number; length: number; angleDeg: number }[] = [];
  for (let i = 0; i + 1 < xy.length; i++) {
    const a = xy[i];
    const b = xy[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    segments.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      length: Math.hypot(dx, dy),
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    });
  }
  return segments;
}

/** The range header's sublabel — the drawn words (:2693) derived from the
 *  SAME window the server filtered by, so the label and the window cannot
 *  disagree (C75). A window that crosses a month says both months. */
export function rangeSub(window: { from: string; to: string }, range: PennyRange): string {
  const parse = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  };
  const mon = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short' });
  const from = parse(window.from);
  const to = parse(window.to);
  if (range === 'today') {
    return `${to.toLocaleDateString('en-US', { weekday: 'short' })} · ${to.getDate()} ${mon(to)}`;
  }
  if (range === 'year') {
    return from.getMonth() === to.getMonth()
      ? `${mon(to)} ${to.getFullYear()}`
      : `${mon(from)} – ${mon(to)} ${to.getFullYear()}`;
  }
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${to.getDate()} ${mon(to)}`
    : `${from.getDate()} ${mon(from)} – ${to.getDate()} ${mon(to)}`;
}

/** "1 visit" / "N visits" (:2611). */
export function visitsWord(n: number): string {
  return `${n} ${n === 1 ? 'visit' : 'visits'}`;
}

// --- Run B #5 — the custom range's typed dates ---

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** Run B #5 — parse what the user typed into a canonical YYYY-MM-DD, or
 *  null. Accepts ISO ("2026-07-01"), month names ("1 jul 2026",
 *  "12 August 2026", any case), and d/m/y slashes ("1/7/26", "1/7/2026" —
 *  day-first, matching the month-name forms). Two-digit years are 20xx.
 *  The server only speaks canonical ISO, so this normalises before the
 *  fetch rather than letting a good date 400. `today` is injected so the
 *  "not in the future" check is pure and testable. */
export function parseCustomDate(input: string, today: string): string | null {
  const s = input.trim().replace(/\s+/g, ' ');
  let y: number;
  let m: number;
  let d: number;
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else if ((match = s.match(/^(\d{1,2}) ([a-z]+) (\d{2}|\d{4})$/i))) {
    // Month names by prefix, minimum 3 letters — "ju" is NOT accepted, so
    // "jun"/"jul" stay distinct; anything ≥3 letters has a unique match.
    const token = (match[2] as string).toLowerCase();
    if (token.length < 3) return null;
    const hits = MONTH_NAMES.filter((name) => name.startsWith(token));
    if (hits.length !== 1) return null;
    d = Number(match[1]);
    m = MONTH_NAMES.indexOf(hits[0] as string) + 1;
    y = Number(match[3]);
    if ((match[3] as string).length === 2) y += 2000;
  } else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    if ((match[3] as string).length === 2) y += 2000;
  } else {
    return null;
  }
  const canonical = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const parsed = Date.parse(`${canonical}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;
  // Round-trip kills 31/2/26-style impostors (Date.parse normalises them).
  if (new Date(parsed).toISOString().slice(0, 10) !== canonical) return null;
  // Fork 5's client half: not a future date. The server re-checks against the
  // ANCHOR — a device/anchor disagreement surfaces as its 400.
  if (canonical > today) return null;
  return canonical;
}

/** The drawn field label (:855-857): "1 Jul 2026" from a canonical day. */
export function customFieldLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return `${dt.getDate()} ${dt.toLocaleDateString('en-US', { month: 'short' })} ${dt.getFullYear()}`;
}

// --- Penny's log (sub-slice C) — the words around the searchable ledger ---

/** The device-local YYYY-MM-DD of a moment. The log groups rows by day and
 *  looks each day's total up in the series `daily` array (the server's
 *  anchored days); when the device and the anchor disagree the lookup simply
 *  finds nothing and the divider shows no total — never a page-sum guess. */
export function localDayKey(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Use the server's calendar day when supplied (Penny purchase chronology).
 * Never parse a date-only value as UTC: it has no timezone or clock precision.
 * Older responses and other neighbours retain their existing filing-day path. */
export function entryDayKey(iso: string, effectiveDay?: string): string {
  return effectiveDay ?? localDayKey(parseServerDate(iso));
}

/** The log's day-divider label — the drawing's dayLabelFor (:2220-2224):
 *  today is named, everything else is "Wed 12 Aug". */
export function logDayLabel(day: string, now: Date, anchoredToday?: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const month = dt.toLocaleDateString('en-US', { month: 'short' });
  const label = `${weekday} ${dt.getDate()} ${month}`;
  return day === (anchoredToday ?? localDayKey(now)) ? `Today · ${label}` : label;
}

/** The log's summary line — "N entries · $total", with both halves earned.
 *  `count` is null when no honest whole-set count exists (a searched page
 *  that paginated: the server counts windows, not queries) — then the line
 *  is not drawn at all. `total` is null whenever the fetched page is not the
 *  whole set (next_cursor present): a sum over a partial page is a quiet
 *  partial sum, which the 28i rule forbids. */
export function logSummaryLine(count: number | null, total: number | null, currency: string): string | null {
  if (count === null) return null;
  const noun = `${count} ${count === 1 ? 'entry' : 'entries'}`;
  return total === null ? noun : `${noun} · ${money(currency, total)}`;
}

// --- Mira's honesty rules ---

/** A journal's dateline. Today and yesterday are named; everything else gets
 *  its date, because a journal is read by WHEN and "3 days ago" makes a
 *  reader do arithmetic to find a Tuesday. */
export function dayLabel(day: string, now: Date): string {
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const yesterdayDate = new Date(now.getTime() - 86_400_000);
  const yesterday = new Date(yesterdayDate.getTime() - yesterdayDate.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// --- the wallet's honesty rules ---

/** "38 photos, if that is what you spend them on."
 *
 *  The hedge is the whole line: coins also buy a week-pass and merch, so a
 *  bare "38 photos" would state a plan the user never made. C06 allows the
 *  balance (it is what you HAVE); it does not allow implying a use. */
export function coinsInPhotos(coins: number): number {
  return Math.floor(coins / COINS_PER_PHOTO);
}

/** Run B #15's hero sub-line, drawn as "38 photos, if that is what you spend
 *  them on". A pure function because the line has been rewritten once already
 *  (PAR-B15, restored 5 Sep): the hedge belongs to the drawing, not to whoever
 *  edits the screen next, and a helper can be pinned by a test where inline JSX
 *  could not. Counts through coinsInPhotos so the rate has ONE home. */
export function coinsWorthLine(coins: number): string {
  return `${coinsInPhotos(Math.max(0, coins)).toLocaleString('en-US')} photos, if that is what you spend them on`;
}

/** Every coin-transaction kind, in the user's words. An unknown kind falls
 *  back to something true rather than a raw enum: the ledger may gain kinds
 *  the app has not shipped words for, and a screen that prints
 *  "referral_credit" has failed at the only job this function has. */
export function coinKindLabel(kind: string): string {
  switch (kind) {
    case 'purchase_pack':
      return 'Bought';
    case 'referral_credit':
      return 'Someone settled in';
    case 'milestone':
      return 'Milestone';
    case 'kept_credits':
      return 'Exchanged for credits';
    case 'week_pass':
      return 'Week pass';
    case 'adjustment':
      return 'Adjustment';
    default:
      return kind.replace(/_/g, ' ');
  }
}

export function signedCoins(delta: number): string {
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('en-US')}`;
}

/** "3 of 15 · 5 yours, 10 from Mira living here."
 *
 *  Two sentences because they answer two questions — how many are left, and
 *  WHY the number is what it is. The second half is what makes inviting a
 *  neighbour legible as a thing that widens the street rather than a bill. */
export function allowanceWords(a: Allowance, residentNames: string[]): { left: string; because: string | null } {
  const left = `${Math.max(0, a.cap - a.used)} of ${a.cap}`;
  if (a.from_neighbours <= 0) return { left, because: null };
  const who =
    residentNames.length === 1
      ? `${residentNames[0]} living here`
      : `${residentNames.length} neighbours living here`;
  return { left, because: `${a.base} yours, ${a.from_neighbours} from ${who}.` };
}

// --- Settings' honesty rules ---

/** C49: a subject absent from the bag is ON. The toggle must reflect the
 *  BEHAVIOUR, not the presence of a row — a user who has never touched
 *  notifications is receiving them, and a switch drawn off would be lying
 *  about what the app is doing. */
export function knockOn(settings: UserSettings['settings'], neighbour: string): boolean {
  return settings?.notifications?.subjects?.[neighbour] !== false;
}

/** "3 of 4 on" — counted over the neighbours actually in residence, because a
 *  count that includes someone who does not live here is a count of nothing. */
export function knocksOnCount(settings: UserSettings['settings'], neighbours: string[]): string {
  const on = neighbours.filter((n) => knockOn(settings, n)).length;
  return `${on} of ${neighbours.length} on`;
}

export const DEFAULT_QUIET_HOURS = { start: '22:00', end: '07:00' };

/** "Nothing knocks between 22:00 and 07:00." The window may wrap midnight,
 *  and saying so plainly is easier to check than a pair of pickers. */
export function quietHoursWords(settings: UserSettings['settings']): string {
  const q = settings?.quiet_hours ?? DEFAULT_QUIET_HOURS;
  return `Nothing knocks between ${q.start} and ${q.end}.`;
}

/** Parse what the user typed into a canonical "HH:MM", or null. Accepts
 *  "7:05" and "07:05"; the server's regex accepts only the canonical form,
 *  so this normalises before the PATCH rather than letting a good time 400. */
export function parseQuietTime(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

// --- C95: the emotion set, in the app's words and icons ---
//
// The server sends a TOKEN; this module owns the glyph and the word, exactly
// as it does for entry chips. An emotion the app has not shipped words for
// renders as nothing rather than as a raw token — the ledger may gain one
// before the app does.
// C45's five, which is CANON: "The emotion set is FIXED AT FIVE: Good ·
// Hopeful · Reflective · Stressed · Low. A sixth emotion is a canon PR, not a
// tag." It shipped as C95's seven, and C95 marks that list "DRAFT (founder
// wordsmiths); the SHAPE is what is ruled" — the shape was the ruling, the
// words were never ratified, and the code took the draft for canon.
//
// Capitalised here because these are the CHIPS, and the drawing capitalises
// them; the stored values are lowercase.
const EMOTIONS: Record<string, { icon: string; label: string }> = {
  good: { icon: 'sentiment_satisfied', label: 'Good' },
  hopeful: { icon: 'wb_sunny', label: 'Hopeful' },
  reflective: { icon: 'self_improvement', label: 'Reflective' },
  stressed: { icon: 'pending', label: 'Stressed' },
  low: { icon: 'sentiment_dissatisfied', label: 'Low' },
};

/** Entries stored before the five was enforced carry C95's draft words.
 *
 *  Mapped for DISPLAY only — the stored value stays what Mira read at the
 *  time. Re-tagging would rewrite what she recorded about somebody's day,
 *  which is the same objection C95 makes about a cleaned version replacing the
 *  raw.
 *
 *  `angry` is the uncomfortable one: it has no home among the five, and
 *  deciding a person's anger was "stress" is a judgement about their feeling
 *  (C96 — she never names the feeling back). Display-only means that judgement
 *  is never written down. */
const LEGACY_EMOTIONS: Record<string, string> = {
  glad: 'good',
  calm: 'reflective',
  tired: 'low',
  anxious: 'stressed',
  angry: 'stressed',
  mixed: 'reflective',
};

export function emotionChip(emotion: string | null): { icon: string; label: string } | null {
  if (!emotion) return null;
  return EMOTIONS[emotion] ?? EMOTIONS[LEGACY_EMOTIONS[emotion] ?? ''] ?? null;
}

// Counts in a sentence (founder ruling, 5 Sep 2026). The drawings split prose
// from data: #77 draws "Choose which four" and, beside it, "You have 5 a day"
// marked `.num`. A number inside a sentence is a word; a number that is DATA is
// a numeral you scan. Ten is the cap — "Choose which twelve" is worse than
// "Choose which 12".
//
// Duplicated from the server's copy/numbers.ts rather than shared: the two are
// separate packages and a text helper is not worth a dependency between them.
// Both are pinned by tests against the same table, so a drift shows up as a
// failure rather than as two subtly different voices.
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const;

/** A COUNT inside a sentence. Never for money, calories, quantities or times. */
export function countWord(n: number): string {
  return Number.isInteger(n) && n >= 0 && n <= 10 ? COUNT_WORDS[n] : String(n);
}

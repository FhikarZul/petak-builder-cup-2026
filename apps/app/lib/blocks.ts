// App slice 2 (plan §2) — message blocks, PURE (the unit-test target).
// The server's messages.blocks jsonb (0023) is an OPEN kind set: this module
// narrows the raw payload into typed unions per kind. Malformed blocks and
// unknown kinds drop SILENTLY (forward-compatible) — a block decorates a
// message, it never replaces it; the bubble body always renders regardless.
// Field names mirror the ONE home for the shapes, apps/server/src/blocks.ts.

export interface EntryCardBlock {
  kind: 'entry_card';
  neighbour: string;
  entryId: string;
  entryKind: string;
  title: string | null;
  /** Semantic tokens, never copy ('evidence', 'no_receipt'). */
  chips: string[];
  /** The strip state where the server knows it — only 'estimate' rides the block. */
  honesty: 'estimate' | null;
}

/** A quiet footnote UNDER a reply's buttons (#72) — secondary text, no icon,
 *  no border, which is why it is not a chip. Semantic token; MessageNote owns
 *  the words, and an unknown token renders nothing. */
export interface NoteBlock {
  kind: 'note';
  token: string;
}

/** #69 — the record-honesty strip on a reply that WAS an undo. Carries no
 *  time: the strip belongs to this reply, so the row reads the message's own
 *  clock rather than a second one that could disagree. */
/** #66 — the weekly draft's figures. Label/value rows the server computes; the
 *  values are numerals because they are the record, and a record is scanned. */
/** #65 — a reflection page's two ways back into the writing. NOT an ask: a
 *  reflection asks nothing, so there is no task, no open question and nothing
 *  to nag about. Navigation, which is why it is not the ask's buttons. */
export interface PageActionsBlock {
  kind: 'page_actions';
  labels: string[];
}

export interface FiguresBlock {
  kind: 'figures';
  rows: { label: string; value: string }[];
}

export interface UndoneBlock {
  kind: 'undone';
}

/** Message-level chips (#50 + the small-chips bucket). Semantic tokens, never
 *  copy — this module owns the words and the icons. Unknown tokens are simply
 *  not rendered, so the server can emit ahead of the app. */
export interface ChipsBlock {
  kind: 'chips';
  tokens: string[];
  /** #43 — values for {placeholders} in a chip's label. The app owns the
   *  sentence; only a number the app cannot derive crosses from the server. */
  values?: Record<string, string>;
}

export interface MoveInPickerBlock {
  kind: 'move_in_picker';
  neighbours: ('penny' | 'mira' | 'milo')[];
}

/** Run A #23 — the filing line's category, tappable. Carries the merchant and
 *  the current category so the tap can send "FairPrice is Household from now
 *  on" without parsing a word out of a sentence. */
export interface CategoryPillBlock {
  kind: 'category_pill';
  merchant: string;
  category: string;
}

export interface TaskActionsBlock {
  kind: 'task_actions';
  taskId: string;
  labels: string[];
  /** The DASHED way out, drawn apart from the choices because it is not one
   *  of them (#35/#36 — "every one visibly skippable"). Absent on a yes/no
   *  pair, where declining IS one of the two answers. */
  skip?: string;
  /** What this set of choices IS, when the app should render more than a row
   *  of words for it. The server sends the token; the explanations live in the
   *  app (6 Sep 2026 — Milo's objectives). Unknown tokens render as an ordinary
   *  row, so the server can ship a new one ahead of the app. */
  explain?: 'objective';
}

export interface ProfileFormBlock {
  kind: 'profile_form';
  taskId: string;
  /** Field TOKENS, in the server's order — C47 puts weight last. The labels
   *  and reasons live in lib/profileForm.ts. */
  fields: string[];
}

export interface UndoBlock {
  kind: 'undo';
  taskId: string;
}

export interface VisitorBlock {
  kind: 'visitor';
  /** The visitor's neighbour id (Ollie knocking in Penny's thread). */
  from: string;
}

export interface QueueNoteBlock {
  kind: 'queue_note';
  /** Photos read today (server-computed — the client never derives them). */
  readToday: number;
  /** Photos still waiting on the allowance reset. */
  waiting: number;
}

export interface CoinsBlock {
  kind: 'coins';
  /** DRAFT until the economy sets amounts — null renders the label only. */
  amount: number | null;
  label: string;
}

export interface PageBlock {
  kind: 'page';
  title: string | null;
  dateline: string;
  /** C95 — the day's feeling, COUNTED from its entries. Null when the day
   *  had nothing readable; absent on pages that are not reflections. */
  emotion?: string | null;
}

export interface DraftBlock {
  kind: 'draft';
  title: string | null;
  dateline: string;
}

export interface ObjectiveTableBlock {
  kind: 'objective_table';
  /** Machine-keyed rows (calories/protein_g/carbs_g/fat_g); null when the
   * before-state isn't known at the reply site (as-built: always null). */
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  working: string | null;
}

// W5 — the structured answers. Every number in these three arrived computed
// from the ledger; the app never derives one, it only draws.
export interface PaceMarkBlock {
  kind: 'pace_mark';
  spent: number;
  budget: number;
  currency: string;
  days_left: number;
  per_day_left: number;
  /** Percentages of the budget: the fill, and where the even-pace mark sits. */
  spent_pct: number;
  expected_pct: number;
}

export interface SpendTableBlock {
  kind: 'spend_table';
  /** The date range — "4–10 Aug". The header carries the currency too. */
  label: string;
  currency: string;
  rows: { category: string; total: number }[];
  total: number;
}

/** C15/C54: the verdict is a WORD. The app owns the glyph and the colour. */
export interface DayCloseRow {
  label: string;
  value: number;
  target: number;
  unit: string;
  verdict: 'on_target' | 'short' | 'over';
}
export interface DayCloseBlock {
  kind: 'day_close';
  rows: DayCloseRow[];
}

/** Run C #70 — the entry an ASK is about, drawn inside the ask. Facts only:
 *  this module owns the separator, the currency and the "filed it" phrasing,
 *  exactly as it does for entry_card. `filedBy` is the neighbour who filed
 *  the referenced entry — the OTHER one, which is the point of the row. */
export interface ReferencedEntryBlock {
  kind: 'referenced_entry';
  photoId: string | null;
  filedBy: string;
  title: string | null;
  amount: number | null;
  currency: string | null;
  /** ISO — the app renders the clock time. */
  at: string | null;
}

/** Run C #71 — the plates linked to a receipt, drawn inside Penny's answer.
 *  Facts only: this module owns the chip label, the footer words and the
 *  "· kcal" phrasing. `filedBy` is the plates' filer — the OTHER neighbour. */
export interface ReceiptPlatesBlock {
  kind: 'receipt_plates';
  receiptPhotoId: string;
  receiptEntryId: string;
  filedBy: string;
  plates: { photoId: string; entryId: string; dish: string | null; calories: number | null; at: string }[];
}

/** C85 (#13) — what a multi-photo entry cost. The server supplies the
 *  numbers, the app supplies the words: unlike the semantic `chips` block,
 *  these carry values that cannot live in a lookup table. */
export interface CostChipsBlock {
  kind: 'cost_chips';
  credits: number;
  photos: number;
  entries: number;
}

/** Run B #6 — the receipt detail card Penny shows after filing a receipt.
 *  Every number is from the ledger; the app owns the layout and the words. */
export interface ReceiptLineItem {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
}
export interface ReceiptPayment {
  kind: 'cash' | 'card' | 'loyalty_redemption' | 'other';
  label: string | null;
  amount: number | null;
}
export interface ReceiptAdjustment {
  kind: 'discount' | 'service_charge' | 'tax' | 'rounding' | 'other';
  label: string | null;
  amount: number;
  includedInItems: boolean | null;
}
export interface ReceiptDetailBlock {
  kind: 'receipt_detail';
  entryId: string;
  merchant: string | null;
  category: string | null;
  amount: number;
  currency: string;
  at: string;
  date: string | null;
  itemsTotal: number | null;
  printedTotal: number | null;
  lineItems: ReceiptLineItem[] | null;
  payments?: ReceiptPayment[] | null;
  grossAmount?: number | null;
  redeemedAmount?: number | null;
  adjustments?: ReceiptAdjustment[] | null;
  question: string | null;
  /** #62/#63 — the same two fields the entry card carries. The server picks
   *  ONE card, so a detail card that lacked these silently dropped the estimate
   *  strip and the evidence chips. */
  chips: string[];
  honesty: 'estimate' | null;
  homeAmount?: number | null;
  homeCurrency?: string | null;
  homeAmountBasis?: 'charge' | 'rate' | null;
  homeAmountSource?: 'user' | 'statement' | null;
  fxEstimate?: Record<string, unknown> | null;
}

/** Run B #6 — the meal detail card Milo shows after filing a meal. */
export interface MealDetailBlock {
  kind: 'meal_detail';
  entryId: string;
  dish: string;
  portion: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  rating: number | null;
  rating_why: string | null;
  at: string;
  question: string | null;
  /** #62/#63 — the same two fields the entry card carries. The server picks
   *  ONE card, so a detail card that lacked these silently dropped the estimate
   *  strip and the evidence chips. */
  chips: string[];
  honesty: 'estimate' | null;
}

export type MessageBlock =
  | CategoryPillBlock
  | ChipsBlock
  | MoveInPickerBlock
  | EntryCardBlock
  | NoteBlock
  | UndoneBlock
  | FiguresBlock
  | PageActionsBlock
  | ProfileFormBlock
  | TaskActionsBlock
  | UndoBlock
  | VisitorBlock
  | QueueNoteBlock
  | CoinsBlock
  | PageBlock
  | DraftBlock
  | ObjectiveTableBlock
  | PaceMarkBlock
  | SpendTableBlock
  | DayCloseBlock
  | CostChipsBlock
  | ReferencedEntryBlock
  | ReceiptPlatesBlock
  | ReceiptDetailBlock
  | MealDetailBlock;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function strOrNull(value: unknown): string | null | undefined {
  return typeof value === 'string' || value === null ? value : undefined;
}

function strArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : null;
}

function numOrNull(value: unknown): number | null | undefined {
  return typeof value === 'number' || value === null ? value : undefined;
}

function recordOrNull(value: unknown): Record<string, unknown> | null | undefined {
  return isRecord(value) || value === null ? (value as Record<string, unknown> | null) : undefined;
}

function receiptPayments(value: unknown): ReceiptPayment[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const result: ReceiptPayment[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.kind !== 'string' || !['cash', 'card', 'loyalty_redemption', 'other'].includes(item.kind)) return null;
    if (item.amount !== null && (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 0)) return null;
    if (item.label !== null && typeof item.label !== 'string') return null;
    result.push({ kind: item.kind as ReceiptPayment['kind'], label: item.label, amount: item.amount });
  }
  return result;
}

function receiptAdjustments(value: unknown): ReceiptAdjustment[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const result: ReceiptAdjustment[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.kind !== 'string' || !['discount', 'service_charge', 'tax', 'rounding', 'other'].includes(item.kind)
      || typeof item.amount !== 'number' || !Number.isFinite(item.amount)) return null;
    result.push({ kind: item.kind as ReceiptAdjustment['kind'], label: strOrNull(item.label) ?? null,
      amount: item.amount, includedInItems: typeof item.included_in_items === 'boolean' ? item.included_in_items : null });
  }
  return result;
}

function receiptAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Narrow one raw block; null when the kind is unknown or the shape is off. */
export function parseBlock(raw: unknown): MessageBlock | null {
  if (!isRecord(raw)) return null;
  switch (raw.kind) {
    case 'entry_card': {
      const neighbour = str(raw.neighbour);
      const entryId = str(raw.entry_id);
      const entryKind = str(raw.entry_kind);
      const title = strOrNull(raw.title);
      const chips = strArray(raw.chips ?? []);
      const honesty = raw.honesty === 'estimate' || raw.honesty === null || raw.honesty === undefined ? (raw.honesty ?? null) : undefined;
      if (!neighbour || !entryId || !entryKind || title === undefined || !chips || honesty === undefined) return null;
      // Old persisted cards can carry this expense-only token in other domains.
      return { kind: 'entry_card', neighbour, entryId, entryKind, title,
        chips: chips.filter(chip => chip !== 'no_receipt' || entryKind === 'expense'), honesty };
    }
    case 'category_pill': {
      const merchant = str(raw.merchant);
      const category = str(raw.category);
      if (!merchant || !category) return null;
      return { kind: 'category_pill', merchant, category };
    }
    case 'chips': {
      const tokens = strArray(raw.tokens);
      if (!tokens || tokens.length === 0) return null;
      // #43 — values fill {placeholders} in this app's labels; the words stay
      // here, only the number crosses.
      const values =
        raw.values && typeof raw.values === 'object' && !Array.isArray(raw.values)
          ? Object.fromEntries(
              Object.entries(raw.values as Record<string, unknown>).filter(
                (e): e is [string, string] => typeof e[1] === 'string',
              ),
            )
          : undefined;
      return values && Object.keys(values).length > 0 ? { kind: 'chips', tokens, values } : { kind: 'chips', tokens };
    }
    case 'page_actions': {
      const labels = strArray(raw.labels);
      return labels && labels.length > 0 ? { kind: 'page_actions', labels } : null;
    }
    case 'figures': {
      if (!Array.isArray(raw.rows)) return null;
      const rows = raw.rows
        .filter((r): r is { label: string; value: string } =>
          !!r && typeof (r as { label?: unknown }).label === 'string' && typeof (r as { value?: unknown }).value === 'string')
        .map((r) => ({ label: r.label, value: r.value }));
      return rows.length > 0 ? { kind: 'figures', rows } : null;
    }
    case 'undone':
      return { kind: 'undone' };
    case 'note': {
      const token = typeof raw.token === 'string' ? raw.token.trim() : '';
      if (token.length === 0) return null;
      return { kind: 'note', token };
    }
    case 'move_in_picker': {
      const neighbours = strArray(raw.neighbours);
      // One to three P0 names, no duplicates. Three is the first-run picker;
      // ONE is an empty-room offer (internal-reference) — Ollie sells the neighbour he
      // names, and a length-3 check dropped her invite silently.
      if (
        !neighbours ||
        neighbours.length === 0 ||
        neighbours.length > 3 ||
        neighbours.some((neighbour) => !['penny', 'mira', 'milo'].includes(neighbour)) ||
        new Set(neighbours).size !== neighbours.length
      ) return null;
      return { kind: 'move_in_picker', neighbours: neighbours as ('penny' | 'mira' | 'milo')[] };
    }
    case 'profile_form': {
      const taskId = str(raw.task_id);
      const fields = strArray(raw.fields);
      if (!taskId || !fields || fields.length === 0) return null;
      return { kind: 'profile_form', taskId, fields };
    }
    case 'task_actions': {
      const taskId = str(raw.task_id);
      const labels = strArray(raw.labels);
      if (!taskId || !labels || labels.length === 0) return null;
      const skip = str(raw.skip);
      // An unrecognised token is DROPPED rather than passed through, so a
      // future server value can never reach a renderer that does not know it.
      const explain = str(raw.explain) === 'objective' ? ('objective' as const) : undefined;
      return { kind: 'task_actions', taskId, labels, ...(skip ? { skip } : {}), ...(explain ? { explain } : {}) };
    }
    case 'referenced_entry': {
      const filedBy = str(raw.filed_by);
      const photoId = strOrNull(raw.photo_id);
      const title = strOrNull(raw.title);
      const amount = numOrNull(raw.amount);
      const currency = strOrNull(raw.currency);
      const at = strOrNull(raw.at);
      if (!filedBy || photoId === undefined || title === undefined || amount === undefined || currency === undefined || at === undefined)
        return null;
      return { kind: 'referenced_entry', photoId, filedBy, title, amount, currency, at };
    }
    case 'receipt_plates': {
      const receiptPhotoId = str(raw.receipt_photo_id);
      const receiptEntryId = str(raw.receipt_entry_id);
      const filedBy = str(raw.filed_by);
      if (!receiptPhotoId || !receiptEntryId || !filedBy || !Array.isArray(raw.plates)) return null;
      const plates: ReceiptPlatesBlock['plates'] = [];
      for (const r of raw.plates) {
        if (!isRecord(r)) return null;
        const photoId = str(r.photo_id);
        const entryId = str(r.entry_id);
        const dish = strOrNull(r.dish);
        const calories = numOrNull(r.calories);
        const at = str(r.at);
        if (!photoId || !entryId || dish === undefined || calories === undefined || !at) return null;
        plates.push({ photoId, entryId, dish, calories, at });
      }
      if (plates.length === 0) return null;
      return { kind: 'receipt_plates', receiptPhotoId, receiptEntryId, filedBy, plates };
    }
    case 'undo': {
      const taskId = str(raw.task_id);
      if (!taskId) return null;
      return { kind: 'undo', taskId };
    }
    case 'visitor': {
      const from = str(raw.from);
      if (!from) return null;
      return { kind: 'visitor', from };
    }
    case 'queue_note': {
      const readToday = typeof raw.read_today === 'number' ? raw.read_today : null;
      const waiting = typeof raw.waiting === 'number' ? raw.waiting : null;
      if (readToday === null || waiting === null) return null;
      return { kind: 'queue_note', readToday, waiting };
    }
    case 'coins': {
      const amount = numOrNull(raw.amount);
      const label = str(raw.label);
      if (amount === undefined || !label) return null;
      return { kind: 'coins', amount, label };
    }
    case 'page':
    case 'draft': {
      const title = strOrNull(raw.title);
      const dateline = str(raw.dateline);
      if (title === undefined || !dateline) return null;
      const emotion = strOrNull(raw.emotion);
      return { kind: raw.kind, title, dateline, ...(emotion !== undefined ? { emotion } : {}) };
    }
    case 'objective_table': {
      const oldRows = recordOrNull(raw.old);
      const newRows = recordOrNull(raw.new);
      const working = strOrNull(raw.working);
      if (oldRows === undefined || newRows === undefined || working === undefined) return null;
      return { kind: 'objective_table', old: oldRows, new: newRows, working };
    }
    case 'pace_mark': {
      const n = (v: unknown) => (typeof v === 'number' ? v : null);
      const spent = n(raw.spent);
      const budget = n(raw.budget);
      const currency = str(raw.currency);
      const daysLeft = n(raw.days_left);
      const perDayLeft = n(raw.per_day_left);
      const spentPct = n(raw.spent_pct);
      const expectedPct = n(raw.expected_pct);
      if (
        spent === null || budget === null || !currency || daysLeft === null ||
        perDayLeft === null || spentPct === null || expectedPct === null
      ) {
        return null;
      }
      return {
        kind: 'pace_mark',
        spent,
        budget,
        currency,
        days_left: daysLeft,
        per_day_left: perDayLeft,
        spent_pct: spentPct,
        expected_pct: expectedPct,
      };
    }
    case 'spend_table': {
      const label = str(raw.label);
      const currency = str(raw.currency);
      const total = typeof raw.total === 'number' ? raw.total : null;
      if (!label || !currency || total === null || !Array.isArray(raw.rows)) return null;
      const rows: { category: string; total: number }[] = [];
      for (const r of raw.rows) {
        if (!isRecord(r)) return null;
        const category = str(r.category);
        const rowTotal = typeof r.total === 'number' ? r.total : null;
        if (!category || rowTotal === null) return null;
        rows.push({ category, total: rowTotal });
      }
      return { kind: 'spend_table', label, currency, rows, total };
    }
    case 'cost_chips': {
      const n = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null);
      const credits = n(raw.credits);
      const photos = n(raw.photos);
      const entries = n(raw.entries) ?? 1;
      // A cost with no number is not a cost — it drops rather than render
      // "· credits spent" with a blank where the figure should be.
      if (credits === null || photos === null) return null;
      return { kind: 'cost_chips', credits, photos, entries };
    }
    case 'receipt_detail': {
      const entryId = str(raw.entry_id);
      const merchant = strOrNull(raw.merchant);
      const category = strOrNull(raw.category);
      const amount = typeof raw.amount === 'number' ? raw.amount : null;
      const currency = str(raw.currency);
      const at = str(raw.at);
      const date = strOrNull(raw.date);
      const itemsTotal = numOrNull(raw.items_total);
      const printedTotal = numOrNull(raw.printed_total);
      const question = strOrNull(raw.question);
      if (!entryId || amount === null || !currency || !at) return null;
      const lineItems: ReceiptLineItem[] | null = Array.isArray(raw.line_items)
        ? raw.line_items.map((item) => {
            if (!isRecord(item)) return null;
            const name = str(item.name);
            const quantity = numOrNull(item.quantity);
            const unitPrice = numOrNull(item.unit_price);
            const lineAmount = typeof item.amount === 'number' ? item.amount : null;
            if (!name || lineAmount === null) return null;
            return { name, quantity, unitPrice, amount: lineAmount };
          }).filter((x): x is ReceiptLineItem => x !== null)
        : null;
      return {
        kind: 'receipt_detail',
        ...('payments' in raw ? { payments: receiptPayments(raw.payments) } : {}),
        ...('gross_amount' in raw ? { grossAmount: receiptAmount(raw.gross_amount) } : {}),
        ...('redeemed_amount' in raw ? { redeemedAmount: receiptAmount(raw.redeemed_amount) } : {}),
        ...('adjustments' in raw ? { adjustments: receiptAdjustments(raw.adjustments) } : {}),
        entryId,
        merchant: merchant ?? null,
        category: category ?? null,
        amount,
        currency,
        at,
        date: date ?? null,
        itemsTotal: itemsTotal ?? null,
        printedTotal: printedTotal ?? null,
        lineItems: lineItems && lineItems.length > 0 ? lineItems : null,
        question: question ?? null,
        chips: strArray(raw.chips) ?? [],
        honesty: raw.honesty === 'estimate' ? 'estimate' : null,
        ...('home_amount' in raw ? { homeAmount: numOrNull(raw.home_amount) ?? null } : {}),
        ...('home_currency' in raw ? { homeCurrency: strOrNull(raw.home_currency) ?? null } : {}),
        ...('home_amount_basis' in raw ? { homeAmountBasis: raw.home_amount_basis === 'charge' || raw.home_amount_basis === 'rate' ? raw.home_amount_basis : null } : {}),
        ...('home_amount_source' in raw ? { homeAmountSource: raw.home_amount_source === 'user' || raw.home_amount_source === 'statement' ? raw.home_amount_source : null } : {}),
        ...('fx_estimate' in raw ? { fxEstimate: isRecord(raw.fx_estimate) ? raw.fx_estimate : null } : {}),
      };
    }
    case 'meal_detail': {
      const entryId = str(raw.entry_id);
      const dish = str(raw.dish);
      const portion = strOrNull(raw.portion);
      const calories = numOrNull(raw.calories);
      const protein_g = numOrNull(raw.protein_g);
      const carbs_g = numOrNull(raw.carbs_g);
      const fat_g = numOrNull(raw.fat_g);
      const rating = numOrNull(raw.rating);
      const rating_why = strOrNull(raw.rating_why);
      const at = str(raw.at);
      const question = strOrNull(raw.question);
      if (!entryId || !dish || !at) return null;
      return {
        kind: 'meal_detail',
        entryId,
        dish,
        portion: portion ?? null,
        calories: calories ?? null,
        protein_g: protein_g ?? null,
        carbs_g: carbs_g ?? null,
        fat_g: fat_g ?? null,
        rating: rating ?? null,
        rating_why: rating_why ?? null,
        at,
        question: question ?? null,
        chips: strArray(raw.chips) ?? [],
        honesty: raw.honesty === 'estimate' ? 'estimate' : null,
      };
    }
    case 'day_close': {
      if (!Array.isArray(raw.rows)) return null;
      const rows: DayCloseRow[] = [];
      for (const r of raw.rows) {
        if (!isRecord(r)) return null;
        const label = str(r.label);
        const value = typeof r.value === 'number' ? r.value : null;
        const target = typeof r.target === 'number' ? r.target : null;
        const unit = str(r.unit) ?? '';
        const verdict =
          r.verdict === 'on_target' || r.verdict === 'short' || r.verdict === 'over' ? r.verdict : null;
        if (!label || value === null || target === null || !verdict) return null;
        rows.push({ label, value, target, unit, verdict });
      }
      if (rows.length === 0) return null;
      return { kind: 'day_close', rows };
    }
    default:
      return null; // unknown kind — degrades to the plain bubble
  }
}

/**
 * Narrow a message's raw `blocks` payload (unknown jsonb — array or null).
 * Never throws; anything unusable simply isn't a block.
 */
export function parseBlocks(raw: unknown): MessageBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: MessageBlock[] = [];
  for (const item of raw) {
    const block = parseBlock(item);
    if (block) out.push(block);
  }
  return out;
}

import { dayKeyInTz } from './time';
import { localDayKey } from './dashboard';

// What an open task SAYS on Ollie's board (internal-reference).
//
// The board rendered every row as "Answer Penny in chat" — the same eleven
// words eleven times, telling you nothing about which question you were about
// to answer. The drawing shows the task itself: what it is, who asked, and how
// long it has been waiting.
//
// The status chips and per-task controls landed 8 Sep with C101's schema slice
// (internal-reference). They were deliberately NOT faked while the statuses did not
// exist: a control that appears to work and does not is harder to find than one
// that is missing.
//
// The board never AUTHORS content (C61): every phrase below describes a
// question a neighbour already asked in chat. Nothing here invents a task.

/** A human line per task kind. Unknown kinds fall back rather than break — the
 *  server ships new kinds by PR and an older build must still render them. */
const TASK_TITLE: Record<string, string> = {
  confirm_dish: 'What was in it?',
  confirm_category: 'Which category?',
  confirm_merchant: 'Is that the right shop?',
  confirm_overlap: 'Did two of these overlap?',
  confirm_eaten: 'Did you eat this?',
  confirm_name: 'Which one did you mean?',
  link_photos_confirm: 'Was this the same meal?',
  milo_objective: 'What are we working toward?',
  profile_offer: 'Your numbers, when you want to',
  body_fat_target: 'A body-fat target?',
  clarify_entry: 'What was that one?',
  reminder: 'A knock you asked for',
  note: 'Kept for you',
  weekly_draft: 'Your week, if you want it',
};

export function taskTitle(kind: string): string {
  // An unknown kind still gets a row and still opens the message. Falling back
  // to the old generic line is better than a blank or a raw enum: it is true,
  // it is just less specific.
  return TASK_TITLE[kind] ?? 'Answer in chat';
}

/** "3h ago" — how long it has been waiting.
 *
 *  Deliberately coarse. A question that has waited eleven minutes and one that
 *  has waited fourteen are the same question; a board that counts minutes at
 *  you is a board that nags, which C06 forbids. */
export function waitedFor(askedAt: string, now: Date): string {
  const then = Date.parse(askedAt);
  if (Number.isNaN(then)) return ''; // never guess at a time we cannot read
  const mins = Math.max(0, Math.round((now.getTime() - then) / 60_000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export interface BoardTask {
  id: string;
  neighbour: string;
  kind: string;
  status: TaskStatus;
  asked_at: string;
  origin_message_id: string;
}

// C101, and the words are the DRAWING's (Run B, `const TASK_STATUS`) — truth
// under C63. Four, not C101's five: `reopened` is a TRANSITION, so a reopened
// task reads as Planned again. See canon/register.md.
export const TASK_STATUSES = ['planned', 'progress', 'done', 'declined'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  planned: 'Planned',
  progress: 'In progress',
  done: 'Done',
  declined: 'Declined',
};

/** System-rendered chips, so these draw freely from Material Symbols Sharp —
 *  the whitelist in CLAUDE.md governs icons a MODEL picks, not these. */
export const TASK_STATUS_ICON: Record<TaskStatus, string> = {
  planned: 'schedule',
  progress: 'autorenew',
  done: 'check',
  declined: 'close',
};

export type StatusFilter = 'all' | TaskStatus;

/** Counts for the drawn chip row: All 11 · Planned 3 · In progress 3 · … */
export function statusCounts(tasks: BoardTask[]): Record<StatusFilter, number> {
  const counts = { all: tasks.length, planned: 0, progress: 0, done: 0, declined: 0 };
  for (const t of tasks) if (t.status in TASK_STATUS_LABEL) counts[t.status] += 1;
  return counts;
}

export function filterByStatus(tasks: BoardTask[], filter: StatusFilter): BoardTask[] {
  return filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
}

// Which moves the board offers, mirroring the server's transition table. Both
// resolved states reopen to `planned` and NEVER to each other: the board cannot
// know that a done task was really declined, and saying so would be the board
// authoring substance — the one thing C101 forbids in the same breath as it
// grants the buttons.
const NEXT: Record<TaskStatus, readonly TaskStatus[]> = {
  planned: ['progress', 'done', 'declined'],
  progress: ['planned', 'done', 'declined'],
  done: ['planned'],
  declined: ['planned'],
};

export function nextStatuses(from: TaskStatus): readonly TaskStatus[] {
  return NEXT[from] ?? [];
}

/** The word on the button. Reopening is named for what it DOES — the status it
 *  moves to is Planned, but "Planned" on a finished task reads as a category,
 *  not an action. */
export function transitionLabel(from: TaskStatus, to: TaskStatus): string {
  if ((from === 'done' || from === 'declined') && to === 'planned') return 'Reopen';
  if (to === 'progress') return 'Start';
  if (to === 'done') return 'Done';
  if (to === 'declined') return 'Not doing this';
  return TASK_STATUS_LABEL[to];
}

/** The board's search. Matches the WORDS a person can see — the title and the
 *  neighbour's name — never the raw kind, which nobody has ever read. */
export function searchTasks(tasks: BoardTask[], query: string): BoardTask[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) => {
    const haystack = `${taskTitle(t.kind)} ${t.neighbour} ${TASK_STATUS_LABEL[t.status] ?? ''}`.toLowerCase();
    return haystack.includes(q);
  });
}

/** "11 tasks" / "1 task" / "Nothing waiting". */
export function taskCountLine(n: number): string {
  if (n === 0) return 'Nothing waiting';
  return n === 1 ? '1 task' : `${n} tasks`;
}

export type BoardRange = 'today' | 'week' | 'month' | 'year' | 'custom';
export interface BoardWindow { from: string; to: string }
export interface BoardFilterOptions {
  range: BoardRange; now: Date; timezone: string | null; custom?: BoardWindow;
  status: StatusFilter; query: string;
}

/** Date/status/search projection for the board; mutations remain elsewhere. */
export function boardView(tasks: BoardTask[], opts: BoardFilterOptions): {
  shown: BoardTask[]; counts: Record<StatusFilter, number>;
} {
  const today = boardCalendarDay(opts.now, opts.timezone);
  const anchor = new Date(`${today}T00:00:00Z`);
  const monday = new Date(anchor.getTime() - ((anchor.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
  const starts = { today, week: monday, month: `${today.slice(0, 7)}-01`, year: `${today.slice(0, 4)}-01-01` };
  const last = opts.range === 'custom' ? opts.custom?.to : today;
  const first = opts.range === 'custom' ? opts.custom?.from
    : starts[opts.range];
  const dated = !first || !last || first > last ? [] : tasks.filter(task => {
    const askedAt = new Date(task.asked_at);
    if (!Number.isFinite(askedAt.getTime())) return false;
    const day = boardCalendarDay(askedAt, opts.timezone);
    return day >= first && day <= last;
  });
  const searched = searchTasks(dated, opts.query);
  // Run B #1 groups existing asks, preserving their order within a status.
  const order: TaskStatus[] = ['progress', 'planned', 'done', 'declined'];
  const shown = filterByStatus(searched, opts.status).slice().sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return { shown, counts: statusCounts(searched) };
}

export function boardCalendarDay(now: Date, timezone: string | null): string {
  const anchored = dayKeyInTz(now.toISOString(), timezone);
  return /^\d{4}-\d{2}-\d{2}$/.test(anchored) ? anchored : localDayKey(now);
}

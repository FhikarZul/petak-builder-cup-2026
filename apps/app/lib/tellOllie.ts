// Tell Ollie, after the founder asked for it to actually go somewhere
// (6 Sep 2026): forwarded to ClickUp, a picture allowed to ride along, and a
// list showing what became of each report.
//
// C57's rulings that still bind, and what they do and do not forbid:
//
// · "No number comes back and nothing is promised in hours." That is about
//   TURNAROUND — it bans a ticket number and a due date, not telling someone
//   what happened to what they wrote. The list below shows STATE and never a
//   date, and the send screen still answers with "Told." and nothing else.
// · "No screenshot auto-attach without an explicit consent toggle." The
//   picture here is chosen by hand, one at a time, and is visible before it is
//   sent. Nothing is captured on the user's behalf.
//
// Pure, because this repo tests logic rather than RN trees.

/** What KIND of thing it is — the writer's own word, not a classification.
 *  Deliberately three: more choices would make a report feel like a form. */
export const REPORT_KINDS = ['bug', 'idea', 'question'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const KIND_LABEL: Record<ReportKind, string> = {
  bug: 'Something broke',
  idea: 'An idea',
  question: 'A question',
};

/** The four words a person actually wants, mapped from ClickUp's eight. */
export type ReportStatus = 'sent' | 'in progress' | 'done' | 'closed';

/** The status line under a report in the list. Written in Ollie's register —
 *  he is the one who took it — and never promising when. */
export function statusLine(status: ReportStatus): string {
  switch (status) {
    case 'in progress':
      return 'Someone is on it.';
    case 'done':
      return 'Done.';
    case 'closed':
      return 'Closed — not something we are changing.';
    default:
      return "I have it."; // 'sent'
  }
}

/** Whether a status reads as finished, for the list's grouping and its tick. */
export function isSettled(status: ReportStatus): boolean {
  return status === 'done' || status === 'closed';
}

/**
 * The footer sentence: exactly what travels with the words, and nothing more.
 *
 * VERBATIM FROM THE DRAWING (Run B, "Petak Run B - Non Chat.dc.html" line
 * 1868), and that is not incidental — C63 makes the drawing the approval
 * mechanism, and this sentence is a promise about data, which is the last
 * place to paraphrase.
 *
 * The code had drifted from it. The drawn version ended "Nothing else, and no
 * photo unless you attach one" — written when attaching was still to come —
 * and the shipped version said "no photo — attaching one is not built yet".
 * The drawing was right the whole time; the code caught up on 6 Sep 2026 when
 * attaching was built. Conforming to the drawing rather than re-approving a
 * new sentence is C63 working exactly as intended.
 *
 * Generated rather than stored as one string so the runtime values are the
 * real ones. `petak` completes the drawn sentence's third clause, which the
 * shipped screen used to omit entirely.
 */
export function whatTravels(input: {
  version: string;
  platform: string;
  /** Where they were when they opened this. Absent renders the drawn sentence
   *  without its third clause rather than naming a petak we did not send. */
  petak?: string | null;
}): string {
  const where = input.petak ? `, and which petak you were in when you opened this` : '';
  return (
    `Sent with your words: which version of Petak you have (v${input.version}), ` +
    `your phone and its system (${input.platform})${where}. ` +
    `Nothing else, and no photo unless you attach one.`
  );
}

/** A report as the list renders it. */
export interface ReportRow {
  id: string;
  summary: string;
  /** The whole report, for the card opened up (internal-reference) — the summary is
   *  how you recognise it, not all you ever get to see. */
  body: string;
  /** The picture that rode along, if one did. Opened through the ordinary
   *  photo route, so what shows is exactly what was sent. */
  photo_id: string | null;
  kind: ReportKind | null;
  created_at: string;
  status: ReportStatus;
}

/** Open first, then settled; newest first inside each. Someone opening this
 *  screen is looking for the thing still outstanding, not the archive. */
export function orderReports(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => {
    const settled = Number(isSettled(a.status)) - Number(isSettled(b.status));
    if (settled !== 0) return settled;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

/** The empty state. Never a nudge to report something — an empty list here is
 *  the good outcome, and a screen that asks for bugs will get invented ones. */
export const EMPTY_LIST = 'Nothing yet. When you tell me something, it shows up here.';

/**
 * "Which petak you were in when you opened this" — the drawn footer's third
 * clause, turned into the one word the server stores.
 *
 * The drawer's visit stack reports a route segment ('dashboards/penny',
 * 'settings/index'); the server's `petak` column wants a neighbour or a
 * plain place name. Anything that is not a petak returns null, and the
 * sentence then drops the clause rather than naming somewhere invented.
 */
export function petakYouWereIn(routeSegment: string | null): string | null {
  if (!routeSegment) return null;
  const dashboard = /^dashboards\/(\w+)$/.exec(routeSegment);
  if (dashboard) return dashboard[1];
  if (routeSegment === 'board') return 'board';
  return null;
}

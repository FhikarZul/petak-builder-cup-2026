// What Milo's four objectives actually MEAN (6 Sep 2026).
//
// The founder: "the objective 'Lean out', 'Get Stronger', 'Eat Better', 'Just
// keep track' can be more informative, what it means, perhaps similar to how we
// get them to pick neighbour it should also perhaps have an accordion to have
// objective details layout and have the options to confirm / pick".
//
// The parallel to the neighbour picker is the right one and worth stating:
// choosing an objective is as consequential as choosing a neighbour. It decides
// the targets Milo derives, what he tracks, and what he will raise later —
// body fat is only ever mentioned if the objective implies leanness (C11/C47).
// It was being picked from four words with none of that visible.
//
// The words live here, not on the server, like every other block's copy: the
// server sends the token `explain: 'objective'` and the app says what it means.
//
// DRAFT copy — the founder wordsmiths. Keyed by the server's label so a
// reworded label falls back to no explanation rather than the wrong one.
export interface ObjectiveDetail {
  /** One line on what choosing this actually commits to. */
  means: string;
  /** What Milo will do with it — the part that is invisible at pick time. */
  tracks: string;
}

export const OBJECTIVE_DETAILS: Record<string, ObjectiveDetail> = {
  'Lean out': {
    means: 'Losing fat while keeping the muscle you have. Targets sit a little under what you burn.',
    tracks: 'Energy in against energy out, protein kept high, and weight over weeks rather than days. This is the one where he may later ask about body fat.',
  },
  'Get stronger': {
    means: 'Build strength and size gradually, with enough food to support training without rushing weight gain.',
    tracks: 'Protein, energy and steady progress in the gym. A small surplus is expected; weight going up slowly is useful.',
  },
  'Eat better': {
    means: 'Improve health and fitness habits without choosing a weight target yet.',
    tracks: 'Meals, movement and trends, while leaving the scale neutral until you choose a direction.',
  },
  'Just keep track': {
    means: 'No objective and no targets. He counts, and leaves the judgement to you.',
    tracks: 'Everything you send, with the numbers shown and nothing measured against a goal. You can pick a different objective whenever you like.',
  },
};

export function objectiveDetail(label: string): ObjectiveDetail | null {
  return OBJECTIVE_DETAILS[label] ?? null;
}

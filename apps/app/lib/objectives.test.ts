import { describe, expect, it } from 'vitest';
import { OBJECTIVE_DETAILS, objectiveDetail } from './objectives';
import { parseBlocks } from './blocks';

// 6 Sep 2026, founder: "the objective 'Lean out', 'Get Stronger', 'Eat Better',
// 'Just keep track' can be more informative, what it means".
describe("Milo's objectives can be read before they are picked", () => {
  it('every choice the server sends has an explanation', () => {
    // These four are OBJECTIVE_CHOICES.objective on the server. If a fifth is
    // added there and not here, this fails — which is the point: a new
    // objective with no explanation is the bug this fixed, arriving again.
    for (const label of ['Lean out', 'Get stronger', 'Eat better', 'Just keep track']) {
      const d = objectiveDetail(label);
      expect(d, `no explanation for "${label}"`).not.toBeNull();
      expect(d!.means.length).toBeGreaterThan(20);
      expect(d!.tracks.length).toBeGreaterThan(20);
    }
    expect(Object.keys(OBJECTIVE_DETAILS)).toHaveLength(4);
  });

  it('says the thing that was invisible: which objective leads to the body-fat question', () => {
    // C11/C47 — body fat is only ever raised when the objective implies
    // leanness. That consequence was completely hidden at pick time.
    expect(objectiveDetail('Lean out')!.tracks).toMatch(/body fat/i);
    expect(objectiveDetail('Just keep track')!.means).toMatch(/no objective|no targets/i);
  });

  it('an unknown label loses its explanation, never its button', () => {
    // The labels are server copy the founder may reword. A reworded label must
    // degrade to a plain choice, not disappear or take the wrong explanation.
    expect(objectiveDetail('Lean Out')).toBeNull(); // different case = different label
    expect(objectiveDetail('Something new')).toBeNull();
  });
});

describe('the task_actions block carries WHICH set of choices it is', () => {
  const block = (extra: Record<string, unknown>) =>
    parseBlocks([{ kind: 'task_actions', task_id: 't1', labels: ['Lean out'], ...extra }]);

  it('passes the objective token through', () => {
    expect(block({ explain: 'objective' })[0]).toMatchObject({ kind: 'task_actions', explain: 'objective' });
  });

  it('drops a token this build does not know, rather than passing it to a renderer', () => {
    // The block contract: unknown tokens render nothing, so the server can ship
    // ahead of the app. A future explain value must degrade to a plain row.
    expect(block({ explain: 'something_new' })[0]).not.toHaveProperty('explain');
    expect(block({})[0]).not.toHaveProperty('explain');
  });
});

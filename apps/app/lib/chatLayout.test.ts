import { describe, expect, it } from 'vitest';
import { chatWidths, chatReplyLayout } from './chatLayout';

describe('approved responsive chat widths', () => {
  it.each([
    [320, 288, 241.92, 241.92],
    [390, 358, 300.72, 300.72],
    [430, 398, 334.32, 334.32],
    [1024, 992, 560, 560],
  ])('uses the measured %ipx viewport, retaining outer gutters and reading caps', (viewport, content, assistant, user) => {
    const widths = chatWidths(viewport);
    expect(widths.content).toBe(content);
    expect(widths.assistant).toBeCloseTo(assistant);
    expect(widths.user).toBeCloseTo(user);
  });
  it('updates for a narrower split view and never produces negative dimensions', () => {
    expect(chatWidths(390).assistant).toBeLessThan(chatWidths(1024).assistant);
    expect(chatWidths(20)).toEqual({ content: 0, assistant: 0, user: 0 });
  });
});

describe('rich replies use their content type rather than expansion or grouping', () => {
  it.each(['profile_form', 'move_in_picker', 'entry_card', 'receipt_detail', 'meal_detail',
    'objective_table', 'spend_table', 'figures'])('%s gets the full lane and visible speaker even in a grouped run', kind => {
    expect(chatReplyLayout([{ kind }], false)).toEqual({ fullWidth: true, showSpeaker: true, speakerAbove: true });
  });
  it('keeps a collapsed meal reply full width before and after inspecting its items', () => {
    const blocks = [{ kind: 'meal_detail', entryId: 'meal-1' }];
    expect(chatReplyLayout(blocks, false)).toEqual(chatReplyLayout(blocks, true));
    expect(chatReplyLayout(blocks, false).fullWidth).toBe(true);
  });
  it('keeps ordinary prose and lightweight decorations intrinsic, with normal speaker grouping', () => {
    expect(chatReplyLayout([], false)).toEqual({ fullWidth: false, showSpeaker: false, speakerAbove: false });
    expect(chatReplyLayout([{ kind: 'chips' }, { kind: 'note' }, { kind: 'undo' }], true))
      .toEqual({ fullWidth: false, showSpeaker: true, speakerAbove: false });
    expect(chatReplyLayout([{ kind: 'unrecognized' }], false).fullWidth).toBe(false);
  });
  it('retains dedicated page, draft and queue renderers rather than reclassifying them as rich bubbles', () => {
    for (const kind of ['page', 'draft', 'queue_note']) {
      expect(chatReplyLayout([{ kind }], true).fullWidth).toBe(false);
    }
  });
});

it('keeps summaries, references, and single actions in normal bubbles', () => {
  for (const kind of ['day_close', 'pace_mark', 'referenced_entry', 'receipt_plates', 'page_actions', 'task_actions']) {
    expect(chatReplyLayout([{kind}], true).fullWidth).toBe(false);
  }
});
it('reserves full-width layout for actual selectors, not every action block', () => {
  expect(chatReplyLayout([{kind:'task_actions', labels:['Yes','No']}], false).fullWidth).toBe(true);
  expect(chatReplyLayout([{kind:'task_actions', explain:'objective'}], false).fullWidth).toBe(true);
});
it('aligns a compact reward with the preceding full-width filing card without an avatar gutter', () => {
  expect(chatReplyLayout([{kind:'coins'}], false)).toEqual({fullWidth:false,showSpeaker:true,speakerAbove:true});
});
it('reserves avatar and gap on both sides even in very narrow lanes', () => {
  const widths=chatWidths(200);
  expect(widths.assistant + 40).toBeLessThanOrEqual(widths.content);
  expect(widths.user + 40).toBeLessThanOrEqual(widths.content);
});

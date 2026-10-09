/** Approved 16 Sep: one gutter rule for ordinary replies and full-width content. */
export const CHAT_GUTTER = 16;
export const CHAT_AVATAR = 32;
export const CHAT_AVATAR_GAP = 8;
export const CHAT_READING_CAP = 560;

export function chatWidths(viewport: number) {
  const content = Math.max(0, viewport - CHAT_GUTTER * 2);
  return {
    content,
    assistant: Math.min(CHAT_READING_CAP, content * 0.84, Math.max(0, content - CHAT_AVATAR - CHAT_AVATAR_GAP)),
    user: Math.min(CHAT_READING_CAP, content * 0.84, Math.max(0, content - CHAT_AVATAR - CHAT_AVATAR_GAP)),
  };
}

const FULL_WIDTH_BLOCKS = new Set([
  'profile_form', 'move_in_picker', 'entry_card', 'receipt_detail', 'meal_detail',
  'objective_table', 'spend_table', 'figures',
]);

/** Expansion state is intentionally not an input: inspecting a table cannot move its reply sideways. */
export function chatReplyLayout(blocks: readonly { kind: string; labels?: readonly string[]; explain?: string }[], groupedSpeakerVisible: boolean) {
  const fullWidth = blocks.some(block => FULL_WIDTH_BLOCKS.has(block.kind)
    || (block.kind === 'task_actions' && ((block.labels?.length ?? 0) > 1 || block.explain === 'objective')));
  const reward = blocks.some(block => block.kind === 'coins');
  const speakerAbove = fullWidth || reward;
  return { fullWidth, showSpeaker: speakerAbove || groupedSpeakerVisible, speakerAbove };
}

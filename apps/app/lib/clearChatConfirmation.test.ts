import { expect, it, vi } from 'vitest';
import { clearChatConfirmation } from './clearChatConfirmation';
it('does not clear until the explicit confirmation is pressed', () => {
  const clear = vi.fn();
  const dialog = clearChatConfirmation(clear);
  expect(clear).not.toHaveBeenCalled();
  expect(dialog.message).toContain('does not delete');
  expect(dialog.message).toContain('Queued messages and photos');
  const cancel = dialog.buttons.find(b => b.style === 'cancel');
  cancel?.onPress?.();
  expect(clear).not.toHaveBeenCalled();
  dialog.buttons.find(b => b.text === 'Clear chat')?.onPress?.();
  expect(clear).toHaveBeenCalledTimes(1);
});

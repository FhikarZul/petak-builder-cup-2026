export function clearChatConfirmation(clear: () => void): {
  title: string;
  message: string;
  buttons: { text: string; style?: 'cancel'; onPress?: () => void }[];
} {
  return {
    title: 'Clear chat?',
    message: 'This hides the current chat view. It does not delete your saved records. Queued messages and photos will still send.',
    buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear chat', onPress: clear }],
  };
}

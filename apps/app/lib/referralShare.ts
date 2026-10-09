/** C58: the existing web route provides a destination; the readable code survives a lost link. */
export function referralShareMessage(code: string): string {
  return `Join me on Petak — my referral code is ${code}.\nhttps://petak.app/r/${encodeURIComponent(code)}\nKeep the code handy if you need to enter it under "Have a code?" in your first month.`;
}

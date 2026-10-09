/** Keep every reason visible once, whether spoken above or beside its field. */
export function showFieldReason(reason: string, parentBody: string): boolean {
  const normalize = (text: string) => text.toLowerCase().replace(/[.!?]+$/g, '').trim();
  return !normalize(parentBody).includes(normalize(reason));
}
export function showSkipHelp(parentBody: string): boolean {
  return !(/\bskip\b|\bleave\b[^.!?]*\bblank\b/i.test(parentBody));
}

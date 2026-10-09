const openedUsers = new Set<string>();

export function shouldRecordAppOpen(userId: string | null | undefined): boolean {
  if (!userId || openedUsers.has(userId)) return false;
  openedUsers.add(userId);
  return true;
}

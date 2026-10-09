// The user's card (3 Sep 2026) — mirrors apps/server/src/profile/profile.ts.
// Keep the two shapes in lockstep; the PATCH sends the whole object.
export interface HouseholdMember {
  name: string;
  note: string | null;
}
export interface Profile {
  display_name: string | null;
  household: HouseholdMember[];
  constraints: string[];
}
export const EMPTY_PROFILE: Profile = { display_name: null, household: [], constraints: [] };

/** Read boundary only: opening the card never repairs or writes stored data. */
export function readStoredProfile(value: unknown): Profile {
  const p = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const household: HouseholdMember[] = [];
  if (Array.isArray(p.household)) {
    for (const member of p.household) {
      if (!member || typeof member !== 'object' || typeof member.name !== 'string') continue;
      household.push({ name: member.name, note: typeof member.note === 'string' ? member.note : null });
    }
  }
  return {
    display_name: typeof p.display_name === 'string' ? p.display_name : null,
    household,
    constraints: Array.isArray(p.constraints) ? p.constraints.filter((item): item is string => typeof item === 'string') : [],
  };
}

export function addChip(list: string[], value: string): string[] {
  const v = value.trim();
  if (!v) return list;
  if (list.some((x) => x.toLowerCase() === v.toLowerCase())) return list;
  return [...list, v];
}
// Removal is by VALUE, never by render-time index: the remove closure applies
// to the mutation ref's list, which diverges from the rendered list while a
// PATCH is in flight. Adds dedupe case-insensitively, so a case-insensitive
// value match names exactly one entry.
export function removeChip(list: string[], value: string): string[] {
  const v = value.toLowerCase();
  return list.filter((x) => x.toLowerCase() !== v);
}

// Household is the object-aware equivalent of the chip helpers — dedupe on
// name, case-insensitive (the server promote() rule).
export function addMember(list: HouseholdMember[], name: string, note: string | null): HouseholdMember[] {
  const n = name.trim();
  if (!n) return list;
  if (list.some((m) => m.name.toLowerCase() === n.toLowerCase())) return list;
  const trimmed = note?.trim() ?? null;
  return [...list, { name: n, note: trimmed ? trimmed : null }];
}
export function removeMember(list: HouseholdMember[], name: string): HouseholdMember[] {
  const n = name.toLowerCase();
  return list.filter((m) => m.name.toLowerCase() !== n);
}

export function cardSummary(p: Profile): string {
  const n = (p.display_name ? 1 : 0) + p.household.length + p.constraints.length;
  return n === 0 ? 'Your card is empty — neighbours will ask, or add things here.' : `${n} on your card`;
}

/** A displayed fallback is not a stored preference. Household names never enter this resolution. */
export function preferredName(preferred: unknown, metadata?: Record<string, unknown> | null, email?: string | null): string | null {
  for (const value of [preferred, metadata?.full_name, metadata?.name, email?.split('@')[0]]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

import type { MiloLogType } from './dashboard';

/** Toggle the actual Food log filter; Out has no exercise feed to filter yet. */
export function toggleMiloFoodFilter(current: MiloLogType): MiloLogType {
  return current === 'food' ? 'all' : 'food';
}

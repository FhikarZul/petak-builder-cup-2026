// Your rules (3 Sep 2026) — the standing filing words Penny keeps. The list
// shows where every rule came from (C15/C68); any of them is killable.
export interface Rule {
  id: string;
  pattern: string;
  pattern_kind: 'merchant' | 'phrase';
  category: string;
  subcategory: string | null;
  source: 'confirmation' | 'correction' | 'stated';
  created_at: string;
}
export function ruleLine(r: Pick<Rule, 'pattern' | 'category' | 'subcategory'>): string {
  return `${r.pattern} → ${r.category}${r.subcategory ? ` · ${r.subcategory}` : ''}`;
}
export function sourceWord(s: Rule['source']): string {
  return s === 'confirmation' ? 'from a confirmation' : s === 'correction' ? 'from a correction' : 'your words';
}

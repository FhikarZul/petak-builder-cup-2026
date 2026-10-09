import { expect, it } from 'vitest';
import { monthComparisonLabel } from './monthComparison';
const period = (month: string, total: number) => ({from:`2026-${month}-01`,to:`2026-${month}-22`,total,entries:1,fx:{estimated_entries:0,unconverted_entries:0}});
const comparison = {current:period('09',125),previous:period('08',100)};
it('names both equal windows and direction', () => {
  expect(monthComparisonLabel(comparison)).toBe('25% more captured · 1–22 Sep vs 1–22 Aug');
  expect(monthComparisonLabel({...comparison,current:period('09',75)})).toContain('25% less captured');
  expect(monthComparisonLabel({...comparison,current:period('09',100)})).toContain('Same captured amount');
});
it('never displays a percentage for missing conversion, zero baseline or refunds', () => {
  expect(monthComparisonLabel(undefined)).toBeNull();
  expect(monthComparisonLabel({...comparison,previous:period('08',0)})).toBeNull();
  expect(monthComparisonLabel({...comparison,current:period('09',-5)})).toBeNull();
  expect(monthComparisonLabel({...comparison,previous:{...comparison.previous,fx:{estimated_entries:0,unconverted_entries:1}}})).toBeNull();
});
it('marks estimated valuations and identifies both years across New Year', () => {
  expect(monthComparisonLabel({...comparison,current:{...comparison.current,fx:{estimated_entries:1,unconverted_entries:0}}})).toMatch(/^About 25%/);
  expect(monthComparisonLabel({current:{...period('01',125)},previous:{...period('12',100),from:'2025-12-01',to:'2025-12-22'}})).toContain('1–22 Jan 2026 vs 1–22 Dec 2025');
});

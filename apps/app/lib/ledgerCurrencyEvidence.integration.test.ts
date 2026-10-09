import React from 'react';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ StyleSheet: { create: (styles: unknown) => styles }, Text: 'Text', View: 'View' }));
vi.stubGlobal('React', React);
import { CurrencyEvidenceList, CurrencyEvidenceRows } from '../components/CurrencyEvidenceRows';
import { ledgerCurrencyEvidence } from './ledgerCurrencyEvidence';
import type { Theme } from './theme';
const t = { color: {}, typography: { textSmall: {}, textBody: {} } } as Theme;
function text(node: unknown): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(text);
  if (typeof node !== 'object') return [String(node)];
  const element = node as React.ReactElement<{ children?: unknown }>;
  if (typeof element.type === 'function') return text((element.type as Function)(element.props));
  return text(element.props.children);
}
const payload = { amount: 21.8, currency: 'USD', fx_estimate: { amount: 28.1, currency: 'SGD', rate_date: '2026-09-20' } };
const entry = { payload, reporting_amount: 28.1, reporting_currency: 'SGD', valuation_estimated: true };
const render = (e: Parameters<typeof ledgerCurrencyEvidence>[0]) => text(CurrencyEvidenceList({ rows: ledgerCurrencyEvidence(e, 'SGD'), t }));
describe('ledger evidence presentation', () => {
  it('renders the original, quote, then replacement settlement on the same purchase', () => {
    expect(render(entry)).toEqual(['Printed total', 'USD 21.80', 'Home estimate', 'S$28.10', 'Reference rate · 2026-09-20']);
    expect(render({ ...entry, reporting_amount: 29, valuation_estimated: false, payload: { ...payload, home_amount: 29, home_currency: 'SGD' } })).toEqual(['Printed total', 'USD 21.80', 'Bank charged', 'S$29.00', 'You told me']);
  });
  it('shows an unavailable state without displaying the stale payload quote', () => {
    expect(render({ ...entry, reporting_amount: null })).toEqual(['Printed total', 'USD 21.80', 'Home estimate unavailable']);
  });
  it('preserves existing chat card presentation', () => {
    expect(text(CurrencyEvidenceRows({ payload, t }))).toEqual(render(entry));
    expect(CurrencyEvidenceRows({ payload: { amount: 10, currency: 'SGD' }, t })).toBeNull();
  });
  it('wires the ledger to current reporting currency outside item expansion', () => {
    const screen = readFileSync(new URL('../app/(drawer)/dashboards/penny.tsx', import.meta.url), 'utf8');
    expect(screen).toContain('<CurrencyEvidenceList rows={ledgerCurrencyEvidence(e, s.currency)} t={t} />');
    expect(screen.indexOf('<CurrencyEvidenceList rows=')).toBeLessThan(screen.indexOf('{breakdown && open ? ('));
  });
});

import React from 'react';
import { expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.stubGlobal('React', React);
import { DashboardLoadError } from '../components/dashboard/DashboardLoadError';
import type { Theme } from './theme';
const t = { color: {}, typography: { textBody: {} } } as Theme;
function nodes(node: unknown): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement(node)) return Array.isArray(node) ? node.flatMap(nodes) : [];
  const e = node as React.ReactElement<Record<string, unknown>>;
  return [e, ...nodes(e.props.children)];
}
it('distinguishes an unavailable dashboard from a failed refresh and offers retry', () => {
  const onRetry = vi.fn();
  const first = nodes(DashboardLoadError({ label: 'your journal', hasData: false, retrying: false, onRetry, t }));
  expect(first.some(n => n.props.children === 'Could not load your journal.')).toBe(true);
  const button = first.find(n => n.props.accessibilityRole === 'button')!;
  expect(button.props.disabled).toBe(false);
  (button.props.onPress as () => void)();
  expect(onRetry).toHaveBeenCalledOnce();
  const cached = nodes(DashboardLoadError({ label: 'your journal', hasData: true, retrying: false, onRetry, t }));
  expect(cached.some(n => n.props.children === 'Could not refresh your journal. Available data is shown below.')).toBe(true);
});
it('disables repeated retry while a request is running', () => {
  const rendered = nodes(DashboardLoadError({ label: 'your dashboard', hasData: true, retrying: true, onRetry: vi.fn(), t }));
  expect(rendered.find(n => n.props.accessibilityRole === 'button')?.props.disabled).toBe(true);
  expect(rendered.some(n => n.props.children === 'Trying again…')).toBe(true);
});

import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { JournalDay } from './dashboard';

// Execute the real screen with a persistent hook store; native children remain
// elements. Callbacks and filter calculations are real, not source-string checks.
const state = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, dark: false, days: [] as JournalDay[] }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useMemo: (compute: () => unknown) => compute(),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.slots)) state.slots[index] = initial;
    return [state.slots[index], (value: unknown) => { state.slots[index] = typeof value === 'function' ? value(state.slots[index]) : value; }];
  },
}));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', Image: 'Image', ScrollView: 'ScrollView', Modal: 'Modal', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (s: unknown) => s } }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('./thread', () => ({ useJournal: () => ({ data: { days: state.days } }), useSettings: () => ({ data: { region: { timezone: 'UTC' } } }), usePhoto: vi.fn() }));
vi.mock('./theme', () => ({ useTheme: () => ({ color: { surfaceCard: state.dark ? '#222' : '#fff', borderStructure: '#888', borderEmphasis: state.dark ? '#eee' : '#111', textPrimary: state.dark ? '#eee' : '#111', ink: '#111', kapur: '#fff' }, typography: { textBody: {}, textSmall: {}, textLabel: {} } }) }));
vi.mock('../components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../components/dashboard/DashboardHeader', () => ({ DashboardHeader: 'DashboardHeader' }));
vi.mock('../components/dashboard/DomainCard', () => ({ DomainCard: 'DomainCard' }));
vi.mock('../components/dashboard/RangeChips', () => ({ RangeChips: 'RangeChips' }));
vi.mock('../components/dashboard/JournalMemoryEvidence', () => ({ JournalMemoryEvidence: 'JournalMemoryEvidence' }));
vi.stubGlobal('React', React);
import MiraDashboard from '../app/(drawer)/dashboards/mira';

type Node = React.ReactElement<Record<string, any>>;
function nodes(node: unknown): Node[] {
  if (!React.isValidElement(node)) return Array.isArray(node) ? node.flatMap(nodes) : [];
  const e = node as Node;
  return [e, ...nodes(e.props.children)];
}
function render() { state.cursor = 0; return nodes(MiraDashboard()); }
const style = (value: any): Record<string, any> => Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value ?? {};
const chip = (tree: Node[]) => tree.find(n => n.props.accessibilityLabel?.startsWith('Reflective,'))!;
const clear = (tree: Node[]) => tree.find(n => n.props.accessibilityRole === 'button' && nodes(n).some(c => c.props.children === 'Clear'));
const search = (tree: Node[]) => tree.find(n => n.props.accessibilityLabel === 'Search your thoughts')!;
const ranges = (tree: Node[]) => tree.find(n => n.type === ('RangeChips' as any))!;
const hasText = (tree: Node[], text: string) => tree.some(n => n.props.children === text);
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
  state.slots = []; state.dark = false;
  const entry = (id: string, emotion: string) => ({ id, at: '2026-10-09T10:00:00Z', scene: 'quiet morning', raw: null, emotion, photo_id: null });
  state.days = [{ day: '2026-10-09', entries: [entry('a', 'reflective'), entry('b', 'reflective'), entry('c', 'low')] }, { day: '2026-10-01', entries: [entry('d', 'reflective')] }];
});
afterEach(() => vi.useRealTimers());
it.each([false, true])('uses a 2px emphasis border and unchanged surface/text for selected emotion (dark=%s)', dark => {
  state.dark = dark;
  chip(render()).props.onPress();
  let selected = chip(render());
  expect(style(selected.props.style)).toMatchObject({ borderWidth: 2, borderColor: dark ? '#eee' : '#111', backgroundColor: dark ? '#222' : '#fff' });
  expect(nodes(selected).filter(n => n.type === ('Text' as any)).every(n => style(n.props.style).color === (dark ? '#eee' : '#111'))).toBe(true);
  selected.props.onPress();
  expect(style(chip(render()).props.style)).toMatchObject({ borderWidth: 1, borderColor: '#888' });
});
it('counts thoughts rather than days and clears only emotion while preserving range and search state', () => {
  ranges(render()).props.onChange('month');
  chip(render()).props.onPress();
  search(render()).props.onChangeText('   ');
  let tree = render();
  expect(hasText(tree, '3 thoughts · this month · reflective')).toBe(true);
  expect(clear(tree)).toBeDefined();
  // Invoke the actual Clear handler after a search edit: it must never reset search.
  const onClear = clear(tree)!.props.onPress;
  search(tree).props.onChangeText('quiet');
  onClear(); tree = render();
  expect(search(tree).props.value).toBe('quiet');
  expect(ranges(tree).props.value).toBe('month');
  expect(chip(tree).props.accessibilityState.selected).toBe(false);
  expect(clear(tree)).toBeUndefined();
});
it('hides the scope row during search and restores it when search is cleared', () => {
  expect(clear(render())).toBeUndefined();
  chip(render()).props.onPress();
  expect(hasText(render(), '2 thoughts · this week · reflective')).toBe(true);
  search(render()).props.onChangeText('quiet');
  expect(clear(render())).toBeUndefined();
  render().find(n => n.props.accessibilityLabel === 'Clear search')!.props.onPress();
  expect(hasText(render(), '2 thoughts · this week · reflective')).toBe(true);
});
it('keeps custom dates when Clear resets emotion', () => {
  ranges(render()).props.onChange('custom');
  chip(render()).props.onPress();
  const before = render();
  const dates = before.filter(n => ['From date', 'To date'].includes(n.props.accessibilityLabel) && n.props.accessibilityRole === 'button').map(n => nodes(n).filter(c => c.type === ('Text' as any)).map(c => c.props.children));
  expect(clear(before)).toBeDefined();
  clear(before)!.props.onPress();
  const after = render();
  expect(ranges(after).props.value).toBe('custom');
  expect(after.filter(n => ['From date', 'To date'].includes(n.props.accessibilityLabel) && n.props.accessibilityRole === 'button').map(n => nodes(n).filter(c => c.type === ('Text' as any)).map(c => c.props.children))).toEqual(dates);
});
it('keeps Clear available when the selected emotion no longer has matching thoughts', () => {
  chip(render()).props.onPress();
  state.days = [{ ...state.days[0], entries: [state.days[0].entries[2]] }];
  expect(hasText(render(), '0 thoughts · this week · reflective')).toBe(true);
  expect(clear(render())).toBeDefined();
  clear(render())!.props.onPress();
  expect(clear(render())).toBeUndefined();
});

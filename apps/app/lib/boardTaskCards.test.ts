import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { BoardTask } from './boardTasks';

const state = vi.hoisted(() => ({ tasks: [] as BoardTask[], push: vi.fn(), dark: false }));
vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(), useState: (value: unknown) => [value, vi.fn()] }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', Image: 'Image', ScrollView: 'ScrollView', Modal: 'Modal', ActivityIndicator: 'ActivityIndicator', Alert: { alert: vi.fn() }, StyleSheet: { create: (s: unknown) => s } }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({ router: { push: state.push } }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { tasks: state.tasks } }), useQueryClient: () => ({}), useMutation: () => ({ mutate: vi.fn() }) }));
vi.mock('./api', () => ({ apiFetch: vi.fn() }));
vi.mock('./thread', () => ({ useSettings: () => ({ data: { region: { timezone: 'UTC' } } }) }));
vi.mock('./neighbours', () => ({ NEIGHBOURS: { ollie: { head: 1 } } }));
vi.mock('./theme', () => ({ useTheme: () => ({ color: { surfaceCard: state.dark ? '#222' : '#fff', borderStructure: '#888', borderEmphasis: state.dark ? '#eee' : '#111' }, typography: { textBody: {}, textSmall: {} } }) }));
vi.mock('../components/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../components/dashboard/DashboardHeader', () => ({ DashboardHeader: 'DashboardHeader' }));
vi.mock('../components/dashboard/DomainCard', () => ({ DomainCard: 'DomainCard' }));
vi.mock('../components/dashboard/RangeChips', () => ({ RangeChips: 'RangeChips' }));
vi.stubGlobal('React', React);
import BoardScreen from '../app/(drawer)/board';

type Node = React.ReactElement<Record<string, any>>;
function nodes(node: unknown): Node[] {
  if (!React.isValidElement(node)) return Array.isArray(node) ? node.flatMap(nodes) : [];
  const e = node as Node;
  return [e, ...nodes(e.props.children)];
}
function style(value: any): Record<string, any> {
  return Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value ?? {};
}
function card(tree: Node[], label: string): Node {
  // Closest shared container for the task's navigation and status controls.
  return tree.filter(n => n.type === 'View' as any && nodes(n).some(c => c.props.accessibilityLabel === `${label}. Change status`) && nodes(n).some(c => c.type === 'Pressable' as any && c.props.onPress && !c.props.accessibilityLabel)).at(-1)!;
}
beforeEach(() => {
  state.dark = false;
  state.push.mockClear();
  state.tasks = ['progress', 'planned', 'done', 'declined'].map((status, i) => ({ id: `${i}`, neighbour: 'penny', kind: 'confirm_category', status: status as BoardTask['status'], asked_at: new Date().toISOString(), origin_message_id: `origin-${i}` }));
});
it.each([false, true])('renders independently bounded status cards using the active theme (dark=%s)', dark => {
  state.dark = dark;
  const tree = nodes(BoardScreen());
  for (const [label, width, opacity] of [['In progress', 2, 1], ['Planned', 1, 1], ['Done', 1, 1], ['Declined', 1, .62]] as const) {
    const c = card(tree, label);
    expect(style(c.props.style)).toMatchObject({ borderWidth: width, borderColor: width === 2 ? (dark ? '#eee' : '#111') : '#888', backgroundColor: dark ? '#222' : '#fff' });
    expect(style(c.props.style).opacity ?? 1).toBe(opacity);
    expect(nodes(c).some(n => n.props.accessibilityRole === 'header')).toBe(false);
  }
});
it('separates task groups with 12px spacing without a surrounding shared card', () => {
  const tree = nodes(BoardScreen());
  const list = tree.filter(n => n.type === 'View' as any && nodes(n).filter(c => c.props.accessibilityLabel?.endsWith('. Change status')).length === 4).at(-1)!;
  expect(style(list.props.style).gap).toBe(12);
  expect(style(list.props.style).borderWidth ?? 0).toBe(0);
  expect(style(list.props.style).backgroundColor).toBeUndefined();
});
it('updates the same task appearance when refreshed status changes and keeps navigation intact', () => {
  state.tasks = [state.tasks[0]];
  let c = card(nodes(BoardScreen()), 'In progress');
  const navigation = nodes(c).find(n => n.type === 'Pressable' as any && !n.props.accessibilityLabel)!;
  navigation.props.onPress();
  expect(state.push).toHaveBeenCalledWith({ pathname: '/', params: { answer: 'origin-0' } });
  state.tasks[0] = { ...state.tasks[0], status: 'declined' };
  c = card(nodes(BoardScreen()), 'Declined');
  expect(style(c.props.style)).toMatchObject({ borderWidth: 1, opacity: .62 });
  expect(nodes(c).filter(n => n.props.accessibilityLabel === 'Declined. Change status')).toHaveLength(1);
});

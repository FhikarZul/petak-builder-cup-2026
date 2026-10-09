// Ollie's board (Run B #1) — the front desk.
//
// This is the founder-approved Tasks-only board. Chat authors content;
// the board changes task status through the existing C101 controls.
//
// "Answer X in chat" scrolls back to the ORIGINAL message, marks it "From
// the board" and pins a reply chip above the input — it never re-sends the
// question (Run A #33, 28 Aug). The row deep-links with the task's
// origin_message_id; the chat home scrolls, marks and pins.
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { validBoardOrigin, BOARD_ORIGIN_UNAVAILABLE } from '../../lib/boardNavigation';
import { apiFetch } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { DomainCard } from '../../components/dashboard/DomainCard';
import { customFieldLabel, parseCustomDate } from '../../lib/dashboard';
import { NEIGHBOURS, type NeighbourId } from '../../lib/neighbours';
import { useSettings } from '../../lib/thread';
import { RangeChips, type RangeChipOption } from '../../components/dashboard/RangeChips';
import { useTheme } from '../../lib/theme';
import {
  boardView,
  boardCalendarDay,
  type BoardRange,
  type BoardWindow,
  nextStatuses,
  taskCountLine,
  taskTitle,
  transitionLabel,
  waitedFor,
  TASK_STATUSES,
  TASK_STATUS_ICON,
  TASK_STATUS_LABEL,
  type BoardTask,
  type StatusFilter,
  type TaskStatus,
} from '../../lib/boardTasks';

const RANGES: readonly RangeChipOption[] = [
  { key: 'today', label: 'Today' }, { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }, { key: 'custom', label: 'Custom' },
];

// The retired Petak/invite surface remains documented in the historical
// drawing, but is intentionally not rendered on this task-only board:
// "There's an empty petak upstairs" / "There's an empty petak upstairs.".

export default function BoardScreen() {
  const t = useTheme();
  const settings = useSettings();
  const timezone = settings.data?.region?.timezone ?? null;
  // C101 — the board filters by status, so it asks for the resolved ones too.
  // Everywhere else still gets the live-only default.
  const tasks = useQuery({
    queryKey: ['tasks', 'board'],
    queryFn: () => apiFetch<{ tasks: BoardTask[] }>('/v1/tasks?status=all'),
    staleTime: 30 * 1000,
  });

  // C101 (4 Sep, founder) — "a task's state is changed by a BUTTON on the
  // board, because closing a task by typing a sentence is counter-intuitive."
  //
  // Optimistic, because the whole complaint was that saying "I'm not doing
  // that one" took a sentence in chat. A tap that waits on a round-trip before
  // the chip moves feels like the sentence it replaced. On failure the cache
  // is rolled back and the row snaps to what the server actually holds.
  const queryClient = useQueryClient();
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      apiFetch(`/v1/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'board'] });
      const previous = queryClient.getQueryData<{ tasks: BoardTask[] }>(['tasks', 'board']);
      queryClient.setQueryData<{ tasks: BoardTask[] }>(['tasks', 'board'], (old) =>
        old ? { tasks: old.tasks.map((x) => (x.id === id ? { ...x, status } : x)) } : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['tasks', 'board'], ctx.previous);
    },
    // The task list is also read by the chat header's waiting count, so both
    // settle from the same refetch rather than drifting apart.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const open = tasks.data?.tasks ?? [];
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [range, setRange] = useState<BoardRange>('today');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [custom, setCustom] = useState<BoardWindow | undefined>();
  const [editingDate, setEditingDate] = useState<'from' | 'to' | null>(null);
  const [dateDraft, setDateDraft] = useState('');
  const now = new Date();
  const today = boardCalendarDay(now, timezone);
  const { counts, shown } = boardView(open, { range, now, timezone, custom, status: statusFilter, query });
  const parsedDate = parseCustomDate(dateDraft, today);
  const canSaveDate = !!(custom && parsedDate && (editingDate === 'from' ? parsedDate <= custom.to : parsedDate >= custom.from));
  const changeRange = (key: string) => {
    setRange(key as BoardRange);
    if (key === 'custom' && !custom) setCustom({ from: today, to: today });
  };
  const editDate = (field: 'from' | 'to') => {
    if (!custom) return;
    setDateDraft(custom[field]);
    setEditingDate(field);
  };
  const saveDate = () => {
    if (!custom || !editingDate || !parsedDate || !canSaveDate) return;
    setCustom({ ...custom, [editingDate]: parsedDate });
    setEditingDate(null);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <DashboardHeader id="ollie" t={t} />
      <ScrollView contentContainerStyle={styles.body}>
        <DomainCard fill={t.color.fillSystem} t={t} style={{ gap: 14 }}>
          <View style={styles.heroHead}>
            <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}>Tasks</Text>
            <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>{taskCountLine(shown.length)}</Text>
          </View>
          <RangeChips options={RANGES} value={range} onChange={changeRange} t={t} />
          {range === 'custom' && custom ? <View style={styles.customRow}>
            {(['from', 'to'] as const).map((field, index) => <View key={field} style={styles.customPart}>
              {index === 1 ? <Text style={{ color: t.color.textSecondary }}>to</Text> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={field === 'from' ? 'From date' : 'To date'} onPress={() => editDate(field)} style={[styles.dateField, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
                <Icon name="calendar_today" size={18} color={t.color.textSecondary} />
                <Text style={{ flexShrink: 1, color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 13 }}>{customFieldLabel(custom[field])}</Text>
              </Pressable>
            </View>)}
          </View> : null}
            {/* The drawn status row: All 11 · Planned 3 · In progress 3 · …
                A chip with a count of zero is still shown, because a row whose
                chips appear and vanish as you work is a row you cannot aim at. */}
              <View style={styles.chipRow}>
                {(['all', ...TASK_STATUSES] as StatusFilter[]).map((key) => {
                  const on = statusFilter === key;
                  const label = key === 'all' ? 'All' : TASK_STATUS_LABEL[key];
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${label}, ${counts[key]}`}
                      onPress={() => setStatusFilter(key)}
                      style={[
                        styles.chip,
                        {
                          // Selection is depth and border, never a domain
                          // accent: an accent answers WHO, never what is
                          // selected (C01).
                          backgroundColor: on ? t.color.surfaceInset : t.color.surfaceCard,
                          borderColor: on ? t.color.textPrimary : t.color.borderStructure,
                        },
                      ]}
                    >
                      {key !== 'all' ? (
                        <Icon name={TASK_STATUS_ICON[key]} size={14} color={t.color.textSecondary} />
                      ) : null}
                      <Text
                        style={{
                          color: on ? t.color.textPrimary : t.color.textSecondary,
                          fontFamily: t.typography.textSmall.fontFamily,
                          fontSize: 12.5,
                          fontWeight: on ? '500' : '400',
                        }}
                      >
                        {`${label} ${counts[key]}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
        </DomainCard>
        <View style={[styles.search, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
          <Icon name="search" size={20} color={t.color.textSecondary} />
          <TextInput accessibilityLabel="Search tasks" value={query} onChangeText={setQuery} placeholder="Search tasks" placeholderTextColor={t.color.textSecondary} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, minWidth: 0, color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15, paddingVertical: 0 }} />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}><Icon name="close" size={20} color={t.color.textSecondary} /></Pressable> : null}
        </View>
            <View style={shown.length > 0 ? styles.list : [styles.emptyList, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              {tasks.isLoading ? <ActivityIndicator color={t.color.textSecondary} style={{ padding: 16 }} /> : tasks.isError ? <Pressable accessibilityRole="button" onPress={() => void tasks.refetch()} style={{ padding: 16 }}><Text style={{ color: t.color.interactive, fontFamily: t.typography.textBody.fontFamily }}>Try again</Text></Pressable> : shown.length === 0 && open.length > 0 ? (
                <Text
                  style={{
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 13,
                    paddingVertical: 12,
                  }}
                >
                  {query.trim() ? `Nothing matches "${query.trim()}".` : 'Nothing matches that. Widen the range, or clear the filters.'}
                </Text>
              ) : open.length === 0 ? (
                <Text
                  style={{
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 13,
                    lineHeight: 19,
                    paddingVertical: 12,
                  }}
                >
                  Nothing needs you. The neighbours are getting on with it.
                </Text>
              ) : (
                shown.map((task, index) => {
                  const n = NEIGHBOURS[task.neighbour as NeighbourId];
                  const waited = waitedFor(task.asked_at, new Date());
                  return (
                    <View key={task.id} style={{ gap: 8 }}>
                    {index === 0 || shown[index - 1].status !== task.status ? (
                      <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                        <Icon name={TASK_STATUS_ICON[task.status]} size={16} color={t.color.textSecondary} />
                        <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 11, fontWeight: '500', letterSpacing: 0.88, textTransform: 'uppercase' }}>
                          {TASK_STATUS_LABEL[task.status]}
                        </Text>
                      </View>
                    ) : null}
                    <View style={{
                      borderWidth: task.status === 'progress' ? 2 : 1,
                      borderColor: task.status === 'progress' ? t.color.borderEmphasis : t.color.borderStructure,
                      backgroundColor: t.color.surfaceCard,
                      opacity: task.status === 'declined' ? 0.62 : 1,
                      paddingHorizontal: 12,
                    }}>
                    <Pressable
                      accessibilityRole="button"
                      // push, not replace — the board is where you came from,
                      // and replace left no way back to it.
                      onPress={() => {
                        const origin = validBoardOrigin(task.origin_message_id);
                        if (!origin) {
                          Alert.alert('From the board', BOARD_ORIGIN_UNAVAILABLE);
                          return;
                        }
                        router.push({ pathname: '/', params: { answer: origin } });
                      }}
                      style={styles.taskRow}
                    >
                      {/* The neighbour's own head, as the drawing shows —
                          sprite and name together, never a generic glyph. */}
                      {n ? (
                        <Image source={n.head} style={styles.taskHead} accessibilityIgnoresInvertColors />
                      ) : (
                        <Icon name="forum" size={18} color={t.color.textSecondary} />
                      )}
                      <View style={{ flex: 1, gap: 2 }}>
                        {/* THE QUESTION ITSELF. Every row used to read "Answer
                            Penny in chat" — the same words however many tasks
                            were waiting, so the board could not tell you what
                            you were about to answer. */}
                        <Text
                          style={{
                            color: t.color.textPrimary,
                            fontFamily: t.typography.textBody.fontFamily,
                            fontSize: 14,
                          }}
                        >
                          {taskTitle(task.kind)}
                        </Text>
                        <Text
                          style={{
                            color: t.color.textSecondary,
                            fontFamily: t.typography.textSmall.fontFamily,
                            fontSize: 12,
                          }}
                        >
                          {[n?.name ?? task.neighbour, n?.roleWord, waited].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      {/* The chevron still carries the tap to chat — the
                          board never authors CONTENT (C39/C101). The status
                          button beside it is the one thing the board writes. */}
                      <Icon name="chevron_right" size={18} color={t.color.textSecondary} />
                    </Pressable>
                    {/* C101's button. Opens the moves this task can actually
                        make — the same closed table the server enforces, so a
                        tap the server would refuse is never offered. */}
                    <View style={styles.taskFoot}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${TASK_STATUS_LABEL[task.status]}. Change status`}
                        onPress={() => setMenuFor(menuFor === task.id ? null : task.id)}
                        style={[styles.statusPill, { borderColor: t.color.borderStructure }]}
                      >
                        <Icon name={TASK_STATUS_ICON[task.status]} size={14} color={t.color.textSecondary} />
                        <Text
                          style={{
                            color: t.color.textSecondary,
                            fontFamily: t.typography.textSmall.fontFamily,
                            fontSize: 12,
                          }}
                        >
                          {TASK_STATUS_LABEL[task.status]}
                        </Text>
                        <Icon
                          name={menuFor === task.id ? 'expand_less' : 'expand_more'}
                          size={14}
                          color={t.color.textSecondary}
                        />
                      </Pressable>
                      {menuFor === task.id
                        ? nextStatuses(task.status).map((to) => (
                            <Pressable
                              key={to}
                              accessibilityRole="button"
                              onPress={() => {
                                setMenuFor(null);
                                move.mutate({ id: task.id, status: to });
                              }}
                              style={[
                                styles.statusPill,
                                { borderColor: t.color.textPrimary, backgroundColor: t.color.surfaceInset },
                              ]}
                            >
                              <Icon name={TASK_STATUS_ICON[to]} size={14} color={t.color.textPrimary} />
                              <Text
                                style={{
                                  color: t.color.textPrimary,
                                  fontFamily: t.typography.textSmall.fontFamily,
                                  fontSize: 12,
                                  fontWeight: '500',
                                }}
                              >
                                {transitionLabel(task.status, to)}
                              </Text>
                            </Pressable>
                          ))
                        : null}
                    </View>
                    </View>
                  </View>
                  );
                })
              )}
            </View>

            {/* C57 entry two, drawn as Run B #20. The founder's note on the
                drawing: "below the last card, above nothing,
                hairline-separated — you reach it by finishing the board, not
                by having it float over your day. Secondary text, his 24px
                head, chevron carries the tap. No Teal fill: this is a door,
                not a state." So: no accent, no FAB, no card. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Something off? Tell Ollie"
              onPress={() => router.push('/(drawer)/settings/tell-ollie')}
              style={[styles.tellOllie, { borderTopColor: t.color.borderStructure }]}
            >
              <Image source={NEIGHBOURS.ollie.head} style={styles.tellOllieHead} />
              <Text
                style={{
                  flex: 1,
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 13,
                }}
              >
                Something off? Tell Ollie
              </Text>
              <Icon name="chevron_right" size={18} color={t.color.textSecondary} />
            </Pressable>
      </ScrollView>
      <Modal visible={editingDate !== null} transparent animationType="slide" onRequestClose={() => setEditingDate(null)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" accessibilityRole="button" onPress={() => setEditingDate(null)} />
          <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: t.color.surfacePage }]}>
            <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}>{editingDate === 'from' ? 'From date' : 'To date'}</Text>
            <TextInput accessibilityLabel={editingDate === 'from' ? 'From date' : 'To date'} value={dateDraft} onChangeText={setDateDraft} placeholder="1 Aug 2026" placeholderTextColor={t.color.textSecondary} autoCapitalize="none" autoCorrect={false} style={[styles.dateInput, { color: t.color.textPrimary, borderColor: t.color.borderStructure, fontFamily: t.typography.textBody.fontFamily }]} />
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setEditingDate(null)} style={styles.closeDate}><Icon name="close" size={22} color={t.color.textSecondary} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSaveDate }} disabled={!canSaveDate} onPress={saveDate} style={[styles.save, { backgroundColor: t.color.ink, opacity: canSaveDate ? 1 : 0.5 }]}><Text style={{ color: t.color.kapur, fontFamily: t.typography.textBody.fontFamily }}>Save</Text></Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    minHeight: 36, paddingHorizontal: 11, borderWidth: 1,
  },
  taskFoot: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12, paddingLeft: 42 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 30, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1,
  },
  root: { flex: 1 },
  heroHead: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  customRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customPart: { flex: 1, minWidth: 125, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateField: { flex: 1, minHeight: 44, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { padding: 20, gap: 16 },
  dateInput: { borderWidth: 1, padding: 12, fontSize: 16 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  closeDate: { minHeight: 44, justifyContent: 'center' },
  save: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
  body: { padding: 16, gap: 16 },
  // Hairline-separated from the last card, never a card of its own.
  tellOllie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 6,
  },
  tellOllieHead: { width: 24, height: 24, borderRadius: 12 },
  list: { gap: 12 },
  emptyList: { borderWidth: 1, paddingHorizontal: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  taskHead: { width: 26, height: 26, borderRadius: 4 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 13, paddingBottom: 10 },
});

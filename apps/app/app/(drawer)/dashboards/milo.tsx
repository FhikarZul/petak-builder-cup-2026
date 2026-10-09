import { DashboardLoadError } from '../../../components/dashboard/DashboardLoadError';
// Milo's dashboard — body (Run B #3) + log/timeline (Run B #8).
//
// What it draws is exactly what the server can honestly feed:
//   · the four inputs a target came from (C90 — the founder's ask)
//   · resting burn and today's In / Out / Net, with the assumptions NAMED
//   · the four macros beside their targets, or "No target" (C11 gate, #74)
//   · today's meals, in the order they were counted
//   · the range-scoped log, searched and filtered by the server
//
// Body fat carries NO target: C11 says it shows "beside its objective-derived
// target", and nothing in canon derives one. Flagged in delta 28g, not faked.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhotoViewer } from '../../../components/chat/rows';
import { BodyBoxes } from '../../../components/dashboard/BodyBoxes';
import { CustomRangeFields } from '../../../components/dashboard/CustomRangeFields';
import { DashboardHeader } from '../../../components/dashboard/DashboardHeader';
import { EnergyCard } from '../../../components/dashboard/EnergyCard';
import { toggleMiloFoodFilter } from '../../../lib/miloEnergyFilter';
import { MacroRows } from '../../../components/dashboard/MacroRows';
import { MealsStrip } from '../../../components/dashboard/MealsStrip';
import { NoObjective } from '../../../components/dashboard/NoObjective';
import { RangeChips, type RangeChipOption } from '../../../components/dashboard/RangeChips';
import { YouRow } from '../../../components/dashboard/YouRow';
import { Icon } from '../../../components/Icon';
import { rangeSub,
  localDayKey,
  miloLogGroups,
  miloLogSummaryLine,
  miloLogTypeChips,
  parseCustomDate,
  type MiloLogType,
  type PennyRange,
} from '../../../lib/dashboard';
import { useMiloLog, useMiloToday, type LedgerEntry } from '../../../lib/thread';
import { useTheme, type Theme } from '../../../lib/theme';

const RANGES: readonly RangeChipOption[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
];

const RANGE_TITLE: Record<PennyRange, string> = {
  today: 'Today',
  week: "This week's log",
  month: "This month's log",
  year: "This year's log",
  custom: 'Custom log',
};

export default function MiloDashboard() {
  const t = useTheme();
  // The device's day, for dating the 'Today' heading (see below).
  const todayLocalKey = localDayKey(new Date());
  const [range, setRange] = useState<PennyRange>('today');
  const [customWindow, setCustomWindow] = useState<{ from: string; to: string } | null>(null);
  const [editingDate, setEditingDate] = useState<'from' | 'to' | null>(null);
  const [dateDraft, setDateDraft] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [logType, setLogType] = useState<MiloLogType>('all');
  const today = useMiloToday();
  const log = useMiloLog(range, debouncedQuery, logType, customWindow ?? undefined);
  const logCounts = useMiloLog(range, '', 'all', customWindow ?? undefined);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const onRangeChange = (key: string) => {
    const next = key as PennyRange;
    setRange(next);
    if (next === 'custom' && !customWindow) {
      const todayKey = localDayKey(new Date());
      setCustomWindow({ from: todayKey, to: todayKey });
    }
  };

  const openEditor = (field: 'from' | 'to') => {
    if (!customWindow) return;
    setEditingDate(field);
    setDateDraft(customWindow[field]);
  };

  const saveEditor = () => {
    if (!editingDate || !customWindow) return;
    const parsed = parseCustomDate(dateDraft, localDayKey(new Date()));
    if (!parsed) return;
    const next = { ...customWindow, [editingDate]: parsed };
    if (next.from <= next.to) setCustomWindow(next);
    setEditingDate(null);
  };

  const data = today.data;
  const failedReads = [today, log, logCounts].filter(query => query.isError);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <DashboardHeader id="milo" t={t} />
      <ScrollView contentContainerStyle={styles.body}>
        {failedReads.length > 0 ? <DashboardLoadError label="your dashboard" hasData={data !== undefined} retrying={failedReads.some(query => query.isFetching)} onRetry={() => { for (const query of failedReads) void query.refetch(); }} t={t} /> : null}
        {today.isLoading ? (
          <ActivityIndicator color={t.color.textSecondary} />
        ) : today.isError && !data ? null : !data ? (
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>
            Nothing to show yet.
          </Text>
        ) : (
          <>
            {/* #74: the ask sits ONCE, at the top, and only when there is no
                objective at all. Never a banner that follows you around. */}
            {data.targets ? null : <NoObjective t={t} />}
            <YouRow profile={data.profile ?? {age:null,sex:null,height_cm:null,weight_kg:null}} basis={data.basis} t={t}>
              {data.body ? <BodyBoxes body={data.body} bodyFatTarget={data.body_fat_target_pct} now={new Date()} t={t} /> : null}
            </YouRow>
            {/* C63 — the drawn grammar is "header, a range row, THEN the
                current-state cards". The range row had sunk below the macros,
                so the control that decides what every card shows sat halfway
                down the screen, under the numbers it governs. */}
            <RangeChips options={RANGES} value={range} onChange={onRangeChange} t={t} />
            {range === 'custom' && customWindow ? (
              <CustomRangeFields from={customWindow.from} to={customWindow.to} onEdit={openEditor} t={t} />
            ) : null}

            <View style={styles.rangeHead}>
              <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}>
                {RANGE_TITLE[range]}
              </Text>
              {/* The drawing dates the window — "Today  Wed · 12 Aug". Without
                  it, "Today" is the only thing on the screen that cannot be
                  checked against a calendar.

                  Penny reads hers from the server's window; Milo's payload
                  carries none, so TODAY is dated from the device and the wider
                  ranges say nothing rather than guess at a window the screen
                  does not have. Same rangeSub formatter either way — one voice
                  for a date, not two. */}
              {range === 'today' ? (
                <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>
                  {rangeSub({ from: todayLocalKey, to: todayLocalKey }, 'today')}
                </Text>
              ) : null}
            </View>

            {range === 'today' ? <>
            {data.basis ? <EnergyCard intake={data.calories} meals={data.entries} basis={data.basis} targetCalories={data.targets?.calories} foodSelected={logType === 'food'} onFilterIn={() => setLogType(toggleMiloFoodFilter)} t={t} /> : null}
            <MacroRows today={data} t={t} />
            <MealsStrip today={data} t={t} />
            </> : null}

            {!log.isError || log.data ? (
            <MiloLog
              entries={log.data?.entries ?? []}
              chipEntries={logCounts.data?.entries ?? log.data?.entries ?? []}
              nextCursor={log.data?.next_cursor ?? null}
              loading={log.isLoading || logCounts.isLoading}
              query={query}
              onQuery={setQuery}
              activeType={logType}
              onType={(key) => setLogType(key as MiloLogType)}
              t={t}
            />
            ) : null}
          </>
        )}
      </ScrollView>
      <Modal visible={editingDate !== null} transparent animationType="fade" onRequestClose={() => setEditingDate(null)}>
        <View style={styles.modalScrim}>
          <View style={[styles.sheet, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
            <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontWeight: '500', fontSize: 15 }}>
              {editingDate === 'from' ? 'From date' : 'To date'}
            </Text>
            <TextInput
              value={dateDraft}
              onChangeText={setDateDraft}
              placeholder="1 Aug 2026"
              placeholderTextColor={t.color.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.dateInput,
                {
                  color: t.color.textPrimary,
                  borderColor: t.color.borderStructure,
                  fontFamily: t.typography.textBody.fontFamily,
                },
              ]}
            />
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={() => setEditingDate(null)} style={styles.iconButton}>
                <Icon name="close" size={22} color={t.color.textSecondary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={saveEditor}
                style={[styles.saveButton, { backgroundColor: t.color.ink }]}
              >
                <Text style={{ color: t.color.kapur, fontFamily: t.typography.textBody.fontFamily, fontWeight: '500' }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MiloLog({
  entries,
  chipEntries,
  nextCursor,
  loading,
  query,
  onQuery,
  activeType,
  onType,
  t,
}: {
  entries: LedgerEntry[];
  chipEntries: LedgerEntry[];
  nextCursor: string | null;
  loading: boolean;
  query: string;
  onQuery: (text: string) => void;
  activeType: MiloLogType;
  onType: (key: string) => void;
  t: Theme;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [whyOpen, setWhyOpen] = useState<Record<string, boolean>>({});
  // Thumbnails and the expanded photo open the SAME full-screen viewer the
  // feed uses (founder, 3 Sep 2026 — "I can't see the photos"). A PDF never
  // reaches it: the row shows an inert document chip instead (0029).
  const [viewer, setViewer] = useState<{ uri: string; caption: string; time: string; photoId: string | null } | null>(null);
  const groups = miloLogGroups(entries, new Date());
  const rowIds = groups.flatMap((g) => g.rows.map((r) => r.id));
  const allExpanded = rowIds.length > 0 && rowIds.every((id) => expanded[id]);
  const summary = miloLogSummaryLine(rowIds.length, nextCursor);
  const chips = miloLogTypeChips(chipEntries);

  const toggleAll = () => {
    if (allExpanded) setExpanded({});
    else setExpanded(Object.fromEntries(rowIds.map((id) => [id, true])));
  };

  return (
    <View style={styles.logBlock}>
      <View style={[styles.search, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
        <Icon name="search" size={20} color={t.color.textSecondary} />
        <TextInput accessibilityLabel="Search the log" value={query} onChangeText={onQuery} placeholder="Search the log" placeholderTextColor={t.color.textSecondary} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, minWidth: 0, padding: 0, color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onQuery('')} hitSlop={8}><Icon name="close" size={20} color={t.color.textSecondary} /></Pressable> : null}
      </View>
      <View style={styles.typeChips}>
        {chips.map(chip => {
          const selected = activeType === chip.key;
          const color = selected ? t.color.kapur : t.color.textPrimary;
          return <Pressable key={chip.key} accessibilityRole="button" accessibilityLabel={`${chip.label}, ${chip.count}`} accessibilityState={{ selected }} onPress={() => onType(chip.key)} style={[styles.typeChip, { backgroundColor: selected ? t.color.ink : t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
            <Icon name={chip.icon} size={17} color={color} />
            <Text style={{ color, fontFamily: t.typography.textBody.fontFamily, fontSize: 13 }}>{chip.label}</Text>
            <Text style={{ color, opacity: 0.62, fontFamily: t.typography.textBody.fontFamily, fontSize: 13 }}>{chip.count}</Text>
          </Pressable>;
        })}
      </View>
      {summary !== null ? <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>{summary}</Text> : null}
      {loading ? (
        <ActivityIndicator color={t.color.textSecondary} />
      ) : rowIds.length === 0 ? (
        <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>
            Nothing in this window.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.expandLine}>
            <Pressable accessibilityRole="button" onPress={toggleAll} style={styles.textButton}>
              <Icon name={allExpanded ? 'unfold_less' : 'unfold_more'} size={18} color={t.color.textSecondary} />
              <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </Text>
            </Pressable>
          </View>
          {groups.map((group) => (
            <View key={group.day} style={styles.dayGroup}>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textLabel.fontFamily,
                  fontSize: 11,
                  fontWeight: '500',
                  letterSpacing: 0.9,
                  textTransform: 'uppercase',
                }}
              >
                {group.label}
              </Text>
              {group.rows.map((row) => {
                const isOpen = expanded[row.id] === true;
                const showWhy = whyOpen[row.id] === true;
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    onPress={() => setExpanded((prev) => ({ ...prev, [row.id]: !isOpen }))}
                    style={[styles.logCard, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}
                  >
                    <View style={styles.logTop}>
                      {row.contentType === 'application/pdf' ? (
                        /* A document is inert: the viewer stays image-only. */
                        <View
                          accessibilityLabel="PDF receipt"
                          style={[styles.logThumb, styles.logDocWell, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}
                        >
                          <Icon name="description" size={18} color={t.color.textSecondary} />
                        </View>
                      ) : row.imageUrl ? (
                        <Pressable
                          accessibilityRole="imagebutton"
                          accessibilityLabel={`Photo: ${row.title}`}
                          onPress={() =>
                            setViewer({ uri: row.imageUrl!, caption: row.title, time: row.time, photoId: row.photoId })
                          }
                        >
                          <Image
                            source={{ uri: row.imageUrl }}
                            style={[styles.logThumb, { borderColor: t.color.borderStructure }]}
                          />
                        </Pressable>
                      ) : (
                        <View style={[styles.logIcon, { backgroundColor: t.color.surfacePage }]}>
                          <Icon name={row.icon} size={21} color={t.color.textPrimary} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.logTitleLine}>
                          <Text
                            numberOfLines={1}
                            style={{ flexShrink: 1, color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}
                          >
                            {row.title}
                          </Text>
                          {row.energy ? (
                            <View style={[styles.energyChip, { backgroundColor: t.color.surfacePage }]}>
                              <Text
                                style={{
                                  color: t.color.textPrimary,
                                  fontFamily: t.typography.textSmall.fontFamily,
                                  fontSize: 12,
                                  fontVariant: ['tabular-nums'],
                                }}
                              >
                                {row.energy}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {row.subtitle ? (
                          <Text
                            numberOfLines={1}
                            style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}
                          >
                            {row.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={{
                          color: t.color.textSecondary,
                          fontFamily: t.typography.textSmall.fontFamily,
                          fontSize: 12,
                          fontVariant: ['tabular-nums'],
                          minWidth: 42,
                          textAlign: 'right',
                        }}
                      >
                        {row.time}
                      </Text>
                      <Icon name={isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={20} color={t.color.textSecondary} />
                    </View>

                    {isOpen ? (
                      <View style={[styles.logDetail, { borderTopColor: t.color.borderStructure }]}>
                        {row.hasPhoto ? (
                          row.contentType === 'application/pdf' ? (
                            /* A document stays an inert chip (0029) — never
                               an Image, never the viewer. */
                            <View style={[styles.photoWell, { borderColor: t.color.borderStructure }]}>
                              <Icon name="description" size={20} color={t.color.textSecondary} />
                              <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
                                PDF receipt
                              </Text>
                            </View>
                          ) : row.imageUrl ? (
                            /* The photo itself, full width at the receipts'
                               fixed aspect; the tap opens the viewer. */
                            <Pressable
                              accessibilityRole="imagebutton"
                              accessibilityLabel={`Photo: ${row.title}`}
                              onPress={() =>
                                setViewer({ uri: row.imageUrl!, caption: row.title, time: row.time, photoId: row.photoId })
                              }
                            >
                              <Image
                                source={{ uri: row.imageUrl }}
                                style={[styles.logPhoto, { borderColor: t.color.borderStructure }]}
                                resizeMode="cover"
                              />
                            </Pressable>
                          ) : (
                            <View style={[styles.photoWell, { borderColor: t.color.borderStructure }]}>
                              <Icon name="image" size={20} color={t.color.textSecondary} />
                              <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
                                photo kept
                              </Text>
                            </View>
                          )
                        ) : null}
                        {row.items?.map(item => (
                          <View key={item.id} style={{ gap: 5, paddingVertical: 10, borderBottomWidth: 1, borderColor: t.color.borderStructure }}>
                            <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>{item.title}</Text>
                            {item.energy ? <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>{item.energy}</Text> : null}
                            {item.detail ? <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>{item.detail}</Text> : null}
                            {item.macros.length ? <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12, lineHeight: 18 }}>{item.macros.map(m => `${m.label} ${m.value}`).join(' · ')}</Text> : null}
                          </View>
                        ))}
                        {row.detail ? (
                          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13, lineHeight: 19 }}>
                            {row.detail}
                          </Text>
                        ) : null}
                        {row.rating !== null ? (
                          <View style={styles.ratingLine}>
                            <View style={styles.pips}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <View
                                  key={n}
                                  style={[
                                    styles.pip,
                                    {
                                      backgroundColor: n <= Math.round(row.rating ?? 0) ? t.color.ink : t.color.surfacePage,
                                      borderColor: t.color.borderStructure,
                                    },
                                  ]}
                                />
                              ))}
                            </View>
                            {row.ratingWhy ? (
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => setWhyOpen((prev) => ({ ...prev, [row.id]: !showWhy }))}
                                style={styles.textButton}
                              >
                                <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>
                                  {showWhy ? 'Hide' : 'Why?'}
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                        {showWhy && row.ratingWhy ? (
                          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13, lineHeight: 19 }}>
                            {row.ratingWhy}
                          </Text>
                        ) : null}
                        {row.macros.length > 0 ? (
                          <View style={styles.macroGrid}>
                            {row.macros.map((m) => (
                              <View key={m.label} style={[styles.macroBox, { borderColor: t.color.borderStructure }]}>
                                <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontWeight: '500', fontSize: 14 }}>
                                  {m.value}
                                </Text>
                                <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 11 }}>
                                  {m.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </>
      )}
      {viewer ? (
        <Modal visible animationType="fade" onRequestClose={() => setViewer(null)}>
          <PhotoViewer viewer={viewer} onClose={() => setViewer(null)} />
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 16 },
  card: { borderWidth: 1, padding: 14, gap: 10 },
  rangeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  logBlock: { gap: 12 },
  search: { minHeight: 48, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 4, borderWidth: 1 },
  expandLine: { flexDirection: 'row', justifyContent: 'flex-end' },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayGroup: { gap: 8 },
  logCard: { borderWidth: 1, padding: 12, gap: 10 },
  logTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  // The row thumbnail — the resident-card head idiom (structure border,
  // radius 2), 40px square; the expanded photo is full width at the receipts'
  // fixed aspect (the capture cards' 200×140 well ≈ 10:7).
  logThumb: { width: 40, height: 40, borderWidth: 1, borderRadius: 2 },
  logDocWell: { alignItems: 'center', justifyContent: 'center' },
  logPhoto: { width: '100%', aspectRatio: 10 / 7, borderWidth: 1, borderRadius: 8 },
  logTitleLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 },
  energyChip: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  logDetail: { borderTopWidth: 1, paddingTop: 10, gap: 10 },
  photoWell: {
    height: 58,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  ratingLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pips: { flexDirection: 'row', gap: 5 },
  pip: { width: 18, height: 8, borderRadius: 4, borderWidth: 1 },
  macroGrid: { flexDirection: 'row', gap: 8 },
  macroBox: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, gap: 2 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'center', padding: 20 },
  sheet: { borderWidth: 1, borderRadius: 8, padding: 16, gap: 14 },
  dateInput: { borderWidth: 1, borderRadius: 8, height: 48, paddingHorizontal: 12, fontSize: 16 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  saveButton: { height: 42, borderRadius: 6, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
});

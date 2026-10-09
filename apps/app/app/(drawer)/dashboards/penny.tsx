import { DashboardLoadError } from '../../../components/dashboard/DashboardLoadError';
// Penny's dashboard — money (Run B #4), third pass: the range chips, the
// three drawn trend cards, and the searchable range-scoped log now ship, fed
// by GET /v1/neighbours/penny/series, /categories and /entries?q=
// (plans/2026-08-28-penny-charts-series.md, sub-slices B+C; forks recorded
// in the 28 Aug repo delta). Run B #5 added the fifth chip: the custom range
// is live (typed from/to, range=custom&from=&to=; the editor sheet is
// undrawn surface — flagged for redraw, delta 28u).
//
// Drawn from what the ledger actually serves:
//   · the budget position — bar, even-pace mark, and where you stand (C50)
//   · the range row (Today/Week/Month/Year/Custom — custom range live, typed
//     from/to, editor sheet undrawn — flagged for redraw, delta 28u)
//     and the range header whose sublabel derives from the SAME window the
//     server filtered by (C75: label and window agree)
//   · today: the metric boxes, "Where it went" (C39/C43)
//   · week/month/year/custom: the trend stack — daily-spend deviation bars,
//     "Where it went" for the window, the running total (month+budget only,
//     fork 4), and "Where you go most" — every figure from /series or
//     /categories, never maths over a page of /entries (the 28i rule)
//   · the log, in every range: search (debounced q= over merchant /
//     merchant_raw / category), type chips whose counts come window-wide
//     from /series and /categories, day dividers whose totals come from the
//     series' anchored days. The summary line omits any figure a paginated
//     page cannot honestly total.
//
// The month hero compares matched elapsed-day windows from the full ledger;
// it never compares a partial current month against a complete previous month.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BudgetPosition, NoBudget } from '../../../components/dashboard/BudgetPosition';
import { CustomRangeFields } from '../../../components/dashboard/CustomRangeFields';
import { DailySpendChart } from '../../../components/dashboard/DailySpendChart';
import { DashboardHeader } from '../../../components/dashboard/DashboardHeader';
import { PhotoViewer } from '../../../components/chat/rows';
import { Icon } from '../../../components/Icon';
import { LogSearch, type LogTypeChip } from '../../../components/dashboard/LogSearch';
import { EntryItems } from '../../../components/dashboard/EntryItems';
import { entryBreakdown } from '../../../lib/entryItems';
import { expenseTotal } from '../../../lib/expenseTotal';
import { ledgerCurrencyEvidence } from '../../../lib/ledgerCurrencyEvidence';
import { CurrencyEvidenceList } from '../../../components/CurrencyEvidenceRows';
import { RangeChips, type RangeChipOption } from '../../../components/dashboard/RangeChips';
import { RunningTotalChart } from '../../../components/dashboard/RunningTotalChart';
import { WhereItWent } from '../../../components/dashboard/WhereItWent';
import { WhereYouGoMost } from '../../../components/dashboard/WhereYouGoMost';
import {
  categoryLabel,
  categorySubLabel,
  entryDayKey,
  localDayKey,
  logDayLabel,
  logSummaryLine,
  money,
  parseCustomDate,
  pennyTodayDelta,
  rangeSub,
  togglePennyMetricFilter,
  type PennyRange,
} from '../../../lib/dashboard';
import { NEIGHBOURS } from '../../../lib/neighbours';
import {
  useCategories,
  usePennyLog,
  usePennySeries,
  usePennyToday,
  type LedgerEntry,
} from '../../../lib/thread';
import { useTheme } from '../../../lib/theme';

// All five drawn chips (:847-851) — Custom is live (Run B #5): a typed
// from/to window, edited in a sheet since the drawing draws no picker
// (fork 1 — undrawn surface, flagged for redraw, delta 28u).
const RANGES: readonly RangeChipOption[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
];

const RANGE_TITLE: Record<PennyRange, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
  custom: 'Custom range', // :2692's words
};

export default function PennyDashboard() {
  const t = useTheme();
  const [range, setRange] = useState<PennyRange>('today');
  const [query, setQuery] = useState('');
  // Sub-slice C: the search fires at ≥1 trimmed char after ~300ms of quiet —
  // a useState+useEffect timer, no library (the no-new-deps boundary).
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [logType, setLogType] = useState<string>('all');
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Run B #5 — the custom window and its editor. The window is kept in
  // screen state when a named chip is tapped, so Custom can be re-entered
  // (fork 7). The editor is the quiet-hours idiom: a Modal sheet with one
  // TextInput, no calendar anything (the no-new-deps boundary).
  const [customWindow, setCustomWindow] = useState<{ from: string; to: string } | null>(null);
  const [editingDate, setEditingDate] = useState<'from' | 'to' | null>(null);
  /** PAR-B04 — which log rows are open. Local and unpersisted: which receipt
   *  you were reading is not a preference, and restoring it on a later visit
   *  would be a surprise rather than a courtesy. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dateDraft, setDateDraft] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  // The log row's thumbnail opens the SAME full-screen viewer the feed uses
  // (founder, 3 Sep 2026 — "I can't see the photos"). A PDF never reaches it:
  // the row shows an inert document well instead.
  const [viewer, setViewer] = useState<{ uri: string; caption: string; time: string; photoId: string | null } | null>(null);

  const openEditor = (field: 'from' | 'to') => {
    setDateDraft(customWindow?.[field] ?? '');
    setDateError(null);
    setEditingDate(field);
  };

  const onRangeChange = (key: string) => {
    if (key === 'custom') {
      // Fork 7: with a saved window, Custom re-selects it; with none, the
      // From editor opens first (then To, then the range activates).
      if (customWindow) setRange('custom');
      else openEditor('from');
      return;
    }
    setRange(key as PennyRange);
  };

  const saveDate = () => {
    if (!editingDate) return;
    const parsed = parseCustomDate(dateDraft, localDayKey(new Date()));
    if (!parsed) return setDateError('Try 12 Aug 2026 or 2026-08-12 — not a future date.');
    const next = { ...(customWindow ?? { from: parsed, to: parsed }), [editingDate]: parsed };
    if (next.from > next.to) return setDateError('From must be on or before To.');
    setCustomWindow(next);
    setRange('custom');
    // Fork 7's two-tap flow: saving From with no prior window pre-seeds
    // to = from and immediately re-opens the To editor instead of closing.
    if (editingDate === 'from' && !customWindow) {
      setEditingDate('to');
      setDateDraft(parsed);
    } else {
      setEditingDate(null);
    }
  };

  const today = usePennyToday();
  const series = usePennySeries(range, customWindow ?? undefined);
  const month = usePennySeries('month');
  // Today's "Where it went" stays month-scoped (the W5 ship); the trend
  // ranges pass their own window.
  const categories = useCategories(range === 'today' ? 'month' : range, customWindow ?? undefined);
  // The type chips' per-category counts are window-scoped like the log, so
  // they need the SELECTED range even on 'today' (a separate key from the
  // month-scoped chart above; the trend ranges dedupe against it).
  const logCategories = useCategories(range, customWindow ?? undefined);
  const log = usePennyLog(range, debouncedQuery, logType, customWindow ?? undefined);

  const data = today.data;
  const failedReads = [today, month, categories, logCategories, log, series].filter(query => query.isError);
  const s = series.data;

  // The log reads the same predicate family the series counts (expense,
  // non-voided, non-superseded), so the rows and the chips' counts can agree.
  const logRows = (log.data?.entries ?? []).filter(
    (e) => e.kind === 'expense' && !e.voided && e.superseded_by === null,
  );
  const dayGroups: { day: string; rows: LedgerEntry[] }[] = [];
  for (const e of logRows) {
    const day = entryDayKey(e.created_at, e.effective_day);
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.day === day) last.rows.push(e);
    else dayGroups.push({ day, rows: [e] });
  }

  // The summary line (28i: no quiet partial sums). Count: window-wide from
  // /series or /categories when unfiltered; the page's own length only when
  // the page IS the whole filtered set; otherwise nothing honest exists and
  // the line is not drawn. Money: summed over the page, and only when the
  // page is the whole set (next_cursor null).
  const nextCursor = log.data?.next_cursor ?? null;
  const searching = debouncedQuery.length > 0;
  let logCount: number | null = null;
  if (s && !searching) {
    if (logType === 'all') logCount = s.log_counts.all;
    else if (logType === 'photos') logCount = s.log_counts.with_photo;
    else logCount = logCategories.data?.categories.find((c) => c.category === logType)?.entries ?? null;
  } else if (log.data && !nextCursor) {
    logCount = logRows.length;
  }
  const logTotal = log.data && !nextCursor && s
    ? expenseTotal(logRows, s.currency)
    : null;
  const summary = s ? logSummaryLine(logCount, logTotal, s.currency) : null;

  const chips: LogTypeChip[] = s
    ? [
        { key: 'all', label: 'All', icon: 'list', count: s.log_counts.all },
        { key: 'photos', label: 'With a photo', icon: 'image', count: s.log_counts.with_photo },
        // One chip per live NAMED category. The "Waiting on a name" group
        // (category null) gets no chip: the entries endpoint cannot filter
        // by a name that does not exist yet.
        ...(logCategories.data?.categories ?? [])
          .filter((c) => c.category !== null && c.entries > 0)
          .map((c) => ({ key: c.category as string, label: c.category as string, count: c.entries })),
      ]
    : [];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <DashboardHeader id="penny" t={t} />
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
            {data.budget ? <BudgetPosition budget={data.budget} comparison={month.data?.comparison} t={t} /> : <NoBudget month={month.data} loading={month.isPending} onRetry={() => void month.refetch()} t={t} />}

            <RangeChips options={RANGES} value={range} onChange={onRangeChange} t={t} />

            {/* The drawn fields row (:853-859) — only when Custom is active
                (the drawing's sc-if). */}
            {range === 'custom' && customWindow ? (
              <CustomRangeFields from={customWindow.from} to={customWindow.to} onEdit={openEditor} t={t} />
            ) : null}

            <View style={styles.rangeHead}>
              <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}>
                {RANGE_TITLE[range]}
              </Text>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 13,
                }}
              >
                {s ? rangeSub(s.window, range) : ''}
              </Text>
            </View>

            {range === 'today' ? (
              <>
                <View style={styles.boxes}>
                  {[
                    {
                      label: 'Spent today',
                      value: money(data.spent_today.currency, data.spent_today.total),
                      sub: `${data.spent_today.entries} ${data.spent_today.entries === 1 ? 'entry' : 'entries'}`,
                      filter: null,
                      action: null,
                    },
                    {
                      label: 'Biggest',
                      value: data.biggest ? money(data.spent_today.currency, data.biggest.total) : '—',
                      sub: data.biggest ? categoryLabel(data.biggest.category) : 'Nothing spent',
                      filter: data.biggest?.category ?? null,
                      action: data.biggest
                        ? `${logType === data.biggest.category ? 'Showing' : 'Show'} ${categoryLabel(data.biggest.category).toLowerCase()}`
                        : null,
                    },
                    {
                      label: 'Receipts kept',
                      value: String(data.receipts_kept),
                      sub: `of ${data.spent_today.entries} ${data.spent_today.entries === 1 ? 'entry' : 'entries'}`,
                      filter: 'photos',
                      action: logType === 'photos' ? 'Showing these' : 'Show these',
                    },
                    {
                      label: 'Yesterday',
                      value: money(data.yesterday.currency, data.yesterday.total),
                      sub: data.yesterday.entries === 0
                        ? 'nothing spent'
                        : `${data.yesterday.entries} ${data.yesterday.entries === 1 ? 'entry' : 'entries'}`,
                      note: pennyTodayDelta(data.spent_today.total, data.yesterday.total, data.spent_today.currency),
                      filter: null,
                      action: null,
                    },
                  ].map((b) => (
                    <Pressable
                      key={b.label}
                      disabled={!b.filter}
                      accessibilityRole={b.filter ? 'button' : undefined}
                      accessibilityLabel={b.action ?? b.label}
                      onPress={() => b.filter && setLogType(togglePennyMetricFilter(logType, b.filter))}
                      style={[
                        styles.box,
                        {
                          backgroundColor: b.filter && logType === b.filter ? t.color.surfacePage : t.color.surfaceCard,
                          borderColor: b.filter && logType === b.filter ? t.color.borderEmphasis : t.color.borderStructure,
                          borderWidth: b.filter && logType === b.filter ? 2 : 1,
                          padding: b.filter && logType === b.filter ? 13 : 14,
                        },
                      ]}
                    >
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
                        {b.label}
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.65}
                        style={{
                          color: t.color.textPrimary,
                          fontFamily: t.typography.textBody.fontFamily,
                          fontWeight: '500',
                          fontSize: 20,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {b.value}
                      </Text>
                      <Text
                        style={{
                          color: t.color.textSecondary,
                          fontFamily: t.typography.textSmall.fontFamily,
                          fontSize: 11.5,
                        }}
                      >
                        {b.sub}
                      </Text>
                      {'note' in b && b.note ? (
                        <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 11.5 }}>
                          {b.note}
                        </Text>
                      ) : null}
                      {b.action ? (
                        <View style={styles.metricAction}>
                          <Text style={{ flex: 1, minWidth: 0, color: t.color.interactive, fontFamily: t.typography.textBody.fontFamily, fontWeight: '500', fontSize: 13 }}>
                            {b.action}{' '}
                            <Icon name="chevron_right" size={16} color={t.color.interactive} />
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </View>

                {/* A foreign entry without a dated quote remains visible in its
                    printed currency. Once the FX worker has a quote, the home
                    estimate is included in the totals above. */}
                {data.spent_today.other_currencies ? (
                  <Text
                    style={{
                      color: t.color.textSecondary,
                      fontFamily: t.typography.textSmall.fontFamily,
                      fontSize: 12,
                    }}
                  >
                    {`Also today, not counted above: ${data.spent_today.other_currencies.join(', ')}. The original amount is kept; a home estimate is pending.`}
                  </Text>
                ) : null}

                <WhereItWent
                  rows={categories.data?.categories ?? []}
                  currency={data.spent_today.currency}
                  t={t}
                />
              </>
            ) : series.isLoading ? (
              <ActivityIndicator color={t.color.textSecondary} />
            ) : !s ? null : s.log_counts.all === 0 ? (
              /* The drawn empty card (:886-892) — an empty window is a true
                 state, said plainly, never a zeroed chart. */
              <View
                style={[
                  styles.card,
                  styles.emptyCard,
                  { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure },
                ]}
              >
                <Image source={NEIGHBOURS.penny.head} style={styles.emptyHead} accessibilityIgnoresInvertColors />
                <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}>
                  Nothing here yet
                </Text>
                <Text
                  style={{
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontSize: 15,
                    lineHeight: 24,
                    textAlign: 'center',
                    maxWidth: 280,
                  }}
                >
                  Snap a receipt and I'll file it. Your categories start the moment you spend something.
                </Text>
              </View>
            ) : (
              <>
                {/* An average of nothing is not a number: daily_avg null means
                    the card is not drawn (the energy-box posture). */}
                {s.daily_avg !== null ? (
                  <DailySpendChart
                    daily={s.daily}
                    dailyAvg={s.daily_avg}
                    windowTotal={s.window_total}
                    currency={s.currency}
                    range={range}
                    t={t}
                  />
                ) : null}

                <WhereItWent rows={categories.data?.categories ?? []} currency={s.currency} t={t} />

                {/* Fork 4: month+budget only — the server omits `running`
                    otherwise, and no card is drawn. */}
                {s.running ? <RunningTotalChart running={s.running} currency={s.currency} t={t} /> : null}

                {s.merchants.length > 0 ? (
                  <WhereYouGoMost merchants={s.merchants} currency={s.currency} t={t} />
                ) : null}
              </>
            )}

            {/* The log sits below BOTH the today and the trend content — the
                drawing's search block is outside the trend sc-if (:998). */}
            {s ? (
              <>
                <LogSearch
                  query={query}
                  onQuery={setQuery}
                  onClear={() => setQuery('')}
                  chips={chips}
                  activeType={logType}
                  onType={setLogType}
                  summary={summary}
                  t={t}
                />

                {log.isLoading ? (
                  <ActivityIndicator color={t.color.textSecondary} />
                ) : logRows.length === 0 ? (
                  /* Both hints are drawn (:2766): unfiltered-empty says how
                     an entry arrives; filtered-empty says how to back out. */
                  <View
                    style={[
                      styles.card,
                      styles.emptyCard,
                      { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure },
                    ]}
                  >
                    <Text
                      style={{
                        color: t.color.textSecondary,
                        fontFamily: t.typography.textBody.fontFamily,
                        fontSize: 15,
                        lineHeight: 24,
                        textAlign: 'center',
                      }}
                    >
                      {searching || logType !== 'all'
                        ? 'Nothing matches. Try another word, or clear the filter.'
                        : "Nothing filed yet. Send Penny a receipt and it lands here."}
                    </Text>
                  </View>
                ) : (
                  dayGroups.map((g) => {
                    // The day total comes from the series' anchored days —
                    // never summed over the page. A day the server has no row
                    // for (no home-currency spend, or a device/anchor tz
                    // disagreement) shows no figure rather than a guess.
                    const dayTotal = s.daily.find((d) => d.day === g.day)?.total;
                    return (
                      <View key={g.day} style={{ gap: 8 }}>
                        <View style={styles.dayHead}>
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
                            {logDayLabel(g.day, new Date(), month.data?.window.to ?? '')}
                          </Text>
                          {dayTotal !== undefined ? (
                            <Text
                              style={{
                                color: t.color.textSecondary,
                                fontFamily: t.typography.textSmall.fontFamily,
                                fontSize: 13,
                                fontVariant: ['tabular-nums'],
                              }}
                            >
                              {money(s.currency, dayTotal)}
                            </Text>
                          ) : null}
                        </View>
                        <View
                          style={[
                            styles.card,
                            styles.logCard,
                            { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure },
                          ]}
                        >
                          {g.rows.map((e, i) => {
                            const p = e.payload as {
                              merchant?: string;
                              amount?: number;
                              currency?: string;
                              category?: string | null;
                              subcategory?: string | null;
                            };
                            const waiting = e.filing === 'waiting_on_a_name';
                            // PAR-B04: the chevron exists only when something
                            // is behind it — a typed entry (C20) and a receipt
                            // whose extraction found no items both stay flat.
                            const breakdown = entryBreakdown(e.payload);
                            const open = expanded.has(e.id);
                            return (
                              <View
                                key={e.id}
                                style={{
                                  borderTopWidth: i === 0 ? 0 : 1,
                                  borderTopColor: t.color.borderStructure,
                                }}
                              >
                              <Pressable
                                accessibilityRole={breakdown ? 'button' : undefined}
                                accessibilityLabel={breakdown ? `${p.merchant ?? 'Entry'} — ${open ? 'hide' : 'show'} items` : undefined}
                                disabled={!breakdown}
                                onPress={() =>
                                  setExpanded((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(e.id)) next.delete(e.id);
                                    else next.add(e.id);
                                    return next;
                                  })
                                }
                                style={styles.logRow}
                              >
                                {e.photo_id ? (
                                  e.content_type === 'application/pdf' ? (
                                    /* A document is inert (0029): the viewer
                                       stays image-only, so no tap target. */
                                    <View
                                      accessibilityLabel="PDF receipt"
                                      style={[styles.logThumb, styles.logDocWell, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}
                                    >
                                      <Icon name="description" size={18} color={t.color.textSecondary} />
                                    </View>
                                  ) : e.image_url ? (
                                    <Pressable
                                      accessibilityRole="imagebutton"
                                      accessibilityLabel={p.merchant ? `Photo: ${p.merchant}` : 'Photo'}
                                      onPress={() =>
                                        setViewer({ uri: e.image_url!, caption: p.merchant ?? '', time: e.purchase_time ?? '', photoId: e.photo_id })
                                      }
                                    >
                                      <Image
                                        source={{ uri: e.image_url }}
                                        style={[styles.logThumb, { borderColor: t.color.borderStructure }]}
                                      />
                                    </Pressable>
                                  ) : null
                                ) : null}
                                <Text
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.75}
                                  style={{
                                    color: t.color.textSecondary,
                                    fontFamily: t.typography.textSmall.fontFamily,
                                    fontSize: 12,
                                    fontVariant: ['tabular-nums'],
                                    width: 44,
                                  }}
                                >
                                  {e.purchase_time ?? null}
                                </Text>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      color: t.color.textPrimary,
                                      fontFamily: t.typography.textBody.fontFamily,
                                      fontSize: 14,
                                    }}
                                  >
                                    {p.merchant ?? 'an entry'}
                                  </Text>
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      color: t.color.textSecondary,
                                      fontFamily: t.typography.textSmall.fontFamily,
                                      fontSize: 11.5,
                                    }}
                                  >
                                    {/* The "waiting on a name" rows keep their
                                        C39 label. */}
                                    {waiting
                                      ? categoryLabel(null)
                                      : categorySubLabel(p.category ?? null, p.subcategory ?? null)}
                                  </Text>
                                </View>
                                <Text
                                  style={{
                                    color: t.color.textPrimary,
                                    fontFamily: t.typography.textBody.fontFamily,
                                    fontWeight: '500',
                                    fontSize: 14,
                                    fontVariant: ['tabular-nums'],
                                  }}
                                >
                                  {p.amount != null && p.currency ? money(p.currency, p.amount) : ''}
                                </Text>
                                {breakdown ? (
                                  <Icon
                                    name={open ? 'expand_less' : 'expand_more'}
                                    size={18}
                                    color={t.color.textSecondary}
                                  />
                                ) : null}
                              </Pressable>
                              <CurrencyEvidenceList rows={ledgerCurrencyEvidence(e, s.currency)} t={t} />
                              {breakdown && open ? (
                                <EntryItems
                                  breakdown={breakdown}
                                  currency={p.currency ?? s.currency}
                                  t={t}
                                />
                              ) : null}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* The custom-range editor sheet (Run B #5) — undrawn surface built
          from the quiet-hours precedent: a Modal, one TextInput, plain text
          buttons (C06). It sets which window you are READING; it authors
          nothing (C39). Nothing is optimistic beyond local state — a server
          400 (an anchor-tz future-date disagreement) surfaces as the series
          query's error state, which the `!s` null-render already covers. */}
      <Modal
        visible={editingDate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingDate(null)}
      >
        <Pressable style={styles.scrim} onPress={() => setEditingDate(null)} accessibilityLabel="Close">
          <Pressable
            style={[styles.sheet, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}
            onPress={() => {}}
          >
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 15,
              }}
            >
              {editingDate === 'to' ? 'To' : 'From'}
            </Text>
            <TextInput
              value={dateDraft}
              onChangeText={setDateDraft}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="12 Aug 2026"
              placeholderTextColor={t.color.textSecondary}
              style={[
                styles.input,
                {
                  color: t.color.textPrimary,
                  borderColor: t.color.borderStructure,
                  fontFamily: t.typography.textBody.fontFamily,
                },
              ]}
            />
            {dateError ? (
              <Text
                style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}
              >
                {dateError}
              </Text>
            ) : null}
            <View style={styles.sheetButtons}>
              <Pressable accessibilityRole="button" onPress={() => setEditingDate(null)}>
                <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={saveDate}>
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 15,
                  }}
                >
                  Save
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {viewer ? (
        <Modal visible animationType="fade" onRequestClose={() => setViewer(null)}>
          <PhotoViewer viewer={viewer} onClose={() => setViewer(null)} />
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 12 },
  rangeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  boxes: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  box: { flexGrow: 1, flexBasis: '46%', minWidth: 0, borderWidth: 1, padding: 14, gap: 4 },
  metricAction: { minHeight: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  card: { borderWidth: 1, padding: 14, gap: 10 },
  logCard: { padding: 12, gap: 0 },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 4 },
  emptyCard: { padding: 20, alignItems: 'center', gap: 10 },
  emptyHead: { width: 56, height: 56, borderRadius: 28 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingVertical: 9 },
  // The row thumbnail — the resident-card head idiom (structure border,
  // radius 2), 40px square.
  logThumb: { width: 40, height: 40, borderWidth: 1, borderRadius: 2 },
  logDocWell: { alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { borderWidth: 1, borderRadius: 8, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  sheetButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24 },
});

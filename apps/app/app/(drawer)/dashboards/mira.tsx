import { DashboardLoadError } from '../../../components/dashboard/DashboardLoadError';
import { JournalMemoryEvidence } from '../../../components/dashboard/JournalMemoryEvidence';
// Mira's dashboard — the journal (Run B #2), first pass.
//
// The shape of the screen IS the ruling: her reading and your words are two
// different claims, and they are never merged. The scene line is what she
// saw; the Rendam block below it is what you actually typed, verbatim (C53),
// and it is the only quoted thing on the surface — canon gives YOUR words the
// inset ground and hers the card.
//
// The emotion chip (icon + word, never a colour) SHIPS since C95/C96 — the
// closed feeling set is stored per entry.
//
// 6 Sep 2026 — the search box and the type chips, missing since 28 Aug and
// recorded in this comment ever since, are now here. The founder compared the
// shipped screen against the Run B drawings and this was the one dashboard that
// was barely started: a flat list where the drawing has a "How you've felt"
// summary, range chips, feeling chips with counts, a search, and "Show raw".
//
// Still NOT here: the themes row (nothing extracts themes — C95 stops at the
// emotion) and "Mira's week" (her weekly page lands in CHAT, not on this
// screen). Both are absent by design, not by omission.
//
// The filtering lives in lib/journalFilter.ts, not in this file: it is the part
// with edges, and the screen renders rather than decides.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DashboardHeader } from '../../../components/dashboard/DashboardHeader';
import { DomainCard } from '../../../components/dashboard/DomainCard';
import { RangeChips } from '../../../components/dashboard/RangeChips';
import {
  JOURNAL_RANGES,
  journalToday,
  journalDayLabel,
  type JournalWindow,
  applyJournalFilters,
  emotionCounts,
  journalSummary,
  withinRange,
  type JournalRange,
} from '../../../lib/journalFilter';
import { customFieldLabel, parseCustomDate, emotionChip, type JournalEntry } from '../../../lib/dashboard';
import { hhmmInTz } from '../../../lib/time';
import { useJournal, usePhoto, useSettings } from '../../../lib/thread';
import { useTheme, type Theme } from '../../../lib/theme';
import { Icon } from '../../../components/Icon';

function Entry({ entry, t, timezone }: { entry: JournalEntry; t: Theme; timezone: string | null }) {
  const photo = usePhoto(entry.photo_id);
  const mood = emotionChip(entry.emotion);
  const [showRaw, setShowRaw] = useState(false);
  return (
    <View style={[styles.entry, { borderTopColor: t.color.borderStructure }]}>
      <View style={styles.entryHead}>
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 12,
            fontVariant: ['tabular-nums'],
            flexShrink: 0,
          }}
        >
          {hhmmInTz(entry.at, timezone)}
        </Text>
        <View style={{ flex: 1 }} />
        {mood ? (
          <View style={styles.mood}>
            <Icon name={mood.icon} size={18} color={t.color.textSecondary} />
            <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>{mood.label}</Text>
          </View>
        ) : null}
      </View>
      {entry.photo_id ? <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>Photo observations</Text> : null}
      <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 16, lineHeight: 27 }}>
        {entry.scene ?? 'a photo'}
      </Text>
      {photo.data ? (
        <Image source={{ uri: photo.data.image_url }} style={styles.photo} accessibilityIgnoresInvertColors />
      ) : null}
      <JournalMemoryEvidence entry={entry} t={t} />
      {/* "Show raw", as drawn: the verbatim words are one tap away rather than
          always open. C95 keeps both versions and neither replaces the other —
          collapsing is about the READING of a long day, not about which one
          counts, so nothing is ever hidden that cannot be opened. */}
      {entry.raw ? <>
        {showRaw ? <View style={[styles.raw, { backgroundColor: t.color.surfaceInset, borderLeftColor: t.color.domainMind }]}>
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textLabel.fontFamily, fontSize: 11, fontWeight: '500', letterSpacing: 0.9, textTransform: 'uppercase' }}>Your words, exactly</Text>
          <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15, lineHeight: 25 }}>{entry.raw}</Text>
        </View> : null}
        <Pressable onPress={() => setShowRaw(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: showRaw }} style={styles.showRaw}>
          <Text style={{ color: t.color.interactive, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>{showRaw ? 'Hide' : 'Show raw'}</Text>
        </Pressable>
      </> : null}
    </View>
  );
}

export default function MiraDashboard() {
  const t = useTheme();
  const journal = useJournal();
  const settings = useSettings();
  const timezone = settings.data?.region?.timezone ?? null;
  const all = journal.data?.days ?? [];

  const [range, setRange] = useState<JournalRange>('week');
  const [emotion, setEmotion] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const today = journalToday(new Date(), timezone);
  const [custom, setCustom] = useState<JournalWindow | undefined>();
  const [editingDate, setEditingDate] = useState<'from' | 'to' | null>(null);
  const [dateDraft, setDateDraft] = useState('');
  const parsedDate = parseCustomDate(dateDraft, today);
  const canSaveDate = !!(custom && parsedDate && (editingDate === 'from' ? parsedDate <= custom.to : parsedDate >= custom.from));
  const changeRange = (key: string) => {
    setRange(key as JournalRange);
    setEmotion(null);
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
    setEmotion(null);
  };

  // Counts come from what the RANGE leaves, not from everything ever written:
  // a chip reading "calm 4" beside a week showing two of them is a chip that
  // lies about the screen it sits on.
  const inRange = useMemo(() => withinRange(all, range, today, custom), [all, range, today, custom]);
  const chips = useMemo(
    () =>
      emotionCounts(inRange).map(({ emotion: key, count }) => ({
        key,
        label: emotionChip(key)?.label ?? key,
        icon: emotionChip(key)?.icon,
        count,
      })),
    [inRange],
  );
  const days = useMemo(
    () => applyJournalFilters(all, { range, emotion, query, today, custom }),
    [all, range, emotion, query, today, custom],
  );

  // Run B scope label counts thoughts, even when several share a day.
  const scopedCount = days.reduce((count, day) => count + day.entries.length, 0);
  const scopeWindow = range === 'custom' && custom
    ? `${customFieldLabel(custom.from)} – ${customFieldLabel(custom.to)}`
    : ({ day: 'Today', week: 'This week', month: 'This month', year: 'This year', all: 'All', custom: 'Custom' }[range]);
  const scopeLabel = `${scopedCount} ${scopedCount === 1 ? 'thought' : 'thoughts'} · ${scopeWindow.toLowerCase()} · ${(emotionChip(emotion)?.label ?? emotion ?? '').toLowerCase()}`;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <DashboardHeader id="mira" t={t} />
      <ScrollView contentContainerStyle={styles.body}>
        {journal.isError ? <DashboardLoadError label="your journal" hasData={journal.data !== undefined} retrying={journal.isFetching} onRetry={() => void journal.refetch()} t={t} /> : null}
        {/* "How you've felt", as drawn: what is on screen, then the ways to
            narrow it. Hidden entirely when there is nothing yet — filters over
            an empty journal are furniture. */}
        {all.length > 0 ? (
          <DomainCard fill={t.color.fillMind} t={t} style={{ gap: 14 }}>
            <View style={styles.heroHead}>
              <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}>How you've felt</Text>
              <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>{journalSummary(days)}</Text>
            </View>
            <RangeChips options={JOURNAL_RANGES} value={range} onChange={changeRange} t={t} />
            {range === 'custom' && custom ? <View style={styles.customRow}>
              {(['from', 'to'] as const).map((field, index) => <View key={field} style={styles.customPart}>
                {index === 1 ? <Text style={{ color: t.color.textSecondary }}>to</Text> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={field === 'from' ? 'From date' : 'To date'} onPress={() => editDate(field)} style={[styles.dateField, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
                  <Icon name="calendar_today" size={18} color={t.color.textSecondary} />
                  <Text style={{ flexShrink: 1, color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 13 }}>{customFieldLabel(custom[field])}</Text>
                </Pressable>
              </View>)}
            </View> : null}
            {chips.length ? <View style={styles.chips}>
              {chips.map(chip => {
                const selected = emotion === chip.key;
                const color = t.color.textPrimary;
                return <Pressable key={chip.key} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${chip.label}, ${chip.count}`} onPress={() => setEmotion(selected ? null : chip.key)} style={[styles.chip, { backgroundColor: t.color.surfaceCard, borderColor: selected ? t.color.borderEmphasis : t.color.borderStructure, borderWidth: selected ? 2 : 1 }]}>
                  {chip.icon ? <Icon name={chip.icon} size={18} color={color} /> : null}
                  <Text style={{ color, fontFamily: t.typography.textBody.fontFamily, fontSize: 13 }}>{chip.label}</Text>
                  <Text style={{ color, opacity: 0.62, fontFamily: t.typography.textBody.fontFamily, fontSize: 13 }}>{chip.count}</Text>
                </Pressable>;
              })}
            </View> : null}
          </DomainCard>
        ) : null}
        {all.length > 0 ? <View style={[styles.search, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
          <Icon name="search" size={20} color={t.color.textSecondary} />
          <TextInput accessibilityLabel="Search your thoughts" value={query} onChangeText={setQuery} placeholder="Search your thoughts" placeholderTextColor={t.color.textSecondary} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, minWidth: 0, padding: 0, fontFamily: t.typography.textBody.fontFamily, fontSize: 15, color: t.color.textPrimary }} />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}><Icon name="close" size={20} color={t.color.textSecondary} /></Pressable> : null}
        </View> : null}
        {emotion && !query.trim() ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset, paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text style={{ flex: 1, fontFamily: t.typography.textBody.fontFamily, fontSize: 13.5, lineHeight: 20.25, color: t.color.textPrimary }}>{scopeLabel}</Text>
            <Pressable accessibilityRole="button" onPress={() => setEmotion(null)} hitSlop={8}>
              <Text style={{ fontFamily: t.typography.textBody.fontFamily, fontWeight: '500', fontSize: 13, color: t.color.interactive }}>Clear</Text>
            </Pressable>
          </View>
        ) : null}
        {journal.isLoading ? (
          <ActivityIndicator color={t.color.textSecondary} />
        ) : journal.isError && !journal.data ? null : days.length === 0 ? (
          <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
            <View style={styles.headRow}>
              <Icon name="image" size={16} color={t.color.textSecondary} />
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontWeight: '500',
                  fontSize: 15,
                }}
              >
                {all.length > 0 ? 'Nothing to show' : 'Nothing here yet'}
              </Text>
            </View>
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              {all.length > 0
                ? 'Nothing matches that. Widen the range, or clear the filters.'
                : 'Send her a photo or tell her about your day — she keeps what you send, in your own words.'}
            </Text>
          </View>
        ) : (
          days.map((d) => (
            <View
              key={d.day}
              style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}
            >
              {/* A dateline, not a timestamp — a page is dated, C69. */}
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textLabel.fontFamily,
                  fontSize: 13,
                }}
              >
                {journalDayLabel(d.day, today)}
              </Text>
              {d.entries.map((e) => (
                <Entry key={e.id} entry={e} t={t} timezone={timezone} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
      <Modal visible={editingDate !== null} transparent animationType="slide" onRequestClose={() => setEditingDate(null)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" accessibilityRole="button" onPress={() => setEditingDate(null)} />
          <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: t.color.surfacePage }]}>
            <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}>{editingDate === 'from' ? 'From date' : 'To date'}</Text>
            <TextInput accessibilityLabel={editingDate === 'from' ? 'From date' : 'To date'} value={dateDraft} onChangeText={setDateDraft} placeholder="1 Aug 2026" placeholderTextColor={t.color.textSecondary} autoCapitalize="none" autoCorrect={false} style={[styles.dateInput, { color: t.color.textPrimary, borderColor: t.color.borderStructure, fontFamily: t.typography.textBody.fontFamily }]} />
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setEditingDate(null)} style={styles.showRaw}><Icon name="close" size={22} color={t.color.textSecondary} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSaveDate }} disabled={!canSaveDate} onPress={saveDate} style={[styles.save, { backgroundColor: t.color.ink, opacity: canSaveDate ? 1 : 0.5 }]}><Text style={{ color: t.color.kapur, fontFamily: t.typography.textBody.fontFamily }}>Save</Text></Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 24, gap: 16 },
  card: { borderWidth: 1, padding: 14, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entry: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  entryHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  photo: { width: '100%', height: 180 },
  raw: { borderLeftWidth: 2, padding: 12, gap: 6 },
  mood: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  showRaw: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  heroHead: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 12, minHeight: 36 },
  customRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customPart: { flex: 1, minWidth: 125, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateField: { flex: 1, minHeight: 44, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  search: { minHeight: 48, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { padding: 20, gap: 16 },
  dateInput: { borderWidth: 1, padding: 12, fontSize: 16 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  save: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
});

// Notifications (Run B #12) — what each neighbour may knock about, and the
// hours they keep.
//
// The line at the top is the whole ruling, and it is a promise the code
// keeps: **"Answers to things you asked always come through, whatever is set
// here."** A knock is a neighbour reaching you FIRST, unprompted (C49). These
// switches govern knocks and nothing else — turning Penny off never silences
// the answer to a question you asked her.
//
// Each row names what that neighbour would knock about, in her own subject
// matter, so the choice is about a real thing rather than an abstract
// "notifications from Penny".
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { DEFAULT_QUIET_HOURS, knockOn, parseQuietTime, type UserSettings } from '../../../lib/dashboard';
import { NEIGHBOURS, type NeighbourId } from '../../../lib/neighbours';
import { useSettings, useStreet } from '../../../lib/thread';
import { useTheme } from '../../../lib/theme';
import { createPreferenceSaver, type PreferenceSaveState } from '../../../lib/preferenceSave';
import { PreferenceSaveNotice } from '../../../components/PreferenceSaveNotice';
import { DashboardLoadError } from '../../../components/dashboard/DashboardLoadError';
import { Icon } from '../../../components/Icon';

/** What each one would knock about — DRAFT copy, from the drawing. */
const SUBJECTS: Record<string, string> = {
  penny: 'A charge she cannot place, and the monthly wrap',
  mira: 'Her nightly reflection, once it is written',
  milo: 'A day left unlogged by evening',
  ollie: 'A photo with no owner, and anything waiting on you',
  tally: 'A bill still to settle',
};

export default function NotificationsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const settings = useSettings();
  const street = useStreet();
  const bag = settings.data?.settings ?? null;
  // Only the neighbours who actually live here: a switch for someone who has
  // not moved in is a setting about nothing.
  const residents = (street.data?.residents ?? []).map((r) => r.neighbour as NeighbourId);
  const quiet = bag?.quiet_hours ?? DEFAULT_QUIET_HOURS;
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [saveState, setSaveState] = useState<PreferenceSaveState>({ status: 'idle' });
  const saver = useMemo(() => createPreferenceSaver({
    state: setSaveState,
    preview: () => () => {},
    write: async patch => {
      await qc.cancelQueries({ queryKey: ['settings'] });
      return apiFetch('/v1/settings', { method: 'PATCH', body: JSON.stringify(patch) });
    },
    accepted: patch => {
      qc.setQueryData<UserSettings>(['settings'], old => old ? { ...old, settings: {
        ...old.settings, notifications: { ...old.settings?.notifications,
          subjects: { ...old.settings?.notifications?.subjects, ...patch.notifications?.subjects },
        },
      } } : old);
      void qc.invalidateQueries({ queryKey: ['settings'] }).catch(() => {});
    },
  }), [qc]);
  const controlsDisabled = saving || saveState.status === 'saving' || !settings.data || !street.data;
  const toggle = (neighbour: string, value: boolean) => saver.save({
    label: 'notifications', patch: { notifications: { subjects: { [neighbour]: value } } },
  });

  const openEditor = (field: 'start' | 'end') => {
    setDraft(quiet[field]);
    setError(null);
    setEditing(field);
  };

  const save = async () => {
    if (!editing || controlsDisabled) return;
    const parsed = parseQuietTime(draft);
    if (!parsed) return setError('Use HH:MM, 24-hour — like 22:30.');
    const next = { ...quiet, [editing]: parsed };
    if (next.start === next.end) return setError("Start and end can't be the same.");
    setSaving(true);
    try {
      await apiFetch('/v1/settings', { method: 'PATCH', body: JSON.stringify({ quiet_hours: next }) });
      await qc.invalidateQueries({ queryKey: ['settings'] });
      setEditing(null);
    } catch {
      setError("That didn't save — try again when you're back.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.body}>
        {settings.isError ? <DashboardLoadError label="your settings" hasData={!!settings.data} retrying={settings.isFetching} onRetry={() => { void settings.refetch(); }} t={t} /> : null}
        {street.isError ? <DashboardLoadError label="your neighbours" hasData={!!street.data} retrying={street.isFetching} onRetry={() => { void street.refetch(); }} t={t} /> : null}
        <PreferenceSaveNotice state={saveState} onRetry={() => { void saver.retry(); }} t={t} />
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          A knock is a neighbour reaching you first — unprompted. Answers to things you asked always come through,
          whatever is set here.
        </Text>

        {settings.isLoading || street.isLoading ? (
          <ActivityIndicator color={t.color.textSecondary} />
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Label t={t}>Your neighbours</Label>
              {residents.map((id) => {
                const n = NEIGHBOURS[id];
                if (!n) return null;
                return (
                  <View key={id} style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.nameRow}>
                        <Text
                          style={{
                            color: t.color.textPrimary,
                            fontFamily: t.typography.textBody.fontFamily,
                            fontWeight: '500',
                            fontSize: 15,
                          }}
                        >
                          {n.name}
                        </Text>
                        <Text
                          style={{
                            color: t.color.textSecondary,
                            fontFamily: t.typography.textSmall.fontFamily,
                            fontSize: 12.5,
                          }}
                        >
                          {`· ${n.roleWord}`}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: t.color.textSecondary,
                          fontFamily: t.typography.textSmall.fontFamily,
                          fontSize: 12.5,
                        }}
                      >
                        {SUBJECTS[id] ?? 'Anything waiting on you'}
                      </Text>
                    </View>
                    <Switch accessibilityLabel={`${n.name} notifications`} disabled={controlsDisabled} value={knockOn(bag, id)} onValueChange={(v) => void toggle(id, v)} />
                  </View>
                );
              })}
            </View>

            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Label t={t}>Quiet hours</Label>
              {(['start', 'end'] as const).map((field) => (
                <Pressable
                  key={field}
                  accessibilityRole="button"
                  disabled={controlsDisabled}
                  onPress={() => openEditor(field)}
                  style={[styles.row, { borderTopColor: t.color.borderStructure }]}
                >
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontWeight: '500',
                      fontSize: 15,
                      flex: 1,
                    }}
                  >
                    {field === 'start' ? 'From' : 'Until'}
                  </Text>
                  <Text
                    style={{
                      color: t.color.textSecondary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontSize: 15,
                    }}
                  >
                    {quiet[field]}
                  </Text>
                  <Icon name="chevron_right" size={20} color={t.color.textSecondary} />
                </Pressable>
              ))}
              <Text
                style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}
              >
                Anything held during quiet hours arrives in the morning, not repeated.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.scrim} onPress={() => setEditing(null)} accessibilityLabel="Close">
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
              {editing === 'end' ? 'Until' : 'From'}
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="22:00"
              placeholderTextColor={t.color.textSecondary}
              maxLength={5}
              style={[
                styles.input,
                {
                  color: t.color.textPrimary,
                  borderColor: t.color.borderStructure,
                  fontFamily: t.typography.textBody.fontFamily,
                },
              ]}
            />
            {error ? (
              <Text
                style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}
              >
                {error}
              </Text>
            ) : null}
            <View style={styles.sheetButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setEditing(null)}
                style={saving ? styles.dimmed : null}
              >
                <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void save()}
                style={saving ? styles.dimmed : null}
              >
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
    </SafeAreaView>
  );
}

function Label({ children, t }: { children: string; t: ReturnType<typeof useTheme> }) {
  return (
    <Text
      style={{
        color: t.color.textSecondary,
        fontFamily: t.typography.textLabel.fontFamily,
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.9,
        textTransform: 'uppercase',
        paddingTop: 12,
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingBottom: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingVertical: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { borderWidth: 1, borderRadius: 8, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  sheetButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24 },
  dimmed: { opacity: 0.4 },
});

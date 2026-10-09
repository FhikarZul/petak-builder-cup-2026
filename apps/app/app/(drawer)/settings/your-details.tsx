// Your details (Run B #7, amended 2 Sep 2026) — who you are, and where your
// day lives.
//
// Founder ruling (2 Sep): timezone and currency PARK HERE — "some settings
// should move to Your details". The drawing's "no currency setting" line
// predates the 1 Sep currency ruling and is retired.
//
// The rest of the ruling stands: Petak has no profile form, because everything
// a profile form would hold is either something a neighbour ASKS for in chat
// (C47/C90 — height and weight belong to Milo) or something read off a
// receipt. Name and email come from how you signed in.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { ChoiceSheet, type Choice } from '../../../components/ChoiceSheet';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { apiFetch } from '../../../lib/api';
import { createRegionSaver, type RegionSaveState } from '../../../lib/regionSave';
import type { UserSettings } from '../../../lib/dashboard';
import {
  addChip,
  addMember,
  cardSummary,
  EMPTY_PROFILE,
  readStoredProfile,
  preferredName,
  removeChip,
  removeMember,
  type Profile,
} from '../../../lib/profile';
import { useSettings } from '../../../lib/thread';
import { timezoneChoices } from '../../../lib/time';
import { useSession } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';

const CURRENCIES: Choice[] = [
  { value: 'SGD', label: 'SGD — Singapore dollar' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British pound' },
  { value: 'AUD', label: 'AUD — Australian dollar' },
  { value: 'CAD', label: 'CAD — Canadian dollar' },
  { value: 'NZD', label: 'NZD — New Zealand dollar' },
  { value: 'MYR', label: 'MYR — Malaysian ringgit' },
  { value: 'IDR', label: 'IDR — Indonesian rupiah' },
  { value: 'THB', label: 'THB — Thai baht' },
  { value: 'PHP', label: 'PHP — Philippine peso' },
  { value: 'VND', label: 'VND — Vietnamese dong' },
  { value: 'JPY', label: 'JPY — Japanese yen' },
  { value: 'CNY', label: 'CNY — Chinese yuan' },
  { value: 'HKD', label: 'HKD — Hong Kong dollar' },
  { value: 'INR', label: 'INR — Indian rupee' },
  { value: 'KRW', label: 'KRW — South Korean won' },
  { value: 'TWD', label: 'TWD — Taiwan dollar' },
];

const TIMEZONES: Choice[] = timezoneChoices().map((z) => ({ value: z, label: z }));

export default function YourDetailsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const session = useSession();
  const settings = useSettings();
  const [picker, setPicker] = useState<'currency' | 'timezone' | null>(null);
  // Your card drafts: null = untouched, so the field follows the server value.
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberNote, setMemberNote] = useState('');
  const [constraintDraft, setConstraintDraft] = useState('');
  const email = session?.user?.email ?? null;
  const name =
    (session?.user?.user_metadata?.full_name as string | undefined) ??
    (session?.user?.user_metadata?.name as string | undefined) ??
    null;
  const region = settings.data?.region ?? null;

  const [regionSaveState, setRegionSaveState] = useState<RegionSaveState>('idle');
  const regionSaver = useMemo(() => createRegionSaver({
    write: patch => apiFetch('/v1/settings', { method: 'PATCH', body: JSON.stringify({ region: patch }) }),
    state: setRegionSaveState,
    accepted: patch => {
      qc.setQueryData<UserSettings>(['settings'], current => current?.region ? {
        ...current, region: { ...current.region, ...patch },
      } : current);
      // Recompute money/date surfaces after the accepted home-setting change.
      void qc.invalidateQueries();
    },
  }), [qc]);
  const setRegion = (patch: { timezone?: string; currency?: string }) => regionSaver.save(patch);


  const storedProfile = settings.data?.settings?.profile;
  const serverProfile = useMemo(() => readStoredProfile(storedProfile), [storedProfile]);
  const [saveError, setSaveError] = useState(false);
  // Mutations build on this ref, not on render-time server data: the server
  // replaces the whole object, so two quick mutations before the refetch
  // lands must both persist. Synced from server data only when no mutation
  // is in flight.
  const profileRef = useRef<Profile>(EMPTY_PROFILE);
  const pendingRef = useRef(0);
  const lastSyncedRef = useRef<Profile | null | undefined>(undefined);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (pendingRef.current > 0) return;
    if (serverProfile === lastSyncedRef.current) return;
    lastSyncedRef.current = serverProfile;
    profileRef.current = serverProfile ?? EMPTY_PROFILE;
  }, [serverProfile]);

  const profile = serverProfile ?? EMPTY_PROFILE;
  // Server caps (apps/server/src/profile/profile.ts): ≤8 of each. At the cap
  // the add row is replaced by a caption — the 9th add must never 400.
  const householdFull = profile.household.length >= 8;
  const constraintsFull = profile.constraints.length >= 8;

  // Every card mutation is an immediate whole-object PATCH (the setRegion
  // pattern — no save button). The card changes no totals, so only the
  // settings query is invalidated. PATCHes are serialized so each carries
  // the cumulative card built on the previous one. Resolves false on
  // failure — callers keep the user's draft and only clear it on true.
  const mutateProfile = (build: (p: Profile) => Profile): Promise<boolean> => {
    const base = profileRef.current;
    const next = build(base);
    if (next === base) return Promise.resolve(true);
    profileRef.current = next;
    setSaveError(false);
    pendingRef.current += 1;
    const attempt = queueRef.current.then(async (): Promise<boolean> => {
      try {
        await apiFetch('/v1/settings', { method: 'PATCH', body: JSON.stringify({ profile: next }) });
        await qc.invalidateQueries({ queryKey: ['settings'] });
        return true;
      } catch {
        // Roll back only if nothing newer built on top — when a later
        // mutation did, its PATCH already carries this change.
        if (profileRef.current === next) profileRef.current = base;
        setSaveError(true);
        return false;
      } finally {
        pendingRef.current -= 1;
      }
    });
    queueRef.current = attempt.catch(() => undefined);
    return attempt;
  };

  const saveDisplayName = async () => {
    if (displayNameDraft === null) return;
    const nextName = displayNameDraft.trim() || null;
    if (nextName === profileRef.current.display_name) {
      setDisplayNameDraft(null);
      return;
    }
    const ok = await mutateProfile((p) => ({ ...p, display_name: nextName }));
    if (ok) setDisplayNameDraft(null);
  };

  const addHouseholdMember = async () => {
    const member = memberName;
    const note = memberNote || null;
    const ok = await mutateProfile((p) => {
      if (p.household.length >= 8) return p;
      const household = addMember(p.household, member, note);
      return household === p.household ? p : { ...p, household };
    });
    if (ok) {
      setMemberName('');
      setMemberNote('');
    }
  };

  const addConstraint = async () => {
    const value = constraintDraft;
    const ok = await mutateProfile((p) => {
      if (p.constraints.length >= 8) return p;
      const constraints = addChip(p.constraints, value);
      return constraints === p.constraints ? p : { ...p, constraints };
    });
    if (ok) setConstraintDraft('');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Your details" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
          {[
            { label: 'Name', value: name ?? 'Not set' },
            { label: 'Email', value: email ?? 'Not set' },
          ].map((f) => (
            <View key={f.label} style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
              <Text
                style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}
              >
                {f.label}
              </Text>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontSize: 15,
                }}
              >
                {f.value}
              </Text>
            </View>
          ))}
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
              lineHeight: 18,
              paddingVertical: 12,
            }}
          >
            These come from how you signed in.
          </Text>
        </View>

        {/* Your card (3 Sep 2026): the profile every conversation carries. */}
        <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
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
            Your card
          </Text>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
              paddingTop: 4,
            }}
          >
            {cardSummary(profile)}
          </Text>
          {saveError ? (
            <Text
              style={{
                color: t.color.error,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
                paddingTop: 4,
              }}
            >
              That didn't save — try again.
            </Text>
          ) : null}
          <View style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
            <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12, marginBottom: 6 }}>Preferred name</Text>
            <TextInput
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 15,
                padding: 0,
              }}
              accessibilityLabel="Preferred name"
              value={displayNameDraft ?? preferredName(profile.display_name, session?.user?.user_metadata) ?? ''}
              placeholder="What neighbours call you"
              placeholderTextColor={t.color.textSecondary}
              maxLength={40}
              onChangeText={setDisplayNameDraft}
              onBlur={() => void saveDisplayName()}
              onSubmitEditing={() => void saveDisplayName()}
              returnKeyType="done"
            />
          </View>
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12, paddingTop: 12 }}>People in your household</Text>
          {profile.household.map((m) => (
            <View
              key={m.name}
              style={[styles.row, styles.pickerRow, { borderTopColor: t.color.borderStructure }]}
            >
              <Text
                style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}
              >
                {m.name}
                {m.note ? ` — ${m.note}` : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${m.name}`}
                onPress={() =>
                  void mutateProfile((p) => ({ ...p, household: removeMember(p.household, m.name) }))
                }
              >
                <Icon name="close" size={18} color={t.color.textSecondary} />
              </Pressable>
            </View>
          ))}
          {householdFull ? (
            <View style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12,
                }}
              >
                Your card holds up to 8 people — remove one to add another.
              </Text>
            </View>
          ) : (
          <View style={[styles.row, styles.addRow, { borderTopColor: t.color.borderStructure }]}>
            <TextInput
              style={[
                styles.addInput,
                {
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  borderColor: t.color.borderStructure,
                },
              ]}
              value={memberName}
              placeholder="Person’s name"
              accessibilityLabel="Household member name"
              placeholderTextColor={t.color.textSecondary}
              maxLength={40}
              onChangeText={setMemberName}
              onSubmitEditing={() => void addHouseholdMember()}
            />
            <TextInput
              style={[
                styles.addInput,
                {
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  borderColor: t.color.borderStructure,
                },
              ]}
              value={memberNote}
              placeholder="Who they are (optional)"
              accessibilityLabel="Household relationship (optional)"
              placeholderTextColor={t.color.textSecondary}
              maxLength={60}
              onChangeText={setMemberNote}
              onSubmitEditing={() => void addHouseholdMember()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add household member"
              onPress={() => void addHouseholdMember()}
            >
              <Icon name="add" size={20} color={t.color.textSecondary} />
            </Pressable>
          </View>
          )}
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12, paddingTop: 12 }}>Allergies and injuries</Text>
          {profile.constraints.map((c) => (
            <View
              key={c}
              style={[styles.row, styles.pickerRow, { borderTopColor: t.color.borderStructure }]}
            >
              <Text
                style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}
              >
                {c}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${c}`}
                onPress={() =>
                  void mutateProfile((p) => ({ ...p, constraints: removeChip(p.constraints, c) }))
                }
              >
                <Icon name="close" size={18} color={t.color.textSecondary} />
              </Pressable>
            </View>
          ))}
          {constraintsFull ? (
            <View style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12,
                }}
              >
                Your card holds up to 8 constraints — remove one to add another.
              </Text>
            </View>
          ) : (
          <View style={[styles.row, styles.addRow, { borderTopColor: t.color.borderStructure }]}>
            <TextInput
              style={[
                styles.addInput,
                {
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  borderColor: t.color.borderStructure,
                },
              ]}
              value={constraintDraft}
              placeholder="Allergy, injury…"
              placeholderTextColor={t.color.textSecondary}
              maxLength={80}
              onChangeText={setConstraintDraft}
              onSubmitEditing={() => void addConstraint()}
              returnKeyType="done"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add constraint"
              onPress={() => void addConstraint()}
            >
              <Icon name="add" size={20} color={t.color.textSecondary} />
            </Pressable>
          </View>
          )}
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
              lineHeight: 18,
              paddingVertical: 12,
            }}
          >
            This card is in every conversation. Change it any time.
          </Text>
        </View>

        {/* Your day (founder ruling 2 Sep: parks under Your details). */}
        <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
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
            Your day
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={regionSaveState === 'saving'}
            accessibilityState={{ disabled: regionSaveState === 'saving', busy: regionSaveState === 'saving' }}
            onPress={() => setPicker('timezone')}
            style={[styles.row, styles.pickerRow, { borderTopColor: t.color.borderStructure }]}
          >
            <Text
              style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}
            >
              Timezone
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}
              >
                {region?.timezone ?? '—'}
              </Text>
              <Icon name="chevron_right" size={18} color={t.color.textSecondary} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={regionSaveState === 'saving'}
            accessibilityState={{ disabled: regionSaveState === 'saving', busy: regionSaveState === 'saving' }}
            onPress={() => setPicker('currency')}
            style={[styles.row, styles.pickerRow, { borderTopColor: t.color.borderStructure }]}
          >
            <Text
              style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}
            >
              Currency
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}
              >
                {region?.currency ?? '—'}
              </Text>
              <Icon name="chevron_right" size={18} color={t.color.textSecondary} />
            </View>
          </Pressable>
          {regionSaveState !== 'idle' ? (
            <View style={{ paddingTop: 8, gap: 6 }}>
              <Text accessibilityLiveRegion="polite" style={{
                color: regionSaveState === 'error' ? t.color.error : t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily, fontSize: 12,
              }}>
                {regionSaveState === 'saving' ? 'Saving…' : regionSaveState === 'saved' ? 'Saved' : "That didn't save — try again."}
              </Text>
              {regionSaveState === 'error' ? (
                <Pressable accessibilityRole="button" onPress={() => void regionSaver.retry()} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ color: t.color.interactive, fontFamily: t.typography.textSmall.fontFamily, textDecorationLine: 'underline' }}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
              lineHeight: 18,
              paddingVertical: 12,
            }}
          >
            Mira's reflection is written overnight here. Your photo allowance resets here. Penny's month ends
            here. Currency is what your amounts are tracked in, going forward.
          </Text>
        </View>

        <View style={[styles.card, styles.note, { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure }]}>
          <Icon name="forum" size={16} color={t.color.textSecondary} />
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 13,
              lineHeight: 19,
              flex: 1,
            }}
          >
            Your height and weight belong to Milo — he asks, and they change.
          </Text>
        </View>
      </ScrollView>
      <ChoiceSheet
        visible={picker === 'currency'}
        title="Currency"
        choices={CURRENCIES}
        searchPlaceholder="Search currencies"
        selected={region?.currency ?? null}
        onSelect={(currency) => void setRegion({ currency })}
        onClose={() => setPicker(null)}
      />
      <ChoiceSheet
        visible={picker === 'timezone'}
        title="Timezone"
        choices={TIMEZONES}
        searchPlaceholder="Search cities or zones"
        selected={region?.timezone ?? null}
        onSelect={(timezone) => void setRegion({ timezone })}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14 },
  row: { borderTopWidth: 1, paddingVertical: 12, gap: 2 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInput: { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14 },
});

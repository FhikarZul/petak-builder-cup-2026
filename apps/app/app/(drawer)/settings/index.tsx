// Settings (Run B #11) — plain rows, in lore and in the open.
//
// "Tell Ollie" (C57) sits with the other rows, **not at the top and not
// styled to be found**. It is his name, not a function: never "Send
// feedback", never "Report a bug", never a Help centre. No badge and no
// unread dot — a row that nags is a row that asks for something.
//
// "Ask before spending one" is the C13 toggle, and it lives here rather than
// in a dialog because the dialog it controls is the one that offers "don't
// ask again": the switch is where that promise is kept.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { buildIdentity, type BuildIdentitySource } from '../../../lib/appVersion';
import { apiFetch } from '../../../lib/api';
import { getAppearance, setAppearance } from '../../../lib/appearance';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { knocksOnCount, type UserSettings } from '../../../lib/dashboard';
import { useSession } from '../../../lib/supabase';
import { useSettings, useStreet } from '../../../lib/thread';
import { useTheme, type Theme } from '../../../lib/theme';
import { PreferenceSaveNotice } from '../../../components/PreferenceSaveNotice';
import { createPreferenceSaver, type PreferenceSaveState } from '../../../lib/preferenceSave';
import { DashboardLoadError } from '../../../components/dashboard/DashboardLoadError';

export default function SettingsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const settings = useSettings();
  const street = useStreet();
  const session = useSession();
  const bag = settings.data?.settings ?? null;
  const residents = (street.data?.residents ?? []).map((r) => r.neighbour);
  // C112 — the version AND the build number. `v0.1.0` alone cannot tell build
  // 19 from 20 from 21, which is the ambiguity that had a whole evening spent
  // guessing which build was installed.
  const version = buildIdentity(Constants.expoConfig as BuildIdentitySource | null);
  const email = session?.user?.email ?? null;
  const name =
    (session?.user?.user_metadata?.full_name as string | undefined) ??
    (session?.user?.user_metadata?.name as string | undefined) ??
    null;
  const initial = (name ?? email ?? '?').slice(0, 1).toUpperCase();

  const [saveState, setSaveState] = useState<PreferenceSaveState>({ status: 'idle' });
  const saver = useMemo(() => createPreferenceSaver({
    state: setSaveState,
    write: async patch => {
      await qc.cancelQueries({ queryKey: ['settings'] });
      return apiFetch('/v1/settings', { method: 'PATCH', body: JSON.stringify(patch) });
    },
    preview: change => {
      const previous = getAppearance();
      if (change.patch.appearance) setAppearance(change.patch.appearance);
      return () => { if (change.patch.appearance) setAppearance(previous); };
    },
    accepted: patch => {
      qc.setQueryData<UserSettings>(['settings'], old => old ? {
        ...old,
        ...(patch.credit_prompt === undefined ? {} : { credit_prompt: patch.credit_prompt }),
        settings: {
          ...old.settings,
          ...(patch.appearance ? { appearance: patch.appearance } : {}),
          ...(patch.c41 ? { c41: { ...old.settings?.c41, ...patch.c41 } } : {}),
        },
      } : old);
      void qc.invalidateQueries({ queryKey: ['settings'] }).catch(() => {});
    },
  }), [qc]);
  const saving = saveState.status === 'saving';
  const controlsDisabled = saving || !settings.data;

  // Run B → Appearance. Applies locally immediately (module store) and
  // persists into the settings bag for the next launch.
  const savedAppearance =
    settings.data?.settings?.appearance === 'light' ||
    settings.data?.settings?.appearance === 'dark' ||
    settings.data?.settings?.appearance === 'system'
      ? settings.data.settings.appearance
      : 'system';
  const appearance = saveState.status === 'saving' && saveState.change.patch.appearance
    ? saveState.change.patch.appearance : savedAppearance;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.body}>
        {settings.isError ? <DashboardLoadError label="your settings" hasData={!!settings.data} retrying={settings.isFetching} onRetry={() => { void settings.refetch(); }} t={t} /> : null}
        <PreferenceSaveNotice state={saveState} onRetry={() => { void saver.retry(); }} t={t} />
        {settings.isLoading ? (
          <ActivityIndicator color={t.color.textSecondary} />
        ) : (
          <>
            {/* The account card (founder directive, 2 Sep): YOUR DETAILS is its
                own card at the top, with the account picture. Timezone and
                currency park on the Your details screen it opens. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Your details"
              onPress={() => router.push('/(drawer)/settings/your-details')}
            >
              <View style={[styles.card, styles.accountCard, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
                <View
                  style={[styles.avatar, { borderColor: t.color.borderEmphasis, backgroundColor: t.color.surfaceInset }]}
                >
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontWeight: '500',
                      fontSize: 18,
                    }}
                  >
                    {initial}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontWeight: '500',
                      fontSize: 15,
                    }}
                  >
                    {name ?? 'You'}
                  </Text>
                  {email ? (
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{
                        color: t.color.textSecondary,
                        fontFamily: t.typography.textSmall.fontFamily,
                        fontSize: 12.5,
                      }}
                    >
                      {email}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron_right" size={20} color={t.color.textSecondary} />
              </View>
            </Pressable>

            {/* Appearance next (founder directive, 2 Sep — Light/Dark/System). */}
            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <View style={{ gap: 2, paddingVertical: 12 }}>
                <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}>
                  Appearance
                </Text>
                <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
                  Dark follows the same palette on Ink
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 14 }}>
                {(['light', 'dark', 'system'] as const).map((m) => {
                  const active = appearance === m;
                  return (
                    <Pressable
                      key={m}
                      accessibilityRole="button"
                      accessibilityLabel={`Appearance ${m}`}
                      disabled={controlsDisabled}
                      accessibilityState={{ disabled: controlsDisabled, selected: active }}
                      onPress={() => void saver.save({ label: 'appearance', patch: { appearance: m } })}
                      style={{
                        flex: 1,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 4,
                        borderWidth: active ? 0 : 1,
                        borderColor: t.color.borderStructure,
                        backgroundColor: active ? t.color.textPrimary : t.color.surfacePage,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? t.color.surfacePage : t.color.textPrimary,
                          fontFamily: t.typography.textBody.fontFamily,
                          fontWeight: '500',
                          fontSize: 14,
                          textTransform: 'capitalize',
                        }}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              <Row
                title="Notifications"
                sub="What each neighbour may knock about"
                right={residents.length > 0 ? knocksOnCount(bag, residents) : undefined}
                onPress={() => router.push('/(drawer)/settings/notifications')}
                t={t}
              />
              <Row
                title="Kept photo credits"
                sub="Ask before spending one"
                t={t}
                toggle={{
                  value: settings.data?.credit_prompt ?? true,
                  onChange: (v) => void saver.save({ label: 'photo credit preference', patch: { credit_prompt: v } }),
                  disabled: controlsDisabled,
                }}
              />
              {/* Penny's standing filing words (3 Sep 2026) — a Penny-flavoured
                  preference surface, beside the photo credits. */}
              <Row
                title="Your rules"
                sub="What Penny always files, and where it came from"
                onPress={() => router.push('/(drawer)/settings/your-rules')}
                t={t}
              />
              {/* The existing “Settings · Milo” preference joins this card under the approved Release 48 regrouping. */}
              <View style={{ paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.color.borderStructure }}>
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
                  Milo
                </Text>
              </View>
              <Row
                title="Link plates to receipts"
                sub="Within six hours, without asking. He still says so when he does."
                t={t}
                toggle={{
                  value: settings.data?.settings?.c41?.auto_link ?? false,
                  onChange: (v) => void saver.save({ label: 'meal linking preference', patch: { c41: { auto_link: v } } }),
                  disabled: controlsDisabled,
                }}
              />
            </View>

            {/* Founder-requested order: Tell Ollie, Delete everything, About. */}
            <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
              {/* C57: his name, not a function. Sits with the plain rows. */}
              <Row
                title="Tell Ollie"
                sub="Something off, or something missing"
                onPress={() => router.push('/(drawer)/settings/tell-ollie')}
                t={t}
              />
              <Row
                title="Delete everything"
                sub={undefined}
                onPress={() => router.push('/(drawer)/settings/delete')}
                t={t}
              />
              <Row title="About Petak" sub={undefined} right={`v${version}`} t={t} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  title,
  sub,
  right,
  onPress,
  toggle,
  t,
}: {
  title: string;
  sub?: string;
  right?: string;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean };
  t: Theme;
}) {
  const content = (
    <View style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}>
          {title}
        </Text>
        {sub ? (
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ? (
        <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
          {right}
        </Text>
      ) : null}
      {toggle ? (
        <Switch accessibilityLabel={title} disabled={toggle.disabled} value={toggle.value} onValueChange={toggle.onChange} />
      ) : onPress ? (
        <Icon name="chevron_right" size={20} color={t.color.textSecondary} />
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14 },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingVertical: 14 },
});

// Moving out (Run B #9) — the three facts, told before anything happens.
//
// C42 fixes what moving out means, and all three facts are TRUE TODAY:
//   · her records stay — every receipt, every category, readable again on
//     return; a departed neighbour files nothing and her dashboard goes
//     unlit, but nothing is deleted
//   · her share of the allowance goes with her (C05: +10/day per paid
//     neighbour, so it leaves when they do)
//   · she leaves at the end of the period you have paid for — **not today**
//
// The third one is drawn with a date, and Petak has no billing: nothing is
// paid for, so there is no period to end. Rather than invent "14 September",
// the screen states the rule and says the date arrives with billing. The
// "give her the free petak" swap is left out for the same reason — it is a
// price change, and there is no price. Delta 28l.
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { NEIGHBOURS, pronouns, type NeighbourId } from '../../../lib/neighbours';
import { parseServerDate } from '../../../lib/honesty';
import { useStreet } from '../../../lib/thread';
import { useTheme } from '../../../lib/theme';

export default function MovingOutScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ neighbour?: string }>();
  const street = useStreet();
  const [busy, setBusy] = useState(false);
  const id = (params.neighbour ?? '') as NeighbourId;
  const n = NEIGHBOURS[id];
  const res = (street.data?.residents ?? []).find((r) => r.neighbour === id);

  const moveOut = async () => {
    if (busy || !n) return;
    setBusy(true);
    try {
      await apiFetch(`/v1/neighbours/${id}/move-out`, { method: 'POST', body: JSON.stringify({}) });
      await qc.invalidateQueries({ queryKey: ['street'] });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  if (!n) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
        <ScreenHeader title="Moving out" />
        <View style={styles.body}>
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 }}>
            Nobody by that name lives here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // C42's three facts, spoken about THIS neighbour. They were hardcoded
  // she/her, so Milo's screen read "Her records stay" and "She leaves at the
  // end of the period you have paid for" (PAR-B09).
  const p = pronouns(id);
  const Subject = p.subject[0].toUpperCase() + p.subject.slice(1);
  const Possessive = p.possessive[0].toUpperCase() + p.possessive.slice(1);
  const facts = [
    {
      icon: 'folder',
      title: `${Possessive} records stay`,
      body: `Every receipt, every category. ${Possessive} dashboard goes unlit and ${p.subject} files nothing — invite ${p.object} back and ${p.subject} is current.`,
    },
    {
      icon: 'photo_camera',
      title: `${Possessive} share of the allowance goes with ${p.object}`,
      body: 'The photos a paid neighbour brings to your day leave when they do.',
    },
    {
      icon: 'event',
      title: `${Subject} leaves at the end of the period you have paid for`,
      body: 'Not today. Nothing on your street is charged yet, so there is no period to run out — the date arrives with billing.',
    },
  ];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Moving out" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image
            source={n.head}
            style={[styles.heroHead, { borderColor: t.color.borderStructure }]}
            accessibilityIgnoresInvertColors
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 26 }}>
              {`${n.name} moves out`}
            </Text>
            {res ? (
              <Text
                style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}
              >
                {`${n.roleWord} · moved in ${parseServerDate(res.moved_in_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
          {facts.map((f) => (
            <View key={f.title} style={[styles.fact, { borderTopColor: t.color.borderStructure }]}>
              <Icon name={f.icon} size={18} color={t.color.textSecondary} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 14,
                  }}
                >
                  {f.title}
                </Text>
                <Text
                  style={{
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 12.5,
                    lineHeight: 18,
                  }}
                >
                  {f.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void moveOut()}
          style={({ pressed }) => [
            styles.button,
            {
              borderColor: t.color.borderEmphasis,
              backgroundColor: pressed ? t.color.surfaceInset : 'transparent',
              opacity: busy ? 0.5 : 1,
            },
          ]}
        >
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 15,
            }}
          >
            {`${n.name} moves out`}
          </Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.keep}>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 15,
            }}
          >
            {`Keep ${n.name.split(' ')[0]}`}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 10 },
  heroHead: { width: 56, height: 56, borderWidth: 1, borderRadius: 2 },
  card: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingBottom: 12, marginTop: 6 },
  fact: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingVertical: 12, alignItems: 'flex-start' },
  button: { borderWidth: 1, borderRadius: 4, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  keep: { paddingVertical: 13, alignItems: 'center' },
});

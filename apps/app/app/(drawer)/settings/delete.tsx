// Delete everything (Run B #13) — three facts, then the way out.
//
// The screen makes a promise, and the server now keeps it: **no waiting
// period, and it cannot be undone by anyone, including us.** The erasure runs
// in one transaction — either every table goes or none did — and the photos
// are purged from storage after it commits.
//
// The typed word is the confirmation, not a second dialog. A destructive
// action behind two taps is one somebody taps twice by accident; typing
// DELETE cannot happen by accident, and the server checks it too.
//
// **"Keep my street" is the emphasised action.** The drawn screen puts the
// destructive one first because that is what you came for, but nothing here
// is styled to be tapped: no red fill, no urgency, no "are you sure?" — the
// three facts do that work.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiFetch } from '../../../lib/api';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../lib/theme';

const FACTS = [
  {
    icon: 'inventory_2',
    title: 'Every entry and every photo',
    body: 'Receipts, meals, journal entries, and the images they came from.',
  },
  {
    icon: 'schedule',
    title: 'Deleted when you say so',
    body: 'No waiting period. It cannot be undone by anyone, including us.',
  },
  {
    icon: 'home_work',
    title: 'Your neighbours move out',
    body: 'Nothing on your street is charged yet, so there is nothing to cancel. When there is, the store handles that part.',
  },
];

export default function DeleteScreen() {
  const t = useTheme();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const armed = typed === 'DELETE';

  const erase = async () => {
    if (!armed || busy) return;
    setBusy(true);
    setNote(null);
    try {
      await apiFetch('/v1/account/erase', { method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) });
      // The account is gone; the session is the only thing left holding a
      // door open, so it goes too.
      await supabase.auth.signOut();
      router.replace('/login');
    } catch {
      setNote('That did not go through, and nothing was deleted. Try again in a moment.');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Delete everything" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          This empties the whole street. It is not the same as a neighbour moving out — that keeps your records, and
          this does not.
        </Text>

        <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
          {FACTS.map((f) => (
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
          <View style={[styles.fact, { borderTopColor: t.color.borderStructure }]}>
            <Icon name="edit_note" size={18} color={t.color.textSecondary} />
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12.5,
                lineHeight: 18,
                flex: 1,
              }}
            >
              {/* Export is not built. Saying so is better than an Export
                  button that does nothing on the one screen where trust is
                  the entire subject. */}
              Want a copy first? Exporting is not built yet — ask a neighbour in chat for anything you want to keep.
            </Text>
          </View>
        </View>

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
          Type DELETE to confirm
        </Text>
        <TextInput
          value={typed}
          onChangeText={(v) => setTyped(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DELETE"
          placeholderTextColor={t.color.textSecondary}
          style={[
            styles.input,
            {
              color: t.color.textPrimary,
              borderColor: t.color.borderStructure,
              backgroundColor: t.color.surfaceInset,
              fontFamily: t.typography.textBody.fontFamily,
            },
          ]}
        />

        <Pressable
          accessibilityRole="button"
          disabled={!armed || busy}
          onPress={() => void erase()}
          style={({ pressed }) => [
            styles.button,
            {
              borderColor: armed ? t.color.borderEmphasis : t.color.borderStructure,
              backgroundColor: pressed ? t.color.surfaceInset : 'transparent',
              opacity: armed && !busy ? 1 : 0.45,
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
            Delete everything
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
            Keep my street
          </Text>
        </Pressable>

        {note ? (
          <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
            {note}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 10 },
  card: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingBottom: 12, marginTop: 4 },
  fact: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingVertical: 12, alignItems: 'flex-start' },
  input: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, height: 46, fontSize: 16, letterSpacing: 2 },
  button: { borderWidth: 1, borderRadius: 4, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  keep: { paddingVertical: 13, alignItems: 'center' },
});

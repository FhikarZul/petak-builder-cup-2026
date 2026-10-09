import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ProfileFormBlock } from '../lib/blocks';
import { hasAnything, specsFor, validateDraft, type ProfileDraft, type ProfileFieldKey } from '../lib/profileForm';
import { showFieldReason, showSkipHelp } from '../lib/profileFormHelp';
import type { Theme } from '../lib/theme';

// Milo's numbers, asked once (6 Sep 2026, founder approved).
//
// "i think we should ask this in one go, instead of a series of question,
// perhaps a form? make the experience seamless and avoid back and forth."
//
// Three things this deliberately keeps from the flow it shortcuts:
//   - every field is SKIPPABLE, by leaving it empty (C47)
//   - every field keeps its one-clause REASON, which is what makes an intrusive
//     question answerable rather than merely asked
//   - WEIGHT IS LAST, because C47 put it last on purpose. A form shows
//     everything at once, so the ordering survives as emphasis rather than as
//     sequence — but it survives.
//
// Typing an answer in chat still works and still walks the questions one at a
// time. This is a faster way through, not a replacement.
export function ProfileForm({
  block,
  parentBody = '',
  open,
  onSubmit,
  t,
}: {
  block: ProfileFormBlock;
  parentBody?: string;
  /** False once the task is closed — the form goes inert like every other
   *  in-reply action, rather than disappearing. */
  open: boolean;
  onSubmit: (taskId: string, profile: Record<string, string | number>) => Promise<void>;
  t: Theme;
}) {
  const [draft, setDraft] = useState<ProfileDraft>({});
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  // 8 Sep 2026 (internal-reference): filled input that cannot be read is said, never
  // dropped — a strict-regex drop is how the founder's "14 Dec 1984" vanished.
  const [errors, setErrors] = useState<Partial<Record<ProfileFieldKey, string>>>({});
  const specs = specsFor(block.fields);
  const canSend = open && !sent && !sending && hasAnything(draft);
  const setField = (key: ProfileFieldKey, value: string | undefined) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.color.borderStructure, padding: 12, gap: 14 }}>
      {specs.map((spec) => (
        <View key={spec.key} style={{ gap: 5 }}>
          <Text style={{ color: t.color.textPrimary, fontSize: 14, fontWeight: '500' }}>{spec.label}</Text>
          {showFieldReason(spec.reason, parentBody) ? (
            <Text style={{ color: t.color.textSecondary, fontSize: 12, lineHeight: 18 }}>{spec.reason}</Text>
          ) : null}
          {spec.kind === 'choice' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              {(spec.choices ?? []).map((choice) => {
                const picked = draft[spec.key] === choice;
                return (
                  <Pressable
                    key={choice}
                    disabled={!open || sent || sending}
                    accessibilityRole="button"
                    accessibilityState={{ selected: picked }}
                    onPress={() => setField(spec.key, picked ? undefined : choice)}
                    style={{
                      paddingVertical: 9,
                      paddingHorizontal: 16,
                      borderWidth: picked ? 0 : 2,
                      borderColor: t.color.interactive,
                      backgroundColor: picked ? t.color.interactive : 'transparent',
                      opacity: open && !sent ? 1 : 0.5,
                    }}
                  >
                    <Text style={{ color: picked ? t.color.textOnInteractive : t.color.interactive, fontWeight: '500' }}>
                      {choice}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                editable={open && !sent && !sending}
                value={draft[spec.key] ?? ''}
                onChangeText={(v) => setField(spec.key, v)}
                placeholder={spec.placeholder}
                placeholderTextColor={t.color.textSecondary}
                keyboardType={spec.kind === 'number' ? 'numeric' : 'default'}
                accessibilityLabel={spec.label}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: t.color.borderStructure,
                  backgroundColor: t.color.surfaceCard,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  color: t.color.textPrimary,
                  fontSize: 15,
                  opacity: open && !sent ? 1 : 0.5,
                }}
              />
              {spec.unit ? <Text style={{ color: t.color.textSecondary, fontSize: 14 }}>{spec.unit}</Text> : null}
            </View>
          )}
          {errors[spec.key] ? (
            <Text style={{ color: t.color.error, fontSize: 12, lineHeight: 18 }}>{errors[spec.key]}</Text>
          ) : null}
        </View>
      ))}

      {showSkipHelp(parentBody) ? (
        <Text style={{ color: t.color.textSecondary, fontSize: 12, lineHeight: 18 }}>
          Leave anything blank and he'll work without it.
        </Text>
      ) : null}

      <Pressable
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSend }}
        onPress={async () => {
          const v = validateDraft(draft);
          if (Object.values(v.errors).some(Boolean)) {
            setErrors(v.errors);
            return;
          }
          setSending(true);
          try {
            await onSubmit(block.taskId, v.payload);
            setSent(true);
          } catch {
            // Shared activity feedback reports the error; preserve the draft
            // and allow another attempt instead of falsely saying "Sent".
          } finally {
            setSending(false);
          }
        }}
        style={{
          minHeight: t.spacing.controlH,
          borderRadius: t.spacing.radiusControl,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: canSend ? t.color.interactive : t.color.borderStructure,
        }}
      >
        <Text style={{ color: canSend ? t.color.textOnInteractive : t.color.textSecondary, fontWeight: '600' }}>
          {sending ? 'Sending…' : sent ? 'Sent' : 'Give Milo these'}
        </Text>
      </Pressable>
    </View>
  );
}

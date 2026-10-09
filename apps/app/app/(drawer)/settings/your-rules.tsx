// Your rules (3 Sep 2026) — the standing filing words, listed with where each
// came from (C15/C68), and killable.
//
// A delete is a two-step inline confirm (tap × → "Delete this rule?
// [Delete] [Keep]") — the codebase's no-native-dialogs posture, same as the
// typed-word gate on Delete everything but sized to a row. The row only
// leaves after the server says so; a failed DELETE keeps the row and says
// why, in line.
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../../../lib/api';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { ruleLine, sourceWord, type Rule } from '../../../lib/rules';
import { useRules } from '../../../lib/thread';
import { useTheme, type Theme } from '../../../lib/theme';

export default function YourRulesScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const rules = useRules();
  // Two-step confirm: the row id being asked, and the row id in flight.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deleteRule = async (id: string) => {
    if (deleting) return;
    setDeleting(id);
    setError(null);
    try {
      await apiFetch(`/v1/rules/${id}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['rules'] });
      setConfirming(null);
    } catch (e) {
      // A 404 means the rule is already gone (another session deleted it):
      // reconcile so the phantom row does not linger.
      if (e instanceof ApiError && e.status === 404) {
        await qc.invalidateQueries({ queryKey: ['rules'] });
        setConfirming(null);
        return;
      }
      // Honest failure: the row stays, the ask collapses, the line says why.
      setError(id);
      setConfirming(null);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Your rules" />
      <ScrollView contentContainerStyle={styles.body}>
        {rules.isLoading ? (
          <ActivityIndicator color={t.color.textSecondary} />
        ) : rules.isError ? (
          // A load failure must never pose as an empty list (the feed's
          // isError idiom in (drawer)/index.tsx): say so, and offer retry.
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              That did not go through. Try again in a moment.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void rules.refetch()}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 18,
                borderWidth: 1,
                borderRadius: 4,
                borderColor: t.color.interactive,
              }}
            >
              <Text
                style={{
                  color: t.color.interactive,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontWeight: '500',
                  fontSize: 14,
                }}
              >
                Try again
              </Text>
            </Pressable>
          </View>
        ) : (rules.data?.rules ?? []).length === 0 ? (
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            No rules yet. Tell Penny once — 'FairPrice is Household' — and it sticks.
          </Text>
        ) : (
          <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
            {(rules.data?.rules ?? []).map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                t={t}
                confirming={confirming === rule.id}
                busy={deleting === rule.id}
                failed={error === rule.id}
                onAsk={() => setConfirming(rule.id)}
                onKeep={() => setConfirming(null)}
                onDelete={() => void deleteRule(rule.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RuleRow({
  rule,
  confirming,
  busy,
  failed,
  onAsk,
  onKeep,
  onDelete,
  t,
}: {
  rule: Rule;
  confirming: boolean;
  busy: boolean;
  failed: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onDelete: () => void;
  t: Theme;
}) {
  return (
    <View style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}>
          {ruleLine(rule)}
        </Text>
        <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
          {sourceWord(rule.source)}
        </Text>
        {confirming ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 }}>
            <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
              Delete this rule?
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete rule ${rule.pattern}`} onPress={onDelete}>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontWeight: '500',
                  fontSize: 13,
                }}
              >
                Delete
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Keep rule ${rule.pattern}`} onPress={onKeep}>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontWeight: '500',
                  fontSize: 13,
                }}
              >
                Keep
              </Text>
            </Pressable>
          </View>
        ) : null}
        {failed ? (
          <Text style={{ color: t.color.error, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12, paddingTop: 2 }}>
            That didn't delete — try again.
          </Text>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator color={t.color.textSecondary} />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove rule ${rule.pattern}`} onPress={onAsk}>
          <Icon name="close" size={18} color={t.color.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingVertical: 12 },
});

// Run B #4 (sub-slice C, plans/2026-08-28-penny-charts-series.md) — the log's
// search block drawn at :998-1017: the field with its clear affordance, the
// type chips (All / With a photo / one per live category), and the summary
// line. Every count on a chip arrived window-wide from /series or
// /categories — never counted over a page (the 28i rule).
//
// The drawing gives All/photos fixed glyphs; category chips carry none here
// because real categories are user-named and no glyph is shipped for them —
// a made-up icon would be a guess. The drawn expand-all toggle is fork 8's
// (rows stay collapsed), so it is not drawn.
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

export interface LogTypeChip {
  key: string;
  label: string;
  icon?: string;
  count: number;
}

export function LogSearch({
  query,
  onQuery,
  onClear,
  chips,
  activeType,
  onType,
  summary,
  placeholder = 'Search the ledger',
  t,
}: {
  query: string;
  onQuery: (text: string) => void;
  onClear: () => void;
  chips: readonly LogTypeChip[];
  /** The chip currently filtering, or null for "no filter" — Mira's emotion
   *  chips genuinely have that state, and it is only ever compared with ===. */
  activeType: string | null;
  onType: (key: string) => void;
  /** null = nothing honest to say (a searched page that paginated) — the
   *  line is not drawn rather than drawn partial. */
  summary: string | null;
  placeholder?: string;
  t: Theme;
}) {
  return (
    <View style={styles.block}>
      <View style={[styles.field, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
        <Icon name="search" size={20} color={t.color.textSecondary} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder={placeholder}
          placeholderTextColor={t.color.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1,
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontSize: 15,
            padding: 0,
          }}
        />
        {query.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={onClear} hitSlop={8}>
            <Icon name="close" size={20} color={t.color.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chips}>
        {chips.map((chip) => {
          const selected = chip.key === activeType;
          return (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${chip.label}, ${chip.count}`}
              onPress={() => onType(chip.key)}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: t.color.ink }
                  : { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure, borderWidth: 1 },
              ]}
            >
              {chip.icon ? (
                <Icon name={chip.icon} size={17} color={selected ? t.color.kapur : t.color.textPrimary} />
              ) : null}
              <Text
                style={{
                  color: selected ? t.color.kapur : t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontWeight: '500',
                  fontSize: 13,
                }}
              >
                {chip.label}
              </Text>
              <Text
                style={{
                  color: selected ? t.color.kapur : t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontSize: 13,
                  fontVariant: ['tabular-nums'],
                  opacity: 0.62,
                }}
              >
                {chip.count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {summary !== null ? (
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 13,
            fontVariant: ['tabular-nums'],
          }}
        >
          {summary}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
});

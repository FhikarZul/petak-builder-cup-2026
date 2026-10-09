// Run B #6 — the meal detail card Milo shows after filing a meal.
// Every macro is from the ledger; this component only draws.
//
// 9 Sep 2026 (internal-reference, founder): "Macros is too messy!! We should maybe
// make it clickable so it's not overwhelming!!!" A three-dish meal drew three
// fully-expanded cards — protein/carbs/fat rows and the rating note, twice
// over on a two-photo lunch. The card is now COLLAPSED by default: dish,
// portion, kcal, chips. A tap opens the breakdown; the question strip (when
// there is one) always shows — an ask is never hidden behind a tap.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MealDetailBlock } from '../../lib/blocks';
import { parseServerDate } from '../../lib/honesty';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';
import { DetailCardFooter } from './DetailCardFooter';

function dateTimeLabel(iso: string): string {
  const d = parseServerDate(iso);
  const day = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} · ${time}`;
}

function MacroRow({
  label,
  value,
  unit,
  t,
}: {
  label: string;
  value: number | null;
  unit: string;
  t: Theme;
}) {
  if (value === null) return null;
  return (
    <View style={styles.macroRow}>
      <Text
        style={{
          color: t.color.textSecondary,
          fontFamily: t.typography.textSmall.fontFamily,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: t.color.textPrimary,
          fontFamily: t.typography.textBody.fontFamily,
          fontSize: 14,
        }}
      >
        {`${value}${unit ? ` ${unit}` : ''}`}
      </Text>
    </View>
  );
}

export function MealDetail({ block, t }: { block: MealDetailBlock; t: Theme }) {
  const hasMacros =
    block.calories !== null ||
    block.protein_g !== null ||
    block.carbs_g !== null ||
    block.fat_g !== null;
  const expandable = hasMacros || block.rating_why !== null;
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.card, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceCard }]}>
      <Pressable
        disabled={!expandable}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.headerRow}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 15,
            }}
          >
            {block.dish}
          </Text>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
            }}
          >
            {dateTimeLabel(block.at)}
          </Text>
          {block.portion ? (
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
              }}
            >
              {block.portion}
            </Text>
          ) : null}
        </View>
        {block.calories !== null ? (
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 16,
            }}
          >
            {`${block.calories} kcal`}
          </Text>
        ) : null}
        {expandable ? (
          <Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} color={t.color.textSecondary} />
        ) : null}
      </Pressable>

      {expanded && hasMacros ? (
        <View style={[styles.breakdown, { borderTopColor: t.color.borderStructure }]}>
          <MacroRow label="Protein" value={block.protein_g} unit="g" t={t} />
          <MacroRow label="Carbs" value={block.carbs_g} unit="g" t={t} />
          <MacroRow label="Fat" value={block.fat_g} unit="g" t={t} />
        </View>
      ) : null}

      {expanded && block.rating_why ? (
        <View style={[styles.note, { borderTopColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
            }}
          >
            {block.rating_why}
          </Text>
        </View>
      ) : null}

      {block.question ? (
        <View style={[styles.question, { borderTopColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
            }}
          >
            {block.question}
          </Text>
        </View>
      ) : null}
      <DetailCardFooter chips={block.chips} honesty={block.honesty} t={t} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  breakdown: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  note: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  question: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
});

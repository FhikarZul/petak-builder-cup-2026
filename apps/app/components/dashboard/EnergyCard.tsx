// Run B #3 — the energy boxes: In − Out = Net.
//
// TWO honesty rules do the work here:
//
// 1. **Out is an ESTIMATE and says so.** C73: activity is assumed (a desk
//    job) until a measured burn replaces it, and C89/C90: sex may be averaged
//    if it was skipped. The line under the boxes names whichever assumption
//    is actually in play — never a generic disclaimer, and nothing when the
//    user told him both.
// 2. **No basis, no boxes.** Without age, height and weight there is no
//    resting burn, so the card does not render an energy box at all rather
//    than render one that is empty or zero.
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { energyTargetLine, type EnergyBasis } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

const kcal = (n: number) => n.toLocaleString('en-US');

export function EnergyCard({
  intake,
  meals,
  basis,
  targetCalories,
  foodSelected,
  onFilterIn,
  t,
}: {
  intake: number;
  meals: number;
  basis: EnergyBasis;
  targetCalories?: number | null;
  foodSelected: boolean;
  onFilterIn: () => void;
  t: Theme;
}) {
  const net = intake - basis.tdee;
  // A fact, not a verdict: C06 keeps guilt out of it, so the words state the
  // arithmetic and stop.
  const state = net < 0 ? { icon: 'arrow_downward', word: 'In deficit' } : { icon: 'arrow_upward', word: 'In surplus' };
  const boxes = [
    { label: 'In', value: kcal(intake), sub: `${meals} ${meals === 1 ? 'meal' : 'meals'}` },
    { label: 'Out', value: kcal(basis.tdee), sub: `${kcal(basis.bmr)} × ${basis.activity_factor}` },
    { label: 'Net', value: `${net < 0 ? '−' : '+'}${kcal(Math.abs(net))}`, sub: 'estimated' },
  ];

  return (
    <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
      <View style={styles.headRow}>
        <Icon name="local_fire_department" size={16} color={t.color.textPrimary} />
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textLabel.fontFamily,
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.9,
            textTransform: 'uppercase',
          }}
          // Same reason as MacroRows: uppercase + letter-spacing at a reader's
          // enlarged font scale is where headings start wrapping (founder,
          // 6 Sep: "the words energy, protein and etc are clipped").
          numberOfLines={1}
        >
          Energy
        </Text>
        <View style={{ flex: 1 }} />
        <Icon name={state.icon} size={15} color={t.color.textSecondary} />
        <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
          {state.word}
        </Text>
      </View>

      <View style={styles.boxes}>
        {boxes.map((b, i) => {
          const Container = i === 0 ? Pressable : View;
          return (
          <Fragment key={b.label}>
            {i > 0 ? (
              <Text style={{ width: 12, textAlign: 'center', alignSelf: 'center', color: t.color.textSecondary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}>
                {i === 1 ? '−' : '='}
              </Text>
            ) : null}
            <Container
              onPress={i === 0 ? onFilterIn : undefined}
              accessibilityRole={i === 0 ? 'button' : undefined}
              accessibilityLabel={i === 0 ? `In, ${b.value} kcal, ${b.sub}` : undefined}
              accessibilityState={i === 0 ? { selected: foodSelected } : undefined}
              style={[styles.box, { backgroundColor: t.color.surfaceInset, borderColor: i === 0 && foodSelected ? t.color.textPrimary : t.color.borderStructure, borderWidth: i === 0 && foodSelected ? 2 : 1, paddingHorizontal: i === 0 && foodSelected ? 9 : 10, paddingVertical: i === 0 && foodSelected ? 11 : 12 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}
              >
                {b.label}
              </Text>
              {i === 0 ? <Icon name="filter_list" size={15} color={foodSelected ? t.color.textPrimary : t.color.textSecondary} /> : null}
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontWeight: '500',
                  fontSize: 20,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {b.value}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 11.5 }}
              >
                {b.sub}
              </Text>
            </Container>
          </Fragment>
          );
        })}
      </View>

      {foodSelected ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        <Icon name="touch_app" size={16} color={t.color.textSecondary} />
        <Text style={{ flex: 1, color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13, lineHeight: 19 }}>Log is showing what went in — tap In again for everything.</Text>
      </View> : null}
      {energyTargetLine(targetCalories) ? (
        <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12, lineHeight: 17 }}>
          {energyTargetLine(targetCalories)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boxes: { flexDirection: 'row', alignItems: 'stretch' },
  box: { flex: 1, minWidth: 0, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 12, gap: 2 },
});

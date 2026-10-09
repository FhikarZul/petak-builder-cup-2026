// Run B #4 — Penny's budget position: the bar, the even-pace mark, and the
// line that says where you stand.
//
// C50 gates the whole card: a budget exists only because the user said one in
// chat, so with none there is no bar to draw — the empty state is an
// invitation, not a form. That is the drawn behaviour and it is also the
// ruling: Penny never asks for a budget, she says what she'd do with one.
//
// The mark's position and the fill both arrive computed from the server, the
// same numbers the chat pace card uses, so the two surfaces cannot disagree
// about where the mark sits.
import { Fragment } from 'react';
import { monthComparisonLabel, type MonthComparison } from '../../lib/monthComparison';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { money, paceNote, type PennyBudget, type PennySeries } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { DomainCard } from './DomainCard';
import { completeWindowTotal } from '../../lib/expenseTotal';
import { Icon } from '../Icon';

export function BudgetPosition({ budget, comparison, t }: { budget: PennyBudget; comparison?: MonthComparison; t: Theme }) {
  const spent = completeWindowTotal({ window_total: budget.spent, fx: budget.fx });
  return (
    // C63 — the drawn hero: the DOMAIN at 12% with the petak grid over it
    // (Run B line 441). It shipped as a plain white card, so Penny's screen
    // and Milo's screen looked like the same screen.
    <DomainCard fill={t.color.fillMoney} t={t}>
      <MonthSummary amount={spent} currency={budget.currency} daysLeft={budget.days_left} comparison={comparison} t={t} />
      {spent === undefined ? <View style={{ gap: 8 }}>
        <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15 }}>Budget {money(budget.currency, budget.amount)}</Text>
        <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>The original amount is kept; a home estimate is pending.</Text>
      </View> : <>
      <View style={styles.figures}>
        {[
          { label: 'Budget', value: budget.amount },
          { label: 'Spent', value: budget.spent },
          { label: 'Left', value: budget.left },
         ].map((f, index) => (
          <Fragment key={f.label}>
          {index > 0 ? <Text style={{ color: t.color.textSecondary, fontSize: 18, alignSelf: 'flex-end', paddingBottom: 2 }}>{index === 1 ? '−' : '='}</Text> : null}
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
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
              {f.label}
            </Text>
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
              {f.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          </Fragment>
        ))}
      </View>

      <View style={[styles.track, { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure }]}>
        <View style={[styles.fill, { width: `${budget.spent_pct}%`, backgroundColor: t.color.domainMoney }]} />
        {/* The even-pace mark: where you WOULD be, spending evenly. A rule,
            not a threshold — nothing turns red for crossing it (C03/C06). */}
        <View style={[styles.mark, { left: `${budget.expected_pct}%`, backgroundColor: t.color.textPrimary }]} />
      </View>

      <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12.5 }}>
        {paceNote(budget)}
      </Text>
      </>}
    </DomainCard>
  );
}

/** C50's offer stays below the monthly captured amount, as drawn. */
export function NoBudget({ month, loading, onRetry, t }: { month?: PennySeries; loading: boolean; onRetry: () => void; t: Theme }) {
  const day = month?.window.to;
  // The series window ends on the server's anchored today, not device today.
  const daysLeft = day
    ? Math.round((Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 1) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000)
    : undefined;
  return (
    <DomainCard fill={t.color.fillMoney} t={t}>
      <MonthSummary amount={month ? completeWindowTotal(month) : undefined} currency={month?.currency} daysLeft={daysLeft} comparison={month?.comparison} t={t} />
      {month && completeWindowTotal(month) === undefined ? <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>The original amount is kept; a home estimate is pending.</Text> : null}
      {!month ? (loading ? <ActivityIndicator color={t.color.textSecondary} /> : <Pressable accessibilityRole="button" onPress={onRetry}><Text style={{ color: t.color.interactive }}>Try again</Text></Pressable>) : null}
      <View style={{ padding: 12, gap: 8, borderWidth: 1, borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceCard }}>
      <Text
        style={{
          color: t.color.textSecondary,
          fontFamily: t.typography.textSmall.fontFamily,
          fontSize: 13,
          lineHeight: 19,
        }}
      >
        Tell me what you want to keep under and I'll count down from it — "keep me under 1,800 a month" is enough.
      </Text>
      <Pressable
        accessibilityRole="button"
        // push, not replace: replace destroyed the back stack, so there was
        // no way back to the dashboard you tapped this from. And it carries
        // the CONTEXT as a pinned chip (internal-reference) — the input stays empty,
        // and "1800" is enough because the chip says what the number is for.
        onPress={() =>
          router.push({
            pathname: '/',
            params: { ask: 'Setting a budget with Penny', askWith: 'penny' },
          })
        }
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? t.color.surfaceInset : 'transparent' },
        ]}
      >
        <Icon name="forum" size={18} color={t.color.interactive} />
        <Text
          style={{
            color: t.color.interactive,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '500',
            fontSize: 13,
          }}
        >
          Say it to Penny
        </Text>
      </Pressable>
      </View>
    </DomainCard>
  );
}

function MonthSummary({ amount, currency, daysLeft, comparison, t }: { amount?: number; currency?: string; daysLeft?: number; comparison?: MonthComparison; t: Theme }) {
  const comparisonText = monthComparisonLabel(comparison);
  return <>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}>This month</Text>
      {daysLeft !== undefined ? <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</Text> : null}
    </View>
    <View style={{ gap: 4 }}>
      <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13 }}>Captured this month</Text>
      {amount !== undefined && currency ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 32, fontVariant: ['tabular-nums'] }}>{money(currency, amount)}</Text> : null}
      {comparisonText ? <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13, lineHeight: 20 }}>{comparisonText}</Text> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({
  figures: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  track: { height: 10, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  mark: { position: 'absolute', top: -2, bottom: -2, width: 2 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
});

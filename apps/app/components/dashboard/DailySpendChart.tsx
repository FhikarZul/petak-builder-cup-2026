// Run B #4 (sub-slice B) — "Daily spend": deviation bars above/below a centre
// line, drawn at :897-925. Every figure comes from /series; the bar maths is
// deviationBars() in lib/dashboard.ts, tested there.
//
// C06: the bars state position and stop. No red for over, no praise for
// under — the money-domain colour carries both directions.
import { StyleSheet, Text, View } from 'react-native';
import {
  deviationBars,
  deviationLabel,
  money,
  type PennyRange,
  type SeriesDay,
} from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

/** The drawing's day tick (:2227-2230): a two-letter weekday inside a week,
 *  "24 Aug" in the longer windows. */
function dayTick(day: string, range: PennyRange): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (range === 'week') return dt.toLocaleDateString('en-US', { weekday: 'narrow' }).slice(0, 2);
  return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// The drawing's 120px box is two 56px bar halves around the centre hairline;
// heightPct is a fraction OF that 56, so the 3px floor lands exactly.
const HALF = 56;

export function DailySpendChart({
  daily,
  dailyAvg,
  windowTotal,
  currency,
  range,
  t,
}: {
  daily: SeriesDay[];
  dailyAvg: number;
  windowTotal: number;
  currency: string;
  range: PennyRange;
  t: Theme;
}) {
  const bars = deviationBars(daily, dailyAvg);
  return (
    <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
      <View style={{ gap: 4 }}>
        <View style={styles.headRow}>
          <Icon name="payments" size={16} color={t.color.textSecondary} />
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
            Daily spend
          </Text>
        </View>
        <View style={styles.avgRow}>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 20,
              fontVariant: ['tabular-nums'],
            }}
          >
            {money(currency, dailyAvg)}
          </Text>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 13,
              fontVariant: ['tabular-nums'],
            }}
          >
            {`a day · ${money(currency, windowTotal)} in this window`}
          </Text>
        </View>
      </View>

      <View>
        <View style={styles.chart}>
          {/* The centre line IS the average — C11: the chart carries the
              goal line, the bars never carry a judgement. */}
          <View style={[styles.centre, { backgroundColor: t.color.ink }]} />
          {bars.map((b) => (
            <View key={b.day} style={styles.column}>
              <View style={styles.halfEnd}>
                {b.dev > 0 ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: b.heightPct * HALF,
                        backgroundColor: t.color.domainMoney,
                        borderColor: t.color.borderStructure,
                      },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.halfStart}>
                {b.dev < 0 ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: b.heightPct * HALF,
                        backgroundColor: t.color.domainMoney,
                        borderColor: t.color.borderStructure,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </View>
        <View style={styles.labels}>
          {bars.map((b) => (
            <View key={b.day} style={styles.labelCell}>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12,
                  fontVariant: ['tabular-nums'],
                  textAlign: 'center',
                }}
              >
                {deviationLabel(b.dev)}
              </Text>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                {dayTick(b.day, range)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13, lineHeight: 19 }}>
        Above the line ran over your daily average for this window, below ran under.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avgRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  chart: { flexDirection: 'row', gap: 6, height: HALF * 2, justifyContent: 'center' },
  centre: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1 },
  column: { flex: 1, flexDirection: 'column' },
  halfEnd: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  halfStart: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  bar: { width: '60%', borderWidth: 1 },
  labels: { flexDirection: 'row', gap: 6, marginTop: 6 },
  labelCell: { flex: 1 },
});

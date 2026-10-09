// C92 (Run B #3) — the weight and body-fat boxes.
//
// These were drawn on 22 Aug and could not be built until now: Petak stored
// one weight, overwritten in place, so "0.3 since yesterday" was not
// approximate — it was uncomputable. The series exists now, and the rules the
// boxes are built on are all about NOT overstating what two numbers mean:
//
// · one reading shows the number and no trend (one reading is not a trend);
// · two readings in different units show no trend either, because they were
//   never in the same terms;
// · a box with no reading at all is not drawn — an empty box invites the
//   reading of "zero", and zero is a number Milo never had.
//
// C93 settled body fat's target: it is STATED by the user or ADVISED by Milo
// and then taken — never computed. So the box shows "of 12%" when there is
// one and shows nothing extra when there is not. An absent target here is the
// ruling working, not a gap.
import { StyleSheet, Text, View } from 'react-native';
import { readingText, trendText, type BodySeries } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

function Box({
  icon,
  label,
  series,
  target,
  now,
  t,
}: {
  icon: string;
  label: string;
  target?: number | null;
  series: { latest: { value: number; unit: 'kg' | 'lb' | 'percent'; at: string }; previous: { value: number; unit: 'kg' | 'lb' | 'percent'; at: string } | null };
  now: Date;
  t: Theme;
}) {
  const trend = trendText(series, now);
  const scale = Math.max(30, series.latest.value, target ?? 0);
  return (
    <View style={[styles.box, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
      <View style={styles.labelRow}>
        <Icon name={icon} size={14} color={t.color.textSecondary} />
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
          {label}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '500',
            fontSize: 20,
            fontVariant: ['tabular-nums'],
          }}
        >
          {readingText(series.latest)}
        </Text>
        {target != null ? (
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12.5,
              fontVariant: ['tabular-nums'],
            }}
          >
            {`of ${target}%`}
          </Text>
        ) : null}
      </View>
      {series.latest.unit === 'percent' && target != null ? (
        <View accessibilityLabel={`Body fat ${series.latest.value}%, target ${target}%`} style={[styles.bar, {backgroundColor:t.color.surfacePage,borderColor:t.color.borderStructure}]}>
          <View style={{height:'100%',width:`${series.latest.value / scale * 100}%`,backgroundColor:t.color.domainBody}} />
          <View style={{position:'absolute',left:`${target / scale * 100}%`,top:-3,bottom:-3,width:1,backgroundColor:t.color.textPrimary}} />
        </View>
      ) : null}
      {trend ? (
        <View style={styles.labelRow}>
          <Icon name={trend.icon} size={14} color={t.color.textSecondary} />
          <Text style={{ flexShrink:1, color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12, lineHeight:17 }}>
            {trend.text}
          </Text>
        </View>
      ) : (
        <Text style={{ flexShrink:1, color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12, lineHeight:17 }}>
          {/* Said plainly, because it is the honest state and it goes away by
              itself the next time the user stands on a scale. */}
          first reading
        </Text>
      )}
    </View>
  );
}

export function BodyBoxes({
  body,
  bodyFatTarget,
  now,
  t,
}: {
  body: BodySeries;
  bodyFatTarget?: number | null;
  now: Date;
  t: Theme;
}) {
  if (!body.weight && !body.body_fat) return null;
  return (
    <View style={styles.row}>
      {body.weight ? <Box icon="monitor_weight" label="Weight" series={body.weight} now={now} t={t} /> : null}
      {body.body_fat ? (
        <Box icon="accessibility_new" label="Body fat" series={body.body_fat} target={bodyFatTarget} now={now} t={t} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  box: { flex: 1, minWidth:0, borderWidth: 1, padding: 12, gap: 6 },
  bar: {height:8,borderWidth:1},
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});

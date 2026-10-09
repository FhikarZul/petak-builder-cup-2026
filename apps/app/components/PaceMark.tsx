// Run A #56 — the pace mark. The drawing's own caption is the spec:
// "information, never alarm; icon and text carry it, no colour and no bar
// that turns red." So the fill is Penny's domain accent at low strength and
// it NEVER changes hue — being over the mark is said in words, not in red.
// Every number here is computed server-side (W5): this component only draws.
import { StyleSheet, Text, View } from 'react-native';
import type { PaceMarkBlock } from '../lib/blocks';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';

function money(currency: string, n: number): string {
  const prefix = currency === 'SGD' ? 'S$' : `${currency} `;
  return `${prefix}${n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function PaceMark({ block, t }: { block: PaceMarkBlock; t: Theme }) {
  return (
    <View>
      <View style={styles.barWrap}>
        <View
          style={[
            styles.bar,
            { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure },
          ]}
        >
          {/* the fill — accent at low strength, one hue, always */}
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, block.spent_pct)}%`, backgroundColor: t.color.fillMoney },
            ]}
          />
          {/* the even-pace mark: 2px Ink, standing slightly proud of the bar */}
          <View
            style={[
              styles.mark,
              { left: `${Math.min(100, block.expected_pct)}%`, backgroundColor: t.color.borderEmphasis },
            ]}
          />
        </View>
        <View style={styles.caption}>
          <Icon name="straighten" size={14} color={t.color.textSecondary} />
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 12,
              flexShrink: 1,
            }}
          >
            The mark is where you would be spending evenly
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.chips,
          { borderTopColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
        ]}
      >
        {/* the prose spells small counts ("Nine days left"); the CHIPS keep
            the numeral ("9 days") — the drawing's own split, not a preference */}
        <Chip t={t} icon="trending_flat" label={`${money(block.currency, block.per_day_left)} a day left`} />
        <Chip t={t} icon="schedule" label={`${block.days_left} ${block.days_left === 1 ? 'day' : 'days'}`} />
      </View>
    </View>
  );
}

function Chip({ t, icon, label }: { t: Theme; icon: string; label: string }) {
  return (
    <View style={[styles.chip, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}>
      <Icon name={icon} size={14} color={t.color.textPrimary} />
      <Text
        style={{
          color: t.color.textPrimary,
          fontFamily: t.typography.textBody.fontFamily,
          fontWeight: '500',
          fontSize: 11.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
  bar: { position: 'relative', height: 10, borderWidth: 1 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  mark: { position: 'absolute', top: -4, bottom: -4, width: 2 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

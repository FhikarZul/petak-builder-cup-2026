// Run B #4 (sub-slice B) — "Running total": cumulative spend against the
// dashed even-pace line, drawn at :949-978. Fork 4: the card exists ONLY for
// range=month with an effective budget — the server omits `running`
// otherwise, and the screen draws nothing.
//
// No SVG at P0 (the slice's no-new-deps boundary): the polyline is one
// rotated View per segment, from polylineSegments() in lib/dashboard.ts,
// tested there. The dots sit at each segment's ends, derived from the same
// tested segments rather than re-mapped here.
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { money, polylineSegments, type RunningSeries } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

// The drawing's box (:958): 110px tall, the value scale spans the middle 100.
const HEIGHT = 110;

export function RunningTotalChart({ running, currency, t }: { running: RunningSeries; currency: string; t: Theme }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const spent = running.points[running.points.length - 1]?.total ?? 0;
  const segments = width > 0 ? polylineSegments(running.points, width, HEIGHT, running.budget) : [];
  // A segment's endpoints ARE the marks: dot 0 starts segment 0, dot i+1 ends
  // segment i — so the squares and the line can never disagree about where a
  // day sits.
  const dots = segments.flatMap((s, i) => {
    const rad = (s.angleDeg * Math.PI) / 180;
    const dx = (Math.cos(rad) * s.length) / 2;
    const dy = (Math.sin(rad) * s.length) / 2;
    return i === 0
      ? [
          { x: s.x - dx, y: s.y - dy },
          { x: s.x + dx, y: s.y + dy },
        ]
      : [{ x: s.x + dx, y: s.y + dy }];
  });
  const paceY = HEIGHT - (running.budget > 0 ? (running.pace / running.budget) * (HEIGHT - 10) : 0);

  return (
    <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
      <View style={{ gap: 4 }}>
        <View style={styles.headRow}>
          <Icon name="trending_up" size={16} color={t.color.textSecondary} />
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
            Running total
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 20,
              fontVariant: ['tabular-nums'],
            }}
          >
            {money(currency, spent)}
          </Text>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 13,
              fontVariant: ['tabular-nums'],
            }}
          >
            {`of ${money(currency, running.budget)} budget`}
          </Text>
        </View>
      </View>

      <View>
        <View style={styles.chart} onLayout={onLayout}>
          {width > 0 ? (
            <>
              {/* The even-pace line: a rule, not a threshold — dashed, and
                  nothing turns red for crossing it (C06/C11). */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: paceY,
                  borderTopWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: t.color.borderEmphasis,
                }}
              />
              {segments.map((s, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: s.x - s.length / 2,
                    top: s.y - 1,
                    width: s.length,
                    height: 2,
                    backgroundColor: t.color.domainMoney,
                    transform: [{ rotate: `${s.angleDeg}deg` }],
                  }}
                />
              ))}
              {dots.map((d, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: d.x - 3,
                    top: d.y - 3,
                    width: 6,
                    height: 6,
                    backgroundColor: t.color.ink,
                  }}
                />
              ))}
            </>
          ) : null}
        </View>
        <View style={styles.labels}>
          {running.points.map((p) => (
            <View key={p.day} style={{ flex: 1 }}>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12,
                  fontVariant: ['tabular-nums'],
                  textAlign: 'center',
                }}
              >
                {Math.round(p.total).toLocaleString('en-US')}
              </Text>
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                {String(Number(p.day.slice(8, 10)))}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.captionRow}>
        <View style={{ width: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: t.color.borderEmphasis }} />
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 13,
            flex: 1,
          }}
        >
          {`The dashed line is even pace. You are ${money(currency, Math.abs(running.pace - spent))} ${
            spent < running.pace ? 'under' : 'over'
          } it.`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  chart: { height: HEIGHT },
  labels: { flexDirection: 'row', gap: 6, marginTop: 6 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

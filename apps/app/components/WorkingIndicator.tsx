// App slice 2 (plan §8, mirror #78) — the working indicator, SUPERSEDING
// slice 1's: always the LAST item in the thread, indented to the bubble
// column (40px); a lit pane in the working neighbour's domain colour at
// FULL strength, her name, and the thing she is doing. The pane blinks and
// three dots follow on a 1.05s STEP cycle — a plain interval, no easing,
// no fade, no sliding, no new dependency. The sprite never animates and
// never appears in the line; a queued photo shows no indicator at all
// (waiting is not working).
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { INDICATOR_START_PHASE, INDICATOR_TICK_MS, indicatorFrame } from '../lib/indicator';
import { activityLine, type ActivityKind, type Neighbour } from '../lib/neighbours';
import type { Theme } from '../lib/theme';

export function WorkingIndicator({
  neighbour,
  kind,
  ordinal,
  t,
}: {
  neighbour: Neighbour;
  kind: ActivityKind;
  /** #78: which send of a batch is in hand ("the fifth one"). Photo lines
   *  only; omitted where there is no batch to count within. */
  ordinal?: number;
  t: Theme;
}) {
  // z8v0kmqxf6 — mount LIT. Phase 0 is the pane's dimmest step, so starting
  // there spent the first 525ms of a ~1s turn showing almost nothing.
  const [phase, setPhase] = useState(INDICATOR_START_PHASE);
  useEffect(() => {
    const iv = setInterval(() => setPhase((p) => p + 1), INDICATOR_TICK_MS);
    return () => clearInterval(iv);
  }, []);
  const frame = indicatorFrame(phase);

  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel={activityLine(neighbour.id, kind, ordinal)} accessibilityLiveRegion="polite">
      <View
        style={[
          styles.pane,
          {
            backgroundColor: t.color[neighbour.domain],
            borderColor: t.color.borderStructure,
            opacity: frame.paneLit ? 1 : 0.35,
          },
        ]}
      />
      <Text
        style={{
          color: t.color.textSecondary,
          fontFamily: t.typography.textSmall.fontFamily,
          fontSize: 13,
        }}
      >
        {activityLine(neighbour.id, kind, ordinal)}
      </Text>
      <View style={styles.dots}>
        {frame.dots.map((lit, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: t.color.textSecondary, opacity: lit ? 1 : 0.25 }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 40, height: 32 },
  pane: { width: 14, height: 14, borderWidth: 1 },
  dots: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingBottom: 4 },
  dot: { width: 3, height: 3 },
});

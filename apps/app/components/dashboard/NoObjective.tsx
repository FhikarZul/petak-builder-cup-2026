// Run C #74 — the no-objective state.
//
// The rule it encodes: **the dashboard still counts.** Targets are simply
// absent; nothing here nags, and the ask appears once at the top of the
// dashboard and once in Milo's first chat — never as a banner on other
// screens (C71/C47: asked for once and never again).
//
// The card is MILO SPEAKING, which is why it carries his full sprite, his 12%
// domain fill and the petak grid, and says "I am counting" rather than "He is".
// It shipped as a plain surface-card with a forum icon standing in for all of
// that, and third-person copy (parity ledger PAR-C74).
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';
import { GridWallpaper } from '../GridWallpaper';
import miloFull from '../../../../packages/assets/sprites/milo.png';

export function NoObjective({ t }: { t: Theme }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: t.color.fillBody, borderColor: t.color.borderStructure }]}>
        <GridWallpaper />
        {/* Full-body sprite, standing on the card's floor — the drawing sets
            it 74px wide and lets it overhang the padding by 2px. */}
        <Image source={miloFull} style={styles.sprite} resizeMode="contain" accessibilityIgnoresInvertColors />
        <View style={styles.copy}>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.fontDisplay,
              fontSize: 24,
              lineHeight: 29,
            }}
          >
            No objective set
          </Text>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 13,
              lineHeight: 21,
            }}
          >
            I am counting everything you send. There is just nothing to measure it against yet.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/')}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? t.color.borderEmphasis : t.color.interactive },
        ]}
      >
        <Text
          style={{
            color: t.color.textOnInteractive,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '500',
            fontSize: 15,
          }}
        >
          Tell Milo what you're after
        </Text>
      </Pressable>

      {/* The line that says the boxes below are not broken, only unmeasured. */}
      <View style={styles.infoRow}>
        <Icon name="info" size={15} color={t.color.textSecondary} />
        <Text
          style={{
            flex: 1,
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 12.5,
            lineHeight: 19,
          }}
        >
          Numbers without a line to cross. Set an objective and the same boxes get one.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  // overflow hidden clips the grid to the card; align-items flex-end stands
  // the sprite on the floor beside the copy.
  card: {
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    overflow: 'hidden',
  },
  sprite: { width: 74, height: 99, marginBottom: -2 },
  copy: { flex: 1, gap: 6, paddingBottom: 2 },
  button: { height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
});

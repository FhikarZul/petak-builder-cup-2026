// App slice 2 (plan §7, Run A #39/#41/#54) — the coins chip: coin.png +
// "+N coins" when the economy has set an amount, the label alone until then
// (amounts are DRAFT — founder-pending, never shown as settled copy). No
// confetti, no badge, no streak; the chip rides the reply's bubble.
import { Image, StyleSheet, Text, View } from 'react-native';
import type { CoinsBlock } from '../lib/blocks';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';
import coin from '../../../packages/assets/sprites/coin.png';

export function CoinsChips({ blocks, t }: { blocks: CoinsBlock[]; t: Theme }) {
  if (blocks.length === 0) return null;
  return (
    <View style={styles.row}>
      {blocks.map((b, i) => (
        <View key={i} style={styles.group}>
          <View
            style={[
              styles.chip,
              { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
            ]}
          >
            <Image source={coin} style={styles.coin} />
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontWeight: '500',
                fontSize: 11.5,
              }}
            >
              {b.amount !== null ? `+${b.amount} coins` : 'Coins added'}
            </Text>
          </View>
          {b.amount !== null && b.label.length > 0 ? (
            <View
              style={[
                styles.chip,
                { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
              ]}
            >
              <Icon name="history" size={14} color={t.color.textPrimary} />
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontWeight: '500',
                  fontSize: 11.5,
                }}
              >
                {b.label}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coin: { width: 16, height: 16 },
});

import { Pressable, Text, View } from 'react-native';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

/** Same explicit affordance for receipt and meal details. */
export function ItemsToggle({ open, onPress, t }: { open: boolean; onPress: () => void; t: Theme }) {
  const label = open ? 'Hide items' : 'Show items';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ expanded: open }} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: t.color.interactive, fontFamily: t.typography.textBody.fontFamily, textDecorationLine: 'underline' }}>{label}</Text>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={18} color={t.color.interactive} />
      </View>
    </Pressable>
  );
}

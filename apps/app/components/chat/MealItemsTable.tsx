import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { MealDetailBlock } from '../../lib/blocks';
import type { Theme } from '../../lib/theme';

/** Approved CX repair: one item table inside the capture reply, no repeated totals. */
export function MealItemsTable({ items, t }: { items: MealDetailBlock[]; t: Theme }) {
  const [copied, setCopied] = useState(false);
  const text = { color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 14 };
  return (
    <View style={{ borderWidth: 1, borderColor: t.color.borderStructure }}>
      <View style={{ flexDirection: 'row', padding: 8, gap: 12, backgroundColor: t.color.surfaceInset }}>
        <Text style={[text, { flex: 1, fontWeight: '500' }]}>Item</Text>
        <Text style={[text, { flex: 1, textAlign: 'right', fontWeight: '500' }]}>Your share</Text>
      </View>
      {items.map(item => (
        <View key={item.entryId} style={{ flexDirection: 'row', gap: 12, padding: 8, borderTopWidth: 1, borderTopColor: t.color.borderStructure }}>
          <Text style={[text, { flex: 1, minWidth: 0 }]}>{item.dish}</Text>
          <Text style={[text, { flex: 1, minWidth: 0, textAlign: 'right' }]}>{item.portion ?? 'Not recorded'}</Text>
        </View>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Copy meal items"
        onPress={async () => {
          await Clipboard.setStringAsync(['Item\tYour share', ...items.map(item => `${item.dish}\t${item.portion ?? 'Not recorded'}`)].join('\n'));
          setCopied(true);
        }}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: t.color.borderStructure }}>
        <Text style={[text, { color: t.color.interactive }]}>{copied ? 'Copied' : 'Copy'}</Text>
      </Pressable>
    </View>
  );
}

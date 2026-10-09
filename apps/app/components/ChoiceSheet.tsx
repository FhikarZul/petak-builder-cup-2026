// Bottom-sheet choice picker for Settings (Run B row-detail pattern): a
// searchable list inside a Modal. Used by the Region settings — currency and
// timezone — where the choice set is too long for inline rows.
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../lib/theme';
import { Icon } from './Icon';

export interface Choice {
  value: string;
  label: string;
}

export function ChoiceSheet({
  visible,
  title,
  choices,
  searchPlaceholder,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  choices: Choice[];
  /** When true-ish placeholder given, a search field filters the list. */
  searchPlaceholder: string;
  selected: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choices;
    return choices.filter((c) => `${c.label} ${c.value}`.toLowerCase().includes(q));
  }, [choices, query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={styles.scrimTouch} accessibilityLabel="Close" onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.color.surfacePage, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.header, { borderBottomColor: t.color.borderStructure }]}>
            <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 20 }}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
              <Icon name="close" size={22} color={t.color.textPrimary} />
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={t.color.textSecondary}
            autoCorrect={false}
            style={[
              styles.search,
              {
                color: t.color.textPrimary,
                backgroundColor: t.color.surfaceInset,
                borderColor: t.color.borderStructure,
                fontFamily: t.typography.textBody.fontFamily,
              },
            ]}
          />
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.value}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => {
              const active = item.value === selected;
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onSelect(item.value);
                    onClose();
                  }}
                  style={[styles.row, { borderBottomColor: t.color.borderStructure }]}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: active ? t.color.interactive : t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontWeight: active ? '600' : '400',
                      fontSize: 15,
                    }}
                  >
                    {item.label}
                  </Text>
                  {active ? <Icon name="check" size={20} color={t.color.interactive} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  scrimTouch: { flex: 1 },
  sheet: { borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  search: { height: 40, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1 },
});

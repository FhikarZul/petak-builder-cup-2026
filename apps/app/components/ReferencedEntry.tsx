// Run C #70 — the entry an ASK is about, drawn inside the ask.
//
// Milo's link question named a merchant in prose and nothing else, so the
// user had to remember which $8.40 receipt that was, from a question in a
// different thread. The row puts it in front of them: the receipt thumbnail,
// what it was, and who filed it — which is always the OTHER neighbour, and
// that is the point of the row.
//
// The server sends FACTS (entry_card's rule). This component owns the
// separator, the currency formatting and the "filed it" phrasing.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReferencedEntryBlock } from '../lib/blocks';
import { hhmm } from '../lib/honesty';
import { NEIGHBOURS, type NeighbourId } from '../lib/neighbours';
import type { Theme } from '../lib/theme';
import { usePhoto } from '../lib/thread';
import { Icon } from './Icon';

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReferencedEntry({
  block,
  onOpen,
  t,
}: {
  block: ReferencedEntryBlock;
  /** The full-screen viewer — every photo opens (canon: sent or recalled). */
  onOpen?: (photoId: string, url: string) => void;
  t: Theme;
}) {
  const photo = usePhoto(block.photoId);
  const filer = NEIGHBOURS[block.filedBy as NeighbourId];
  // A missing amount drops its half rather than printing a placeholder — the
  // row states what is known and never pads it out.
  const title = [block.title, block.amount !== null ? `${block.currency ?? ''}${money(block.amount)}`.trim() : null]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' · ');
  const foot = [block.at ? hhmm(block.at) : null, filer ? `${filer.name} filed it` : null]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <View style={[styles.row, { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure }]}>
      {block.photoId ? (
        photo.data ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="Open the receipt"
            onPress={() => {
              if (onOpen && photo.data) onOpen(block.photoId as string, photo.data.image_url);
            }}
          >
            <Image source={{ uri: photo.data.image_url }} style={styles.thumb} accessibilityIgnoresInvertColors />
          </Pressable>
        ) : (
          <View style={[styles.thumb, styles.well, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfacePage }]}>
            <Icon name="receipt_long" size={18} color={t.color.textSecondary} />
          </View>
        )
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {title.length > 0 ? (
          <Text
            numberOfLines={1}
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontWeight: '500',
              fontSize: 13,
              fontVariant: ['tabular-nums'],
            }}
          >
            {title}
          </Text>
        ) : null}
        {foot.length > 0 ? (
          <Text
            numberOfLines={1}
            style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}
          >
            {foot}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  // 40px, per the drawing.
  thumb: { width: 40, height: 40, borderRadius: 6 },
  well: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});

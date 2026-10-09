// Run C #71 — the reverse lookup: Penny's answer to "show me the food photos
// for the X bill" carries every plate linked to that receipt (C41 — the link
// is always the server's; this only reads it). One evidence row per plate:
// the 64px thumb with its open_in_full badge, "{dish} · {kcal}", and the chip
// "this receipt · evidence". The chip and the footer open the SAME door — the
// other entry, in the already-shipped LinkedEntrySheet ("His count, not
// mine") — never a merged record.
//
// The server sends FACTS (entry_card's rule). This component owns the
// separator, the "· kcal" phrasing, the chip label and the footer words.
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReceiptPlatesBlock } from '../../lib/blocks';
import { NEIGHBOURS, possessive, type NeighbourId } from '../../lib/neighbours';
import type { Theme } from '../../lib/theme';
import {
  findEntry,
  useNeighbourEntries,
  usePhoto,
  type LedgerEntry,
} from '../../lib/thread';
import { LinkedEntrySheet } from '../EntryCard';
import { Icon } from '../Icon';

type Plate = ReceiptPlatesBlock['plates'][number];

function PlateRow({
  plate,
  entry,
  onOpenEntry,
  onOpenPhoto,
  t,
}: {
  plate: Plate;
  /** Milo's plate entry — null when it is older than the served first page
   *  (the findEntry contract): the chip renders DISABLED, never an error. */
  entry: LedgerEntry | null;
  onOpenEntry: (entry: LedgerEntry) => void;
  onOpenPhoto: (photoId: string, uri: string, caption: string, iso: string) => void;
  t: Theme;
}) {
  const photo = usePhoto(plate.photoId);
  // The row states what is known and never pads it out: no dish when the
  // server read none, no "· kcal" when it counted none — never a placeholder.
  const facts = [plate.dish, plate.calories !== null ? `${plate.calories} kcal` : null]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' · ');

  return (
    <View style={styles.plateRow}>
      {photo.data ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="Open the plate photo"
          onPress={() => {
            // No caption: the row is not the photo's own message, and
            // borrowing this bubble's words would misattribute them.
            if (photo.data) onOpenPhoto(plate.photoId, photo.data.image_url, '', plate.at);
          }}
        >
          <Image source={{ uri: photo.data.image_url }} style={styles.thumb} accessibilityIgnoresInvertColors />
          <View style={styles.badge}>
            <Icon name="open_in_full" size={11} color="#ffffff" />
          </View>
        </Pressable>
      ) : (
        <View style={[styles.thumb, styles.well, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfacePage }]}>
          <Icon name="image" size={18} color={t.color.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        {facts.length > 0 ? (
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
            {facts}
          </Text>
        ) : null}
        <View>
          <Pressable
            disabled={!entry}
            onPress={() => entry && onOpenEntry(entry)}
            accessibilityRole="button"
            accessibilityLabel="this receipt · evidence — open the linked entry"
            style={[
              styles.chip,
              { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
            ]}
          >
            <Icon name="link" size={13} color={t.color.textPrimary} />
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontWeight: '500',
                fontSize: 11.5,
              }}
            >
              this receipt · evidence
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function ReceiptPlates({
  block,
  onOpenPhoto,
  t,
}: {
  block: ReceiptPlatesBlock;
  /** The full-screen viewer — every photo opens (canon: sent or recalled). */
  onOpenPhoto: (photoId: string, uri: string, caption: string, iso: string) => void;
  t: Theme;
}) {
  // filedBy is the plates' filer — the OTHER neighbour, which is the point of
  // the footer. The chip and the footer open the same door: that neighbour's
  // entry, in the already-shipped "two doors" sheet.
  const filer = NEIGHBOURS[block.filedBy as NeighbourId];
  const entriesQ = useNeighbourEntries(block.filedBy);
  const entries = entriesQ.data?.entries;
  const [openEntry, setOpenEntry] = useState<LedgerEntry | null>(null);

  // The footer appears once and opens the FIRST plate's entry (the minimal
  // extension of the drawn one-plate case); each row's chip opens its own.
  const first = findEntry(entries, block.plates[0].entryId);

  return (
    <View style={[styles.card, { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure }]}>
      {block.plates.map((plate) => (
        <PlateRow
          key={plate.entryId}
          plate={plate}
          entry={findEntry(entries, plate.entryId)}
          onOpenEntry={setOpenEntry}
          onOpenPhoto={onOpenPhoto}
          t={t}
        />
      ))}
      <View style={[styles.footer, { borderTopColor: t.color.borderStructure }]}>
        <Pressable
          disabled={!first}
          onPress={() => first && setOpenEntry(first)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${filer?.name ?? block.filedBy}'s entry`}
          hitSlop={8}
        >
          <Text
            style={{
              color: t.color.interactive,
              fontFamily: t.typography.textSmall.fontFamily,
              fontWeight: '500',
              fontSize: 12.5,
            }}
          >
            {`Open ${filer?.name ?? block.filedBy}'s entry`}
          </Text>
        </Pressable>
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 12,
          }}
        >
          {`${possessive(block.filedBy as NeighbourId)} count, not mine`}
        </Text>
      </View>
      {openEntry ? (
        <LinkedEntrySheet
          visible
          owner={block.filedBy as NeighbourId}
          entry={openEntry}
          onClose={() => setOpenEntry(null)}
          t={t}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    gap: 8,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // 64px, per the drawing.
  thumb: { width: 64, height: 64, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  well: { alignItems: 'center', justifyContent: 'center' },
  // The open_in_full badge, pinned bottom-right on a dark scrim chip.
  badge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    borderRadius: 4,
    padding: 2,
    backgroundColor: 'rgba(32,36,46,.62)',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 8,
  },
});

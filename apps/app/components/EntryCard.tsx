// App slice 2 (plan §3/§5) — the entry card below a filing line (mirror
// #60/#62/#63): title · kind and date on the left, the state chip (which
// REPEATS the strip's word) and the value on the right; the honesty strip
// is always the LAST row. Evidence chips (#71) follow the link in BOTH
// directions — tapping either opens the OTHER entry's card in-thread,
// labelled whose it is ("His count, not mine"). One link, two doors —
// never a merged record.
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EntryCardBlock } from '../lib/blocks';
import { categorySubLabel } from '../lib/dashboard';
import {
  dayLabel,
  parseServerDate,
  stripFromTrail,
  stripIcon,
  stripText,
  trailValueLabel,
} from '../lib/honesty';
import { NEIGHBOURS, possessive, type NeighbourId } from '../lib/neighbours';
import type { Theme } from '../lib/theme';
import {
  findEntry,
  useEntryTrail,
  useNeighbourEntries,
  type LedgerEntry,
} from '../lib/thread';
import { HonestyStrip, WhatChangedSheet } from './HonestyStrip';
import { Icon } from './Icon';
import { CurrencyEvidenceRows } from './CurrencyEvidenceRows';

/** Chip tokens the server writes today; unknown tokens degrade to words. */
function chipLabel(token: string): string {
  if (token === 'evidence') return 'evidence';
  if (token === 'no_receipt') return 'no receipt';
  // C87 (#49) — the entry's OWN photo, named for what it is. It sits beside
  // the `evidence` chip, which names the linked one: two photos, two chips,
  // and it is obvious at a glance which is which.
  if (token === 'own_photo') return 'plate photo';
  return token.replace(/_/g, ' ');
}

/** #49: the entry's own photo carries the picture icon; evidence carries the
 *  other side's. */
function chipIcon(token: string, entryKind: string): string | null {
  if (token === 'own_photo') return 'image';
  if (token === 'evidence') return evidenceIcon(entryKind);
  return null;
}

/** #71: the evidence chip's label names the OTHER side, from THIS entry's kind. */
function evidenceLabel(entryKind: string): string {
  if (entryKind === 'meal') return 'receipt · evidence'; // Milo's plate
  if (entryKind === 'expense') return 'this receipt · evidence'; // Penny's receipt
  return 'evidence';
}

function evidenceIcon(entryKind: string): string {
  return entryKind === 'meal' ? 'receipt_long' : 'link';
}

/** The neighbour who filed the OTHER side of a plate/receipt link. */
function otherNeighbourOf(entryKind: string): NeighbourId | null {
  if (entryKind === 'meal') return 'penny';
  if (entryKind === 'expense') return 'milo';
  return null;
}

function entryTitle(block: EntryCardBlock, entry: LedgerEntry | null): string {
  if (block.title) return block.title;
  const p = entry?.payload ?? {};
  // C92 — a body reading has no merchant and no dish; its title is what was
  // measured, and the reading itself is the value line.
  if (block.entryKind === 'body') return p.metric === 'body_fat' ? 'Body fat' : 'Weight';
  const name = p.merchant ?? p.dish;
  if (typeof name === 'string' && name.length > 0) return name;
  return block.entryKind;
}

export function EntryCard({
  block,
  t,
  onOpenPhoto,
}: {
  block: EntryCardBlock;
  t: Theme;
  /** #61: the What-changed footer opens the entry's kept photo. Threaded from
   *  the feed — the trail endpoint serves no photo reference. */
  onOpenPhoto?: (photoId: string, uri: string, caption: string, iso: string) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [linkedOpen, setLinkedOpen] = useState(false);

  const entriesQ = useNeighbourEntries(block.neighbour);
  const entry = findEntry(entriesQ.data?.entries, block.entryId);
  const trailQ = useEntryTrail(block.entryId);

  const strip = stripFromTrail(trailQ.data?.versions, block.honesty);

  const title = entryTitle(block, entry);
  const category =
    entry && typeof entry.payload.category === 'string' ? entry.payload.category : null;
  const subcategory =
    entry && typeof entry.payload.subcategory === 'string' ? entry.payload.subcategory : null;
  const titleLine = `${title}${category ? ` · ${categorySubLabel(category, subcategory)}` : ''}`;
  const value = entry ? trailValueLabel(entry.payload) : null;
  const dateLine = entry ? dayLabel(parseServerDate(entry.created_at)) : null;

  // #71 — the OTHER entry behind the evidence chip. The target is now
  // server-served: the served photo_id makes it a fact, not a guess — the
  // other neighbour's entry whose own photo is the one our link names. The
  // pre-#71 heuristic (the only linked entry, else nearest in time) is kept
  // only as an off-page fallback. Never inferred — the link itself is
  // always the server's (C41).
  const otherId = block.chips.includes('evidence') ? otherNeighbourOf(block.entryKind) : null;
  const otherEntriesQ = useNeighbourEntries(otherId);
  const linked = useMemo(() => {
    if (!entry || entry.linked_photos.length === 0) return null;
    const others = otherEntriesQ.data?.entries ?? [];
    // #71: the served photo_id makes the target a fact, not a guess — the
    // entry whose own photo is the one our link names.
    const linkedIds = new Set(entry.linked_photos.map((l) => l.photo_id));
    const exact = others.find((e) => e.photo_id !== null && linkedIds.has(e.photo_id));
    if (exact) return exact;
    // Fallback for an entry older than the served page: the pre-#71 heuristic
    // (the only linked entry, else nearest in time). Never inferred — the link
    // itself is always the server's (C41).
    const candidates = others.filter((e) => e.linked_photos.length > 0);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const at = parseServerDate(entry.created_at).getTime();
    return candidates.reduce((a, b) =>
      Math.abs(parseServerDate(a.created_at).getTime() - at) <= Math.abs(parseServerDate(b.created_at).getTime() - at) ? a : b);
  }, [entry, otherEntriesQ.data]);

  const hasEvidence = block.chips.includes('evidence');
  const plainChips = block.chips.filter((c) => c !== 'evidence');
  const tappable = strip && strip.state !== 'estimate';

  return (
    <View style={[styles.card, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceCard }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 14,
            }}
          >
            {titleLine}
          </Text>
          {dateLine ? (
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
              }}
            >
              {dateLine}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {strip ? (
            <View style={[styles.stateChip, { borderColor: t.color.borderStructure }]}>
              <Icon name={stripIcon(strip.state)} size={13} color={t.color.textSecondary} />
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textLabel.fontFamily,
                  fontSize: 11,
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                }}
              >
                {strip.state}
              </Text>
            </View>
          ) : null}
          {value ? (
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 15,
              }}
            >
              {value}
            </Text>
          ) : null}
        </View>
      </View>

      {entry ? <CurrencyEvidenceRows payload={entry.payload} t={t} /> : null}

      {hasEvidence || plainChips.length > 0 ? (
        <View style={[styles.chipsRow, { borderTopColor: t.color.borderStructure }]}>
          {hasEvidence ? (
            <Pressable
              disabled={!linked}
              onPress={() => setLinkedOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`${evidenceLabel(block.entryKind)} — open the linked entry`}
              style={[
                styles.chip,
                { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
              ]}
            >
              <Icon name={evidenceIcon(block.entryKind)} size={14} color={t.color.textPrimary} />
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontWeight: '500',
                  fontSize: 11.5,
                }}
              >
                {evidenceLabel(block.entryKind)}
              </Text>
            </Pressable>
          ) : null}
          {plainChips.map((chip) => (
            <View
              key={chip}
              style={[
                styles.chip,
                { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset },
              ]}
            >
              {chipIcon(chip, block.entryKind) ? (
                <Icon name={chipIcon(chip, block.entryKind) as string} size={13} color={t.color.textPrimary} />
              ) : null}
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontWeight: '500',
                  fontSize: 11.5,
                }}
              >
                {chipLabel(chip)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {strip ? (
        <HonestyStrip
          strip={strip.state}
          text={stripText(strip)}
          onPress={tappable ? () => setSheetOpen(true) : undefined}
          t={t}
        />
      ) : null}

      {tappable && trailQ.data ? (
        <WhatChangedSheet
          visible={sheetOpen}
          context={`${titleLine}${dateLine ? ` · ${dateLine}` : ''}`}
          versions={trailQ.data.versions}
          photoId={entry?.photo_id ?? null}
          onOpenPhoto={onOpenPhoto}
          onClose={() => setSheetOpen(false)}
          t={t}
        />
      ) : null}

      {otherId && linked ? (
        <LinkedEntrySheet
          visible={linkedOpen}
          owner={otherId}
          entry={linked}
          onClose={() => setLinkedOpen(false)}
          t={t}
        />
      ) : null}
    </View>
  );
}

/** #71 — the OTHER entry's card, in-thread, labelled whose it is. */
export function LinkedEntrySheet({
  visible,
  owner,
  entry,
  onClose,
  t,
}: {
  visible: boolean;
  owner: NeighbourId;
  entry: LedgerEntry;
  onClose: () => void;
  t: Theme;
}) {
  const n = NEIGHBOURS[owner];
  const p = entry.payload;
  const name = p.merchant ?? p.dish;
  const title = typeof name === 'string' && name.length > 0 ? name : entry.kind;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.color.surfaceCard, borderTopColor: t.color.borderEmphasis },
          ]}
        >
        <View style={[styles.sheetHeader, { borderBottomColor: t.color.borderStructure }]}>
          <Text
            style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}
          >
            {`${n.name}'s entry`}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={24} color={t.color.textPrimary} />
          </Pressable>
        </View>
        <View style={[styles.linkedBody, { borderLeftColor: t.color[n.domain] }]}>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 14,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 15,
            }}
          >
            {trailValueLabel(p)}
          </Text>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
            }}
          >
            {dayLabel(parseServerDate(entry.created_at))}
          </Text>
        </View>
        <Text
          style={{
            paddingHorizontal: 16,
            paddingBottom: 4,
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 12.5,
          }}
        >
          {`${possessive(owner)} count, not mine`}
        </Text>
        <View style={styles.closeWrap}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.closeButton, { backgroundColor: t.color.interactive }]}
          >
            <Text
              style={{
                color: t.color.textOnInteractive,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 15,
              }}
            >
              Close
            </Text>
          </Pressable>
        </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(32,36,46,.48)',
  },
  sheet: { borderTopWidth: 2 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  linkedBody: {
    margin: 16,
    marginBottom: 8,
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 3,
  },
  closeWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  closeButton: { height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});

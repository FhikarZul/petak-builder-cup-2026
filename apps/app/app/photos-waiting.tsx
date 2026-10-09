// App slice 3 (plan §7) — "Photos waiting", Run A #32. Appears only when
// more are held than you can read today; otherwise the queue reads itself.
// The header line carries REAL numbers: n = (cap − used) + kept_credits from
// ['street']; the list is GET /v1/photos?state=queued, oldest first, age
// labels from created_at. `Pick oldest {n}` pre-selects; confirm POSTs
// /v1/photos/read ONCE (the pick IS the kept-credit consent — the copy
// carries the C13 ask-once + "don't ask again" tickbox → PATCH /v1/settings
// {credit_prompt:false}); `Clear` just closes. Manual picks beyond n are
// simply not sent — no counter chrome (C06).
//
// DRAFT COPY (founder wordsmiths — every line touching credits is DRAFT):
// the C13 ask-once line below the confirm button.
import { useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { parseServerDate } from '../lib/honesty';
import { useQueuedPhotos, useStreet, type QueuedPhoto } from '../lib/thread';
import { pickerRows } from '../lib/feed';
import { useTheme } from '../lib/theme';
import { Icon } from '../components/Icon';
import { PhotoViewer, dayTimeLabel } from '../components/chat/rows';

function hhmm(iso: string): string {
  const d = parseServerDate(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The age label (created_at = age): time today, Yesterday, then N days. */
function ageLabel(iso: string, now: Date): string {
  const d = parseServerDate(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return hhmm(iso);
  if (days === 1) return `Yesterday ${hhmm(iso)}`;
  return `${days} days ${hhmm(iso)}`;
}

export default function PhotosWaitingScreen() {
  const t = useTheme();
  const queryClient = useQueryClient();
  const street = useStreet();
  const queued = useQueuedPhotos();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<{ credit_prompt: boolean }>('/v1/settings'),
    staleTime: 60 * 1000,
  });

  const photos = useMemo(() => queued.data ?? [], [queued.data]);
  const waiting = photos.length;
  const n = street.data
    ? Math.max(0, street.data.allowance.cap - street.data.allowance.used) +
      street.data.kept_credits
    : 0;

  // `Pick oldest {n}` is the pre-selection (the list is already oldest-first).
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [seeded, setSeeded] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [sending, setSending] = useState(false);
  // 27 Aug founder ruling: no content labels (naming what is in a photo
  // means reading it). Instead the tile IS the photo and this opens it
  // full-screen — the same open_in_full pattern every other photo uses.
  const [zoom, setZoom] = useState<QueuedPhoto | null>(null);
  if (!seeded && photos.length > 0 && street.data) {
    setSeeded(true);
    setSelected(new Set(photos.slice(0, n).map((p) => p.photo_id)));
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Run A #32 draws "4 picked · 3 left to spend". C06 bans streaks, bars,
  // countdowns, badges and urgency — a selection counter is none of those, and
  // the founder ruled the same question the same way for the balance line
  // (26 Aug). It also stops the silent truncation that used to drop picks
  // beyond n with no explanation, which C32 forbids.
  const pickedAll = photos.filter((p) => selected.has(p.photo_id));
  const picked = pickedAll.slice(0, n);
  const leftToSpend = Math.max(0, n - pickedAll.length);
  const overPicked = Math.max(0, pickedAll.length - n);
  // C13: the ask-once shows only while the user still wants to be asked.
  const askOnce = settings.data?.credit_prompt !== false;

  const confirm = async () => {
    if (picked.length === 0 || sending) return;
    setSending(true);
    try {
      if (dontAskAgain) {
        await apiFetch('/v1/settings', {
          method: 'PATCH',
          body: JSON.stringify({ credit_prompt: false }),
        });
        void queryClient.invalidateQueries({ queryKey: ['settings'] });
      }
      await apiFetch('/v1/photos/read', {
        method: 'POST',
        body: JSON.stringify({ photo_ids: picked.map((p) => p.photo_id) }),
      });
      void queryClient.invalidateQueries({ queryKey: ['photos', 'queued'] });
      void queryClient.invalidateQueries({ queryKey: ['street'] });
      router.back();
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: t.color.surfacePage }}>
      <View style={[styles.header, { borderBottomColor: t.color.borderStructure }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="arrow_back" size={24} color={t.color.textPrimary} />
        </Pressable>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.textBody.fontFamily,
            fontWeight: '500',
            fontSize: 15,
          }}
        >
          Photos waiting
        </Text>
      </View>

      <FlatList
        data={pickerRows(photos)}
        keyExtractor={(row, i) => (row.kind === 'day' ? `day:${row.label}` : `row:${i}`)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 6 }}>
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 15,
                lineHeight: 24,
              }}
            >
              {`${waiting} photos are waiting and you can read ${n} today. Pick which ones — whoever they turn out to be for.`}
            </Text>
            {/* Run A #32's counter, above the buttons as drawn. When the user
                picks MORE than they can spend it says so plainly rather than
                dropping the extras in silence (C32 — nothing degrades
                quietly). */}
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 13,
              }}
            >
              {overPicked > 0
                ? `${pickedAll.length} picked · ${overPicked} more than you can read today`
                : `${pickedAll.length} picked · ${leftToSpend} left to spend`}
            </Text>
            <View style={styles.pickRow}>
              <Pressable
                onPress={() => setSelected(new Set(photos.slice(0, n).map((p) => p.photo_id)))}
                accessibilityRole="button"
                style={[styles.pickOldest, { backgroundColor: t.color.interactive }]}
              >
                <Text
                  style={{
                    color: t.color.textOnInteractive,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 15,
                  }}
                >
                  {`Pick oldest ${n}`}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelected(new Set())}
                accessibilityRole="button"
                style={[styles.clear, { borderColor: t.color.interactive }]}
              >
                <Text
                  style={{
                    color: t.color.interactive,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 15,
                  }}
                >
                  Clear
                </Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item: row }) =>
          row.kind === 'day' ? (
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 13,
                marginTop: 6,
              }}
            >
              {row.label}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {row.tiles.map((photo: QueuedPhoto) => (
                <QueuedPhotoTile
                  key={photo.photo_id}
                  photo={photo}
                  selected={selected.has(photo.photo_id)}
                  onToggle={() => toggle(photo.photo_id)}
                  onZoom={() => setZoom(photo)}
                />
              ))}
            </View>
          )
        }
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 8 }}>
            <Pressable
              onPress={() => void confirm()}
              disabled={picked.length === 0 || sending}
              accessibilityRole="button"
              style={[
                styles.confirm,
                {
                  backgroundColor:
                    picked.length > 0 && !sending ? t.color.interactive : t.color.disabledBg,
                },
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
                {`Read these ${picked.length}`}
              </Text>
            </Pressable>
            {askOnce ? (
              <Pressable
                onPress={() => setDontAskAgain((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: dontAskAgain }}
                style={styles.askRow}
              >
                <View
                  style={[
                    styles.tickbox,
                    { borderColor: t.color.borderEmphasis },
                    dontAskAgain && { backgroundColor: t.color.interactive },
                  ]}
                >
                  {dontAskAgain ? <Icon name="check" size={14} color={t.color.textOnInteractive} /> : null}
                </View>
                <Text
                  style={{
                    flex: 1,
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textSmall.fontFamily,
                    fontSize: 12.5,
                    lineHeight: 19,
                  }}
                >
                  {/* DRAFT (C13 ask-once — founder wordsmiths) */}
                  Reading past today's allowance spends your kept credits — ask me every time, or
                  tick to spend them without asking.
                </Text>
              </Pressable>
            ) : null}
            {street.data ? (
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontSize: 12.5,
                  lineHeight: 19,
                }}
              >
                {`Nothing is deleted. What you leave keeps until tomorrow's ${street.data.allowance.cap}, when the queue reads itself.`}
              </Text>
            ) : null}
          </View>
        }
      />
      {zoom ? (
        <Modal visible animationType="fade" onRequestClose={() => setZoom(null)}>
          <PhotoViewer
            viewer={{
              uri: zoom.image_url,
              caption: '',
              time: dayTimeLabel(zoom.created_at),
              photoId: zoom.photo_id,
            }}
            onClose={() => setZoom(null)}
          />
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * One waiting photo, as a square tile in the #32 grid.
 *
 * Two separate actions, deliberately: TAPPING the tile picks it (that is the
 * screen's job), and the open_in_full badge opens it full-screen. Petak
 * already uses that badge for every photo, so zoom is not a new gesture to
 * learn — and it is what replaces the drawn content labels, which cannot be
 * built without reading the photo (27 Aug founder ruling).
 */
function QueuedPhotoTile({
  photo,
  selected,
  onToggle,
  onZoom,
}: {
  photo: QueuedPhoto;
  selected: boolean;
  onToggle: () => void;
  onZoom: () => void;
}) {
  const t = useTheme();
  const now = new Date();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`Photo from ${ageLabel(photo.created_at, now)}`}
        style={[
          styles.tile,
          { borderColor: selected ? t.color.borderEmphasis : t.color.borderStructure },
          selected ? styles.tileSelected : null,
        ]}
      >
        <Image source={{ uri: photo.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {selected ? (
          <View style={[styles.tileCheck, { backgroundColor: t.color.interactive }]}>
            <Icon name="check" size={16} color={t.color.textOnInteractive} />
          </View>
        ) : null}
        <Pressable
          onPress={onZoom}
          accessibilityRole="button"
          accessibilityLabel="Open full screen"
          hitSlop={8}
          style={[styles.tileZoom, { backgroundColor: t.color.surfaceCard }]}
        >
          <Icon name="open_in_full" size={14} color={t.color.textPrimary} />
        </Pressable>
      </Pressable>
      <Text
        style={{
          color: t.color.textSecondary,
          fontFamily: t.typography.textSmall.fontFamily,
          fontSize: 12,
        }}
      >
        {ageLabel(photo.created_at, now)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { aspectRatio: 1, borderWidth: 1, overflow: 'hidden' },
  tileSelected: { borderWidth: 2 },
  tileCheck: {
    position: 'absolute', top: 6, left: 6, width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  tileZoom: {
    position: 'absolute', bottom: 6, right: 6, width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  pickRow: { flexDirection: 'row', gap: 8 },
  pickOldest: {
    flexGrow: 1,
    height: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  clear: {
    height: 44,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    padding: 10,
  },
  thumb: { width: 56, height: 56, borderWidth: 1, overflow: 'hidden' },
  thumbEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tickbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: {
    height: 48,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});

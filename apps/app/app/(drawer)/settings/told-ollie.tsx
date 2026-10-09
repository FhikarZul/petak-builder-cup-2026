// What you have told Ollie, and what became of it (6 Sep 2026, founder:
// "a list of things that user can view and see if the progress has been
// completed").
//
// The reason this exists is not project management. It is that a report which
// disappears teaches people to stop reporting — and in a beta, the person who
// tells you something broke is doing you the biggest favour available.
//
// What it deliberately does NOT show, all from C57:
//   · no ticket number — the report is identified by its own first line
//   · no date, no estimate, nothing "promised in hours"
//   · no crisis-floor report — those are never forwarded, so listing one
//     under a status would be a quiet lie about where it went
//
// The status words are Ollie's, not ClickUp's. Someone who reported a bug
// wants to know whether it is being looked at; "update required" is a project
// board's vocabulary and means nothing to them.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { apiFetch } from '../../../lib/api';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useTheme, type Theme } from '../../../lib/theme';
import { usePhoto } from '../../../lib/thread';
import { EMPTY_LIST, isSettled, orderReports, statusLine, type ReportRow } from '../../../lib/tellOllie';

export default function ToldOllieScreen() {
  const t = useTheme();
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Which card is open (internal-reference). One at a time: the detail is the whole
  // report plus its picture, and two open essays is a wall.
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      // `refresh=1` tells the server to ask ClickUp NOW rather than serve its
      // cached answer. A pull-to-refresh is a person saying "check again", and
      // returning a cached status to that gesture makes the screen feel broken.
      const res = await apiFetch<{ reports: ReportRow[] }>(`/v1/feedback${force ? '?refresh=1' : ''}`);
      setRows(orderReports(res.reports));
    } catch {
      // An empty list and a list that failed to load look the same to the
      // user, which is wrong — but inventing a status would be worse. The
      // pull-to-refresh is the recovery.
      setRows([]);
    }
  }, []);

  // Reload on focus: the status changes on someone else's board, so the value
  // of this screen is entirely in it being current when you open it.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="What you've told me" />
      {rows === null ? (
        <View style={styles.centre}>
          <ActivityIndicator color={t.color.domainSystem} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true).finally(() => setRefreshing(false));
              }}
              tintColor={t.color.domainSystem}
            />
          }
        >
          {rows.length === 0 ? (
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 14,
                lineHeight: 21,
              }}
            >
              {EMPTY_LIST}
            </Text>
          ) : (
            rows.map((row) => {
              const settled = isSettled(row.status);
              const open = openId === row.id;
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setOpenId(open ? null : row.id)}
                  style={[
                    styles.card,
                    {
                      backgroundColor: t.color.surfaceCard,
                      borderColor: t.color.borderStructure,
                      // A settled report steps back rather than disappearing:
                      // it is still the user's record of what they said.
                      opacity: settled ? 0.62 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: t.color.textPrimary,
                      fontFamily: t.typography.textBody.fontFamily,
                      fontSize: 15,
                      lineHeight: 22,
                    }}
                  >
                    {open ? row.body : row.summary}
                  </Text>
                  {open && row.photo_id ? <ReportPhoto photoId={row.photo_id} t={t} /> : null}
                  <View style={styles.status}>
                    <Icon
                      name={row.status === 'done' ? 'check' : row.status === 'closed' ? 'close' : 'schedule'}
                      size={15}
                      color={t.color.textSecondary}
                    />
                    <Text
                      style={{
                        color: t.color.textSecondary,
                        fontFamily: t.typography.textSmall.fontFamily,
                        fontSize: 12.5,
                        flex: 1,
                      }}
                    >
                      {statusLine(row.status)}
                    </Text>
                    {/* The picture's presence is visible even folded — it is
                        half of what the report IS. */}
                    {!open && row.photo_id ? (
                      <Icon name="image" size={15} color={t.color.textSecondary} />
                    ) : null}
                    <Icon name={open ? 'expand_less' : 'expand_more'} size={16} color={t.color.textSecondary} />
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * The picture that rode along on a report, drawn through the ORDINARY photo
 * route (G3's presigned URL) — what shows is byte-for-byte what was sent,
 * never a re-upload or a thumbnail made elsewhere.
 */
function ReportPhoto({ photoId, t }: { photoId: string; t: Theme }) {
  const photo = usePhoto(photoId);
  if (!photo.data?.image_url) {
    return (
      <View style={[styles.photoBox, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}>
        <ActivityIndicator color={t.color.textSecondary} />
      </View>
    );
  }
  return (
    <View style={[styles.photoBox, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}>
      <Image source={{ uri: photo.data.image_url }} style={styles.photo} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 10 },
  card: { borderWidth: 1, borderRadius: 8, padding: 14, gap: 8 },
  status: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  // Tall enough to READ a phone screenshot; `contain` keeps the whole of it.
  photoBox: { borderWidth: 1, borderRadius: 4, overflow: 'hidden', height: 360, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
});

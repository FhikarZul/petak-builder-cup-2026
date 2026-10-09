// Tell Ollie (Run B #21/#22) — telling him something, not filing anything.
//
// Three rules from C57, and each one is a thing this screen does NOT do:
//
// · **No ticket number, no waiting time.** "Told." and a line in his voice.
//   A number would turn a conversation into a support queue.
// · **No reward, and no mention of one.** Pre-launch, being early is the
//   whole of it — coins for accepted reports are a post-launch thing and
//   never advertised on the box.
// · **Nothing is captured unless you say so.** Which is why the footer lists
//   exactly what travels, and the list is short enough to read.
//
// 6 Sep 2026 — the founder asked for three things, and all three are here:
//
//   1. It reaches ClickUp. Previously it did not: C57 said reports route
//      automatically and the forwarder was never built, so a report went into
//      a Postgres table and stopped. The server forwards now (ops/clickup.ts)
//      with the account context a triager would otherwise have to ask for.
//   2. A picture can ride along. It goes up the ORDINARY photo route and is
//      deliberately never "accepted" — accept is what enqueues extraction, so
//      no neighbour reads it and no credit is spent (C41 charges at the read,
//      and a screenshot on a bug report is not a read).
//   3. You can see what became of it. "See what you have told me" opens the
//      list — state only, never a date, so C57's "nothing is promised in
//      hours" still holds.
//
// The attach affordance is no longer withheld. It was, because C57 forbids
// auto-attaching a screenshot without consent — but a picture chosen by hand,
// shown before it is sent, and removable IS the consent that ruling asks for.
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { buildIdentityForReport, type BuildIdentitySource } from '../../../lib/appVersion';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { apiFetch } from '../../../lib/api';
import { Icon } from '../../../components/Icon';
import { ScreenHeader } from '../../../components/ScreenHeader';
import ollieFull from '../../../../../packages/assets/sprites/ollie.png';
import { useTheme } from '../../../lib/theme';
import { KIND_LABEL, REPORT_KINDS, petakYouWereIn, whatTravels, type ReportKind } from '../../../lib/tellOllie';
import { peekDrawerTop } from '../../../lib/drawerHistory';
import { putBytes, preparePhotoForUpload } from '../../../lib/captureRun';

export default function TellOllieScreen() {
  const t = useTheme();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [sent, setSent] = useState<{ words: string; crisisReply: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  // C112 — the report carries the BUILD, not just the version. Without the
  // number a report says "0.1.0", which identifies nothing once the counter has
  // moved — and identifying the build is most of triage.
  const { app_version: version, build_number: buildNumber } = buildIdentityForReport(
    Constants.expoConfig as BuildIdentitySource | null,
  );
  const platform = `${Platform.OS} ${String(Platform.Version)}`;
  // "which petak you were in when you opened this" — the drawn sentence's
  // third clause, which the shipped screen promised nowhere and sent nowhere.
  // The drawer's own visit stack already knows; read once so it does not
  // change under the user while they type.
  const [cameFrom] = useState(() => petakYouWereIn(peekDrawerTop()));

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: false, quality: 0.85 });
    if (!res.canceled && res.assets[0]) setPhoto({ uri: res.assets[0].uri });
  };

  /**
   * The picture, uploaded the ordinary way and then LEFT ALONE.
   *
   * Create → PUT, and deliberately no /accept. Accept is what enqueues
   * extraction, which is what spends a credit and puts the image in front of
   * a neighbour. A screenshot attached to a bug report must do neither, so
   * the flow simply stops one step early and the photo exists only as bytes
   * the report can point at.
   *
   * Returns null on any failure: a picture that will not upload must never
   * cost someone the words they wrote.
   */
  const uploadPhoto = async (): Promise<string | null> => {
    if (!photo) return null;
    try {
      const prepared = await preparePhotoForUpload(photo.uri);
      const created = await apiFetch<{ photo_id: string; upload_url?: string }>('/v1/photos', {
        method: 'POST',
        body: JSON.stringify({
          client_key: `tell-ollie:${Crypto.randomUUID()}`,
          sha256: prepared.sha256,
          content_type: prepared.contentType,
        }),
      });
      if (created.upload_url) await putBytes(prepared.uri, created.upload_url, prepared.contentType);
      return created.photo_id;
    } catch {
      Alert.alert("That photo didn't upload.");
      return null;
    }
  };

  const send = async () => {
    const words = body.trim();
    if (words.length === 0 || busy) return;
    setBusy(true);
    try {
      const photoId = await uploadPhoto();
      if (photo && !photoId) return; // keep the draft and Send button for retry
      const res = await apiFetch<{ id: string; crisis_floor?: boolean; reply?: string }>('/v1/feedback', {
        method: 'POST',
        body: JSON.stringify({
          body: words,
          app_version: version,
          platform,
          ...(kind ? { kind } : {}),
          ...(cameFrom ? { petak: cameFrom } : {}),
          ...(photoId ? { photo_id: photoId } : {}),
          os_version: String(Platform.Version),
          ...(buildNumber ? { build_number: buildNumber } : {}),
        }),
      });
      setSent({ words, crisisReply: res.crisis_floor ? (res.reply ?? null) : null });
    } finally {
      setBusy(false);
    }
  };

  if (sent !== null) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
        <ScreenHeader title="Tell Ollie" />
        <ScrollView contentContainerStyle={styles.body}>
          {/* #22 draws Ollie above the line. Withheld on the crisis reply:
              a sprite above "Please get help now." is the wrong register, and
              C57's crisis floor is the one place this screen stops being
              conversational. */}
          {!sent.crisisReply ? (
            <Image source={ollieFull} style={styles.ollie} resizeMode="contain" accessibilityIgnoresInvertColors />
          ) : null}
          <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 28, lineHeight: 33 }}>
            {sent.crisisReply ? 'Please get help now.' : 'Told.'}
          </Text>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 14,
              lineHeight: 21,
            }}
          >
            {sent.crisisReply ??
              'Got it. It goes in front of the neighbour whose petak it is — and I keep a note of who told me.'}
          </Text>
          <View style={[styles.quote, { backgroundColor: t.color.surfaceInset, borderLeftColor: t.color.domainSystem }]}>
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textLabel.fontFamily,
                fontSize: 10.5,
                fontWeight: '500',
                letterSpacing: 0.9,
                textTransform: 'uppercase',
              }}
            >
              What you said
            </Text>
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 14,
                lineHeight: 21,
              }}
            >
              {sent.words}
            </Text>
          </View>
          {/* Tell me something else (internal-reference).

              The confirmation used to be terminal: `sent` was set and never
              cleared, so the form was gone for the life of the screen and a
              second report meant navigating away and back — with nothing
              saying so. Reporting is a burst activity; somebody testing a
              build hits four things in ten minutes. Making the second one
              harder than the first is backwards.

              The confirmation STAYS, because it is doing real work: it echoes
              the words back so the sender can see they landed as meant. It
              just gains a door. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSent(null);
              setBody('');
              setKind(null);
              setPhoto(null);
            }}
            style={styles.back}
          >
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 15,
              }}
            >
              Tell me something else
            </Text>
          </Pressable>

          {/* Where it went. C57 forbids a ticket NUMBER and a promised time;
              it does not forbid someone seeing what became of their own words
              — and a report that vanishes is exactly what makes people stop
              sending them. Withheld on the crisis reply: that report is
              deliberately never forwarded, so a status for it would be a lie. */}
          {!sent.crisisReply ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(drawer)/settings/told-ollie')}
              style={styles.back}
            >
              <Text
                style={{
                  color: t.color.textSecondary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontSize: 14,
                }}
              >
                See what you have told me
              </Text>
            </Pressable>
          ) : null}

          {/* The drawing (Run B #22) sends you to the BOARD, not back up the
              stack. router.back() landed on Settings — the screen you came
              through — so the one place the button names was the one place it
              never went (parity ledger PAR-B22). */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(drawer)/board')}
            style={styles.back}
          >
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 15,
              }}
            >
              Back to the board
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: t.color.surfacePage }]}>
      <ScreenHeader title="Tell Ollie" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textBody.fontFamily,
            fontSize: 14,
            lineHeight: 21,
          }}
        >
          In your own words. I read all of it, and I know whose petak it belongs in.
        </Text>

        {/* WHAT KIND, in the writer's own choosing. Three, because a fourth
            starts to feel like a form — and the point of this screen is that
            it is a message, not a ticket. Optional: skipping it sends fine. */}
        <View style={styles.kinds}>
          {REPORT_KINDS.map((k) => {
            const on = kind === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setKind(on ? null : k)}
                style={[
                  styles.kind,
                  {
                    borderColor: on ? t.color.domainSystem : t.color.borderStructure,
                    borderWidth: on ? 2 : 1,
                    backgroundColor: on ? t.color.fillSystem : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontSize: 13,
                    fontWeight: on ? '500' : '400',
                  }}
                >
                  {KIND_LABEL[k]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          placeholder="What happened?"
          placeholderTextColor={t.color.textSecondary}
          maxLength={4000}
          style={[
            styles.input,
            {
              color: t.color.textPrimary,
              borderColor: t.color.borderStructure,
              backgroundColor: t.color.surfaceCard,
              fontFamily: t.typography.textBody.fontFamily,
            },
          ]}
        />

        {/* The picture. Chosen by hand, visible before it is sent, removable
            in one tap — which is the explicit consent C57 asks for, and the
            reason an auto-attached screenshot is still forbidden. */}
        {photo ? (
          <View style={[styles.attached, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 12,
                flex: 1,
              }}
            >
              Attached to this.
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove the picture" onPress={() => setPhoto(null)} hitSlop={10}>
              <Icon name="close" size={18} color={t.color.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => void pick()}
            style={[styles.attach, { borderColor: t.color.borderStructure }]}
          >
            <Icon name="image" size={18} color={t.color.textSecondary} />
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontSize: 14,
              }}
            >
              Show me a picture
            </Text>
          </Pressable>
        )}

        <View style={[styles.footer, { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure }]}>
          <Icon name="lock" size={16} color={t.color.textSecondary} />
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12,
              lineHeight: 18,
              flex: 1,
            }}
          >
            {/* The DRAWN sentence (C63), assembled with the real values. The
                shipped one had drifted to "no photo — attaching one is not
                built yet"; the drawing always said "no photo unless you attach
                one", and as of today that is simply true. */}
            {whatTravels({ version, platform, petak: cameFrom })}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={body.trim().length === 0 || busy}
          onPress={() => void send()}
          style={({ pressed }) => [
            styles.button,
            {
              borderColor: t.color.borderEmphasis,
              backgroundColor: pressed ? t.color.surfaceInset : 'transparent',
              opacity: body.trim().length > 0 && !busy ? 1 : 0.45,
            },
          ]}
        >
          {/* internal-reference — "there is a delay but there is no progress bar so it
              feels like stuck". The send goes photo upload THEN report write,
              two network calls with nothing moving on screen. The button
              shows the work, like MoveInPicker's confirm does. */}
          {busy ? (
            <ActivityIndicator color={t.color.textPrimary} />
          ) : (
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textBody.fontFamily,
                fontWeight: '500',
                fontSize: 15,
              }}
            >
              Tell Ollie
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(drawer)/settings/told-ollie')}
          style={styles.back}
        >
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textBody.fontFamily,
              fontSize: 14,
            }}
          >
            See what you have told me
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // #22: 112px, pixel art — never smoothed on upscale.
  ollie: { width: 112, height: 150 },
  root: { flex: 1 },
  body: { padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 14, minHeight: 160, fontSize: 15, lineHeight: 22 },
  footer: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: 8, padding: 12 },
  button: { borderWidth: 1, borderRadius: 4, paddingVertical: 13, alignItems: 'center' },
  quote: { borderLeftWidth: 2, borderRadius: 4, padding: 12, gap: 5 },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: { borderRadius: 4, paddingVertical: 9, paddingHorizontal: 12, flex: 1, alignItems: 'center' },
  attach: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 13 },
  attached: { flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10 },
  thumb: { width: 48, height: 48, borderRadius: 4 },
  back: { paddingVertical: 13, alignItems: 'center' },
});

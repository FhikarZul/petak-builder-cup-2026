import { useCallback, useRef, useState } from 'react';
import { Modal, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canAcceptLegal, hasReachedEnd } from '../lib/legalGate';
import { useTheme } from '../lib/theme';

// 6 Sep 2026, founder: "the accept T&Cs and Privacy is hard to read, make it as
// a link and they need to scroll to the bottom for both of them before they can
// click accept. don't make it as 2 placeholders, its fucking hard to see!"
//
// It used to stack TWO ScrollViews, each flex:1, inside a modal that also
// carried a title, a subtitle, a checkbox row and a button — so each document
// got about a third of a phone screen, four or five lines of a four-paragraph
// text. Neither could be read in the space it was given.
//
// And the consent was not evidenced: the checkbox was live from the moment the
// screen opened, so both documents could be accepted in one tap with not a
// single line of either having been on screen.
//
// Now: one document at a time, full height, reached by a link — and Accept
// stays disabled until BOTH have been scrolled to the end. That is what makes
// the consent defensible rather than merely recorded.
//
// STILL OPEN and not fixed here: the server stores two timestamps and no
// VERSION, and the text below is hard-coded in the app. Change the wording and
// every existing user stays "accepted" forever, with no record of what they
// agreed to. Versioning needs a column and a migration; it is tracked on the
// ticket rather than smuggled in with a layout change.
// The operator, from canon/company.md (C105, 6 Sep 2026). It used to be named
// NOWHERE in either document — the only identifier in the whole consent screen
// was an email address. Terms from an unnamed party are a weak instrument, a
// privacy policy is expected to identify the data controller (PDPA here, GDPR
// for any EU user), and the stores ask who operates the app.
//
// Naming the operator is a FACT. The SUBSTANCE of what follows is legal
// drafting: it was written to be honest rather than to be enforceable and has
// never been reviewed by a lawyer. That is a standing note in canon/company.md,
// not something to quietly improve here.
const OPERATOR = 'Petak Pte. Ltd. (UEN 202640760C), 152 Beach Road, #23-02, Gateway East, Singapore 189721';

const TERMS_TEXT = [
  `Petak is provided by ${OPERATOR}.`,
  'Petak is a beta product. Neighbours help file what you send them: spending, meals, thoughts, shared bills, and related records.',
  'The service is provided as-is during beta. It may be interrupted, changed, limited, or reset while the product is being tested.',
  'Petak is not emergency support, medical advice, legal advice, financial advice, or a crisis intervention service. If you may hurt yourself or someone else, contact local emergency services or a crisis line now.',
  'You are responsible for what you send and for checking important outputs before acting on them.',
].join('\n\n');

const PRIVACY_TEXT = [
  `${OPERATOR} decides how and why your data is handled, and is who to contact about it.`,
  'Your records are yours. Petak stores account data, photos you send, extracted records, chat messages, attribution fields, and operational logs needed to run the beta.',
  'Photos and messages are processed by service providers under contract so the app can read, route, and file them. Petak does not sell your data.',
  'Analytics events measure signup, app open, onboarding, photo extraction, routing quality, referrals, and feedback. Analytics does not include message text, photos, names, or emails.',
  'You can ask to export or delete your account data by contacting hello@petak.app.',
  'Subscriptions are billed by the App Store or Google Play, not by Petak directly — payment details never reach us.',
].join('\n\n');

type DocKey = 'terms' | 'privacy';
const DOCS: Record<DocKey, { title: string; body: string }> = {
  terms: { title: 'Terms of Service', body: TERMS_TEXT },
  privacy: { title: 'Privacy Policy', body: PRIVACY_TEXT },
};

function DocumentReader({ doc, onRead, onClose }: { doc: DocKey; onRead: () => void; onClose: () => void }) {
  const t = useTheme();
  const reached = useRef(false);

  const markRead = useCallback(() => {
    if (reached.current) return;
    reached.current = true;
    onRead();
  }, [onRead]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (
        hasReachedEnd({
          viewportHeight: layoutMeasurement.height,
          contentHeight: contentSize.height,
          scrollOffset: contentOffset.y,
        })
      ) {
        markRead();
      }
    },
    [markRead],
  );

  // A document shorter than the screen has no scrolling to do, and is therefore
  // already read. Without this the button could never enable on a tall phone.
  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      if (hasReachedEnd({ viewportHeight: height.current, contentHeight: h, scrollOffset: 0 })) markRead();
    },
    [markRead],
  );
  const height = useRef(0);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.color.surfacePage, paddingTop: 56 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingBottom: 14 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={{ fontSize: 17, color: t.color.interactive }}>‹ Back</Text>
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '600', color: t.color.textPrimary }}>{DOCS[doc].title}</Text>
        </View>
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 24 }}
          contentContainerStyle={{ paddingBottom: 48 }}
          scrollEventThrottle={64}
          onScroll={onScroll}
          onLayout={(e) => {
            height.current = e.nativeEvent.layout.height;
          }}
          onContentSizeChange={onContentSizeChange}
        >
          <Text style={{ fontSize: 16, lineHeight: 26, color: t.color.textPrimary }}>{DOCS[doc].body}</Text>
          <Text style={{ marginTop: 28, fontSize: 14, color: t.color.textSecondary }}>You've reached the end.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function LegalAcceptanceModal({
  visible,
  accepting,
  error,
  onAccept,
}: {
  visible: boolean;
  accepting: boolean;
  error: string | null;
  onAccept: () => void;
}) {
  const t = useTheme();
  // internal-reference — "the button to accept is clipped". Android is edge-to-edge
  // by default, so the window draws UNDER the system bar and a flat 24 of
  // padding leaves the accept button under it on any device whose bar is
  // thicker than 24dp. The bottom pad is the inset, never less than 24.
  const insets = useSafeAreaInsets();
  const [read, setRead] = useState<Record<DocKey, boolean>>({ terms: false, privacy: false });
  const [open, setOpen] = useState<DocKey | null>(null);
  const bothRead = canAcceptLegal(read);
  const disabled = !bothRead || accepting;

  const row = (key: DocKey) => (
    <Pressable
      key={key}
      onPress={() => setOpen(key)}
      accessibilityRole="button"
      accessibilityLabel={`Read ${DOCS[key].title}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: t.color.borderStructure,
        backgroundColor: t.color.surfaceCard,
        paddingVertical: 18,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: t.color.interactive }}>{DOCS[key].title}</Text>
        <Text style={{ marginTop: 3, fontSize: 13, color: t.color.textSecondary }}>
          {read[key] ? 'Read' : 'Tap to read — scroll to the end'}
        </Text>
      </View>
      <Text style={{ fontSize: 18, color: read[key] ? t.color.textSecondary : t.color.interactive }}>
        {read[key] ? '✓' : '›'}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View
        style={{
          flex: 1,
          backgroundColor: t.color.surfacePage,
          padding: 24,
          paddingTop: 56,
          paddingBottom: Math.max(insets.bottom, 24),
        }}
      >
        <Text style={{ fontFamily: 'PixelifySans_600SemiBold', fontSize: 34, lineHeight: 38, color: t.color.textPrimary }}>
          Before you enter.
        </Text>
        <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 23, color: t.color.textSecondary }}>
          Two things to read. Both open in full — you can take your time.
        </Text>

        <View style={{ gap: 12, marginTop: 26 }}>
          {row('terms')}
          {row('privacy')}
        </View>

        <View style={{ flex: 1 }} />

        {!bothRead ? (
          <Text style={{ fontSize: 13, lineHeight: 20, color: t.color.textSecondary, marginBottom: 12 }}>
            Read both to continue.
          </Text>
        ) : null}
        {error ? <Text style={{ color: t.color.error, marginBottom: 10 }}>{error}</Text> : null}
        <Pressable
          disabled={disabled}
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          style={{
            height: t.spacing.controlH,
            borderRadius: t.spacing.radiusControl,
            backgroundColor: disabled ? t.color.borderStructure : t.color.interactive,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: disabled ? t.color.textSecondary : t.color.textOnInteractive, fontWeight: '600' }}>
            {accepting ? 'Saving...' : 'I agree to both'}
          </Text>
        </Pressable>
      </View>

      {open ? (
        <DocumentReader
          doc={open}
          onRead={() => setRead((r) => ({ ...r, [open]: true }))}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </Modal>
  );
}

import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('release source contracts', () => {
  it('ships the canonical Petak mark as the Android launcher icon', () => {
    const config = source('../app.config.ts');

    // The launcher uses the full app icon as the fallback and a transparent
    // foreground of the mark as the adaptive foreground, with the Kapur ground
    // behind it.
    expect(config).toContain("icon: '../../packages/assets/logo/app-icon.png'");
    expect(config).toContain("foregroundImage: '../../packages/assets/logo/app-icon-foreground.png'");
    expect(config).toContain("backgroundColor: '#F7F2E7'");
  });

  it('never promises a free photo or free memory on the send-photo sheet', () => {
    const sheet = source('../components/SendPhotoSheet.tsx');

    expect(sheet).toContain('One photo costs one credit');
    expect(sheet).toContain('Free text (fair use)');
    expect(sheet).not.toMatch(/memory to Mira is free|Text is free/);
  });

  it('configures Supabase OAuth for PKCE callbacks', () => {
    expect(source('./supabase.tsx')).toContain("flowType: 'pkce'");
  });

  it('mounts the authenticated foreground event stream at the app root', () => {
    const layout = source('../app/_layout.tsx');

    expect(layout).toContain('<EventStreamBridge');
    expect(layout).toContain('enabled={userId !== null && bootstrappedUserId === userId}');
  });

  it('polls photo state while queued or processing, then stops at a terminal state', () => {
    const card = source('../components/CaptureCard.tsx');
    const home = source('../app/(drawer)/index.tsx');
    const thread = source('./thread.ts');

    expect(card).not.toContain("payload.step === 'accepted' && !payload.failed");
    expect(thread).toContain('photoStateRefetchInterval(query.state.data?.state, query.state.data?.progress?.stage)');
    expect(home).toContain('reconcileLocalCaptures(prev, messages)');
  });

  it('uses feed-head refresh for ordinary new-message and capture paths', () => {
    const home = source('../app/(drawer)/index.tsx');
    const bridge = source('../components/EventStreamBridge.tsx');
    const captureCard = source('../components/CaptureCard.tsx');
    for (const file of [home, bridge, captureCard]) {
      expect(file).not.toContain("invalidateQueries({ queryKey: feedKey() })");
      expect(file).not.toContain("invalidateQueries({ queryKey: ['feed'] })");
    }
    expect(home).toContain('refreshFeedHead(qc)');
    expect(bridge).toContain('refreshFeedHead(queryClient)');
    expect(captureCard).toContain('refreshFeedHead(queryClient)');
    expect(source('./sse.ts')).toContain('refreshFeed?.()');
  });

  it('keeps historical feed rows stable across unrelated home-screen state changes', () => {
    const home = source('../app/(drawer)/index.tsx');
    const rows = source('../components/chat/rows.tsx');

    expect(home).toContain('const reversedRows = useMemo(() => [...rows].reverse(), [rows])');
    expect(home).toContain('data={reversedRows}');
    expect(rows).toContain('export const ServerRow = memo(function ServerRow');
    expect(rows).toContain('useMemo(() => (mine ? [] : parseBlocks(message.blocks)), [message.blocks, mine])');
  });

  it('ships the drawn first-run shell instead of a blank authenticated feed', () => {
    const home = source('../app/(drawer)/index.tsx');
    const drawer = source('../app/(drawer)/_layout.tsx');
    const picker = source('../components/MoveInPicker.tsx');
    const rows = source('../components/chat/rows.tsx');

    expect(home).toContain('navigation.openDrawer()');
    expect(home).toContain("name=\"grid_view\"");
    expect(home).toContain("edges={['top', 'bottom']}");
    expect(drawer).toContain('name="index"');
    expect(picker).toContain('Invite Penny');
    expect(picker).toContain('Invite Mira');
    expect(picker).toContain('Invite Milo');
    expect(picker).toContain('Not yet');
    expect(picker).toContain('Neighbours settle in: you can swap your free petak once every 30 days.');
    expect(picker).toContain('name="expand_less"');
    expect(picker).toContain('name="expand_more"');
    expect(picker).toContain('styles.voiceHead');
    expect(picker).toContain('fontFamily: t.typography.fontDisplay');
    expect(rows).toContain('<View style={styles.moveInCard}>');
    expect(rows).not.toContain('moveInCard: { marginLeft: 40 }');
    expect(rows).toContain('layout.showSpeaker');
    expect(rows).toContain('styles.structuredHeading');
    expect(rows).toMatch(/<QueueNoteCard[^>]*createdAt=\{message.created_at\}/);
  });

  it('applies the shared width policy to actual feed rows without losing swipe-to-reply', () => {
    const home = source('../app/(drawer)/index.tsx');
    const rows = source('../components/chat/rows.tsx');
    const captures = source('../components/CaptureCard.tsx');
    expect(home).toContain('<ChatLayout>');
    expect(home).toContain('padding: CHAT_GUTTER');
    expect(rows).toContain('const layout = chatReplyLayout(blocks, showHead)');
    expect(rows).toContain('maxWidth: widths.assistant');
    expect(rows).toContain('maxWidth: widths.user');
    expect(captures).toContain('maxWidth: widths.user');
    expect(rows).not.toMatch(/maxWidth: (280|264)/);
    expect(captures).not.toContain('maxWidth: 264');
    expect(rows).not.toContain('belowCard: { marginLeft: 40');
    expect(rows).toContain('<SwipeToReference onPin={() => onPin(message)}>');
    // These are wiring checks, not rendered layout or native swipe verification.
  });

  it('passes weekly figures through the early page branch and renders them before draft actions', () => {
    const rows = source('../components/chat/rows.tsx');
    const page = source('../components/PageCard.tsx');
    // Match only the actual PageCard opening tag, not the later bubble renderer.
    expect(rows).toMatch(/<PageCard[^>]*figures=\{figures\}/);
    expect(page).toContain('figures?: readonly FiguresBlock[]');
    expect(page).toContain('<FiguresTable');
    const figuresAt = page.indexOf('{figures.map');
    expect(figuresAt).toBeGreaterThan(page.indexOf('{body}'));
    expect(figuresAt).toBeLessThan(page.indexOf('{actions &&'));
  });

  it('shows a recoverable feed state instead of a blank street', () => {
    const home = source('../app/(drawer)/index.tsx');

    expect(home).toContain('ListEmptyComponent');
    expect(home).toContain('That did not go through. Try again in a moment.');
    expect(home).toContain('feed.refetch()');
  });

  it('keeps the Expo dev launcher out of distributable app dependencies', () => {
    expect(source('../package.json')).not.toContain('expo-dev-client');
    expect(source('../app.config.ts')).not.toContain('expo-dev-client');
  });

  it('imports only the four Google font files used by the app', () => {
    const fonts = source('./fonts.ts');

    expect(fonts).toContain("@expo-google-fonts/plus-jakarta-sans/400Regular");
    expect(fonts).toContain("@expo-google-fonts/plus-jakarta-sans/500Medium");
    expect(fonts).toContain("@expo-google-fonts/pixelify-sans/400Regular");
    expect(fonts).toContain("@expo-google-fonts/pixelify-sans/600SemiBold");
    expect(fonts).not.toMatch(/from '@expo-google-fonts\/(plus-jakarta-sans|pixelify-sans)'/);
  });

  // C14's lexicon is the one rule a reader hits before any other: a neighbour
  // is INVITED and MOVES IN, never added, installed or enabled. The drawer was
  // the single surface out of step (parity ledger PAR-X2, PAR-B05) — the board,
  // the household screen and the wallet all already say "Invite a neighbour".
  // The founder's 1 Sep ruling changed the affordance's SHAPE to a "+" dashed
  // head; it never changed the word.
  it('invites a neighbour to the drawer, never adds one (C14)', () => {
    const drawer = source('../components/DrawerContent.tsx');

    expect(drawer).toContain('Invite a neighbour');
    // Screen readers speak the accessibility label, so it is user-visible copy.
    expect(drawer).not.toMatch(/(accessibilityLabel="|>\s*)Add a neighbour/);
  });

  // The role word beside a neighbour's name is a fixed set (CLAUDE.md): Mira is
  // "mind". "reflection" is the domain word wearing a different coat, which is
  // exactly what the rule exists to stop.
  it('gives Mira the domain word "mind", never "reflection" (C14)', () => {
    const drawer = source('../components/DrawerContent.tsx');

    expect(drawer).toMatch(/id === 'mira'\) return 'mind'/);
    expect(drawer).not.toContain("'reflection'");
  });

  // C60: no billing exists, so no surface may print a subscription price — the
  // household screen already refuses to, and the drawer must not undercut it by
  // quoting a number nothing can charge.
  it('never quotes a street price while no billing exists (C60)', () => {
    const drawer = source('../components/DrawerContent.tsx');

    expect(drawer).not.toMatch(/S\$\d/);
  });

  // Run B #22 draws Ollie's 112px sprite above "Told." The confirmation shipped
  // without it (parity ledger PAR-B22). It is withheld on the crisis reply: a
  // cheerful sprite above "Please get help now." would be the wrong register.
  it('puts Ollie on the Tell Ollie confirmation, but never above a crisis reply (Run B #22)', () => {
    const sent = source('../app/(drawer)/settings/tell-ollie.tsx');

    expect(sent).toContain('sprites/ollie.png');
    expect(sent).toMatch(/!sent\.crisisReply \?[\s\S]{0,200}ollieFull/);
  });

  // The local capture card dropped the caption. The SERVER twin renders it
  // (rows.tsx:524, BubbleBody), so on a normal send the caption appears only
  // once the twin lands — and for a byte-duplicate, where no twin is ever
  // created, it never appears at all. CLAUDE.md: "Photo messages are captioned
  // cards (caption + time inside the bubble)."
  it('keeps the caption on the local photo card, not just the server twin', () => {
    const card = source('../components/CaptureCard.tsx');

    expect(card).toMatch(/payload\.caption\.length > 0/);
    expect(card).toContain('captionLine');
  });

  // PAR-B04: Penny's log rows now expand onto their line items. The design
  // rule worth pinning is the ABSENCE — the chevron exists only when there is
  // something behind it, so a typed entry (C20) and a receipt whose extraction
  // found no items both stay flat. An affordance that opens onto nothing is
  // worse than no affordance.
  it('shows the expand chevron only when a row has items behind it (Run B #4)', () => {
    const penny = source('../app/(drawer)/dashboards/penny.tsx');

    expect(penny).toContain('entryBreakdown(e.payload)');
    expect(penny).toContain('disabled={!breakdown}');
    expect(penny).toMatch(/breakdown \?[\s\S]{0,160}expand_less/);
  });

  // Run A #8 draws a download icon. It shipped absent, justified by a comment
  // claiming the share sheet already saves — which is not reliable here, since
  // Share is passed a presigned REMOTE url that iOS treats as a link. A camera
  // photo lives nowhere but Petak (launchCameraAsync has no saveToPhotos), so
  // this is the only way one gets out. Founder ruled BUILD IT, 4 Sep.
  it('lets you save a photo you sent, write-only (Run A #8)', () => {
    const rows = source('../components/chat/rows.tsx');
    const config = source('../app.config.ts');

    expect(rows).toContain('savePhotoToLibrary');
    expect(rows).toContain('accessibilityLabel="Save to your photos"');
    // The stale justification must not survive the fix that disproves it.
    expect(rows).not.toContain('The share sheet already offers "Save Image"');
    // WRITE only: reading the library is expo-image-picker's separate prompt.
    expect(config).toContain('savePhotosPermission');
    expect(config).not.toContain('readPhotosPermission');

    // In SDK 57 saveToLibraryAsync imported from the package ROOT is a
    // deprecation stub that THROWS at runtime. It typechecks, so only a device
    // catches it — and the failure looks like a permanent "that did not save".
    // The legacy subpath is what the deprecation message names.
    const save = source('./savePhoto.ts');
    expect(save).toContain("import('expo-media-library/legacy')");
    expect(save).not.toMatch(/import\('expo-media-library'\)/);
  });

  // Run C #74's no-objective card is drawn as Milo's full sprite on his 12%
  // domain fill with the petak grid, a Pixelify heading, and HIS OWN VOICE.
  // It shipped as a plain card with a forum icon, third-person copy, and no
  // sprite (parity ledger PAR-C74).
  it('gives the no-objective card Milo, his fill, and his voice (Run C #74)', () => {
    const card = source('../components/dashboard/NoObjective.tsx');

    expect(card).toContain('sprites/milo.png');
    expect(card).toContain('fillBody');
    expect(card).toContain('<GridWallpaper />');
    // The drawing says "I am counting", not "He is counting" — the card is
    // Milo speaking, which is what the forum icon was standing in for.
    expect(card).toContain('I am counting everything you send');
    expect(card).not.toContain('He is counting');
    // The info line the card shipped without.
    expect(card).toContain('Numbers without a line to cross');
    // Pixelify is display-only and never below 24px (C04).
    expect(card).toMatch(/fontDisplay[\s\S]{0,80}fontSize: 24/);
  });

  // Run C #76 draws the picked card as ONE bordered, padded container holding a
  // dimmed image and, inside it, the state row — icon + label left, time right.
  // The card shipped with the row OUTSIDE the well's border, the time glued to
  // the label, and no dim at all (parity ledger PAR-C76).
  it('dims the picked photo and keeps the state row inside the card (Run C #76)', () => {
    const card = source('../components/CaptureCard.tsx');

    // The dim rides the IMAGE and only while sending — a sent photo is not faded.
    expect(card).toMatch(/state === 'picked' \? 0\.55 : 1/);
    expect(card).toContain('captureCard');
    // Label left, time right — the drawing's space-between, not a joined string.
    expect(card).toMatch(/justifyContent: 'space-between'/);
    expect(card).not.toMatch(/Sending… \$\{hhmm\(createdAt\)\}/);
  });

  // Run C #61's footer is drawn as a 56px photo thumbnail, the line, and
  // open_in_full — "the photo is kept as it was read". The sheet shipped with
  // the line and an INERT icon, because no photo reference reached it: the
  // trail endpoint serves none. The entry card knows the entry's own photo, so
  // the id and the viewer handler come from there (parity ledger PAR-C61).
  it('shows the kept photo in the What-changed footer, and opens it (Run C #61)', () => {
    const strip = source('../components/HonestyStrip.tsx');
    const card = source('../components/EntryCard.tsx');
    const rows = source('../components/chat/rows.tsx');

    expect(strip).toContain('trailThumb');
    expect(strip).toMatch(/width: 56, height: 56/);
    // The icon must sit inside the same Pressable as the thumbnail — an
    // open_in_full that does nothing is what this fix exists to remove.
    expect(strip).toMatch(/onPress=\{[\s\S]{0,120}onOpenPhoto/);
    // The id and handler are threaded from the feed, not invented here.
    expect(card).toContain('onOpenPhoto');
    expect(rows).toContain('<EntryCard block={b} t={t} onOpenPhoto={onOpenPhoto} />');
  });

  // C57 entry two, drawn as Run B #20: "one quiet line at the foot of the Petak
  // view, under the last card. Not a FAB, no accent fill." The founder's note on
  // the drawing is explicit — hairline-separated, secondary text, Ollie's 24px
  // head, the chevron carries the tap, "No Teal fill: this is a door, not a
  // state." The board had no such line at all (parity ledger PAR-B20).
  it('offers Tell Ollie at the foot of the board, as a door not a state (C57)', () => {
    const board = source('../app/(drawer)/board.tsx');

    expect(board).toContain('Something off? Tell Ollie');
    expect(board).toContain("router.push('/(drawer)/settings/tell-ollie')");
    // A domain accent would make it read as a state. The row carries no fill.
    expect(board).not.toMatch(/tellOllie[\s\S]{0,400}backgroundColor/);
  });

  // Run B #22 sends you to the BOARD. router.back() landed on Settings — the
  // screen you came through — so the one destination the button names was the
  // one it never reached (parity ledger PAR-B22).
  it('sends "Back to the board" to the board, not up the stack (Run B #22)', () => {
    const sent = source('../app/(drawer)/settings/tell-ollie.tsx');

    expect(sent).toMatch(/router\.replace\('\/\(drawer\)\/board'\)/);
    expect(sent).not.toContain('onPress={() => router.back()}');
  });

  // Found 5 Sep 2026 by the founder. The neighbour picker walked ONE way: a
  // next chevron with no previous, and no gesture at all — so going back meant
  // cycling forward twice through a carousel of three. A row of faces invites a
  // swipe, and not answering one reads as broken.
  it('the neighbour picker can be browsed BOTH ways, by arrow and by swipe', () => {
    const invite = source('../app/(drawer)/invite.tsx');
    expect(invite).toContain('chevron_left');
    expect(invite).toContain('chevron_right');
    expect(invite).toContain('Previous neighbour'); // the a11y label, not just a glyph
    expect(invite).toContain('GestureDetector');
    expect(invite).toContain('browseDirection');
  });
});

// Pure navigation decisions have behavioral tests; these contracts ensure the
// native screen actually uses them. Native scroll placement still needs QA.
describe('Release48 board answer wiring', () => {
  it('resolves against full history and temporarily reveals the original through clear-chat', () => {
    const home = source('../app/(drawer)/index.tsx');
    expect(home).toContain('boardVisibleMessages(messages, clearedAt, boardTarget)');
    expect(home).toMatch(/boardNavigationStep\(\{[\s\S]*?messages,/);
    expect(home).toContain('boardAnswerRequest(params.answer, consumedAnswer.current)');
    expect(home).toContain('pinReference(step.message, step.message.neighbour)');
    expect(home).toContain("Alert.alert('From the board', BOARD_ORIGIN_UNAVAILABLE)");
  });

  it('bounds scroll retries and rechecks the current target and row before retrying', () => {
    const home = source('../app/(drawer)/index.tsx');
    expect(home).toContain('boardScrollRecoveryOffset(index, averageItemLength, scrollAttempts.current++)');
    expect(home).toContain('latest.target !== target || latest.index === null');
    expect(home).toContain('scrollToIndex({ index: latest.index');
    expect(home).toContain('clearTimeout(scrollTimer.current)');
  });

  it('ends the board navigation before pinning a manually selected reply', () => {
    const home = source('../app/(drawer)/index.tsx');
    expect(home).toMatch(/const onPinFeedMessage = useCallback\([\s\S]*?leaveBoard\(\);\s*pinReference\(message, \(message as FeedMessage\).neighbour\)/);
    expect(home).toContain('leaveBoardNavigation({ setBoardTarget, setPendingTarget, scrollPending, scrollTimer, currentBoardScroll })');
  });

  it('refuses to leave the board when the task has no original message', () => {
    const board = source('../app/(drawer)/board.tsx');
    expect(board).toContain('validBoardOrigin(task.origin_message_id)');
    expect(board).toMatch(/if \(!origin\) \{[\s\S]*?Alert.alert\('From the board', BOARD_ORIGIN_UNAVAILABLE\);[\s\S]*?return;/);
  });
});


describe('board and quote retry entry wiring', () => {
  it('starts board routes and quote taps through the same fresh navigation attempt', () => {
    const home = source('../app/(drawer)/index.tsx');
    expect(home).toContain('beginMessageJump(request.target)');
    expect(home).toContain('beginMessageJump(messageId)');
    expect(home).toContain('beginMessageNavigation(target, {');
  });

  it('uses the deliberate scroll policy independently of automatic lookup errors', () => {
    const home = source('../app/(drawer)/index.tsx');
    expect(home).toMatch(/onEndReached=\{\(\) => \{\s*if \(canPageHistoryFromScroll\(/);
  });
});

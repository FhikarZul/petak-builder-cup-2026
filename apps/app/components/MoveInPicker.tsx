import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import pennyBody from '../../../packages/assets/sprites/penny.png';
import miraBody from '../../../packages/assets/sprites/mira.png';
import miloBody from '../../../packages/assets/sprites/milo.png';
import { Icon } from './Icon';
import { BETA_OPEN_STREET } from '../lib/beta';
import { NEIGHBOURS, type NeighbourId } from '../lib/neighbours';
import type { Theme } from '../lib/theme';

export type MoveInId = Extract<NeighbourId, 'penny' | 'mira' | 'milo'>;

export const PROFILE: Record<
  MoveInId,
  {
    blurb: string;
    long: string;
    does: string[];
    quotes: string[];
    voice: string;
    sees: string;
    never: string;
    inviteLabel: string;
    subject: 'She' | 'He';
    possessive: 'her' | 'his';
    heroGround: 'fillMoney' | 'fillMind' | 'fillBody';
    body: number;
  }
> = {
  penny: {
    blurb: 'Files every receipt. Never judges.',
    long: 'Keeps the books for the whole shophouse. Dry, exact, never scolds.',
    does: [
      'Files receipts and photos into expenses',
      'Tracks spending by week, month and category',
      'Handles any currency, no setup',
      'Catches duplicates and asks which one counts',
    ],
    quotes: ['"Penny, how much this month?"', '"Split last night\'s dinner three ways"'],
    voice: 'Third bubble tea this week. Not judging. Just counting.',
    sees: 'Your expenses, receipts and budgets',
    never: 'Your journal or your health',
    inviteLabel: 'Invite Penny',
    subject: 'She',
    possessive: 'her',
    heroGround: 'fillMoney',
    body: pennyBody,
  },
  mira: {
    blurb: 'Keeps your words. Asks, never tells.',
    long: 'Holds the journal. Gentle, unhurried, remembers what you said in March.',
    does: [
      'Keeps every thought, word for word',
      'Cleans it up without changing your voice',
      'Writes one reflection each night',
      'Finds the day you are thinking of',
    ],
    quotes: ['"Mira, what did I write in March?"', '"I keep thinking about my sister"'],
    voice: 'You wrote something similar in March. Want to see it?',
    sees: 'Your journal and what you tell her',
    never: 'Your money or your health',
    inviteLabel: 'Invite Mira',
    subject: 'She',
    possessive: 'her',
    heroGround: 'fillMind',
    body: miraBody,
  },
  milo: {
    blurb: 'Counts your meals. Coaches your next move.',
    long: 'Reads a plate and tells you the number. Blunt, never preachy.',
    does: [
      'Reads a plate and counts it',
      'Tracks sleep, training and weight',
      'Gives you the number, not a lecture',
      'Remembers what you ate last Tuesday',
    ],
    quotes: ['"Milo, how much protein today?"', '"a photo of dinner, nothing typed"'],
    voice: 'About 640 kcal, 21g protein. Room for dinner.',
    sees: 'Your meals, sleep and training',
    never: 'Your money or your journal',
    inviteLabel: 'Invite Milo',
    subject: 'He',
    possessive: 'his',
    heroGround: 'fillBody',
    body: miloBody,
  },
};

export function MoveInPicker({
  neighbours,
  residents,
  onMoveIn,
  t,
}: {
  neighbours: MoveInId[];
  residents: string[];
  onMoveIn: (neighbour: MoveInId) => Promise<void>;
  t: Theme;
}) {
  const residentSet = useMemo(() => new Set(residents), [residents]);
  const [expanded, setExpanded] = useState<MoveInId>(neighbours[0] ?? 'penny');
  const [confirming, setConfirming] = useState<MoveInId | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Beta (3 Sep 2026): on QA builds the whole street moves in free — the
  // subscription gate isn't built, so the free-petak limit doesn't apply.
  const firstPetakTaken = residentSet.size > 0 && !BETA_OPEN_STREET;

  const confirm = async () => {
    if (!confirming || moving) return;
    setMoving(true);
    setError(null);
    try {
      await onMoveIn(confirming);
      setConfirming(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not invite this neighbour.');
    } finally {
      setMoving(false);
    }
  };

  return (
    <>
      <View style={styles.list}>
        {neighbours.map((id) => {
          const neighbour = NEIGHBOURS[id];
          const profile = PROFILE[id];
          const selected = residentSet.has(id);
          const open = expanded === id && !selected;
          return (
            <View
              key={id}
              style={[
                styles.card,
                {
                  backgroundColor: t.color[profile.heroGround],
                  borderColor: selected || open ? t.color.borderEmphasis : t.color.borderStructure,
                  borderWidth: selected || open ? 2 : 1,
                  opacity: firstPetakTaken && !selected ? 0.72 : 1,
                },
              ]}
            >
              {open ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Close ${neighbour.name}`}
                    onPress={() => setExpanded(id)}
                    style={styles.hero}
                  >
                    <Image
                      source={profile.body}
                      style={styles.heroSprite}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                    <View style={styles.heroCopy}>
                      <View style={styles.heroTitle}>
                        <Text
                          style={[
                            styles.name,
                            { color: t.color.textPrimary, fontFamily: t.typography.fontText },
                          ]}
                        >
                          {neighbour.name}
                        </Text>
                        <Icon name="expand_less" size={20} color={t.color.textSecondary} />
                      </View>
                      <Text
                        style={[
                          styles.long,
                          { color: t.color.textSecondary, fontFamily: t.typography.fontText },
                        ]}
                      >
                        {profile.long}
                      </Text>
                    </View>
                  </Pressable>
                  <View
                    style={[
                      styles.details,
                      {
                        backgroundColor: t.color.surfaceCard,
                        borderTopColor: t.color.borderStructure,
                      },
                    ]}
                  >
                    <Label t={t}>What {id === 'milo' ? 'he' : 'she'} does</Label>
                    <View style={styles.doesList}>
                      {profile.does.map((line) => (
                        <Text
                          key={line}
                          style={[
                            styles.detailLine,
                            { color: t.color.textPrimary, fontFamily: t.typography.fontText },
                          ]}
                        >
                          {line}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.quotes}>
                      {profile.quotes.map((line) => (
                        <Text
                          key={line}
                          style={[
                            styles.quote,
                            {
                              color: t.color.textPrimary,
                              backgroundColor: t.color.surfaceInset,
                              borderColor: t.color.borderStructure,
                              fontFamily: t.typography.fontText,
                            },
                          ]}
                        >
                          {line}
                        </Text>
                      ))}
                    </View>
                    <Label t={t}>{id === 'milo' ? 'His' : 'Her'} voice</Label>
                    <View style={styles.voiceRow}>
                      <Image
                        source={neighbour.head}
                        style={styles.voiceHead}
                        accessibilityIgnoresInvertColors
                      />
                      <Text
                        style={[
                          styles.voice,
                          {
                            color: t.color.textPrimary,
                            borderLeftColor: t.color[neighbour.domain],
                            backgroundColor: t.color.surfaceInset,
                            fontFamily: t.typography.fontText,
                          },
                        ]}
                      >
                        {profile.voice}
                      </Text>
                    </View>
                    <Label t={t}>What {id === 'milo' ? 'he' : 'she'} can see</Label>
                    <View style={styles.visibilityRow}>
                      <View
                        style={[
                          styles.visibilityCol,
                          {
                            backgroundColor: t.color.surfacePage,
                            borderColor: t.color.borderStructure,
                          },
                        ]}
                      >
                        <View style={[styles.pane, { backgroundColor: t.color[neighbour.domain] }]} />
                        <Text style={[styles.visibilityTitle, { color: t.color.textPrimary, fontFamily: t.typography.fontText }]}>Sees</Text>
                        <Text style={[styles.small, { color: t.color.textSecondary, fontFamily: t.typography.fontText }]}>{profile.sees}</Text>
                      </View>
                      <View
                        style={[
                          styles.visibilityCol,
                          {
                            backgroundColor: t.color.surfacePage,
                            borderColor: t.color.borderStructure,
                          },
                        ]}
                      >
                        <View style={[styles.pane, { backgroundColor: t.color.surfaceInset, borderColor: t.color.borderEmphasis }]} />
                        <Text style={[styles.visibilityTitle, { color: t.color.textPrimary, fontFamily: t.typography.fontText }]}>Never</Text>
                        <Text style={[styles.small, { color: t.color.textSecondary, fontFamily: t.typography.fontText }]}>{profile.never}</Text>
                      </View>
                    </View>
                  </View>
                  {!firstPetakTaken ? (
                    <View
                      style={[styles.inviteWrap, { backgroundColor: t.color.surfaceCard }]}
                    >
                      <Text
                        style={[
                          styles.freeLine,
                          { color: t.color.textPrimary, fontFamily: t.typography.fontText },
                        ]}
                      >
                        Free as your first neighbour
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setError(null);
                          setConfirming(id);
                        }}
                        style={[styles.invite, { backgroundColor: t.color.interactive }]}
                      >
                        <Text
                          style={[
                            styles.inviteText,
                            {
                              color: t.color.textOnInteractive,
                              fontFamily: t.typography.fontText,
                            },
                          ]}
                        >
                          {profile.inviteLabel}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${neighbour.name}`}
                  onPress={() => setExpanded(id)}
                  style={styles.summary}
                >
                  <Image source={neighbour.head} style={styles.head} accessibilityIgnoresInvertColors />
                  <View style={styles.grow}>
                    <Text
                      style={[
                        styles.name,
                        { color: t.color.textPrimary, fontFamily: t.typography.fontText },
                      ]}
                    >
                      {`${neighbour.name} · ${neighbour.roleWord}`}
                    </Text>
                    <Text
                      style={[
                        styles.small,
                        { color: t.color.textSecondary, fontFamily: t.typography.fontText },
                      ]}
                    >
                      {profile.blurb}
                    </Text>
                  </View>
                  {selected ? (
                    <Text style={[styles.moved, { color: t.color.textPrimary, backgroundColor: t.color.surfaceInset, borderColor: t.color.borderStructure, fontFamily: t.typography.fontDisplay }]}>Moved in</Text>
                  ) : (
                    <View style={styles.viewAction}>
                      <Text style={[styles.view, { color: t.color.interactive, fontFamily: t.typography.fontText }]}>View</Text>
                      <Icon name="expand_more" size={20} color={t.color.textSecondary} />
                    </View>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <Modal visible={confirming !== null} transparent animationType="fade" onRequestClose={() => !moving && setConfirming(null)}>
        <View style={styles.backdrop}>
          {confirming ? (
            <View style={[styles.modal, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderEmphasis }]}>
              <View
                style={[
                  styles.modalHero,
                  {
                    backgroundColor: t.color[PROFILE[confirming].heroGround],
                    borderBottomColor: t.color.borderStructure,
                  },
                ]}
              >
                <Image
                  source={PROFILE[confirming].body}
                  style={styles.bodySprite}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
                <Text
                  style={[
                    styles.modalTitle,
                    { color: t.color.textPrimary, fontFamily: t.typography.fontDisplay },
                  ]}
                >
                  {`${NEIGHBOURS[confirming].name} moves in?`}
                </Text>
              </View>
              <Text
                style={[
                  styles.modalBody,
                  { color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily },
                ]}
              >
                {`${PROFILE[confirming].subject} takes the free petak — ${PROFILE[confirming].possessive} skills, dashboard and photo filing, all included. Neighbours settle in: you can swap your free petak once every 30 days.`}
              </Text>
              {error ? <Text style={[styles.error, { color: t.color.error }]}>{error}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={moving}
                  onPress={confirm}
                  style={[
                    styles.confirm,
                    { backgroundColor: t.color.interactive, opacity: moving ? 0.65 : 1 },
                  ]}
                >
                  {moving ? (
                    <ActivityIndicator color={t.color.textOnInteractive} />
                  ) : (
                    <Text
                      style={[
                        styles.modalActionText,
                        {
                          color: t.color.textOnInteractive,
                          fontFamily: t.typography.fontDisplay,
                        },
                      ]}
                    >
                      {PROFILE[confirming].inviteLabel}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={moving}
                  onPress={() => setConfirming(null)}
                  style={[styles.cancel, { borderColor: t.color.interactive }]}
                >
                  <Text
                    style={[
                      styles.modalActionText,
                      { color: t.color.interactive, fontFamily: t.typography.fontDisplay },
                    ]}
                  >
                    Not yet
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function Label({ children, t }: { children: ReactNode; t: Theme }) {
  return (
    <Text
      style={[
        styles.label,
        { color: t.color.textSecondary, fontFamily: t.typography.textLabel.fontFamily },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, marginTop: 10 },
  card: { borderRadius: 0, overflow: 'hidden' },
  summary: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  head: { width: 44, height: 44, borderRadius: 2 },
  grow: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '500' },
  small: { fontSize: 12.5, lineHeight: 18 },
  view: { fontSize: 13, fontWeight: '500' },
  viewAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moved: {
    fontSize: 18,
    lineHeight: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 4,
  },
  hero: { minHeight: 116, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12 },
  heroSprite: { width: 92, height: 112 },
  heroCopy: { flex: 1, minWidth: 0, paddingBottom: 10 },
  heroTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  details: { borderTopWidth: 1, padding: 12, gap: 12 },
  doesList: { gap: 4 },
  long: { fontSize: 13, lineHeight: 19.5 },
  label: { fontSize: 11, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' },
  detailLine: { fontSize: 13, lineHeight: 19.5 },
  quotes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quote: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13 },
  voiceRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  voiceHead: { width: 32, height: 32 },
  voice: { flex: 1, borderLeftWidth: 2, padding: 9, fontSize: 13, lineHeight: 19.5 },
  visibilityRow: { flexDirection: 'row', gap: 8 },
  visibilityCol: { flex: 1, minHeight: 100, borderWidth: 1, padding: 9 },
  pane: { width: 12, height: 12, borderWidth: 1, marginBottom: 6 },
  visibilityTitle: { fontSize: 13, fontWeight: '500' },
  inviteWrap: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  freeLine: { fontSize: 13 },
  invite: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  inviteText: { fontSize: 15, fontWeight: '500' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(32,36,46,0.48)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: { borderWidth: 2, borderRadius: 4, overflow: 'hidden' },
  modalHero: {
    minHeight: 126,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  bodySprite: { width: 96, height: 118 },
  modalTitle: { flex: 1, paddingBottom: 18, fontSize: 26, lineHeight: 30 },
  modalBody: { padding: 16, fontSize: 14.5, lineHeight: 23 },
  error: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 13 },
  modalActions: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  confirm: { height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  cancel: { height: 48, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  modalActionText: { fontSize: 24, lineHeight: 30, fontWeight: '400' },
});

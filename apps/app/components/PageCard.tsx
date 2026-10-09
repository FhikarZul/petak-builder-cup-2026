// App slice 2 (plan §4, mirror #65–67) — page vs draft vs bubble, enforced
// by GEOMETRY, not convention: a page is finished writing addressed to you
// (full thread width, Susu-class card ground, no bubble tail, the 2px
// domain rule left, a DATELINE instead of a timestamp, Pixelify title, body
// 15/1.75); a draft is the same geometry not yet filed (dashed Batu edge,
// the `Draft · not filed` chip, File it / Change / Bin it when the block
// carries actions, the exact caption). No modal, no "new" dot, no unread
// count, never expires, never re-surfaced.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { emotionChip } from '../lib/dashboard';
import { dayLabel } from '../lib/honesty';
import { draftDateline } from '../lib/time';
import type { Neighbour } from '../lib/neighbours';
import type { FiguresBlock } from '../lib/blocks';
import { FiguresTable } from './chat/FiguresTable';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';

/** Buttons ride a sibling task_actions block — a tap sends the label as an
 * ordinary reply (#70). Never Pixelify on controls (C04). */
export interface PageActions {
  labels: string[];
  /** false when the task is known closed — the actions render inert. */
  open: boolean;
  /** QA-07/08: the task_id travels with the tap so the server answers the right task. */
  taskId?: string;
  onSend: (label: string, taskId?: string) => void;
}

/** Page datelines arrive as ISO days ("2026-08-25") — format them as a
 * date ("Written 25 Aug") without a timezone shift. The DRAFT's dateline is an
 * ISO week and goes through draftDateline() instead. The mirror's fuller
 * phrasing ("Written 02:14 · held until you were up") needs a richer server
 * dateline — flagged in the delta, never improvised. */
function pageDateline(dateline: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateline);
  if (!m) return `Written ${dateline}`;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `Written ${dayLabel(d).replace(/^\S+\s/, '')}`;
}

export function PageCard({
  kind,
  title,
  dateline,
  emotion,
  body,
  neighbour,
  actions,
  figures = [],
  t,
}: {
  kind: 'page' | 'draft';
  title: string | null;
  dateline: string;
  /** C95 — the day's or week's feeling, COUNTED from its entries. Sits with
   *  the dateline because it is a fact ABOUT the period, like the date is. */
  emotion?: string | null;
  body: string;
  neighbour: Neighbour;
  actions?: PageActions;
  figures?: readonly FiguresBlock[];
  t: Theme;
}) {
  const draft = kind === 'draft';
  // Icon and word live together in the dateline rather than as a chip: a
  // feeling is not a status, and a badge on a reflection would make one week
  // look like a warning (C03/C06).
  const mood = emotionChip(emotion ?? null);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.color.surfaceCard,
          borderColor: draft ? t.color.borderEmphasis : t.color.borderStructure,
          borderLeftColor: t.color[neighbour.domain],
          borderStyle: draft ? 'dashed' : 'solid',
        },
      ]}
    >
      {draft ? (
        <View style={[styles.draftHeader, { borderBottomColor: t.color.borderStructure }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="draft" size={14} color={t.color.textSecondary} />
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textLabel.fontFamily,
                fontSize: 11,
                letterSpacing: 0.9,
                textTransform: 'uppercase',
              }}
            >
              Draft · not filed
            </Text>
          </View>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 11.5,
            }}
          >
            {draftDateline(dateline)}
          </Text>
        </View>
      ) : (
        <View style={[styles.pageHeader, { borderBottomColor: t.color.borderStructure }]}>
          <Image
            source={neighbour.head}
            style={[styles.head, { borderColor: t.color.borderStructure }]}
          />
          <View style={{ flex: 1, gap: 1 }}>
            <Text
              style={{
                color: t.color.textPrimary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontWeight: '500',
                fontSize: 13,
              }}
            >
              {neighbour.name}
              <Text style={{ color: t.color.textSecondary, fontWeight: '400' }}>
                {` · ${neighbour.roleWord}`}
              </Text>
            </Text>
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textSmall.fontFamily,
                fontSize: 11.5,
              }}
            >
              {pageDateline(dateline)}
              {mood ? ` · ${mood.label}` : ''}
            </Text>
          </View>
        </View>
      )}

      {title ? (
        <Text
          style={{
            paddingHorizontal: 16,
            paddingTop: draft ? 14 : 16,
            paddingBottom: 2,
            color: t.color.textPrimary,
            fontFamily: t.typography.fontDisplay,
            fontSize: 24,
            lineHeight: 30,
          }}
        >
          {title}
        </Text>
      ) : null}

      <Text
        style={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: actions || draft ? 0 : 16,
          color: t.color.textPrimary,
          fontFamily: t.typography.textBody.fontFamily,
          fontSize: 15,
          lineHeight: 26, // 15/1.75
        }}
      >
        {body}
      </Text>

      {figures.length > 0 ? (
        <View style={styles.figures}>
          {figures.map((block, index) => <FiguresTable key={index} block={block} t={t} />)}
        </View>
      ) : null}

      {actions && actions.labels.length > 0 ? (
        draft ? (
          <View style={styles.draftActions}>
            {actions.labels.map((label, i) => (
              <Pressable
                key={label}
                disabled={!actions.open}
                onPress={() => actions.onSend(label, actions.taskId)}
                accessibilityRole="button"
                style={[
                  styles.draftButton,
                  i === 0
                    ? { flex: 1, backgroundColor: t.color.interactive }
                    : i === 1
                      ? { width: 96, borderWidth: 2, borderColor: t.color.interactive }
                      : { width: 88, borderWidth: 1, borderColor: t.color.borderStructure },
                  !actions.open && { opacity: 0.5 },
                ]}
              >
                <Text
                  style={{
                    color:
                      i === 0
                        ? t.color.textOnInteractive
                        : i === 1
                          ? t.color.interactive
                          : t.color.textSecondary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 15,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[styles.pageActions, { borderTopColor: t.color.borderStructure }]}>
            {actions.labels.map((label) => (
              <Pressable
                key={label}
                disabled={!actions.open}
                onPress={() => actions.onSend(label, actions.taskId)}
                accessibilityRole="button"
                style={!actions.open ? { opacity: 0.5 } : undefined}
              >
                <Text
                  style={{
                    color: t.color.interactive,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 14,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {draft ? (
        <Text
          style={{
            paddingHorizontal: 16,
            paddingBottom: 14,
            paddingTop: actions ? 0 : 12,
            color: t.color.textSecondary,
            fontFamily: t.typography.textSmall.fontFamily,
            fontSize: 12.5,
            lineHeight: 19,
          }}
        >
          Nothing here is on your record yet. Leave it and it stays a draft.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  figures: { marginHorizontal: 16, marginVertical: 12, gap: 8 },
  card: { borderWidth: 1, borderLeftWidth: 2 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  head: { width: 32, height: 32, borderWidth: 1 },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  draftActions: { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 10 },
  draftButton: { height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  pageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: 1,
    marginTop: 14,
  },
});

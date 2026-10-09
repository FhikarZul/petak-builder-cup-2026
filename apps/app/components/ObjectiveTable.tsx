// App slice 2 (plan §6, mirror #73) — the objective table in-thread: a
// changed objective re-derives every target and SHOWS ITS WORKING (C11),
// and it joins the record-honesty family (a target that quietly moved is a
// target you cannot trust). old-beside-new rows render the old column ONLY
// when the block carries it. A first derivation has no changed marker or
// amendment strip because there is nothing it used to be (C88).
import { StyleSheet, Text, View } from 'react-native';
import type { ObjectiveTableBlock } from '../lib/blocks';
import { hhmm, objectiveStripText } from '../lib/honesty';
import type { Theme } from '../lib/theme';
import { HonestyStrip } from './HonestyStrip';
import { Icon } from './Icon';

const ROW_ORDER = ['calories', 'protein_g', 'carbs_g', 'fat_g'] as const;

function rowLabel(key: string): string {
  switch (key) {
    case 'calories':
      return 'Daily energy';
    case 'protein_g':
      return 'Protein';
    case 'carbs_g':
      return 'Carbs';
    case 'fat_g':
      return 'Fat';
    default:
      return key.replace(/_/g, ' ');
  }
}

function valueLabel(key: string, value: unknown): string | null {
  if (typeof value !== 'number') return null;
  if (key.endsWith('_g')) return `${value} g`;
  return value.toLocaleString('en-US');
}

export function ObjectiveTable({
  block,
  createdAt,
  t,
}: {
  block: ObjectiveTableBlock;
  /** The reply's timestamp — the strip's "changed <time>". */
  createdAt: string;
  t: Theme;
}) {
  const newRows = block.new ?? {};
  const keys = ROW_ORDER.filter((k) => newRows[k] != null);
  const extraKeys = Object.keys(newRows).filter(
    (k) => !(ROW_ORDER as readonly string[]).includes(k) && newRows[k] != null,
  );
  const allKeys = [...keys, ...extraKeys];
  const oldObjective =
    block.old && typeof block.old.objective === 'string' ? block.old.objective : null;
  const amendmentText = objectiveStripText(oldObjective, hhmm(createdAt));

  return (
    <View
      style={[
        styles.card,
        { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceCard },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: t.color.borderStructure }]}>
        <Text
          style={{ color: t.color.textPrimary, fontFamily: t.typography.fontDisplay, fontSize: 24 }}
        >
          New targets
        </Text>
        {block.old ? (
          <View style={[styles.changedChip, { borderColor: t.color.borderStructure }]}>
            <Icon name="edit_note" size={13} color={t.color.textSecondary} />
            <Text
              style={{
                color: t.color.textSecondary,
                fontFamily: t.typography.textLabel.fontFamily,
                fontSize: 11,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
              }}
            >
              changed
            </Text>
          </View>
        ) : null}
      </View>

      <View>
        {allKeys.map((key, i) => {
          const next = valueLabel(key, newRows[key]);
          const prev = block.old ? valueLabel(key, block.old[key]) : null;
          return (
            <View
              key={key}
              style={[
                styles.row,
                i < allKeys.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: t.color.borderStructure,
                },
              ]}
            >
              <Text
                style={{
                  flex: 1,
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textBody.fontFamily,
                  fontSize: 14,
                }}
              >
                {rowLabel(key)}
              </Text>
              {prev !== null ? (
                <Text
                  style={{
                    paddingHorizontal: 8,
                    color: t.color.textSecondary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontSize: 13.5,
                  }}
                >
                  {prev}
                </Text>
              ) : null}
              {next !== null ? (
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontFamily: t.typography.textBody.fontFamily,
                    fontWeight: '500',
                    fontSize: 15,
                  }}
                >
                  {next}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {block.working ? (
        <View style={[styles.working, { borderTopColor: t.color.borderStructure }]}>
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textLabel.fontFamily,
              fontSize: 11,
              letterSpacing: 0.9,
              textTransform: 'uppercase',
              marginBottom: 5,
            }}
          >
            How I got there
          </Text>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12.5,
              lineHeight: 20,
            }}
          >
            {block.working}
          </Text>
        </View>
      ) : null}

      {amendmentText ? <HonestyStrip strip="edited" text={amendmentText} t={t} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  changedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  working: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
  },
});

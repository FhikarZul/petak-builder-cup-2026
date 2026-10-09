// #62/#63 — the honesty a DETAIL card owes.
//
// `cardBlock` on the server picks ONE card, and `chips`/`honesty` used to live
// only on the entry-card branch. So a receipt-only meal — the exact case #62
// draws — showed neither the estimate strip nor the evidence chip, because the
// richer card had won and taken the honesty with it.
//
// The strip is the SAME component the entry card uses: one visual language,
// three states, never a second implementation that can drift from the first.
// A detail card's strip is never tappable: the What-changed sheet belongs to
// the entry card, which owns the trail.
import { StyleSheet, Text, View } from 'react-native';
import { HonestyStrip } from '../HonestyStrip';
import { stripText } from '../../lib/honesty';
import { Icon } from '../Icon';
import type { Theme } from '../../lib/theme';

const CHIP_ICON: Record<string, string> = {
  own_photo: 'image',
  evidence: 'receipt_long',
  // #63 — a number that simply stands. It gets a chip rather than a strip
  // because there is nothing to explain about it; the strip exists to say why
  // a number is not the final word.
  counted: 'check',
};

const CHIP_LABEL: Record<string, string> = {
  own_photo: 'plate photo',
  evidence: 'evidence',
  counted: 'counted',
};

export function DetailCardFooter({
  chips,
  honesty,
  t,
}: {
  chips: string[];
  honesty: 'estimate' | null;
  t: Theme;
}) {
  const known = chips.filter((c) => c in CHIP_LABEL);
  if (known.length === 0 && !honesty) return null;
  return (
    <>
      {known.length > 0 ? (
        <View style={[styles.row, { borderTopColor: t.color.borderStructure }]}>
          {known.map((chip) => (
            <View
              key={chip}
              style={[styles.chip, { borderColor: t.color.borderStructure, backgroundColor: t.color.surfaceInset }]}
            >
              <Icon name={CHIP_ICON[chip]} size={13} color={t.color.textPrimary} />
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontFamily: t.typography.textSmall.fontFamily,
                  fontWeight: '500',
                  fontSize: 11.5,
                }}
              >
                {CHIP_LABEL[chip]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {honesty === 'estimate' ? (
        <HonestyStrip strip="estimate" text={stripText({ state: 'estimate' })} t={t} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
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
});

// Run B #3 + C11 — the four macros, each beside its target, with progress bars
// and a one-line commentary.
//
// C11's gate, drawn: **a target exists only when an objective derived it.**
// With no objective the value still shows and the target column reads
// "No target" — never a zero, never a progress bar (C06).
// Run C #74 is explicit about this: "targets absent, never zero/dashed".
import { StyleSheet, Text, View } from 'react-native';
import { miloMacroNote, miloMacroRows, type MiloToday } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';

export function MacroRows({ today, t }: { today: MiloToday; t: Theme }) {
  const rows = miloMacroRows(today);
  const note = miloMacroNote(today);

  return (
    <View style={[styles.card, { backgroundColor: t.color.surfaceCard, borderColor: t.color.borderStructure }]}>
      <View style={styles.headRow}>
        <Icon name="restaurant" size={16} color={t.color.textSecondary} />
        <Text
          style={{
            color: t.color.textSecondary,
            fontFamily: t.typography.textLabel.fontFamily,
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.9,
            textTransform: 'uppercase',
          }}
        >
          Macros
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
          {`after ${today.entries} ${today.entries === 1 ? 'meal' : 'meals'}`}
        </Text>
      </View>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          {/* 6 Sep 2026 (founder): "Milo dashboard the words energy, protein
              and etc are clipped (wrapped to next line) on my phone."

              The label sat at a HARD width: 60 with nothing stopping it
              wrapping. "PROTEIN" is seven characters at 11px uppercase with
              0.9 letter-spacing — it fits at the default text size and stops
              fitting the moment the reader has font scaling turned up, which is
              a setting we do not control and should not assume.

              numberOfLines makes wrapping impossible; adjustsFontSizeToFit
              makes the label SHRINK rather than clip, so the word stays whole
              and readable instead of becoming "PROTEI…". */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textLabel.fontFamily,
              fontSize: 11,
              fontWeight: '500',
              letterSpacing: 0.9,
              textTransform: 'uppercase',
              width: 60,
            }}
          >
            {row.label}
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${row.pct}%`, backgroundColor: t.color.domainBody },
              ]}
            />
          </View>
          <Text
            style={{
              color: t.color.textPrimary,
              fontFamily: t.typography.textBody.fontFamily,
              fontWeight: '500',
              fontSize: 13,
              fontVariant: ['tabular-nums'],
              minWidth: 86,
              textAlign: 'right',
            }}
          >
            {`${Math.round(row.value).toLocaleString('en-US')}${row.unit}`}
            <Text style={{ color: t.color.textSecondary, fontWeight: '400', fontSize: 12.5 }}>
              {row.target !== null
                ? ` / ${row.target.toLocaleString('en-US')}${row.unit}`
                : ' · No target'}
            </Text>
          </Text>
          <Icon name={row.stateIcon} size={18} color={t.color[row.stateColor]} />
        </View>
      ))}
      {note ? (
        <View style={styles.noteRow}>
          <Icon name="egg_alt" size={16} color={t.color.textSecondary} />
          <Text
            style={{
              color: t.color.textSecondary,
              fontFamily: t.typography.textSmall.fontFamily,
              fontSize: 12.5,
              lineHeight: 18,
              flex: 1,
            }}
          >
            {note}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 11 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(32,36,46,0.12)',
    borderRadius: 0,
    overflow: 'hidden',
  },
  barFill: { height: '100%' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: 2 },
});

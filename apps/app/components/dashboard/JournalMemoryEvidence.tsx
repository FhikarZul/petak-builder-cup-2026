import { Text, View } from 'react-native';
import type { JournalEntry } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';

/** The interpretation is visibly separate from scene facts and verbatim words. */
export function JournalMemoryEvidence({ entry, t }: { entry: JournalEntry; t: Theme }) {
  if (!entry.emotion_evidence && !entry.interpretation) return null;
  const detail = { color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 13, lineHeight: 21 };
  return <View style={{ gap: 8 }}>
    {entry.emotion_evidence ? <Text style={detail}>Feeling from your words: “{entry.emotion_evidence}”</Text> : null}
    {entry.interpretation ? <View style={{ gap: 6, borderLeftWidth: 2, borderLeftColor: t.color.domainMind, paddingLeft: 12 }}>
      <Text style={{ ...detail, fontWeight: '500' }}>Mira’s reading · tentative</Text>
      <Text style={{ color: t.color.textPrimary, fontFamily: t.typography.textBody.fontFamily, fontSize: 15, lineHeight: 25 }}>{entry.interpretation.summary}</Text>
      {entry.interpretation.evidence.map((e, i) => <Text key={i} style={detail}>
        {e.source === 'caption' ? 'Your caption' : 'Photo detail'}: {e.detail}
      </Text>)}
    </View> : null}
  </View>;
}

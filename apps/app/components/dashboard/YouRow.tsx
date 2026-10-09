// C90 (founder, 28 Aug) — "the dashboard need to display this new input."
//
// The four facts a target is derived FROM: age · sex · height · weight. They
// sit at the top because a target whose inputs are invisible is a target you
// cannot argue with — a calorie number that looks wrong says nothing on its
// own, and becomes obvious the moment the height beside it reads 172 when it
// should be 182.
//
// A field never answered renders "not said" — NEVER a guess, and never a
// blank that reads as zero. Every one of these questions is skippable (C47),
// so not-said is a real state the surface has to be able to show.
import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { burnNote, youSummary, type EnergyBasis, type MiloProfile } from '../../lib/dashboard';
import type { Theme } from '../../lib/theme';
import { Icon } from '../Icon';
import { DomainCard } from './DomainCard';

export function YouRow({ profile, basis, children, t }: { profile: MiloProfile; basis?: EnergyBasis | null; children?: ReactNode; t: Theme }) {
  const summary = youSummary(profile);
  return (
    // C63 — the drawing tints this card with the DOMAIN at 12%
    // (`background-color: var(--fill-body)`, Run B line 441) and heads it in
    // Pixelify. It shipped as a plain white card with an uppercase label, which
    // is what made the dashboard read as "nothing like the design": the domain
    // never appears, so the screen has no owner.
    <DomainCard fill={t.color.fillBody} t={t}>
      <View style={styles.head}>
        <Text
          style={{
            color: t.color.textPrimary,
            fontFamily: t.typography.fontDisplay,
            fontSize: 24,
          }}
        >
          You
        </Text>
        {summary ? (
          <Text style={{ color: t.color.textSecondary, fontFamily: t.typography.textSmall.fontFamily, fontSize: 12 }}>
            {summary}
          </Text>
        ) : null}
      </View>
      {children}
      <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
      {basis ? <Icon name="local_fire_department" size={16} color={t.color.textSecondary}/> : null}
      <Text
        style={{
          flex:1,
          color: t.color.textSecondary,
          fontFamily: t.typography.textSmall.fontFamily,
          fontSize: 12,
          lineHeight: 17,
        }}
      >
        {basis ? burnNote(basis) : 'Tell Milo in chat and the numbers move with it.'}
      </Text>
      </View>
    </DomainCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
});

// The hero card on a neighbour's dashboard — 1:1 with the drawing (C63).
//
// Founder, 7 Sep 2026: "there is also a checkard background with respective
// neighbour color.. make it the same as design!!!"
//
// The drawn card, verbatim from Run B line 441:
//
//   border: 1px solid var(--border-structure);
//   background-color: var(--fill-body);                     ← the DOMAIN at 12%
//   background-image: linear-gradient(color-mix(in srgb, var(--batu) 40%, transparent) 1px, transparent 1px),
//                     linear-gradient(90deg, color-mix(...) 1px, transparent 1px);
//   background-size: 28px 28px;                             ← the petak grid
//   padding: 16px; gap: 12px;
//
// What shipped was a plain white card with none of it. The domain never
// appeared, so Penny's screen and Milo's screen looked like the same screen —
// which is exactly what "nothing like the design" meant.
//
// The grid is the same 28px Batu cell as the chat wallpaper (GridWallpaper),
// at 40% rather than 50% because it sits over a tinted fill here rather than
// bare Kapur. RN has no CSS gradients, so it is hairline Views — no new
// dependency, same approach the chat surface already took.
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { Theme } from '../../lib/theme';

/** The drawn cell. Shared with the chat wallpaper on purpose: one grid. */
export const PETAK_CELL = 28;

/** Enough lines to cover any card we draw, then clipped. Measuring with
 *  onLayout would cost a second layout pass for a texture nobody looks at. */
const LINES = 20;

export function DomainCard({
  fill,
  t,
  style,
  children,
}: PropsWithChildren<{ fill: string; t: Theme; style?: ViewStyle }>) {
  const dark = 'gridTexture' in t.color;
  const lineColor = dark ? t.color.gridTexture : t.color.batu;

  return (
    <View
      style={[styles.card, { backgroundColor: fill, borderColor: t.color.borderStructure }, style]}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: dark ? 0.8 : 0.4 }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {Array.from({ length: LINES }, (_, i) => (
          <View
            key={`v${i}`}
            style={{
              position: 'absolute',
              left: i * PETAK_CELL,
              top: 0,
              bottom: 0,
              width: StyleSheet.hairlineWidth,
              backgroundColor: lineColor,
            }}
          />
        ))}
        {Array.from({ length: LINES }, (_, i) => (
          <View
            key={`h${i}`}
            style={{
              position: 'absolute',
              top: i * PETAK_CELL,
              left: 0,
              right: 0,
              height: StyleSheet.hairlineWidth,
              backgroundColor: lineColor,
            }}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // padding 16 and gap 12 are the drawn values, not the 14/10 that shipped.
  card: { borderWidth: 1, padding: 16, gap: 12, overflow: 'hidden' },
});

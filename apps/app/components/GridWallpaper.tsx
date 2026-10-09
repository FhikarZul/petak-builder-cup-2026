// Petak-grid wallpaper (plan §4): faint hairline grid behind every chat
// surface — Batu lines at 50% on Kapur in light, --grid-texture on Ink in
// dark (28px cells, per the Run A mirror). RN has no CSS gradients, so this
// is a component of hairline Views; no new dependency.
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../lib/theme';

const CELL = 28;

export function GridWallpaper() {
  const t = useTheme();
  const { width, height } = useWindowDimensions();

  // --grid-texture exists only on the dark ramp; light is Batu at 50%.
  const dark = 'gridTexture' in t.color;
  const lineColor = dark ? t.color.gridTexture : t.color.batu;

  const columns = Math.ceil(width / CELL) + 1;
  const rows = Math.ceil(height / CELL) + 1;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: dark ? 1 : 0.5 }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {Array.from({ length: columns }, (_, i) => (
        <View
          key={`v${i}`}
          style={{
            position: 'absolute',
            left: i * CELL,
            top: 0,
            bottom: 0,
            width: StyleSheet.hairlineWidth,
            backgroundColor: lineColor,
          }}
        />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={`h${i}`}
          style={{
            position: 'absolute',
            top: i * CELL,
            left: 0,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: lineColor,
          }}
        />
      ))}
    </View>
  );
}

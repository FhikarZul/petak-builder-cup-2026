// Material Symbols Sharp glyph (C61: the vendored static 400 TTF). Glyph names come from the
// design mirror / the canon whitelist; system chrome may draw freely.
import { Text } from 'react-native';
import { MATERIAL_SYMBOLS_FONT } from '../lib/fonts';

export function Icon({
  name,
  size = 24,
  color,
  opacity,
}: {
  name: string;
  size?: number;
  color: string;
  opacity?: number;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: MATERIAL_SYMBOLS_FONT,
          fontSize: size,
          color,
          opacity,
          includeFontPadding: false,
        },
      ]}
    >
      {name}
    </Text>
  );
}

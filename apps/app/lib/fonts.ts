// Bundled fonts (C61): no network fonts, identical rendering on both platforms.
// - Plus Jakarta Sans 400/500 via @expo-google-fonts (static TTFs in the bundle).
// - Material Symbols Sharp: the upstream variable TTF is instantiated at the
//   design's FILL 0 / GRAD 0 / opsz 24 / wght 400 settings. Every glyph and
//   ligature is retained, but unused variation data is not shipped.
// - Pixelify Sans 700: selected inline keywords (C04 exception, 22 Sep 2026).
// - Pixelify Sans 400/600 via @expo-google-fonts — the design's DISPLAY face
//   (fonts.css: H1/H2, nav labels, empty states only; never <24px, never on
//   controls or amounts, C04). Bundling it is not optional: tokens.ts emits
//   fontFamily 'Pixelify Sans' and without the TTF every header falls back.
import { PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans/700Bold';
import { PixelifySans_400Regular } from '@expo-google-fonts/pixelify-sans/400Regular';
import { PixelifySans_600SemiBold } from '@expo-google-fonts/pixelify-sans/600SemiBold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { useFonts } from 'expo-font';

export const MATERIAL_SYMBOLS_FONT = 'MaterialSymbolsSharp';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const materialSymbolsSharp = require('../assets/fonts/MaterialSymbolsSharp-400.ttf');

export function usePetakFonts(): boolean {
  const [loaded] = useFonts({
    'Plus Jakarta Sans': PlusJakartaSans_400Regular,
    'Pixelify Sans': PixelifySans_400Regular,
    'Petak Pixel Bold': PixelifySans_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PixelifySans_400Regular,
    PixelifySans_600SemiBold,
    [MATERIAL_SYMBOLS_FONT]: materialSymbolsSharp,
  });
  return loaded;
}

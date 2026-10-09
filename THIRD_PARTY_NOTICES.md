# Third-party notices

The notices below identify third-party material directly bundled in this
repository or used by the application. Each component retains its own
license. Petak's limited evaluation terms and brand notice do not replace or
restrict those licenses.

## Material Symbols Sharp

- Owner/source: Google, [Material Design Icons](https://github.com/google/material-design-icons).
- License: Apache License 2.0. The full text is included once in
  [the Vertex example LICENSE](examples/vertex-ai-demo/LICENSE); that text
  also accompanies this font and does **not** make Petak application code
  Apache-2.0 licensed.
- Local file: `apps/app/assets/fonts/MaterialSymbolsSharp-400.ttf`.
- The app source describes this as a static 400-weight instance made from the
  upstream variable font. Treat that as a modification; retain this notice
  and verify the exact source, generation record, and any upstream notice
  obligations before further distribution.
- Expo's dependency graph also includes `@expo-google-fonts/material-symbols` version
  0.4.49 transitively. That package reports `MIT AND Apache-2.0` and includes
  separate wrapper and font license files. Its font material may be included
  in an Expo export; review the final distributed bundle's font notices.

## Pixelify Sans

- Font authors: The Pixelify Sans Project Authors.
- License: SIL Open Font License 1.1.
- Used through `@expo-google-fonts/pixelify-sans` version 0.4.2; the pinned
  package also licenses its wrapper code under MIT.
- The package's font-specific copyright notice and complete OFL text are in
  [OFL-1.1-Pixelify-Sans.txt](third_party_licenses/OFL-1.1-Pixelify-Sans.txt).

## Plus Jakarta Sans

- Font authors: The Plus Jakarta Sans Project Authors.
- License: SIL Open Font License 1.1.
- Used through `@expo-google-fonts/plus-jakarta-sans` version 0.4.2; the pinned
  package also licenses its wrapper code under MIT.
- The package's font-specific copyright notice and complete OFL text are in
  [OFL-1.1-Plus-Jakarta-Sans.txt](third_party_licenses/OFL-1.1-Plus-Jakarta-Sans.txt).

## Direct npm dependencies

The direct dependency versions in `pnpm-lock.yaml` were checked against npm
package metadata. Expo, React, React Native, Supabase JS, TanStack Query,
Vitest, and most other direct app packages report MIT licenses; the two
Expo Google Fonts packages report `MIT AND OFL-1.1`. `google-auth-library`
(used only by the Vertex example) and TypeScript report Apache-2.0. Package
licenses remain with the packages installed by pnpm; this repository does
not vendor their source. A distributed native app needs a separate complete
notice review for compiled direct and transitive dependencies.

The 18 PNG files in `packages/assets` are Petak-branded images. Their
individual creation, ownership, and publication permissions have not been
verified from this repository. Do not infer third-party ownership or Petak
ownership solely from their filenames. No other obvious directly bundled
font, image, icon, or third-party code copy was identified among tracked files.

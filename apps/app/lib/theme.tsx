// Token theme bridge (C61): the generated tokens are the single source of
// truth; this provider resolves light/dark from the Appearance setting
// (Run B Settings: Light / Dark / System), falling back to the OS scheme
// while the setting loads. No hand-maintained copies.
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { tokens, type Tokens } from '@petak/design-system/tokens';
import { getAppearance, setAppearance, subscribeAppearance, type AppearanceMode } from './appearance';
import { useSettings } from './thread';

export type ThemeName = keyof Tokens;
export type Theme = Tokens[ThemeName];

const ThemeContext = createContext<Theme>(tokens.light);

/** Bridges the server-stored Appearance setting into the module store the
 *  provider reads. Mounted inside the provider; until settings load the OS
 *  scheme decides. */
function AppearanceSync() {
  const settings = useSettings();
  const stored = settings.data?.settings?.appearance;
  useEffect(() => {
    const mode: AppearanceMode =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    setAppearance(mode);
  }, [stored]);
  return null;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const [mode, setMode] = useState<AppearanceMode>(getAppearance());
  useEffect(() => subscribeAppearance(setMode), []);
  const dark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  const theme = dark ? tokens.dark : tokens.light;
  return (
    <ThemeContext.Provider value={theme}>
      <AppearanceSync />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

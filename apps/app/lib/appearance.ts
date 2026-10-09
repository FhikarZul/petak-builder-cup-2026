// Appearance mode (Run B Settings → Appearance): Light / Dark / System.
// The resolved value lives in a module store so the ThemeProvider — which sits
// ABOVE the components that read settings — can react to it: an
// AppearanceSync component inside the tree pushes the server-stored choice
// in as soon as settings load. Until then the OS scheme decides ('system').
export type AppearanceMode = 'light' | 'dark' | 'system';

type Listener = (mode: AppearanceMode) => void;

let current: AppearanceMode = 'system';
const listeners = new Set<Listener>();

export function getAppearance(): AppearanceMode {
  return current;
}

export function setAppearance(mode: AppearanceMode): void {
  if (mode === current) return;
  current = mode;
  for (const l of listeners) l(mode);
}

export function subscribeAppearance(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

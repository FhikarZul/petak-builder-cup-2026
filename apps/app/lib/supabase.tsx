// Supabase client (plan §3): session persisted via expo-secure-store.
// Env comes from EXPO_PUBLIC_* vars — see apps/app/README.md for how dev
// pulls real values from the repo root .env (never committed).
import 'react-native-url-polyfill/auto';
import './nativeCrypto';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// SecureStore adapter: supabase-js expects a localStorage-shaped object.
const secureStoreStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Boot must not crash without env — the login screen surfaces the state.
  console.warn('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set');
}

export const supabase: SupabaseClient = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    storage: secureStoreStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

const SessionContext = createContext<Session | null>(null);
const SessionLoadingContext = createContext(true);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SessionLoadingContext.Provider value={loading}>
      <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
    </SessionLoadingContext.Provider>
  );
}

export function useSession(): Session | null {
  return useContext(SessionContext);
}

export function useSessionLoading(): boolean {
  return useContext(SessionLoadingContext);
}

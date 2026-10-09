// Root layout (plan §3): providers — TanStack QueryClient, theme (tokens),
// Supabase session. Gesture handler must be imported first (drawer).
import 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LegalAcceptanceModal } from '../components/LegalAcceptanceModal';
import { EventStreamBridge } from '../components/EventStreamBridge';
import { authRedirectForState } from '../lib/authNavigation';
import { useAuthCallbackHandler } from '../lib/auth';
import {
  bootstrapAuthenticatedUser,
  noteScreenViewed,
  recordAppBackgrounded,
  recordAppColdStart,
  recordAppForegrounded,
  recordAuthenticatedAppOpen,
} from '../lib/analytics';
import { appAnalytics, trackClient } from '../lib/clientAnalytics';
import { usePetakFonts } from '../lib/fonts';
import { acceptLegal, fetchLegalStatus, shouldBlockForLegal } from '../lib/legal';
import { SessionProvider, useSession, useSessionLoading } from '../lib/supabase';
import { ThemeProvider, useTheme } from '../lib/theme';
import { loadReadCache, saveReadCache } from '../lib/readCacheStorage';



let coldStartRecorded = false;

/** The status bar follows the RESOLVED theme (Appearance setting), not the OS. */
function ThemedStatusBar() {
  const t = useTheme();
  const darkSurface = t.color.surfacePage === '#20242E';
  return <StatusBar style={darkSurface ? 'light' : 'dark'} />;
}

function AuthGate({ cachedBootstrap, onBootstrap }: { cachedBootstrap: boolean; onBootstrap: (accepted: boolean) => void }) {
  const session = useSession();
  const loading = useSessionLoading();
  const router = useRouter();
  const segments = useSegments();
  const [bootstrappedUserId, setBootstrappedUserId] = useState<string | null>(null);
  const [bootstrapRetry, setBootstrapRetry] = useState(0);
  const [legalPendingUserId, setLegalPendingUserId] = useState<string | null>(null);
  const [legalAccepting, setLegalAccepting] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  useAuthCallbackHandler();
  const userId = session?.user.id ?? null;
  const routeKey = useMemo(() => segments.join('/') || '/', [segments]);

  useEffect(() => {
    noteScreenViewed(routeKey);
    // The CLIENT lane (internal-reference). A second, independent path to PostHog, so
    // one wrong host string can never take out all analytics again — the
    // server's did, for the life of the product, and nothing could say so.
    trackClient(appAnalytics(userId), 'screen_viewed', { screen: routeKey });
  }, [routeKey, userId]);

  // The heartbeat. If the server lane is dead, these still arrive, and the
  // contrast between the two is the alarm.
  useEffect(() => {
    if (coldStartRecorded) return;
    coldStartRecorded = true;
    trackClient(appAnalytics(userId), 'app_opened');
    // Deliberately once per launch, not once per sign-in change: this counts
    // app starts, and re-firing it on auth would inflate every session figure.
    // z8v0kmr81a: a session the last launch died holding is ended here, with
    // the duration it actually had, before this launch's session begins.
    void recordAppColdStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // z8v0kmr81a — a session is open → a ≥30-min background gap, not open →
  // any background (3 opens / 21 ends on one account). Background stamps and
  // saves; foreground decides: resume, or end the stored session and open a
  // new one — and a new one is a new `app_opened`, so opens and ends agree.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') recordAppBackgrounded();
      if (next === 'active') {
        void recordAppForegrounded().then((opened) => {
          if (opened) trackClient(appAnalytics(userId), 'app_opened');
        });
      }
    });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      setBootstrappedUserId(null);
      setLegalPendingUserId(null);
      setLegalError(null);
      return;
    }
    if (legalPendingUserId === userId) return;
    if (bootstrappedUserId === userId) return;
    let alive = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      const ok = await bootstrapAuthenticatedUser(userId);
      if (!ok) {
        if (alive) retryTimer = setTimeout(() => setBootstrapRetry((n) => n + 1), 2000);
        return;
      }
      const legal = await fetchLegalStatus().catch(() => null);
      if (!legal) {
        if (alive) retryTimer = setTimeout(() => setBootstrapRetry((n) => n + 1), 2000);
        return;
      }
      if (shouldBlockForLegal(legal)) {
        if (alive) {
          onBootstrap(false);
          setLegalPendingUserId(userId);
          setLegalError(null);
        }
        return;
      }
      await recordAuthenticatedAppOpen(userId);
      if (alive) { onBootstrap(true); setBootstrappedUserId(userId); }
    })();
    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [bootstrapRetry, bootstrappedUserId, legalPendingUserId, loading, userId, onBootstrap]);

  const handleLegalAccept = useCallback(() => {
    if (!legalPendingUserId || legalAccepting) return;
    setLegalAccepting(true);
    setLegalError(null);
    void (async () => {
      try {
        const legal = await acceptLegal();
        if (shouldBlockForLegal(legal)) throw new Error('Acceptance was not saved.');
        await recordAuthenticatedAppOpen(legalPendingUserId);
        onBootstrap(true);
        setBootstrappedUserId(legalPendingUserId);
        setLegalPendingUserId(null);
      } catch (e) {
        setLegalError(e instanceof Error ? e.message : String(e));
      } finally {
        setLegalAccepting(false);
      }
    })();
  }, [legalAccepting, legalPendingUserId, onBootstrap]);

  useEffect(() => {
    const bootstrapping = !!userId && bootstrappedUserId !== userId && !cachedBootstrap;
    const redirect = authRedirectForState({
      loading: loading || bootstrapping,
      hasSession: session !== null,
      firstSegment: segments[0],
    });
    if (redirect) router.replace(redirect);
  }, [bootstrappedUserId, cachedBootstrap, loading, router, segments, session, userId]);

  return (
    <>
      <EventStreamBridge enabled={userId !== null && bootstrappedUserId === userId} />
      <LegalAcceptanceModal
        visible={legalPendingUserId !== null}
        accepting={legalAccepting}
        error={legalError}
        onAccept={handleLegalAccept}
      />
    </>
  );
}

/** Each account gets its own query client, hydrated before screens mount. */
function AccountQueries({ userId }: { userId: string | null }) {
  const [client] = useState(() => new QueryClient());
  const [ready, setReady] = useState(!userId);
  const [cachedBootstrap, setCachedBootstrap] = useState(false);
  const accepted = useRef(false);
  const onBootstrap = useCallback((value: boolean) => {
    accepted.current = value;
    setCachedBootstrap(value);
    if (userId) saveReadCache(userId, client, value);
  }, [client, userId]);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void loadReadCache(userId, client).then(result => {
      if (!alive) return;
      accepted.current = result.previouslyBootstrapped;
      setCachedBootstrap(result.previouslyBootstrapped);
      setReady(true);
    });
    return () => { alive = false; void client.cancelQueries(); };
  }, [client, userId]);
  useEffect(() => {
    if (!ready || !userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => { clearTimeout(timer); saveReadCache(userId, client, accepted.current); };
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      clearTimeout(timer);
      timer = setTimeout(save, 500);
    });
    const background = AppState.addEventListener('change', state => { if (state !== 'active') save(); });
    return () => { unsubscribe(); background.remove(); save(); };
  }, [client, ready, userId]);
  if (!ready) return null;
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthGate cachedBootstrap={cachedBootstrap} onBootstrap={onBootstrap} />
        <ThemedStatusBar />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(drawer)" />
          <Stack.Screen name="photos-waiting" />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AccountRoot() {
  const session = useSession();
  const loading = useSessionLoading();
  if (loading) return null;
  const userId = session?.user.id ?? null;
  return <AccountQueries key={userId ?? 'signed-out'} userId={userId} />;
}

export default function RootLayout() {
  const fontsLoaded = usePetakFonts();
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider><AccountRoot /></SessionProvider>
    </GestureHandlerRootView>
  );
}

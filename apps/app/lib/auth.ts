import { useEffect } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getPetakAppProfile } from './appProfile';
import { supabase } from './supabase';
import { completeAuthFromUrl } from './authCallback';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';
export type SignInResult = 'session' | 'cancelled' | 'dismissed' | 'opened' | 'ignored';

export async function signInWithEmailPassword(email: string, password: string): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return 'session';
}

export function authRedirectUri(): string {
  return makeRedirectUri({ scheme: getPetakAppProfile().scheme, path: 'login' });
}

function isAppleCancellation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_REQUEST_CANCELED';
}

async function signInWithNativeApple(): Promise<SignInResult> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error('Apple sign-in is not available on this device.');

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) throw new Error('No Apple identity token returned.');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;

    const nameParts = [
      credential.fullName?.givenName,
      credential.fullName?.middleName,
      credential.fullName?.familyName,
    ].filter(Boolean);
    if (nameParts.length > 0) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: nameParts.join(' '),
          given_name: credential.fullName?.givenName,
          family_name: credential.fullName?.familyName,
        },
      });
      if (updateError) throw updateError;
    }

    return 'session';
  } catch (e: unknown) {
    if (isAppleCancellation(e)) return 'cancelled';
    throw e;
  }
}

async function signInWithOAuthProvider(provider: OAuthProvider): Promise<SignInResult> {
  const redirectTo = authRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No auth URL returned.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') return completeAuthFromUrl(supabase.auth, result.url);
  if (result.type === 'cancel') return 'cancelled';
  if (result.type === 'dismiss') return 'dismissed';
  return 'opened';
}

export async function signInWithProvider(provider: OAuthProvider): Promise<SignInResult> {
  if (provider === 'apple' && Platform.OS === 'ios') return signInWithNativeApple();
  if (provider === 'apple') throw new Error('Apple sign-in is only available on iOS.');
  return signInWithOAuthProvider(provider);
}

export function useAuthCallbackHandler(): void {
  useEffect(() => {
    let mounted = true;
    const handle = (url: string) => {
      completeAuthFromUrl(supabase.auth, url).catch((e: unknown) => {
        console.warn(e instanceof Error ? e.message : String(e));
      });
    };

    Linking.getInitialURL()
      .then((url: string | null) => {
        if (mounted && url) handle(url);
      })
      .catch(() => {});

    const sub = Linking.addEventListener('url', ({ url }: { url: string }) => handle(url));
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
}

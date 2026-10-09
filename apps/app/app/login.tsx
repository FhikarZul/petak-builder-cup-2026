import { useMemo, useRef, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import markColour from '../../../packages/assets/logo/mark-colour.png';
import wordmark from '../../../packages/assets/logo/wordmark.png';
import neighbourhood from '../../../packages/assets/sprites/neighbourhood.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithEmailPassword, signInWithProvider, type OAuthProvider } from '../lib/auth';
import { isAppleSignInVisible } from '../lib/authProviders';
import { useTheme } from '../lib/theme';

const QA_BACKDOOR_TAPS = 3;
const TAP_RESET_MS = 500;

export default function Login() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [showReviewerForm, setShowReviewerForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isQa = useMemo(() => process.env.EXPO_PUBLIC_PETAK_ENV === 'qa', []);

  const handleProviderSignIn = (provider: OAuthProvider) => () => {
    setError(null);
    signInWithProvider(provider).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  };

  const handleLogoTap = () => {
    if (!isQa) return;
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, TAP_RESET_MS);
    if (tapCount.current >= QA_BACKDOOR_TAPS) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      setShowReviewerForm(true);
    }
  };

  const handleReviewerSignIn = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithEmailPassword(email.trim(), password);
      if (result !== 'session') setError('Reviewer sign-in did not complete.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.color.surfacePage }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.center}>
            <Pressable onPress={handleLogoTap} style={styles.logoBlock}>
              <Image source={markColour} style={styles.mark} resizeMode="contain" />
              <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
            </Pressable>

            <Text
              style={[
                styles.tagline,
                {
                  color: t.color.textPrimary,
                  fontFamily: t.typography.fontDisplay,
                },
              ]}
            >
              Everything, in its petak.
            </Text>

            <View style={styles.buttonStack}>
              <Pressable
                onPress={handleProviderSignIn('google')}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: pressed ? t.color.interactivePressed : t.color.interactive,
                  },
                ]}
              >
                <Text style={[styles.buttonText, { color: t.color.textOnInteractive }]}>
                  Continue with Google
                </Text>
              </Pressable>

              {isAppleSignInVisible(Platform.OS) ? (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={
                    t.color.surfacePage === '#F7F2E7'
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                      : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  }
                  cornerRadius={t.spacing.radiusControl}
                  onPress={handleProviderSignIn('apple')}
                  style={styles.appleButton}
                />
              ) : null}
            </View>

            {isQa && showReviewerForm ? (
              <View
                style={[
                  styles.reviewerForm,
                  {
                    backgroundColor: t.color.surfaceCard,
                    borderColor: t.color.borderStructure,
                  },
                ]}
              >
                <Text style={[styles.reviewerTitle, { color: t.color.textPrimary }]}>
                  Reviewer sign in
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[
                    styles.input,
                    {
                      color: t.color.textPrimary,
                      backgroundColor: t.color.surfaceInset,
                      borderColor: t.color.borderStructure,
                    },
                  ]}
                  placeholderTextColor={t.color.textSecondary}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry
                  style={[
                    styles.input,
                    {
                      color: t.color.textPrimary,
                      backgroundColor: t.color.surfaceInset,
                      borderColor: t.color.borderStructure,
                    },
                  ]}
                  placeholderTextColor={t.color.textSecondary}
                />
                <Pressable
                  onPress={handleReviewerSignIn}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      backgroundColor: pressed ? t.color.interactivePressed : t.color.interactive,
                      opacity: loading ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.buttonText, { color: t.color.textOnInteractive }]}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {error ? (
              <Text style={[styles.error, { color: t.color.error }]}>{error}</Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pad the banner by the system navigation inset so the neighbourhood
          strip and ground bar render fully above Android's gesture bar. The
          illustration is capped at the designed 120 and contained — scaled
          down, never cropped, on any phone. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <Image source={neighbourhood} style={styles.neighbourhood} resizeMode="contain" />
        <View style={[styles.bottomBar, { backgroundColor: t.color.batu }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  logoBlock: {
    alignItems: 'center',
    gap: 18,
  },
  mark: {
    width: 120,
    height: 120,
  },
  wordmark: {
    width: 170,
    height: 48,
  },
  tagline: {
    fontSize: 26,
    lineHeight: 34,
    textAlign: 'center',
  },
  buttonStack: {
    width: '100%',
    maxWidth: 296,
    gap: 12,
  },
  button: {
    height: 48,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: '500',
    fontSize: 15,
  },
  appleButton: {
    height: 48,
    width: '100%',
  },
  reviewerForm: {
    width: '100%',
    maxWidth: 296,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  reviewerTitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'center',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 15,
  },
  error: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 296,
  },
  footer: {
    flexShrink: 0,
  },
  neighbourhood: {
    // The designed footer strip is 120 tall — `contain` fits the whole 968px
    // illustration inside width×120, scaling DOWN, never cropping (founder,
    // 3 Sep 2026: "why can't we have it scaled down?"). The earlier
    // aspect-ratio rule made it uncropped but enormous on tall phones.
    width: '100%',
    height: 120,
  },
  bottomBar: {
    height: 28,
  },
});

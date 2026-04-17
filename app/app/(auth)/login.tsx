import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { OAUTH_BASE } from '../../src/api/base';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { LinkedInIcon, GoogleIcon } from '../../src/constants/icons';
import { prepareDashboardPostAuthRoute } from '../../src/navigation/mode';
import { AuthScaffold, Button, FormError, Input } from '../../src/components/ui';
import { SEOHead } from '../../src/components/seo';
import {
  getOAuthCallbackParamsFromMessage,
  getOAuthCallbackParamsFromUrl,
} from '../../src/utils/oauth';

function resolveOAuthBackendOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // OAUTH_BASE is always an absolute URL (see src/api/base.ts); the backend
    // serves the postMessage page from this origin.
    return new URL(OAUTH_BASE, window.location.origin).origin;
  } catch {
    return null;
  }
}

function AuthDivider() {
  const { t } = useLanguage();
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.sm }}>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
      <Text
        style={{
          marginHorizontal: theme.spacing.md,
          color: theme.colors.mutedForeground,
          fontSize: 12,
          lineHeight: 16,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {t('or') || 'or'}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
    </View>
  );
}

export default function LoginScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { login, handleOAuthCallback } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [error, setError] = useState('');
  const isMountedRef = useRef(true);
  const lastHandledOAuthUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (params.error) {
      setError(params.error);
    }
  }, [params.error]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    isMountedRef.current = true;

    const handleDeepLink = async (event: { url: string }) => {
      if (!isMountedRef.current) {
        return;
      }

      const callback = getOAuthCallbackParamsFromUrl(event.url);
      if (!callback) {
        return;
      }

      if (lastHandledOAuthUrlRef.current === event.url) {
        return;
      }
      lastHandledOAuthUrlRef.current = event.url;

      setIsOAuthLoading(true);

      try {
        if (callback.error) {
          if (isMountedRef.current) {
            setError(callback.error);
          }
          return;
        }

        if (callback.token && callback.refreshToken) {
          await handleOAuthCallback(callback.token, callback.refreshToken);
          if (isMountedRef.current) {
            const target = await prepareDashboardPostAuthRoute();
            router.replace(target as any);
          }
          return;
        }

        if (isMountedRef.current) {
          setError('Invalid callback parameters');
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'OAuth failed');
        }
      } finally {
        if (isMountedRef.current) {
          setIsOAuthLoading(false);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL()
      .then((url) => {
        if (url && isMountedRef.current) {
          void handleDeepLink({ url });
        }
      })
      .catch((err) => {
        if (isMountedRef.current) {
          console.warn('Failed to get initial URL:', err);
        }
      });

    return () => {
      isMountedRef.current = false;
      subscription.remove();
    };
  }, [handleOAuthCallback, router]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('fillAllFields'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login({ email, password });
      const target = await prepareDashboardPostAuthRoute();
      router.replace(target as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'linkedin') => {
    setIsOAuthLoading(true);
    setError('');
    lastHandledOAuthUrlRef.current = null;

    try {
      const baseUrl =
        provider === 'google'
          ? api.auth.getGoogleAuthUrl()
          : api.auth.getLinkedInAuthUrl();

      if (Platform.OS === 'web') {
        const expectedOrigin = resolveOAuthBackendOrigin();
        if (!expectedOrigin) {
          setError('Unable to start OAuth flow');
          return;
        }

        // window.open must run synchronously in the click handler so that
        // browsers attribute it to a user gesture. No awaits before this.
        const popup = window.open(baseUrl, 'coai-oauth', 'width=500,height=650');
        if (!popup) {
          setError(t('failedToOpenPopup') || 'Popup blocked — please allow popups for this site');
          return;
        }

        await new Promise<void>((resolve) => {
          const messageHandler = (event: MessageEvent) => {
            if (event.origin !== expectedOrigin) return;
            const callback = getOAuthCallbackParamsFromMessage(event.data);
            if (!callback) return;

            cleanup();

            if (callback.error) {
              setError(callback.error);
              resolve();
              return;
            }

            if (callback.token && callback.refreshToken) {
              (async () => {
                try {
                  await handleOAuthCallback(callback.token!, callback.refreshToken!);
                  const target = await prepareDashboardPostAuthRoute();
                  router.replace(target as any);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'OAuth failed');
                } finally {
                  resolve();
                }
              })();
              return;
            }

            setError('Invalid callback parameters');
            resolve();
          };

          const closedPoll = window.setInterval(() => {
            if (popup.closed) {
              cleanup();
              resolve();
            }
          }, 500);

          const cleanup = () => {
            window.removeEventListener('message', messageHandler);
            window.clearInterval(closedPoll);
            try {
              if (!popup.closed) popup.close();
            } catch {
              /* ignore */
            }
          };

          window.addEventListener('message', messageHandler);
        });
      } else {
        // Native: use auth session so the browser closes on redirect back
        // Important: we append ?platform=mobile so the backend knows to redirect to coai://
        const authUrl = `${baseUrl}?platform=mobile`;
        const result = await WebBrowser.openAuthSessionAsync(authUrl, 'coai://');

        if (result.type === 'success' && result.url) {
          if (lastHandledOAuthUrlRef.current === result.url) {
            return;
          }

          const callback = getOAuthCallbackParamsFromUrl(result.url);
          if (callback?.error) {
            lastHandledOAuthUrlRef.current = result.url;
            setError(callback.error);
            return;
          }

          if (callback?.token && callback.refreshToken) {
            lastHandledOAuthUrlRef.current = result.url;
            await handleOAuthCallback(callback.token, callback.refreshToken);
            const target = await prepareDashboardPostAuthRoute();
            router.replace(target as any);
            return;
          }

          if (callback) {
            lastHandledOAuthUrlRef.current = result.url;
            setError('Invalid callback parameters');
            return;
          }
        }
        // If user cancelled, just stop loading
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : provider === 'google'
            ? (t('failedToOpenGoogleLogin') || 'Failed to open Google login')
            : (t('failedToOpenLinkedInLogin') || 'Failed to open LinkedIn login')
      );
    } finally {
      setIsOAuthLoading(false);
    }
  };

  const isSubmitting = isLoading || isOAuthLoading;

  return (
    <>
    <SEOHead
      title={t('seoLoginTitle') || 'Login'}
      description="Log in to your CoAI account to manage your finances."
      canonicalPath="/login"
      keywords={['coai login', 'coai sign in']}
      noIndex
    />
    <AuthScaffold
      title={t('welcomeBack')}
      subtitle={t('loginSubtitle')}
      footer={(
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>{t('noAccount')} </Text>
          <Link href="/register" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={t('register')}>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily, fontSize: 14, lineHeight: 20 }}>
                {t('register')}
              </Text>
            </Pressable>
          </Link>
        </View>
      )}
    >
      <FormError message={error} />

      <View style={{ gap: theme.spacing.lg }}>
        <Button
          variant="outline"
          onPress={() => void handleOAuthLogin('google')}
          disabled={isSubmitting}
          isLoading={isOAuthLoading}
          leftIcon={<GoogleIcon size={18} />}
        >
          {t('continueWithGoogle') || 'Continue with Google'}
        </Button>

        <Button
          variant="outline"
          onPress={() => void handleOAuthLogin('linkedin')}
          disabled={isSubmitting}
          leftIcon={<LinkedInIcon size={18} color={theme.colors.secondaryForeground} />}
        >
          {t('continueWithLinkedIn') || 'Continue with LinkedIn'}
        </Button>

        <AuthDivider />

        <Input
          label={t('email')}
          placeholder={t('email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
          returnKeyType="next"
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          leftIcon={<Mail size={18} color={theme.colors.mutedForeground} />}
          style={{ fontSize: 15, outlineStyle: 'none' } as any}
        />

        <Input
          label={t('password')}
          placeholder={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete="password"
          textContentType="password"
          autoCapitalize="none"
          editable={!isSubmitting}
          returnKeyType="done"
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          leftIcon={<Lock size={18} color={theme.colors.mutedForeground} />}
          rightIcon={(
            <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={6}>
              {showPassword ? <EyeOff size={18} color={theme.colors.mutedForeground} /> : <Eye size={18} color={theme.colors.mutedForeground} />}
            </Pressable>
          )}
          style={{ fontSize: 15, outlineStyle: 'none' } as any}
        />

        <View style={{ alignItems: 'flex-end' }}>
          <Link href="/forgot-password" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={t('forgotPassword')}>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>{t('forgotPassword')}</Text>
            </Pressable>
          </Link>
        </View>

        <Button isLoading={isLoading} onPress={handleLogin} disabled={isSubmitting}>
          {t('login')}
        </Button>
      </View>
    </AuthScaffold>
    </>
  );
}

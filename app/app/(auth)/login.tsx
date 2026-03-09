import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { LinkedInIcon, GoogleIcon } from '../../src/constants/icons';
import { prepareDashboardPostAuthRoute } from '../../src/navigation/mode';
import { AuthScaffold, Button, FormError, Input } from '../../src/components/ui';

function AuthDivider() {
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
        or
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

  useEffect(() => {
    if (params.error) {
      setError(params.error);
    }
  }, [params.error]);

  useEffect(() => {
    isMountedRef.current = true;

    const handleDeepLink = async (event: { url: string }) => {
      if (!event.url.includes('/auth/callback')) {
        return;
      }

      if (!isMountedRef.current) {
        return;
      }

      setIsOAuthLoading(true);

      try {
        const urlParams = new URL(event.url).searchParams;
        const token = urlParams.get('token');
        const refreshToken = urlParams.get('refresh_token');
        const errorParam = urlParams.get('error');

        if (errorParam) {
          if (isMountedRef.current) {
            setError(errorParam);
          }
          return;
        }

        if (token && refreshToken) {
          await handleOAuthCallback(token, refreshToken);
          if (isMountedRef.current) {
            const target = await prepareDashboardPostAuthRoute();
            router.replace(target as any);
          }
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

    try {
      const baseUrl =
        provider === 'google'
          ? api.auth.getGoogleAuthUrl()
          : api.auth.getLinkedInAuthUrl();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(baseUrl);
      } else {
        // Native: use auth session so the browser closes on redirect back
        const authUrl = `${baseUrl}?platform=mobile`;
        const result = await WebBrowser.openAuthSessionAsync(authUrl, 'coai://');

        if (result.type === 'success' && result.url) {
          // Parse tokens from hash fragment (#token=...&refresh_token=...)
          const hashIndex = result.url.indexOf('#');
          if (hashIndex !== -1) {
            const hashParams = new URLSearchParams(result.url.substring(hashIndex + 1));
            const token = hashParams.get('token');
            const refreshToken = hashParams.get('refresh_token');

            if (token && refreshToken) {
              await handleOAuthCallback(token, refreshToken);
              const target = await prepareDashboardPostAuthRoute();
              router.replace(target as any);
              return;
            }
          }

          // Check for error in query params (error redirect)
          const errorParam = new URL(result.url).searchParams.get('error');
          if (errorParam) {
            setError(decodeURIComponent(errorParam));
            return;
          }

          setError('Authentication failed');
        }
        // result.type === 'cancel' or 'dismiss' — user closed the browser
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
  );
}

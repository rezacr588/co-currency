import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { LinkedInIcon, GoogleIcon } from '../../src/constants/icons';
import { prepareDashboardPostAuthRoute } from '../../src/navigation/mode';
import { AuthScaffold, Button, FormError, Input } from '../../src/components/ui';
import { SEOHead } from '../../src/components/seo';

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

export default function RegisterScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { register, handleOAuthCallback } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError(t('fillAllFields'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register({ name, email, password });
      const target = await prepareDashboardPostAuthRoute();
      router.replace(target as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registrationFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthRegister = async (provider: 'google' | 'linkedin') => {
    setIsOAuthLoading(true);
    setError('');

    try {
      const authUrl =
        provider === 'google'
          ? api.auth.getGoogleAuthUrl()
          : api.auth.getLinkedInAuthUrl();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(authUrl);
      } else {
        await WebBrowser.openBrowserAsync(authUrl);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : provider === 'google'
            ? (t('failedToOpenGoogleLogin') || 'Failed to open Google login')
            : (t('failedToOpenLinkedInLogin') || 'Failed to open LinkedIn login')
      );
      setIsOAuthLoading(false);
    }
  };

  const isSubmitting = isLoading || isOAuthLoading;

  return (
    <>
    <SEOHead
      title={t('seoRegisterTitle') || 'Create Your Free Account'}
      description="Create a free CoAI account. Track spending across 160+ currencies with AI-powered insights."
      canonicalPath="/register"
      keywords={['coai register', 'create coai account']}
      noIndex
    />
    <AuthScaffold
      title={t('createAccount')}
      subtitle={t('registerSubtitle')}
      footer={(
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>{t('haveAccount')} </Text>
          <Link href="/login" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={t('login')}>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.bodyMedium.fontFamily, fontSize: 14, lineHeight: 20 }}>
                {t('login')}
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
          onPress={() => void handleOAuthRegister('google')}
          disabled={isSubmitting}
          isLoading={isOAuthLoading}
          leftIcon={<GoogleIcon size={18} />}
        >
          {t('signUpWithGoogle') || 'Sign up with Google'}
        </Button>

        <Button
          variant="outline"
          onPress={() => void handleOAuthRegister('linkedin')}
          disabled={isSubmitting}
          leftIcon={<LinkedInIcon size={18} color={theme.colors.secondaryForeground} />}
        >
          {t('signUpWithLinkedIn') || 'Sign up with LinkedIn'}
        </Button>

        <AuthDivider />

        <Input
          label={t('name')}
          placeholder={t('name')}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          editable={!isSubmitting}
          returnKeyType="next"
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          leftIcon={<User size={18} color={theme.colors.mutedForeground} />}
          style={{ fontSize: 15, outlineStyle: 'none' } as any}
        />

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
          returnKeyType="next"
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

        <Input
          label={t('confirmPassword')}
          placeholder={t('confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          autoComplete="password"
          textContentType="password"
          autoCapitalize="none"
          editable={!isSubmitting}
          returnKeyType="done"
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          leftIcon={<Lock size={18} color={theme.colors.mutedForeground} />}
          style={{ fontSize: 15, outlineStyle: 'none' } as any}
        />

        <Button isLoading={isLoading} onPress={handleRegister} disabled={isSubmitting}>
          {t('register')}
        </Button>
      </View>
    </AuthScaffold>
    </>
  );
}

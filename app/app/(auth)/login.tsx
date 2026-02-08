import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useColors } from '../../src/context/ThemeContext';
import { api } from '../../src/api';
import { LinkedInIcon, GoogleIcon } from '../../src/constants/icons';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';

export default function LoginScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const { login, handleOAuthCallback } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [error, setError] = useState('');

  // Responsive: max width for form on larger screens
  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const formMaxWidth = isTablet ? 400 : '100%';

  // Check for OAuth error in URL params
  useEffect(() => {
    if (params.error) {
      setError(params.error);
    }
  }, [params.error]);

  // Handle deep link for OAuth callback
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (url.includes('/auth/callback')) {
        if (!isMountedRef.current) return;
        setIsOAuthLoading(true);
        try {
          const urlParams = new URL(url).searchParams;
          const token = urlParams.get('token');
          const refreshToken = urlParams.get('refresh_token');
          const errorParam = urlParams.get('error');

          if (errorParam) {
            if (isMountedRef.current) setError(errorParam);
          } else if (token && refreshToken) {
            await handleOAuthCallback(token, refreshToken);
            if (isMountedRef.current) router.replace('/(app)/(tabs)');
          }
        } catch (err) {
          if (isMountedRef.current) {
            setError(err instanceof Error ? err.message : 'OAuth failed');
          }
        } finally {
          if (isMountedRef.current) setIsOAuthLoading(false);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL()
      .then((url) => {
        if (url && isMountedRef.current) {
          handleDeepLink({ url });
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
      router.replace('/(app)/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsOAuthLoading(true);
    setError('');
    try {
      const authUrl = api.auth.getGoogleAuthUrl();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(authUrl);
      } else {
        await WebBrowser.openBrowserAsync(authUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToOpenGoogleLogin') || 'Failed to open Google login');
      setIsOAuthLoading(false);
    }
  };

  const handleLinkedInLogin = async () => {
    setIsOAuthLoading(true);
    setError('');
    try {
      const authUrl = api.auth.getLinkedInAuthUrl();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(authUrl);
      } else {
        await WebBrowser.openBrowserAsync(authUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToOpenLinkedInLogin') || 'Failed to open LinkedIn login');
      setIsOAuthLoading(false);
    }
  };

  const isSubmitting = isLoading || isOAuthLoading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={isDesktop ? [] : ['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: isDesktop ? 32 : 24,
            paddingBottom: (isDesktop ? 32 : 24) + insets.bottom,
          }}
        >
          {/* Form Container - Centered with max width */}
          <View style={{ width: '100%', maxWidth: formMaxWidth }}>
          <View className="items-center mb-8">
            <Text className="text-2xl font-semibold text-foreground mb-2">{t('welcomeBack')}</Text>
            <Text className="text-muted-foreground text-center text-sm">{t('loginSubtitle')}</Text>
          </View>

          <FormError message={error} />

          <View className="gap-4">
            {/* Google OAuth Button */}
            <Button
              variant="primary"
              onPress={handleGoogleLogin}
              disabled={isSubmitting}
              isLoading={isOAuthLoading}
              leftIcon={<GoogleIcon size={18} />}
            >
              {t('continueWithGoogle') || 'Continue with Google'}
            </Button>

            {/* LinkedIn OAuth Button */}
            <Button
              variant="outline"
              onPress={handleLinkedInLogin}
              disabled={isSubmitting}
              leftIcon={<LinkedInIcon size={18} color={colors.secondaryForeground} />}
            >
              {t('continueWithLinkedIn') || 'Continue with LinkedIn'}
            </Button>

            {/* Divider */}
            <View className="flex-row items-center my-3">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted-foreground mx-4 text-xs uppercase tracking-wider">{t('or') || 'or'}</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* Email Input */}
            <Text className="text-xs text-muted-foreground">{t('email')}</Text>
            <View className="bg-muted rounded-lg flex-row items-center px-4 border border-border">
              <Mail size={18} color={colors.mutedForeground} />
              <TextInput
                placeholder={t('email')}
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                returnKeyType="next"
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                style={{
                  flex: 1,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 15,
                  outlineStyle: 'none',
                } as any}
              />
            </View>

            {/* Password Input */}
            <Text className="text-xs text-muted-foreground">{t('password')}</Text>
            <View className="bg-muted rounded-lg flex-row items-center px-4 border border-border">
              <Lock size={18} color={colors.mutedForeground} />
              <TextInput
                placeholder={t('password')}
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                autoCapitalize="none"
                editable={!isSubmitting}
                returnKeyType="done"
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                style={{
                  flex: 1,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 15,
                  outlineStyle: 'none',
                } as any}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{ cursor: 'pointer', padding: 4 }}
              >
                {showPassword ? (
                  <EyeOff size={18} color={colors.mutedForeground} />
                ) : (
                  <Eye size={18} color={colors.mutedForeground} />
                )}
              </Pressable>
            </View>

            {/* Forgot Password */}
            <Link href="/forgot-password" asChild>
              <Pressable style={{ cursor: 'pointer' }}>
                <Text className="text-muted-foreground text-right text-sm hover:text-foreground">{t('forgotPassword')}</Text>
              </Pressable>
            </Link>

            {/* Login Button */}
            <Button variant="accent" isLoading={isLoading} onPress={handleLogin} disabled={isSubmitting} className="mt-2">
              {t('login')}
            </Button>
          </View>

          {/* Register Link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-muted-foreground text-sm">{t('noAccount')} </Text>
            <Link href="/register" asChild>
              <Pressable style={{ cursor: 'pointer' }}>
                <Text className="text-foreground font-medium text-sm">{t('register')}</Text>
              </Pressable>
            </Link>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

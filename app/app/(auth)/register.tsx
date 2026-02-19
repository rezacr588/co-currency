import { useState, useEffect, useRef } from 'react';
import {
  View,
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
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native';
import styled, { useTheme } from 'styled-components/native';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { api } from '../../src/api';
import { LinkedInIcon, GoogleIcon } from '../../src/constants/icons';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';
import { H2, Caption } from '../../src/components/ui/styled';

const ScreenContainer = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
`;

const InputRow = styled.View`
  background-color: ${({ theme }) => theme.colors.muted};
  border-radius: ${({ theme }) => theme.radii.md}px;
  flex-direction: row;
  align-items: center;
  padding-horizontal: ${({ theme }) => theme.spacing.lg}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
`;

const Divider = styled.View`
  height: 1px;
  flex: 1;
  background-color: ${({ theme }) => theme.colors.border};
`;

export default function RegisterScreen() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { register, handleOAuthCallback } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [error, setError] = useState('');

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const formMaxWidth = isTablet ? 400 : '100%';

  useEffect(() => {
    if (params.error) setError(params.error);
  }, [params.error]);

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
          if (isMountedRef.current) setError(err instanceof Error ? err.message : 'OAuth failed');
        } finally {
          if (isMountedRef.current) setIsOAuthLoading(false);
        }
      }
    };
    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url && isMountedRef.current) handleDeepLink({ url });
    }).catch((err) => {
      if (isMountedRef.current) console.warn('Failed to get initial URL:', err);
    });
    return () => { isMountedRef.current = false; subscription.remove(); };
  }, [handleOAuthCallback, router]);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) { setError(t('fillAllFields')); return; }
    if (password !== confirmPassword) { setError(t('passwordsDoNotMatch')); return; }
    if (password.length < 8) { setError(t('passwordTooShort')); return; }
    setIsLoading(true);
    setError('');
    try {
      await register({ name, email, password });
      router.replace('/(app)/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registrationFailed'));
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
  const inputStyle = {
    flex: 1, padding: 14, color: theme.colors.foreground,
    fontSize: 15, outlineStyle: 'none',
  } as any;

  return (
    <ScreenContainer edges={isDesktop ? [] : ['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1, justifyContent: 'center', alignItems: 'center',
            padding: isDesktop ? 32 : 24,
            paddingBottom: (isDesktop ? 32 : 24) + insets.bottom,
          }}
        >
          <View style={{ width: '100%', maxWidth: formMaxWidth }}>
            <View style={{ alignItems: 'center', marginBottom: theme.spacing.xxxl }}>
              <H2 style={{ marginBottom: theme.spacing.sm }}>{t('createAccount')}</H2>
              <Caption style={{ textAlign: 'center' }}>{t('registerSubtitle')}</Caption>
            </View>

            <FormError message={error} />

            <View style={{ gap: theme.spacing.lg }}>
              <Button variant="primary" onPress={handleGoogleLogin} disabled={isSubmitting} isLoading={isOAuthLoading} leftIcon={<GoogleIcon size={18} />}>
                {t('signUpWithGoogle') || 'Sign up with Google'}
              </Button>

              <Button variant="outline" onPress={handleLinkedInLogin} disabled={isSubmitting} leftIcon={<LinkedInIcon size={18} color={theme.colors.secondaryForeground} />}>
                {t('signUpWithLinkedIn') || 'Sign up with LinkedIn'}
              </Button>

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.md }}>
                <Divider />
                <Caption style={{ marginHorizontal: theme.spacing.lg, textTransform: 'uppercase', letterSpacing: 1 }}>{t('or') || 'or'}</Caption>
                <Divider />
              </View>

              {/* Name */}
              <Caption>{t('name')}</Caption>
              <InputRow>
                <User size={18} color={theme.colors.mutedForeground} />
                <TextInput placeholder={t('name')} placeholderTextColor={theme.colors.placeholder} value={name} onChangeText={setName}
                  autoComplete="name" textContentType="name" autoCapitalize="words" editable={!isSubmitting} returnKeyType="next"
                  selectionColor={theme.colors.accent} cursorColor={theme.colors.accent} style={inputStyle} />
              </InputRow>

              {/* Email */}
              <Caption>{t('email')}</Caption>
              <InputRow>
                <Mail size={18} color={theme.colors.mutedForeground} />
                <TextInput placeholder={t('email')} placeholderTextColor={theme.colors.placeholder} value={email} onChangeText={setEmail}
                  keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false}
                  editable={!isSubmitting} returnKeyType="next" selectionColor={theme.colors.accent} cursorColor={theme.colors.accent} style={inputStyle} />
              </InputRow>

              {/* Password */}
              <Caption>{t('password')}</Caption>
              <InputRow>
                <Lock size={18} color={theme.colors.mutedForeground} />
                <TextInput placeholder={t('password')} placeholderTextColor={theme.colors.placeholder} value={password} onChangeText={setPassword}
                  secureTextEntry={!showPassword} autoComplete="password" textContentType="password" autoCapitalize="none"
                  editable={!isSubmitting} returnKeyType="next" selectionColor={theme.colors.accent} cursorColor={theme.colors.accent} style={inputStyle} />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                  {showPassword ? <EyeOff size={18} color={theme.colors.mutedForeground} /> : <Eye size={18} color={theme.colors.mutedForeground} />}
                </Pressable>
              </InputRow>

              {/* Confirm Password */}
              <Caption>{t('confirmPassword')}</Caption>
              <InputRow>
                <Lock size={18} color={theme.colors.mutedForeground} />
                <TextInput placeholder={t('confirmPassword')} placeholderTextColor={theme.colors.placeholder} value={confirmPassword} onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword} autoComplete="password" textContentType="password" autoCapitalize="none"
                  editable={!isSubmitting} returnKeyType="done" selectionColor={theme.colors.accent} cursorColor={theme.colors.accent} style={inputStyle} />
              </InputRow>

              <Button variant="accent" isLoading={isLoading} onPress={handleRegister} disabled={isSubmitting}>
                {t('register')}
              </Button>
            </View>

            {/* Login Link */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.xxxl }}>
              <Caption>{t('haveAccount')} </Caption>
              <Link href="/login" asChild>
                <Pressable>
                  <Caption $color={theme.colors.foreground} style={{ fontFamily: theme.typography.bodyMedium.fontFamily }}>{t('login')}</Caption>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { api } from '../../src/api';
import { LinkedInIcon, GoogleIcon } from '../../src/constants/icons';

export default function RegisterScreen() {
  const { t } = useLanguage();
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

  // Responsive: max width for form on larger screens
  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const formMaxWidth = isTablet ? 400 : '100%';

  useEffect(() => {
    if (params.error) {
      setError(params.error);
    }
  }, [params.error]);

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (url.includes('/auth/callback')) {
        setIsOAuthLoading(true);
        try {
          const urlParams = new URL(url).searchParams;
          const token = urlParams.get('token');
          const refreshToken = urlParams.get('refresh_token');
          const errorParam = urlParams.get('error');

          if (errorParam) {
            setError(errorParam);
          } else if (token && refreshToken) {
            await handleOAuthCallback(token, refreshToken);
            router.replace('/(app)/(tabs)');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'OAuth failed');
        } finally {
          setIsOAuthLoading(false);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => subscription.remove();
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
      setError(err instanceof Error ? err.message : 'Failed to open Google login');
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
      setError(err instanceof Error ? err.message : 'Failed to open LinkedIn login');
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
            <Text className="text-2xl font-semibold text-foreground mb-2">{t('createAccount')}</Text>
            <Text className="text-muted-foreground text-center text-sm">{t('registerSubtitle')}</Text>
          </View>

          {error ? (
            <View className="bg-danger-muted border border-danger/20 p-3 rounded-lg mb-4">
              <Text className="text-danger text-sm">{error}</Text>
            </View>
          ) : null}

          <View className="gap-4">
            {/* Google OAuth Button */}
            <Pressable
              onPress={handleGoogleLogin}
              disabled={isSubmitting}
              style={{ cursor: 'pointer' }}
              className={`bg-foreground p-3.5 rounded-lg flex-row items-center justify-center ${
                isSubmitting ? 'opacity-50' : ''
              }`}
            >
              <GoogleIcon size={18} />
              <Text className="text-background font-medium ml-3 text-sm">Sign up with Google</Text>
            </Pressable>

            {/* LinkedIn OAuth Button */}
            <Pressable
              onPress={handleLinkedInLogin}
              disabled={isSubmitting}
              style={{ cursor: 'pointer' }}
              className={`bg-secondary border border-border p-3.5 rounded-lg flex-row items-center justify-center ${
                isSubmitting ? 'opacity-50' : ''
              }`}
            >
              <LinkedInIcon size={18} color="#a1a1aa" />
              <Text className="text-foreground font-medium ml-3 text-sm">Sign up with LinkedIn</Text>
            </Pressable>

            {/* Divider */}
            <View className="flex-row items-center my-3">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted-foreground mx-4 text-xs uppercase tracking-wider">{t('or') || 'or'}</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* Name Input */}
            <Text className="text-xs text-muted-foreground">{t('name')}</Text>
            <View className="bg-muted rounded-lg flex-row items-center px-4 border border-border">
              <User size={18} color="#71717a" />
              <TextInput
                className="flex-1 p-3.5 text-foreground"
                style={{ outlineStyle: 'none', fontSize: 15 } as any}
                placeholder={t('name')}
                placeholderTextColor="#52525b"
                value={name}
                onChangeText={setName}
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                editable={!isSubmitting}
                returnKeyType="next"
              />
            </View>

            {/* Email Input */}
            <Text className="text-xs text-muted-foreground">{t('email')}</Text>
            <View className="bg-muted rounded-lg flex-row items-center px-4 border border-border">
              <Mail size={18} color="#71717a" />
              <TextInput
                className="flex-1 p-3.5 text-foreground"
                style={{ outlineStyle: 'none', fontSize: 15 } as any}
                placeholder={t('email')}
                placeholderTextColor="#52525b"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                returnKeyType="next"
              />
            </View>

            {/* Password Input */}
            <Text className="text-xs text-muted-foreground">{t('password')}</Text>
            <View className="bg-muted rounded-lg flex-row items-center px-4 border border-border">
              <Lock size={18} color="#71717a" />
              <TextInput
                className="flex-1 p-3.5 text-foreground"
                style={{ outlineStyle: 'none', fontSize: 15 } as any}
                placeholder={t('password')}
                placeholderTextColor="#52525b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                autoCapitalize="none"
                editable={!isSubmitting}
                returnKeyType="next"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{ cursor: 'pointer', padding: 4 }}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#71717a" />
                ) : (
                  <Eye size={18} color="#71717a" />
                )}
              </Pressable>
            </View>

            {/* Confirm Password Input */}
            <Text className="text-xs text-muted-foreground">{t('confirmPassword')}</Text>
            <View className="bg-muted rounded-lg flex-row items-center px-4 border border-border">
              <Lock size={18} color="#71717a" />
              <TextInput
                className="flex-1 p-3.5 text-foreground"
                style={{ outlineStyle: 'none', fontSize: 15 } as any}
                placeholder={t('confirmPassword')}
                placeholderTextColor="#52525b"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                autoCapitalize="none"
                editable={!isSubmitting}
                returnKeyType="done"
              />
            </View>

            {/* Register Button */}
            <Pressable
              onPress={handleRegister}
              disabled={isSubmitting}
              style={{ cursor: 'pointer' }}
              className={`bg-accent p-3.5 rounded-lg items-center mt-2 ${isSubmitting ? 'opacity-50' : ''}`}
            >
              {isLoading ? (
                <ActivityIndicator color="#09090b" />
              ) : (
                <Text className="text-accent-foreground font-semibold">{t('register')}</Text>
              )}
            </Pressable>
          </View>

          {/* Login Link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-muted-foreground text-sm">{t('haveAccount')} </Text>
            <Link href="/login" asChild>
              <Pressable style={{ cursor: 'pointer' }}>
                <Text className="text-foreground font-medium text-sm">{t('login')}</Text>
              </Pressable>
            </Link>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

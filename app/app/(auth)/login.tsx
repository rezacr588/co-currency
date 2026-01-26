import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { api } from '../../src/api';
import { LinkedInIcon, GoogleIcon } from '../../src/constants/icons';

export default function LoginScreen() {
  const { t } = useLanguage();
  const { login, handleOAuthCallback } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const { width } = useWindowDimensions();

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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: isDesktop ? 32 : 24,
        }}
      >
        {/* Form Container - Centered with max width */}
        <View style={{ width: '100%', maxWidth: formMaxWidth }}>
          <View className="items-center mb-8">
            <Text className="text-3xl font-bold text-foreground mb-2">{t('welcomeBack')}</Text>
            <Text className="text-muted-foreground text-center">{t('loginSubtitle')}</Text>
          </View>

          {error ? (
            <View className="bg-danger/10 p-4 rounded-xl mb-4">
              <Text className="text-danger">{error}</Text>
            </View>
          ) : null}

          <View className="gap-4">
            {/* Google OAuth Button */}
            <Pressable
              onPress={handleGoogleLogin}
              disabled={isSubmitting}
              style={{ cursor: 'pointer' }}
              className={`bg-white p-4 rounded-xl flex-row items-center justify-center border border-gray-300 ${
                isSubmitting ? 'opacity-50' : ''
              }`}
            >
              <GoogleIcon size={20} />
              <Text className="text-gray-700 font-semibold ml-3">Continue with Google</Text>
            </Pressable>

            {/* LinkedIn OAuth Button */}
            <Pressable
              onPress={handleLinkedInLogin}
              disabled={isSubmitting}
              style={{ cursor: 'pointer' }}
              className={`bg-[#0077b5] p-4 rounded-xl flex-row items-center justify-center ${
                isSubmitting ? 'opacity-50' : ''
              }`}
            >
              <LinkedInIcon size={20} color="white" />
              <Text className="text-white font-semibold ml-3">Continue with LinkedIn</Text>
            </Pressable>

            {/* Divider */}
            <View className="flex-row items-center my-2">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted-foreground mx-4">{t('or') || 'or'}</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* Email Input */}
            <View className="bg-card rounded-xl flex-row items-center px-4 border border-border">
              <Mail size={20} color="rgb(148, 163, 184)" />
              <TextInput
                className="flex-1 p-4 text-foreground"
                style={{
                  outlineStyle: 'none',
                  fontSize: 16,
                } as any}
                placeholder={t('email')}
                placeholderTextColor="rgb(148, 163, 184)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            </View>

            {/* Password Input */}
            <View className="bg-card rounded-xl flex-row items-center px-4 border border-border">
              <Lock size={20} color="rgb(148, 163, 184)" />
              <TextInput
                className="flex-1 p-4 text-foreground"
                style={{
                  outlineStyle: 'none',
                  fontSize: 16,
                } as any}
                placeholder={t('password')}
                placeholderTextColor="rgb(148, 163, 184)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isSubmitting}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{ cursor: 'pointer', padding: 4 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color="rgb(148, 163, 184)" />
                ) : (
                  <Eye size={20} color="rgb(148, 163, 184)" />
                )}
              </Pressable>
            </View>

            {/* Forgot Password */}
            <Link href="/forgot-password" asChild>
              <Pressable style={{ cursor: 'pointer' }}>
                <Text className="text-accent text-right">{t('forgotPassword')}</Text>
              </Pressable>
            </Link>

            {/* Login Button */}
            <Pressable
              onPress={handleLogin}
              disabled={isSubmitting}
              style={{ cursor: 'pointer' }}
              className={`bg-primary p-4 rounded-xl items-center ${isSubmitting ? 'opacity-50' : ''}`}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">{t('login')}</Text>
              )}
            </Pressable>
          </View>

          {/* Register Link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-muted-foreground">{t('noAccount')} </Text>
            <Link href="/register" asChild>
              <Pressable style={{ cursor: 'pointer' }}>
                <Text className="text-accent font-semibold">{t('register')}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

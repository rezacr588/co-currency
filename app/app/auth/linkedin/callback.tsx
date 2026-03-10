import { useEffect, useState, useRef } from 'react';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';
import { isValidJWT } from '../../../src/utils/validation';
import { useTheme } from 'styled-components/native';
import { prepareDashboardPostAuthRoute } from '../../../src/navigation/mode';

/** Parse token and refresh_token from the URL hash fragment or query params. */
function getCallbackParams(queryParams: Record<string, string | string[] | undefined>) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    return {
      token: hashParams.get('token') ?? undefined,
      refresh_token: hashParams.get('refresh_token') ?? undefined,
      error: hashParams.get('error') ?? undefined,
    };
  }
  return {
    token: typeof queryParams.token === 'string' ? queryParams.token : undefined,
    refresh_token: typeof queryParams.refresh_token === 'string' ? queryParams.refresh_token : undefined,
    error: typeof queryParams.error === 'string' ? queryParams.error : undefined,
  };
}

export default function LinkedInCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; refresh_token?: string; error?: string }>();
  const { handleOAuthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const colors = theme.colors;
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;
    hasHandled.current = true;

    let redirectTimer: ReturnType<typeof setTimeout>;

    async function handleCallback() {
      const { token, refresh_token, error: errorParam } = getCallbackParams(params);

      if (errorParam) {
        setError(errorParam);
        redirectTimer = setTimeout(() => {
          router.replace(`/login?error=${encodeURIComponent(errorParam)}`);
        }, 2000);
        return;
      }

      if (
        token &&
        refresh_token &&
        isValidJWT(token)
      ) {
        try {
          await handleOAuthCallback(token, refresh_token);
          const target = await prepareDashboardPostAuthRoute();
          router.replace(target as any);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Authentication failed';
          setError(message);
          redirectTimer = setTimeout(() => {
            router.replace(`/login?error=${encodeURIComponent(message)}`);
          }, 2000);
        }
      } else {
        setError('Invalid callback parameters');
        redirectTimer = setTimeout(() => {
          router.replace('/login?error=Invalid%20callback%20parameters');
        }, 2000);
      }
    }

    handleCallback();

    return () => clearTimeout(redirectTimer);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      {error ? (
        <View style={{ alignItems: 'center', padding: 24 }}>
          <Text style={{ color: colors.danger, fontSize: 18, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>Authentication Failed</Text>
          <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>{error}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 16 }}>Redirecting to login...</Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
          <Text style={{ color: colors.foreground, marginTop: 16 }}>Completing LinkedIn sign in...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

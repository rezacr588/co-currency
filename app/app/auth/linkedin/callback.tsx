import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';
import { isValidJWT } from '../../../src/utils/validation';
import { useTheme } from 'styled-components/native';
import { resolvePostAuthRoute } from '../../../src/navigation/mode';

export default function LinkedInCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; refresh_token?: string; error?: string }>();
  const { handleOAuthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const colors = theme.colors;

  useEffect(() => {
    async function handleCallback() {
      const { token, refresh_token, error: errorParam } = params;

      if (errorParam) {
        setError(typeof errorParam === 'string' ? errorParam : 'Unknown error');
        // Redirect to login with error after a delay
        setTimeout(() => {
          router.replace(`/login?error=${encodeURIComponent(typeof errorParam === 'string' ? errorParam : 'Unknown error')}`);
        }, 2000);
        return;
      }

      if (
        typeof token === 'string' &&
        typeof refresh_token === 'string' &&
        isValidJWT(token) &&
        isValidJWT(refresh_token)
      ) {
        try {
          await handleOAuthCallback(token, refresh_token);
          const target = await resolvePostAuthRoute();
          router.replace(target as any);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Authentication failed';
          setError(message);
          setTimeout(() => {
            router.replace(`/login?error=${encodeURIComponent(message)}`);
          }, 2000);
        }
      } else {
        setError('Invalid callback parameters');
        setTimeout(() => {
          router.replace('/login?error=Invalid%20callback%20parameters');
        }, 2000);
      }
    }

    handleCallback();
  }, [params, handleOAuthCallback, router]);

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

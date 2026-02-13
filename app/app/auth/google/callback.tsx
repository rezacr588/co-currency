import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/context/AuthContext';
import { isValidJWT } from '../../../src/utils/validation';

export default function GoogleCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; refresh_token?: string; error?: string }>();
  const { handleOAuthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const { token, refresh_token, error: errorParam } = params;

      if (errorParam) {
        setError(typeof errorParam === 'string' ? errorParam : 'Unknown error');
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
          router.replace('/(app)/(tabs)');
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
    <SafeAreaView className="flex-1 bg-background items-center justify-center">
      {error ? (
        <View className="items-center p-6">
          <Text className="text-danger text-lg font-semibold mb-2">Authentication Failed</Text>
          <Text className="text-muted-foreground text-center">{error}</Text>
          <Text className="text-muted-foreground text-sm mt-4">Redirecting to login...</Text>
        </View>
      ) : (
        <View className="items-center">
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
          <Text className="text-foreground mt-4">Completing Google sign in...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

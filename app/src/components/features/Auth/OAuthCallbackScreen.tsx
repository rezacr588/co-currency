import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import { useAuth } from '../../../context/AuthContext';
import { prepareDashboardPostAuthRoute } from '../../../navigation/mode';
import {
  getOAuthCallbackParams,
  hasOAuthCallbackQueryParams,
  type OAuthCallbackQueryParams,
} from '../../../utils/oauth';
import { isValidJWT } from '../../../utils/validation';

interface OAuthCallbackScreenProps {
  providerLabel: string;
}

export function OAuthCallbackScreen({ providerLabel }: OAuthCallbackScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams() as OAuthCallbackQueryParams;
  const currentUrl = ExpoLinking.useURL();
  const { handleOAuthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const colors = theme.colors;
  const hasHandled = useRef(false);

  const callbackUrl = useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.href;
    }
    return currentUrl;
  }, [currentUrl]);

  useEffect(() => {
    if (hasHandled.current) return;

    const hasCallbackSource =
      Platform.OS === 'web'
        ? true
        : Boolean(callbackUrl) || hasOAuthCallbackQueryParams(params);

    if (!hasCallbackSource) {
      return;
    }

    hasHandled.current = true;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    async function handleCallback() {
      const callback = getOAuthCallbackParams({
        url: callbackUrl,
        queryParams: params,
      });

      if (callback?.error) {
        setError(callback.error);
        redirectTimer = setTimeout(() => {
          router.replace(`/login?error=${encodeURIComponent(callback.error || 'Authentication failed')}`);
        }, 2000);
        return;
      }

      if (
        callback?.token &&
        callback.refreshToken &&
        isValidJWT(callback.token)
      ) {
        try {
          await handleOAuthCallback(callback.token, callback.refreshToken);
          const target = await prepareDashboardPostAuthRoute();
          router.replace(target as any);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Authentication failed';
          setError(message);
          redirectTimer = setTimeout(() => {
            router.replace(`/login?error=${encodeURIComponent(message)}`);
          }, 2000);
        }
        return;
      }

      setError('Invalid callback parameters');
      redirectTimer = setTimeout(() => {
        router.replace('/login?error=Invalid%20callback%20parameters');
      }, 2000);
    }

    void handleCallback();

    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [callbackUrl, handleOAuthCallback, params, router]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {error ? (
        <View style={{ alignItems: 'center', padding: 24 }}>
          <Text
            style={{
              color: colors.danger,
              fontSize: 18,
              fontFamily: 'Inter_600SemiBold',
              marginBottom: 8,
            }}
          >
            Authentication Failed
          </Text>
          <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>{error}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 16 }}>
            Redirecting to login...
          </Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
          <Text style={{ color: colors.foreground, marginTop: 16 }}>
            {`Completing ${providerLabel} sign in...`}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

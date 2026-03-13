import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from 'styled-components/native';

type AddLauncherParams = Record<string, string | string[] | undefined>;

export default function AddTransactionLauncherScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const params = useLocalSearchParams() as AddLauncherParams;
  const hasNavigatedRef = useRef(false);

  const forwardedParams = useMemo(() => {
    const nextParams: Record<string, string> = {};

    Object.entries(params).forEach(([key, value]) => {
      const normalized = Array.isArray(value) ? value[0] : value;
      if (typeof normalized === 'string' && normalized.trim()) {
        nextParams[key] = normalized;
      }
    });

    if (!nextParams.return_to) {
      nextParams.return_to = encodeURIComponent('/finapp');
    }

    return nextParams;
  }, [params]);

  useEffect(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    router.push({ pathname: '/transaction-create', params: forwardedParams } as any);
  }, [forwardedParams, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

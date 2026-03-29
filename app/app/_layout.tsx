import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
} from '@expo-google-fonts/vazirmatn';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider as SCThemeProvider, useTheme as useStyledTheme } from 'styled-components/native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext';
import { AuthProvider } from '../src/context/AuthContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { ToastProvider } from '../src/components/ui/Toast';
import { OfflineBanner } from '../src/components/ui/OfflineBanner';
import { AnimatedSplash } from '../src/components/ui/AnimatedSplash';
import { BiometricLock } from '../src/components/ui/BiometricLock';
import { useAppUpdates } from '../src/hooks/useAppUpdates';
import { useAndroidNavigationBar } from '../src/hooks/useAndroidNavigationBar';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { buildTheme } from '../src/theme';
import { markStartup } from '../src/utils/startupPerf';
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 1000,
    },
  },
});

function StyledThemeWrapper({ children }: { children: ReactNode }) {
  const { isDark, colors } = useTheme();
  const { isRTL } = useLanguage();
  const theme = useMemo(() => buildTheme(colors, isDark, isRTL), [colors, isDark, isRTL]);
  return <SCThemeProvider theme={theme}>{children}</SCThemeProvider>;
}

function RootLayoutNav() {
  const { isDark } = useTheme();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [backgroundStartupEnabled, setBackgroundStartupEnabled] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_600SemiBold,
    Vazirmatn_700Bold,
  });

  useEffect(() => {
    markStartup('root_layout_mount');
  }, []);

  useAppUpdates(backgroundStartupEnabled);
  useAndroidNavigationBar();
  usePushNotifications(backgroundStartupEnabled);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded || showAnimatedSplash) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      setBackgroundStartupEnabled(true);
    });

    return () => {
      task.cancel();
    };
  }, [fontsLoaded, showAnimatedSplash]);

  // Don't render until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="+not-found" />
      </Stack>
      {showAnimatedSplash && (
        <AnimatedSplash
          onAnimationComplete={() => {
            markStartup('splash_complete');
            setShowAnimatedSplash(false);
          }}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ThemeProvider>
              <StyledThemeWrapper>
                <SettingsProvider>
                  <AuthProvider>
                    <ToastProvider>
                      <RootLayoutNav />
                      <BiometricLock />
                    </ToastProvider>
                  </AuthProvider>
                </SettingsProvider>
              </StyledThemeWrapper>
            </ThemeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

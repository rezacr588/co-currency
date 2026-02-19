import { useEffect, useState, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider as SCThemeProvider, useTheme as useStyledTheme } from 'styled-components/native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { LanguageProvider } from '../src/context/LanguageContext';
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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 1000, // 30 seconds
    },
  },
});

function StyledThemeWrapper({ children }: { children: ReactNode }) {
  const { isDark, colors } = useTheme();
  const theme = buildTheme(colors, isDark);
  return <SCThemeProvider theme={theme}>{children}</SCThemeProvider>;
}

function RootLayoutNav() {
  const { isDark } = useTheme();
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Check for OTA updates on app launch
  useAppUpdates();
  useAndroidNavigationBar();
  // Initialize push notifications on app launch (requests permission when authenticated)
  usePushNotifications();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

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
        <AnimatedSplash onAnimationComplete={() => setShowAnimatedSplash(false)} />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <StyledThemeWrapper>
            <LanguageProvider>
              <SettingsProvider>
                <AuthProvider>
                  <ToastProvider>
                    <RootLayoutNav />
                    <BiometricLock />
                  </ToastProvider>
                </AuthProvider>
              </SettingsProvider>
            </LanguageProvider>
            </StyledThemeWrapper>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

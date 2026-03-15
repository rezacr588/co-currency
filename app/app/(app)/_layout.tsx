import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from 'styled-components/native';
import { DailyRewardModal } from '../../src/components/features/DailyReward';
import { SEOHead } from '../../src/components/seo';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <>
      <SEOHead
        title="CoAI"
        description="CoAI is your personal finance copilot."
        canonicalPath="/finapp"
        noIndex
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="finapp" />
        <Stack.Screen name="todo" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="coai-chat" />
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tools" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="budgets" />
        <Stack.Screen name="recurring" />
        <Stack.Screen name="subscriptions" />
        <Stack.Screen name="badges" />
        <Stack.Screen name="historical" />
        <Stack.Screen name="planner" />
        <Stack.Screen name="planner-create" />
        <Stack.Screen name="transaction-create" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="note/[id]" />
        <Stack.Screen name="loans" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="real-value" />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      {/* Daily Reward Modal - shows once per day */}
      <DailyRewardModal />
    </>
  );
}

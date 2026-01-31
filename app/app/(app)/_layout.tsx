import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { DailyRewardModal } from '../../src/components/features/DailyReward';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="rgb(212, 175, 55)" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="budgets" />
        <Stack.Screen name="recurring" />
        <Stack.Screen name="subscriptions" />
        <Stack.Screen name="badges" />
        <Stack.Screen name="historical" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="loans" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      {/* Daily Reward Modal - shows once per day */}
      <DailyRewardModal />
    </>
  );
}

import { Stack } from 'expo-router';

export default function WalletLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="history" />
      <Stack.Screen name="convert" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="forecasting" />
    </Stack>
  );
}

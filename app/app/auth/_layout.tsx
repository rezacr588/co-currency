import { Stack } from 'expo-router';

export default function AuthCallbackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="linkedin/callback" />
      <Stack.Screen name="google/callback" />
    </Stack>
  );
}

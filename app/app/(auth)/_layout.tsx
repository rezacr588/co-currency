import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { MODE_ENTRY_ROUTE } from '../../src/navigation/mode';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Redirect href={MODE_ENTRY_ROUTE.finapp as any} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

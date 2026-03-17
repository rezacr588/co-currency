import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from 'styled-components/native';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // If authenticated, go to the app dashboard
  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  // If not authenticated, go to the public landing page
  return <Redirect href="/(public)" />;
}

import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { View, ActivityIndicator, Platform } from 'react-native';
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

  // If not authenticated:
  // - On web, show the public landing page
  // - On mobile (iOS/Android), go directly to login
  if (Platform.OS === 'web') {
    return <Redirect href="/(public)" />;
  }
  
  return <Redirect href="/(auth)/login" />;
}

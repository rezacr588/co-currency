import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '../../../../src/context/ThemeContext';

// This screen now redirects to the unified chat interface
// All AI parsing functionality has been integrated into chat.tsx
export default function AIReceiptScreen() {
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    // Redirect to the chat screen which handles all AI interactions
    router.replace('/wallet/chat');
  }, [router]);

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

import { View, Text, Pressable } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTheme } from 'styled-components/native';

export default function NotFoundScreen() {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 }}>
        <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 16 }}>
          Page Not Found
        </Text>
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 32 }}>
          The page you're looking for doesn't exist.
        </Text>
        <Link href="/" asChild>
          <Pressable style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>Go Home</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

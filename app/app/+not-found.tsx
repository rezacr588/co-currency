import { View, Text, Pressable } from 'react-native';
import { Link, Stack } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-2xl font-bold text-foreground mb-4">
          Page Not Found
        </Text>
        <Text className="text-muted-foreground text-center mb-8">
          The page you're looking for doesn't exist.
        </Text>
        <Link href="/" asChild>
          <Pressable className="bg-primary px-6 py-3 rounded-xl">
            <Text className="text-primary-foreground font-semibold">Go Home</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

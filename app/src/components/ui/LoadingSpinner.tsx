import { ActivityIndicator, View, Text } from 'react-native';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = 'large',
  color = 'rgb(212, 175, 55)',
  text,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const content = (
    <>
      <ActivityIndicator size={size} color={color} />
      {text && (
        <Text className="text-muted-foreground mt-4">{text}</Text>
      )}
    </>
  );

  if (fullScreen) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        {content}
      </View>
    );
  }

  return (
    <View className="items-center justify-center p-8">
      {content}
    </View>
  );
}

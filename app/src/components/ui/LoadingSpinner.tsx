import { ActivityIndicator, View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';

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
  const theme = useTheme();
  const colors = theme.colors;

  const content = (
    <>
      <ActivityIndicator size={size} color={color} />
      {text && (
        <Text style={{ color: colors.mutedForeground, marginTop: 16 }}>{text}</Text>
      )}
    </>
  );

  if (fullScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        {content}
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      {content}
    </View>
  );
}

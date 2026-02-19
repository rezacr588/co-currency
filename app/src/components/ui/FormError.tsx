import { View, Text } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';

interface FormErrorProps {
  message: string;
}

export function FormError({ message }: FormErrorProps) {
  const theme = useTheme();
  const colors = theme.colors;

  if (!message) return null;

  return (
    <View
      style={{
        backgroundColor: colors.dangerMuted,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <AlertCircle size={16} color={colors.danger} />
      <Text style={{ color: colors.danger, fontSize: 14, flex: 1 }}>{message}</Text>
    </View>
  );
}

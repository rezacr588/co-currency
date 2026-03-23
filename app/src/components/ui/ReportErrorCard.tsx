import { View, Text, Pressable } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { Card } from './Card';

interface ReportErrorCardProps {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ReportErrorCard({
  title,
  message,
  onRetry,
  retryLabel = 'Retry',
}: ReportErrorCardProps) {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <Card style={{ padding: 24, alignItems: 'center' }}>
      <AlertCircle size={48} color={colors.danger} />
      <Text
        style={{
          color: colors.foreground,
          fontFamily: 'Inter_600SemiBold',
          marginTop: 16,
          fontSize: 18,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.mutedForeground,
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => ({
            marginTop: 16,
            backgroundColor: colors.accent,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 10,
            opacity: pressed ? 0.85 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          accessibilityHint="Try loading the report again"
        >
          <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' }}>
            {retryLabel}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}


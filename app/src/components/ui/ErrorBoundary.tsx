import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const theme = useTheme();
  const { colors, spacing, radii, typography } = theme;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xxl,
        backgroundColor: colors.background,
      }}
    >
      <AlertTriangle size={48} color={colors.danger} />
      <Text
        style={{
          ...typography.h2,
          marginTop: spacing.lg,
          color: colors.foreground,
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          ...typography.body,
          color: colors.mutedForeground,
          marginTop: spacing.sm,
          textAlign: 'center',
        }}
      >
        {error?.message || 'An unexpected error occurred'}
      </Text>
      <Pressable
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={{
          marginTop: spacing.xxl,
          paddingHorizontal: spacing.xxl,
          paddingVertical: spacing.md,
          backgroundColor: colors.accent,
          borderRadius: radii.sm,
        }}
      >
        <Text style={{ ...typography.bodyMedium, color: colors.accentForeground }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

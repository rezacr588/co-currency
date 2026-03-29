import { memo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTheme } from 'styled-components/native';
import { PlannerScreenContent } from '../planner';
import { useScreenLayout } from '../../../src/hooks/useScreenLayout';
import { ErrorBoundary } from '../../../src/components/ui/ErrorBoundary';

export default memo(function PlannerTabScreen() {
  const theme = useTheme();
  const { width, isDesktop, isTablet } = useScreenLayout();

  // Wait for valid dimensions before deciding layout
  if (width === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (isDesktop || isTablet) {
    return <Redirect href="/planner" />;
  }

  return (
    <ErrorBoundary>
      <PlannerScreenContent />
    </ErrorBoundary>
  );
});

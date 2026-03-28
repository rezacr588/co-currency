import { Redirect } from 'expo-router';
import { PlannerScreenContent } from '../planner';
import { useScreenLayout } from '../../../src/hooks/useScreenLayout';

export default function PlannerTabScreen() {
  const { isDesktop, isTablet } = useScreenLayout();

  if (isDesktop || isTablet) {
    return <Redirect href="/planner" />;
  }

  return <PlannerScreenContent />;
}

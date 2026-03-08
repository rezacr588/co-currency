import { useWindowDimensions } from 'react-native';
import { getScreenLayout } from '../utils/screenLayout';

export function useScreenLayout() {
  const { width, height } = useWindowDimensions();

  return {
    ...getScreenLayout(width),
    height,
  };
}

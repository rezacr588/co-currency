import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

export function useAndroidNavigationBar() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const applyImmersive = async () => {
      try {
        const navBar = NavigationBar as typeof NavigationBar & {
          setPositionAsync?: (position: 'absolute' | 'relative') => Promise<void>;
        };
        if (navBar.setPositionAsync) {
          await navBar.setPositionAsync('absolute');
        }
        await NavigationBar.setVisibilityAsync('hidden');
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        await NavigationBar.setBackgroundColorAsync('transparent');
      } catch {
        // Best effort; ignore failures on unsupported devices.
      }
    };

    applyImmersive();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        applyImmersive();
      }
    });

    return () => subscription.remove();
  }, []);
}

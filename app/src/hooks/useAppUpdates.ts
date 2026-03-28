import { useEffect, useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as Updates from 'expo-updates';

export function useAppUpdates(enabled: boolean = true) {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkForUpdates = useCallback(async () => {
    // Updates only work in production builds, not in Expo Go or dev
    if (__DEV__ || Platform.OS === 'web') {
      return;
    }

    try {
      setIsChecking(true);
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateAvailable(true);
        promptUpdate();
      }
    } catch (error) {
      // Silently fail - don't bother user if update check fails
      console.log('Update check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const downloadAndApplyUpdate = useCallback(async () => {
    if (__DEV__ || Platform.OS === 'web') {
      return;
    }

    try {
      setIsDownloading(true);
      await Updates.fetchUpdateAsync();

      Alert.alert(
        'Update Ready',
        'The app will now restart to apply the update.',
        [
          {
            text: 'Restart Now',
            onPress: () => {
              Updates.reloadAsync().catch((err) => {
                console.error('Failed to reload app after update:', err);
                Alert.alert('Restart Failed', 'Please restart the app manually.');
              });
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Update Failed', 'Could not download the update. Please try again later.');
      console.log('Update download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const promptUpdate = useCallback(() => {
    Alert.alert(
      'Update Available',
      'A new version of CoAI is available. Would you like to update now?',
      [
        {
          text: 'Later',
          style: 'cancel',
        },
        {
          text: 'Update',
          onPress: downloadAndApplyUpdate,
        },
      ]
    );
  }, [downloadAndApplyUpdate]);

  // Check for updates on mount
  useEffect(() => {
    if (!enabled) {
      return;
    }

    checkForUpdates();
  }, [checkForUpdates, enabled]);

  return {
    isChecking,
    isDownloading,
    updateAvailable,
    checkForUpdates,
    downloadAndApplyUpdate,
  };
}

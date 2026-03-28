import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

// Types for expo-notifications (inline to avoid requiring the package for TypeScript)
interface NotificationChannelConfig {
  name: string;
  description?: string;
  importance: number;
  vibrationPattern?: number[];
  lightColor?: string;
}

interface NotificationContent {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: boolean;
}

interface NotificationTrigger {
  seconds: number;
}

interface NotificationModule {
  setNotificationHandler: (config: { handleNotification: () => Promise<{ shouldShowAlert: boolean; shouldPlaySound: boolean; shouldSetBadge: boolean }> }) => void;
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (config: { projectId: string }) => Promise<{ data: string }>;
  setNotificationChannelAsync: (id: string, config: NotificationChannelConfig) => Promise<void>;
  addNotificationReceivedListener: (cb: (notif: unknown) => void) => { remove: () => void };
  addNotificationResponseReceivedListener: (cb: (response: unknown) => void) => { remove: () => void };
  scheduleNotificationAsync: (config: { content: NotificationContent; trigger: NotificationTrigger }) => Promise<void>;
  AndroidImportance: { MAX: number; HIGH: number };
}

interface DeviceModule {
  isDevice: boolean;
  modelName: string;
}

interface ExpoConstants {
  expoConfig?: { extra?: { eas?: { projectId?: string } } };
  easConfig?: { projectId?: string };
}

// Lazy import notifications module to handle missing dependency gracefully
let Notifications: NotificationModule | null = null;
let Device: DeviceModule | null = null;
let Constants: ExpoConstants | null = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  Constants = require('expo-constants').default;

  // Configure notification handler if available
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch {
  console.log('Push notification dependencies not installed');
}

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: unknown | null;
  error: string | null;
}

export function usePushNotifications(enabled: boolean = true) {
  const { isAuthenticated } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  const registerForPushNotifications = useCallback(async () => {
    if (!Notifications || !Device) {
      console.warn('[PushNotifications] Push notifications not available (missing dependencies)');
      setError('Push notifications not available');
      return null;
    }

    if (!Device.isDevice) {
      console.warn('[PushNotifications] Push notifications require a physical device');
      setError('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[PushNotifications] Permission denied by user');
        setError('Permission for push notifications was denied');
        return null;
      }

      // Get the Expo push token
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ??
                       Constants?.easConfig?.projectId;

      if (!projectId) {
        // For development, use a placeholder
        console.warn('No EAS project ID found, using development token');
        const devToken = `dev-${Device.modelName}-${Date.now()}`;
        setExpoPushToken(devToken);
        return devToken;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = tokenData.data;
      setExpoPushToken(token);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#d4af37',
        });

        await Notifications.setNotificationChannelAsync('budget-alerts', {
          name: 'Budget Alerts',
          description: 'Notifications when you approach or exceed budget limits',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#ef4444',
        });

        await Notifications.setNotificationChannelAsync('loan-reminders', {
          name: 'Loan Reminders',
          description: 'Reminders for upcoming loan payments',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#f59e0b',
        });
      }

      return token;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get push token');
      return null;
    }
  }, []);

  // Register token with backend
  const registerTokenWithBackend = useCallback(async (token: string) => {
    try {
      await api.notifications.registerToken(token, Platform.OS);
    } catch (err) {
      console.warn('Failed to register push token with backend:', err);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !Notifications) {
      setIsLoading(false);
      return;
    }

    // Register for push notifications
    setIsLoading(true);
    registerForPushNotifications().then((token) => {
      if (token) {
        registerTokenWithBackend(token);
      } else {
        console.warn('[PushNotifications] Registration returned null token');
      }
    }).catch((err) => {
      console.error('[PushNotifications] Registration failed:', err);
      setError(err instanceof Error ? err.message : 'Push notification registration failed');
    }).finally(() => {
      setIsLoading(false);
    });

    // Listen for incoming notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((notif: unknown) => {
      setNotification(notif);
    });

    // Listen for notification interactions
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: unknown) => {
      const data = (response as { notification?: { request?: { content?: { data?: Record<string, string> } } } })?.notification?.request?.content?.data;
      // Handle notification tap - navigate based on type
      if (data?.type === 'budget_alert' && data?.budgetId) {
        // Navigate to budgets screen
        // router.push('/(app)/budgets');
      } else if (data?.type === 'loan_reminder' && data?.loanId) {
        // Navigate to loans screen
        // router.push('/(app)/loans');
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [enabled, isAuthenticated, registerForPushNotifications, registerTokenWithBackend]);

  return {
    expoPushToken,
    notification,
    error,
    isLoading,
    registerForPushNotifications,
  };
}

// Utility to schedule a local notification (for testing)
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  seconds: number = 1
) {
  if (!Notifications) {
    Alert.alert('Push notifications not available', 'Please install expo-notifications');
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: { seconds },
  });
}

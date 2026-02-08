import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  PiggyBank,
  CreditCard,
  Target,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';
import { api } from '../../src/api';
import { useLanguage } from '../../src/context/LanguageContext';
import { useTheme, useColors } from '../../src/context/ThemeContext';
import { usePushNotifications, scheduleLocalNotification } from '../../src/hooks/usePushNotifications';
import { haptics } from '../../src/utils/haptics';
import { Toggle } from '../../src/components/ui/Toggle';
import type { NotificationPreferences } from '../../src/api/notifications';

export default function NotificationSettingsScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = useColors();
  const { expoPushToken, error: pushError, isLoading: isPushLoading, registerForPushNotifications } = usePushNotifications();

  const iconColor = isDark ? colors.foreground : 'rgb(51, 65, 85)';

  // Fetch current preferences
  const { data: prefsData, isPending } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => api.notifications.getPreferences(),
    retry: false,
  });

  const preferences = prefsData?.preferences;

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) => api.notifications.updatePreferences(data),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
    },
    onError: (err) => {
      haptics.error();
      Alert.alert(
        t('error') || 'Error',
        err instanceof Error ? err.message : t('updateFailed') || 'Failed to update preferences'
      );
    },
  });

  const togglePreference = (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    haptics.light();
    updateMutation.mutate({ [key]: !preferences[key] });
  };

  const handleTestNotification = async () => {
    haptics.medium();
    try {
      await scheduleLocalNotification(
        'Test Notification',
        'Push notifications are working correctly!',
        { type: 'test' },
        1
      );
      Alert.alert(
        t('success') || 'Success',
        t('testNotificationSent') || 'Test notification scheduled. You should see it shortly.'
      );
    } catch (err) {
      Alert.alert(
        t('error') || 'Error',
        t('notificationFailed') || 'Failed to schedule notification'
      );
    }
  };

  const handleRequestPermission = async () => {
    haptics.medium();
    await registerForPushNotifications();
  };

  const SettingRow = ({
    icon,
    title,
    description,
    value,
    onToggle,
    disabled = false,
  }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    value: boolean;
    onToggle: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      className={`flex-row items-center justify-between p-4 border-b border-border ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <View className="flex-row items-center flex-1 mr-4">
        {icon}
        <View className="ml-3 flex-1">
          <Text className="text-foreground font-medium">{title}</Text>
          <Text className="text-muted-foreground text-xs mt-0.5">{description}</Text>
        </View>
      </View>
      <Toggle
        value={value}
        onValueChange={() => onToggle()}
        disabled={disabled}
      />
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2" hitSlop={12}>
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">
          {t('notificationSettings') || 'Notification Settings'}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {/* Push Token Status */}
        <View className="bg-card border border-border p-4 rounded-xl mb-6">
          <View className="flex-row items-center mb-2">
            <Bell size={20} color={colors.accent} />
            <Text className="text-foreground font-semibold ml-2">
              {t('pushNotifications') || 'Push Notifications'}
            </Text>
          </View>
          {expoPushToken ? (
            <View className="bg-success/10 border border-success/20 p-3 rounded-lg">
              <Text className="text-success text-sm">
                {t('notificationsEnabled') || 'Push notifications are enabled'}
              </Text>
            </View>
          ) : isPushLoading ? (
            <View className="items-center py-2">
              <ActivityIndicator color={colors.accent} />
              <Text className="text-muted-foreground text-sm mt-2">
                {t('checkingPermissions') || 'Checking permissions...'}
              </Text>
            </View>
          ) : pushError ? (
            <View>
              <View className="bg-danger/10 border border-danger/20 p-3 rounded-lg mb-3">
                <View className="flex-row items-center">
                  <AlertCircle size={16} color={colors.danger} />
                  <Text className="text-danger text-sm ml-2">{pushError}</Text>
                </View>
              </View>
              <Pressable
                onPress={handleRequestPermission}
                className="bg-accent p-3 rounded-lg items-center"
              >
                <Text className="text-accent-foreground font-medium">
                  {t('enableNotifications') || 'Enable Notifications'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <View className="bg-muted/50 border border-border p-3 rounded-lg mb-3">
                <Text className="text-muted-foreground text-sm">
                  {t('notificationsNotSetUp') || 'Push notifications are not set up yet'}
                </Text>
              </View>
              <Pressable
                onPress={handleRequestPermission}
                className="bg-accent p-3 rounded-lg items-center"
              >
                <Text className="text-accent-foreground font-medium">
                  {t('enableNotifications') || 'Enable Notifications'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Notification Types */}
        {isPending ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : preferences ? (
          <View className="bg-card border border-border rounded-xl overflow-hidden mb-6">
            <Text className="text-sm text-muted-foreground p-4 pb-2">
              {t('notificationTypes') || 'Notification Types'}
            </Text>

            <SettingRow
              icon={<PiggyBank size={20} color={colors.accent} />}
              title={t('budgetAlerts') || 'Budget Alerts'}
              description={t('budgetAlertsDesc') || 'Get notified when approaching or exceeding budgets'}
              value={preferences.budget_alerts}
              onToggle={() => togglePreference('budget_alerts')}
              disabled={!expoPushToken}
            />

            <SettingRow
              icon={<CreditCard size={20} color={colors.accent} />}
              title={t('loanReminders') || 'Loan Reminders'}
              description={t('loanRemindersDesc') || 'Reminders for upcoming loan payments'}
              value={preferences.loan_reminders}
              onToggle={() => togglePreference('loan_reminders')}
              disabled={!expoPushToken}
            />

            <SettingRow
              icon={<Target size={20} color={colors.accent} />}
              title={t('goalUpdates') || 'Goal Updates'}
              description={t('goalUpdatesDesc') || 'Celebrate when you reach savings milestones'}
              value={preferences.goal_updates}
              onToggle={() => togglePreference('goal_updates')}
              disabled={!expoPushToken}
            />

            <SettingRow
              icon={<Calendar size={20} color={colors.accent} />}
              title={t('weeklyRecap') || 'Weekly Recap'}
              description={t('weeklyRecapDesc') || 'Get a weekly summary of your finances'}
              value={preferences.weekly_recap}
              onToggle={() => togglePreference('weekly_recap')}
              disabled={!expoPushToken}
            />
          </View>
        ) : (
          <View className="bg-muted/50 p-6 rounded-xl items-center mb-6">
            <Text className="text-muted-foreground text-center">
              {t('unableToLoadPreferences') || 'Unable to load notification preferences'}
            </Text>
          </View>
        )}

        {/* Test Notification */}
        {expoPushToken && (
          <Pressable
            onPress={handleTestNotification}
            className="bg-secondary border border-border p-4 rounded-xl flex-row items-center justify-center"
          >
            <Bell size={20} color={iconColor} />
            <Text className="text-foreground font-medium ml-2">
              {t('sendTestNotification') || 'Send Test Notification'}
            </Text>
          </Pressable>
        )}

        {/* Info */}
        <View className="mt-6">
          <Text className="text-muted-foreground text-xs text-center">
            {t('notificationInfo') ||
              'Notifications are processed on our servers and sent via Expo Push Notification service. You can disable notifications at any time from your device settings.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

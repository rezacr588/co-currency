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
import { useTheme } from '../../src/context/ThemeContext';
import { useTheme as useStyledTheme } from 'styled-components/native';
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
  const styledTheme = useStyledTheme();
  const colors = styledTheme.colors;
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
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginEnd: 16 }}>
        {icon}
        <View style={{ marginStart: 12, flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>{title}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{description}</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }} hitSlop={12}>
          <ArrowLeft size={24} color={iconColor} />
        </Pressable>
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
          {t('notificationSettings') || 'Notification Settings'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {/* Push Token Status */}
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Bell size={20} color={colors.accent} />
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginStart: 8 }}>
              {t('pushNotifications') || 'Push Notifications'}
            </Text>
          </View>
          {expoPushToken ? (
            <View style={{ backgroundColor: colors.success + '1a', borderWidth: 1, borderColor: colors.success + '33', padding: 12, borderRadius: 8 }}>
              <Text style={{ color: colors.success, fontSize: 14 }}>
                {t('notificationsEnabled') || 'Push notifications are enabled'}
              </Text>
            </View>
          ) : isPushLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
                {t('checkingPermissions') || 'Checking permissions...'}
              </Text>
            </View>
          ) : pushError ? (
            <View>
              <View style={{ backgroundColor: colors.danger + '1a', borderWidth: 1, borderColor: colors.danger + '33', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AlertCircle size={16} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontSize: 14, marginStart: 8 }}>{pushError}</Text>
                </View>
              </View>
              <Pressable
                onPress={handleRequestPermission}
                style={{ backgroundColor: colors.accent, padding: 12, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium' }}>
                  {t('enableNotifications') || 'Enable Notifications'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <View style={{ backgroundColor: colors.muted + '80', borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  {t('notificationsNotSetUp') || 'Push notifications are not set up yet'}
                </Text>
              </View>
              <Pressable
                onPress={handleRequestPermission}
                style={{ backgroundColor: colors.accent, padding: 12, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_500Medium' }}>
                  {t('enableNotifications') || 'Enable Notifications'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Notification Types */}
        {isPending ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : preferences ? (
          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, padding: 16, paddingBottom: 8 }}>
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
          <View style={{ backgroundColor: colors.muted + '80', padding: 24, borderRadius: 12, alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
              {t('unableToLoadPreferences') || 'Unable to load notification preferences'}
            </Text>
          </View>
        )}

        {/* Test Notification */}
        {expoPushToken && (
          <Pressable
            onPress={handleTestNotification}
            style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <Bell size={20} color={iconColor} />
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', marginStart: 8 }}>
              {t('sendTestNotification') || 'Send Test Notification'}
            </Text>
          </Pressable>
        )}

        {/* Info */}
        <View style={{ marginTop: 24 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center' }}>
            {t('notificationInfo') ||
              'Notifications are processed on our servers and sent via Expo Push Notification service. You can disable notifications at any time from your device settings.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

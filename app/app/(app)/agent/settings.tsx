/**
 * Agent Settings Screen
 * Configure AI agent behavior, thresholds, and permissions
 */

import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Switch, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Zap, Clock, Save } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAgentConfig, useUpdateAgentConfig } from '@/src/hooks/useAgent';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { useToast } from '@/src/components/ui/Toast';
import { haptics } from '@/src/utils/haptics';
import { spacing, radii } from '@/src/theme';

interface SettingsSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ icon, title, children }: SettingsSectionProps) {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        {icon}
        <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
          {title}
        </Text>
      </View>
      <View style={{ backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  last?: boolean;
}

function SettingsRow({ label, description, children, last }: SettingsRowProps) {
  const theme = useTheme();
  const colors = theme.colors;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View style={{ flex: 1, marginEnd: spacing.lg }}>
        <Text style={{ fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.foreground }}>
          {label}
        </Text>
        {description && (
          <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
            {description}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

export default function AgentSettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const { showToast } = useToast();

  const { data: configData, isLoading } = useAgentConfig();
  const updateConfig = useUpdateAgentConfig();
  const config = configData?.config;

  // Local state for settings
  const [enabled, setEnabled] = useState(true);
  const [autoApproveThreshold, setAutoApproveThreshold] = useState('50');
  const [autoApproveCurrency, setAutoApproveCurrency] = useState('USD');
  const [requireBiometricAbove, setRequireBiometricAbove] = useState('100');
  const [dailyAutopilotEnabled, setDailyAutopilotEnabled] = useState(false);
  const [autopilotTime, setAutopilotTime] = useState('09:00:00');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state when config loads
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled ?? true);
      setAutoApproveThreshold(String(config.auto_approve_threshold ?? 50));
      setAutoApproveCurrency(config.auto_approve_currency ?? 'USD');
      setRequireBiometricAbove(String(config.require_biometric_above ?? 100));
      setDailyAutopilotEnabled(config.daily_autopilot_enabled ?? false);
      setAutopilotTime(config.autopilot_time ?? '09:00:00');
    }
  }, [config]);

  const handleSave = useCallback(async () => {
    haptics.medium();
    try {
      await updateConfig.mutateAsync({
        enabled,
        auto_approve_threshold: parseFloat(autoApproveThreshold) || 50,
        auto_approve_currency: autoApproveCurrency,
        require_biometric_above: parseFloat(requireBiometricAbove) || 100,
        daily_autopilot_enabled: dailyAutopilotEnabled,
        autopilot_time: autopilotTime,
      });
      haptics.success();
      showToast(t('settingsSaved') || 'Settings saved', 'success');
      setHasChanges(false);
    } catch (err: any) {
      haptics.error();
      showToast(err?.message || t('failedToSaveSettings') || 'Failed to save settings', 'error');
    }
  }, [enabled, autoApproveThreshold, autoApproveCurrency, requireBiometricAbove, dailyAutopilotEnabled, autopilotTime, updateConfig, showToast, t]);

  const markChanged = () => setHasChanges(true);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <LoadingSpinner size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('a11yBack') || 'Back'}
            hitSlop={8}
            style={({ pressed }) => [{ padding: spacing.sm, marginEnd: spacing.sm }, pressed && { opacity: 0.7 }]}
          >
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {t('agentSettings') || 'Agent Settings'}
          </Text>
        </View>
        {hasChanges && (
          <Button onPress={handleSave} disabled={updateConfig.isPending} variant="accent" size="sm">
            <Save size={16} color={colors.accentForeground} />
            <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', marginStart: spacing.xs }}>
              {updateConfig.isPending ? t('saving') || 'Saving...' : t('save') || 'Save'}
            </Text>
          </Button>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <SettingsSection
          icon={<Zap size={20} color={colors.accent} />}
          title={t('generalSettings') || 'General Settings'}
        >
          <SettingsRow
            label={t('enableAgent') || 'Enable Agent'}
            description={t('enableAgentDesc') || 'Turn the AI financial agent on or off'}
            last
          >
            <Switch
              value={enabled}
              onValueChange={(v) => { setEnabled(v); markChanged(); haptics.light(); }}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.primaryForeground}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          icon={<Shield size={20} color={colors.success} />}
          title={t('approvalSettings') || 'Approval Settings'}
        >
          <SettingsRow
            label={t('autoApproveThreshold') || 'Auto-approve threshold'}
            description={t('autoApproveThresholdDesc') || 'Max amount for auto-approval'}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: spacing.md, paddingVertical: 6, width: 80, textAlign: 'right', color: colors.foreground }}
                value={autoApproveThreshold}
                onChangeText={(v) => { setAutoApproveThreshold(v); markChanged(); }}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, width: 60, textAlign: 'center', color: colors.foreground, marginStart: spacing.sm }}
                value={autoApproveCurrency}
                onChangeText={(v) => { setAutoApproveCurrency(v.toUpperCase()); markChanged(); }}
                maxLength={3}
                autoCapitalize="characters"
              />
            </View>
          </SettingsRow>
          <SettingsRow
            label={t('requireBiometricAbove') || 'Require biometric above'}
            description={t('requireBiometricAboveDesc') || 'Amount requiring biometric confirmation'}
            last
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.mutedForeground, marginEnd: spacing.xs }}>{autoApproveCurrency}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: spacing.md, paddingVertical: 6, width: 80, textAlign: 'right', color: colors.foreground }}
                value={requireBiometricAbove}
                onChangeText={(v) => { setRequireBiometricAbove(v); markChanged(); }}
                keyboardType="decimal-pad"
              />
            </View>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          icon={<Clock size={20} color={colors.info} />}
          title={t('autopilotSettings') || 'Autopilot Settings'}
        >
          <SettingsRow
            label={t('dailyAutopilot') || 'Daily autopilot'}
            description={t('dailyAutopilotDesc') || 'Run automated tasks daily'}
          >
            <Switch
              value={dailyAutopilotEnabled}
              onValueChange={(v) => { setDailyAutopilotEnabled(v); markChanged(); haptics.light(); }}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.primaryForeground}
            />
          </SettingsRow>
          <SettingsRow
            label={t('autopilotTime') || 'Autopilot time'}
            description={t('autopilotTimeDesc') || 'When to run daily tasks (HH:MM)'}
            last
          >
            <TextInput
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: spacing.md, paddingVertical: 6, width: 100, textAlign: 'center', color: colors.foreground }}
              value={autopilotTime.slice(0, 5)}
              onChangeText={(v) => { setAutopilotTime(v + ':00'); markChanged(); }}
              placeholder="09:00"
              placeholderTextColor={colors.placeholder}
              editable={dailyAutopilotEnabled}
            />
          </SettingsRow>
        </SettingsSection>

        <View style={{ backgroundColor: colors.card, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: spacing.sm }}>
            {t('note') || 'Note'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 18 }}>
            {t('agentSettingsNote') || 'Changes to these settings will affect how the AI agent behaves. Higher thresholds mean more manual approvals required.'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

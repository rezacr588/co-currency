/**
 * Create Agent Plan Screen (Simplified)
 * Backend currently supports: title, description, goal_type, priority, target_amount/currency
 */

import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Target } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '@/src/context/LanguageContext';
import { useCreatePlan } from '@/src/hooks/useAgent';
import { Button } from '@/src/components/ui/Button';
import { FormError } from '@/src/components/ui/FormError';
import { useToast } from '@/src/components/ui/Toast';
import { haptics } from '@/src/utils/haptics';
import { spacing, radii } from '@/src/theme';
import type { CreatePlanRequest } from '@/src/api/agent';

type GoalType = 'savings' | 'debt_payoff' | 'budget_optimization' | 'investment' | 'emergency_fund' | 'custom';
type Priority = 'low' | 'medium' | 'high' | 'urgent';

const GOAL_TYPES: { value: GoalType; label: string; icon: string }[] = [
  { value: 'savings', label: 'Savings', icon: '💰' },
  { value: 'debt_payoff', label: 'Pay Off Debt', icon: '💳' },
  { value: 'investment', label: 'Investment', icon: '📈' },
  { value: 'budget_optimization', label: 'Optimize Budget', icon: '📊' },
  { value: 'emergency_fund', label: 'Emergency Fund', icon: '🚨' },
  { value: 'custom', label: 'Custom Goal', icon: '🎯' },
];

export default function CreatePlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const { showToast } = useToast();
  const createPlan = useCreatePlan();

  const priorities: { value: Priority; label: string; color: string }[] = useMemo(() => [
    { value: 'low', label: t('priorityLow') || 'Low', color: colors.palette.gray },
    { value: 'medium', label: t('priorityMedium') || 'Medium', color: colors.warning },
    { value: 'high', label: t('priorityHigh') || 'High', color: colors.palette.orange },
    { value: 'urgent', label: t('priorityUrgent') || 'Urgent', color: colors.danger },
  ], [colors, t]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('savings');
  const [priority, setPriority] = useState<Priority>('medium');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [error, setError] = useState('');

  const validate = useCallback(() => {
    if (!title.trim()) {
      setError(t('planTitleRequired') || 'Plan title is required');
      return false;
    }
    setError('');
    return true;
  }, [title, t]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      haptics.error();
      return;
    }

    haptics.medium();
    
    const payload: CreatePlanRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      goal_type: goalType,
      priority,
      target_amount: targetAmount ? parseFloat(targetAmount) : undefined,
      target_currency: targetCurrency || undefined,
    };

    try {
      await createPlan.mutateAsync(payload);
      haptics.success();
      showToast(t('planCreated') || 'Plan created successfully', 'success');
      router.back();
    } catch (err: any) {
      haptics.error();
      setError(err?.message || t('failedToCreatePlan') || 'Failed to create plan');
    }
  }, [validate, title, description, goalType, priority, targetAmount, targetCurrency, createPlan, showToast, router, t]);

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
            {t('createPlan') || 'Create Plan'}
          </Text>
        </View>
        <Button onPress={handleSubmit} disabled={createPlan.isPending} variant="accent" size="sm">
          {createPlan.isPending ? t('creating') || 'Creating...' : t('create') || 'Create'}
        </Button>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        {error && <FormError message={error} />}

        <View style={{ marginBottom: spacing.xxl }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: spacing.md }}>
            {t('basicInfo') || 'Basic Information'}
          </Text>

          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.sm }}>{t('planTitle') || 'Plan Title'}</Text>
          <TextInput
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: spacing.md, fontSize: 16, color: colors.foreground, marginBottom: spacing.lg }}
            value={title}
            onChangeText={setTitle}
            placeholder={t('enterPlanTitle') || 'Enter plan title'}
            placeholderTextColor={colors.placeholder}
          />

          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.sm }}>{t('description') || 'Description'}</Text>
          <TextInput
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: spacing.md, fontSize: 16, color: colors.foreground, minHeight: 80, textAlignVertical: 'top' }}
            value={description}
            onChangeText={setDescription}
            placeholder={t('enterDescription') || 'Enter description (optional)'}
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={{ marginBottom: spacing.xxl }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: spacing.md }}>
            {t('goalSettings') || 'Goal Settings'}
          </Text>

          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.sm }}>{t('goalType') || 'Goal Type'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg, gap: spacing.sm }}>
            {GOAL_TYPES.map((type) => (
              <Pressable
                key={type.value}
                onPress={() => { haptics.light(); setGoalType(type.value); }}
                accessibilityRole="button"
                accessibilityLabel={type.label}
                accessibilityState={{ selected: goalType === type.value }}
                style={({ pressed }) => [{ backgroundColor: goalType === type.value ? colors.accent : colors.card, borderWidth: 1, borderColor: goalType === type.value ? colors.accent : colors.border, borderRadius: radii.sm, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ fontSize: 18 }}>{type.icon}</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: goalType === type.value ? colors.accentForeground : colors.foreground }}>
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.sm }}>{t('priority') || 'Priority'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {priorities.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => { haptics.light(); setPriority(p.value); }}
                accessibilityRole="button"
                accessibilityLabel={p.label}
                accessibilityState={{ selected: priority === p.value }}
                style={({ pressed }) => [{ backgroundColor: priority === p.value ? p.color : colors.card, borderWidth: 1, borderColor: priority === p.value ? p.color : colors.border, borderRadius: radii.sm, padding: spacing.md, paddingHorizontal: spacing.lg }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: priority === p.value ? colors.primaryForeground : colors.foreground }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ marginBottom: spacing.xxl }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: spacing.md }}>
            {t('target') || 'Target'} ({t('optional') || 'Optional'})
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.sm }}>{t('amount') || 'Amount'}</Text>
              <TextInput
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: spacing.md, fontSize: 16, color: colors.foreground }}
                value={targetAmount}
                onChangeText={setTargetAmount}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: 100 }}>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.sm }}>{t('currency') || 'Currency'}</Text>
              <TextInput
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, padding: spacing.md, fontSize: 16, color: colors.foreground }}
                value={targetCurrency}
                onChangeText={setTargetCurrency}
                placeholder="USD"
                placeholderTextColor={colors.placeholder}
                maxLength={3}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: colors.card, borderRadius: radii.sm, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Target size={18} color={colors.accent} />
            <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {t('note') || 'Note'}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 18 }}>
            {t('createPlanNote') || 'You can add steps and configure actions after creating the plan.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

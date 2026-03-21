/**
 * Create Agent Plan Screen (Simplified)
 * Backend currently supports: title, description, goal_type, priority, target_amount/currency
 */

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Alert } from 'react-native';
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

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

export default function CreatePlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const { showToast } = useToast();
  const createPlan = useCreatePlan();

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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ padding: 8, marginEnd: 8 }, pressed && { opacity: 0.7 }]} hitSlop={8}>
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {error && <FormError message={error} />}

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 12 }}>
            {t('basicInfo') || 'Basic Information'}
          </Text>

          <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>{t('planTitle') || 'Plan Title'}</Text>
          <TextInput
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: colors.foreground, marginBottom: 16 }}
            value={title}
            onChangeText={setTitle}
            placeholder={t('enterPlanTitle') || 'Enter plan title'}
            placeholderTextColor={colors.muted}
          />

          <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>{t('description') || 'Description'}</Text>
          <TextInput
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: colors.foreground, minHeight: 80, textAlignVertical: 'top' }}
            value={description}
            onChangeText={setDescription}
            placeholder={t('enterDescription') || 'Enter description (optional)'}
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 12 }}>
            {t('goalSettings') || 'Goal Settings'}
          </Text>

          <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>{t('goalType') || 'Goal Type'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 }}>
            {GOAL_TYPES.map((type) => (
              <Pressable
                key={type.value}
                onPress={() => { haptics.light(); setGoalType(type.value); }}
                style={({ pressed }) => [{ backgroundColor: goalType === type.value ? colors.accent : colors.card, borderWidth: 1, borderColor: goalType === type.value ? colors.accent : colors.border, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ fontSize: 18 }}>{type.icon}</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: goalType === type.value ? colors.background : colors.foreground }}>
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>{t('priority') || 'Priority'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRIORITIES.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => { haptics.light(); setPriority(p.value); }}
                style={({ pressed }) => [{ backgroundColor: priority === p.value ? p.color : colors.card, borderWidth: 1, borderColor: priority === p.value ? p.color : colors.border, borderRadius: 8, padding: 12, paddingHorizontal: 16 }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: priority === p.value ? '#fff' : colors.foreground }}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 12 }}>
            {t('target') || 'Target'} ({t('optional') || 'Optional'})
          </Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>{t('amount') || 'Amount'}</Text>
              <TextInput
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: colors.foreground }}
                value={targetAmount}
                onChangeText={setTargetAmount}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: 100 }}>
              <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>{t('currency') || 'Currency'}</Text>
              <TextInput
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 16, color: colors.foreground }}
                value={targetCurrency}
                onChangeText={setTargetCurrency}
                placeholder="USD"
                placeholderTextColor={colors.muted}
                maxLength={3}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: colors.card, borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Target size={18} color={colors.accent} />
            <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {t('note') || 'Note'}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
            {t('createPlanNote') || 'You can add steps and configure actions after creating the plan.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

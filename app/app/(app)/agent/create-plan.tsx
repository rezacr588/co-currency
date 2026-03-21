/**
 * Create Agent Plan Screen
 * 
 * Allows users to create new financial plans with:
 * - Plan title and description
 * - Goal type selection
 * - Priority level
 * - Target amount and currency
 * - Multiple steps with action types
 * - AI reasoning/notes
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, X, Sparkles, Target } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { useLanguage } from '@/src/context/LanguageContext';
import { useCreatePlan } from '@/src/hooks/useAgent';
import { Button } from '@/src/components/ui/Button';
import { FormError } from '@/src/components/ui/FormError';
import { useToast } from '@/src/components/ui/Toast';
import { haptics } from '@/src/utils/haptics';
import type { CreatePlanRequest, PlanStep } from '@/src/api/agent';

type GoalType = 'save' | 'debt_payoff' | 'invest' | 'budget_optimization' | 'expense_reduction' | 'custom';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type ActionType = 'transfer' | 'goal_contribution' | 'budget_adjustment' | 'recurring_update' | 'subscription_cancel' | 'debt_payment' | 'alert' | 'recommendation';

const GOAL_TYPES: { value: GoalType; label: string; icon: string }[] = [
  { value: 'save', label: 'Save Money', icon: '💰' },
  { value: 'debt_payoff', label: 'Pay Off Debt', icon: '💳' },
  { value: 'invest', label: 'Invest', icon: '📈' },
  { value: 'budget_optimization', label: 'Optimize Budget', icon: '📊' },
  { value: 'expense_reduction', label: 'Reduce Expenses', icon: '✂️' },
  { value: 'custom', label: 'Custom Goal', icon: '🎯' },
];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'medium', label: 'Medium', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'transfer', label: 'Transfer Money' },
  { value: 'goal_contribution', label: 'Contribute to Goal' },
  { value: 'budget_adjustment', label: 'Adjust Budget' },
  { value: 'recurring_update', label: 'Update Recurring Transaction' },
  { value: 'subscription_cancel', label: 'Cancel Subscription' },
  { value: 'debt_payment', label: 'Make Debt Payment' },
  { value: 'alert', label: 'Alert/Notification' },
  { value: 'recommendation', label: 'Recommendation' },
];

export default function CreatePlanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const { showToast } = useToast();
  const createPlan = useCreatePlan();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('save');
  const [priority, setPriority] = useState<Priority>('medium');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [aiReasoning, setAiReasoning] = useState('');
  const [steps, setSteps] = useState<Partial<PlanStep>[]>([]);
  const [error, setError] = useState('');

  // Step builder modal
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepTitle, setStepTitle] = useState('');
  const [stepDescription, setStepDescription] = useState('');
  const [stepActionType, setStepActionType] = useState<ActionType>('transfer');
  const [stepRequiresApproval, setStepRequiresApproval] = useState(true);

  const handleAddStep = useCallback(() => {
    haptics.light();
    setStepTitle('');
    setStepDescription('');
    setStepActionType('transfer');
    setStepRequiresApproval(true);
    setEditingStepIndex(null);
    setShowStepModal(true);
  }, []);

  const handleEditStep = useCallback((index: number) => {
    haptics.light();
    const step = steps[index];
    setStepTitle(step.title || '');
    setStepDescription(step.description || '');
    setStepActionType(step.action_type as ActionType || 'transfer');
    setStepRequiresApproval(step.requires_approval ?? true);
    setEditingStepIndex(index);
    setShowStepModal(true);
  }, [steps]);

  const handleSaveStep = useCallback(() => {
    if (!stepTitle.trim()) {
      Alert.alert(t('error') || 'Error', t('stepTitleRequired') || 'Step title is required');
      return;
    }

    haptics.success();
    const newStep: Partial<PlanStep> = {
      title: stepTitle,
      description: stepDescription,
      action_type: stepActionType,
      requires_approval: stepRequiresApproval,
      action_params: {},
    };

    if (editingStepIndex !== null) {
      const updated = [...steps];
      updated[editingStepIndex] = newStep;
      setSteps(updated);
    } else {
      setSteps([...steps, newStep]);
    }

    setShowStepModal(false);
  }, [stepTitle, stepDescription, stepActionType, stepRequiresApproval, editingStepIndex, steps, t]);

  const handleDeleteStep = useCallback((index: number) => {
    Alert.alert(
      t('confirmDelete') || 'Confirm Delete',
      t('confirmDeleteStep') || 'Remove this step from the plan?',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: () => {
            haptics.medium();
            setSteps(steps.filter((_, i) => i !== index));
          },
        },
      ]
    );
  }, [steps, t]);

  const validate = useCallback(() => {
    if (!title.trim()) {
      setError(t('planTitleRequired') || 'Plan title is required');
      return false;
    }
    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      setError(t('validTargetAmountRequired') || 'Valid target amount is required');
      return false;
    }
    if (steps.length === 0) {
      setError(t('atLeastOneStepRequired') || 'At least one step is required');
      return false;
    }
    setError('');
    return true;
  }, [title, targetAmount, steps, t]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      haptics.error();
      return;
    }

    haptics.medium();
    
    const payload: CreatePlanRequest = {
      title: title.trim(),
      description: description.trim(),
      goal_type: goalType,
      priority,
      target_amount: parseFloat(targetAmount),
      target_currency: targetCurrency,
      ai_reasoning: aiReasoning.trim() || undefined,
      steps: steps.map((step, index) => ({
        step_order: index + 1,
        title: step.title!,
        description: step.description || '',
        action_type: step.action_type!,
        action_params: step.action_params || {},
        requires_approval: step.requires_approval ?? true,
      })),
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
  }, [validate, title, description, goalType, priority, targetAmount, targetCurrency, aiReasoning, steps, createPlan, showToast, router, t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              { padding: 8, marginEnd: 8 },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}
          >
            <ArrowLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
            {t('createPlan') || 'Create Plan'}
          </Text>
        </View>
        <Button
          onPress={handleSubmit}
          disabled={createPlan.isPending}
          variant="accent"
          size="sm"
        >
          {createPlan.isPending ? t('creating') || 'Creating...' : t('create') || 'Create'}
        </Button>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {error && <FormError error={error} style={{ marginBottom: 16 }} />}

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 12 }}>
            {t('basicInfo') || 'Basic Information'}
          </Text>

          <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>
            {t('planTitle') || 'Plan Title'}
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: colors.foreground,
              marginBottom: 16,
            }}
            value={title}
            onChangeText={setTitle}
            placeholder={t('enterPlanTitle') || 'Enter plan title'}
            placeholderTextColor={colors.muted}
          />

          <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>
            {t('description') || 'Description'}
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: colors.foreground,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
            value={description}
            onChangeText={setDescription}
            placeholder={t('enterDescription') || 'Enter description (optional)'}
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

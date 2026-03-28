import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Plus, Tag, Trash2, X } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { DatePickerModal } from './DatePickerModal';
import { PlannerSelectionSheet } from './PlannerSelectionSheet';
import { CurrencyPicker } from '../../ui/CurrencyPicker';
import {
  MultiStepWizardScreen,
  WizardStepJumpChips,
  type MultiStepWizardItem,
} from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import { useScreenLayout } from '../../../hooks/useScreenLayout';
import { haptics } from '../../../utils/haptics';
import { readJSON, removeStorage, writeJSON } from '../../../utils/storage';
import { isValidPlannerDueDate, normalizePlannerDueDate } from '../../../utils/plannerDate';
import type { Goal } from '../../../types/goal';
import { COLUMN_ORDER, PRIORITY_COLORS, getStatusLabel } from '../../../utils/plannerConstants';
import type {
  PlannerStatus,
  Task,
  TaskEditorValues,
  TaskSubtask,
  TaskWizardDraft,
  TaskWizardStep,
} from '../../../types/planner';

const TASK_WIZARD_DRAFT_VERSION = 1;
const WIZARD_STEPS: TaskWizardStep[] = ['basics', 'schedule', 'organization', 'finance_review'];

function draftStorageKey(userID: string): string {
  return `@task_wizard_draft:${userID}`;
}

function emptyEditorValues(): TaskEditorValues {
  return {
    title: '',
    description: '',
    due_date: '',
    status: 'todo',
    priority: 'medium',
    reminder_mode: 'off',
    selected_tag_ids: [],
    subtasks: [],
    goal_id: undefined,
    auto_ledger_enabled: false,
    ledger_type: 'debit',
    ledger_amount: '',
    ledger_currency: 'USD',
    ledger_wallet_currency: 'USD',
    ledger_category: '',
    ledger_description: '',
  };
}

function taskToEditorValues(task: Task, tagIDs: string[]): TaskEditorValues {
  return {
    title: task.title,
    description: task.description || '',
    due_date: normalizePlannerDueDate(task.due_date),
    status: task.status,
    priority: task.priority,
    reminder_mode: task.reminder_mode || 'off',
    selected_tag_ids: tagIDs,
    subtasks: task.subtasks ?? [],
    goal_id: task.goal_id,
    auto_ledger_enabled: task.auto_ledger_enabled ?? false,
    ledger_type: task.ledger_type === 'credit' ? 'credit' : 'debit',
    ledger_amount: typeof task.ledger_amount === 'number' ? String(task.ledger_amount) : '',
    ledger_currency: task.ledger_currency || 'USD',
    ledger_wallet_currency: task.ledger_wallet_currency || 'USD',
    ledger_category: task.ledger_category || '',
    ledger_description: task.ledger_description || '',
  };
}

interface TaskWizardModalProps {
  onClose: () => void;
  onSubmit: (values: TaskEditorValues) => Promise<void>;
  userId: string;
  tags: Array<{ id: string; name: string }>;
  goals: Goal[];
  mode?: 'create' | 'edit';
  initialTask?: Task | null;
  initialTagIDs?: string[];
}

export function TaskWizardModal({
  onClose,
  onSubmit,
  userId,
  tags,
  goals,
  mode = 'create',
  initialTask,
  initialTagIDs = [],
}: TaskWizardModalProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const { isCompactPhone, isPhone } = useScreenLayout();
  const isEditMode = mode === 'edit';

  const [step, setStep] = useState<TaskWizardStep>('basics');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<PlannerStatus>('todo');
  const [selectedPriority, setSelectedPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [reminderMode, setReminderMode] = useState<'off' | 'aggressive'>('off');
  const [selectedTagIDs, setSelectedTagIDs] = useState<string[]>([]);
  const [selectedGoalID, setSelectedGoalID] = useState<string | undefined>(undefined);
  const [autoLedgerEnabled, setAutoLedgerEnabled] = useState(false);
  const [ledgerType, setLedgerType] = useState<'credit' | 'debit'>('debit');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerCurrency, setLedgerCurrency] = useState('USD');
  const [ledgerWalletCurrency, setLedgerWalletCurrency] = useState('USD');
  const [ledgerCategory, setLedgerCategory] = useState('');
  const [ledgerDescription, setLedgerDescription] = useState('');
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSourceCurrencyPicker, setShowSourceCurrencyPicker] = useState(false);
  const [showWalletCurrencyPicker, setShowWalletCurrencyPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storedDraft, setStoredDraft] = useState<TaskWizardDraft | null>(null);
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [showGoalSheet, setShowGoalSheet] = useState(false);

  const applyValues = useCallback((values: TaskEditorValues, nextStep: TaskWizardStep = 'basics') => {
    setStep(nextStep);
    setTitle(values.title);
    setDescription(values.description);
    setDueDate(normalizePlannerDueDate(values.due_date));
    setSelectedStatus(values.status);
    setSelectedPriority(values.priority);
    setReminderMode(values.reminder_mode);
    setSelectedTagIDs(values.selected_tag_ids);
    setSelectedGoalID(values.goal_id);
    setAutoLedgerEnabled(values.auto_ledger_enabled);
    setLedgerType(values.ledger_type);
    setLedgerAmount(values.ledger_amount);
    setLedgerCurrency(values.ledger_currency || 'USD');
    setLedgerWalletCurrency(values.ledger_wallet_currency || 'USD');
    setLedgerCategory(values.ledger_category);
    setLedgerDescription(values.ledger_description);
    setSubtasks(values.subtasks);
    setSubtaskDraft('');
  }, []);

  const resetWizard = useCallback(() => {
    applyValues(emptyEditorValues(), 'basics');
  }, [applyValues]);

  const applyDraft = useCallback((draft: TaskWizardDraft) => {
    applyValues(draft, draft.step);
    setStoredDraft(null);
  }, [applyValues]);

  useEffect(() => {
    if (isEditMode) {
      if (initialTask) {
        applyValues(taskToEditorValues(initialTask, initialTagIDs));
      }
      setStoredDraft(null);
      return;
    }

    resetWizard();

    if (!userId) return;

    void (async () => {
      const stored = await readJSON<TaskWizardDraft>(draftStorageKey(userId));
      if (!stored) return;
      setStoredDraft(stored);
    })();
  }, [applyValues, initialTagIDs, initialTask, isEditMode, resetWizard, userId]);

  useEffect(() => {
    if (isEditMode || !userId) return;

    const draft: TaskWizardDraft = {
      version: TASK_WIZARD_DRAFT_VERSION,
      updated_at: Date.now(),
      step,
      title,
      description,
      due_date: dueDate,
      status: selectedStatus,
      priority: selectedPriority,
      reminder_mode: reminderMode,
      selected_tag_ids: selectedTagIDs,
      subtasks,
      goal_id: selectedGoalID,
      auto_ledger_enabled: autoLedgerEnabled,
      ledger_type: ledgerType,
      ledger_amount: ledgerAmount,
      ledger_currency: ledgerCurrency,
      ledger_wallet_currency: ledgerWalletCurrency,
      ledger_category: ledgerCategory,
      ledger_description: ledgerDescription,
    };

    const timeout = setTimeout(() => {
      void writeJSON(draftStorageKey(userId), draft);
    }, 420);

    return () => clearTimeout(timeout);
  }, [
    autoLedgerEnabled,
    description,
    dueDate,
    isEditMode,
    ledgerAmount,
    ledgerCategory,
    ledgerCurrency,
    ledgerDescription,
    ledgerType,
    ledgerWalletCurrency,
    reminderMode,
    selectedGoalID,
    selectedPriority,
    selectedStatus,
    selectedTagIDs,
    step,
    subtasks,
    title,
    userId,
  ]);

  const dueDateValidationError = useMemo(() => {
    if (isValidPlannerDueDate(dueDate)) return null;
    return t('plannerCompleteStep') || 'Use YYYY-MM-DD (for example, 2026-03-01).';
  }, [dueDate, t]);

  const validateStep = useCallback((s: TaskWizardStep): string | null => {
    if (s === 'basics' && !title.trim()) return t('plannerTitleRequiredMessage') || 'Please add a task title.';
    if (s === 'schedule' && dueDateValidationError) return dueDateValidationError;
    if (s === 'finance_review' && autoLedgerEnabled) {
      const amount = Number(ledgerAmount);
      if (!Number.isFinite(amount) || amount <= 0) return t('plannerLedgerAmountError') || 'Ledger amount must be greater than zero.';
      if (!ledgerCurrency.trim()) return t('plannerLedgerCurrencyError') || 'Ledger currency is required when auto-ledger is on.';
    }
    return null;
  }, [autoLedgerEnabled, dueDateValidationError, ledgerAmount, ledgerCurrency, title, t]);

  const goBack = useCallback(() => {
    const idx = WIZARD_STEPS.indexOf(step);
    if (idx > 0) setStep(WIZARD_STEPS[idx - 1]);
  }, [step]);

  const goNext = useCallback(() => {
    const error = validateStep(step);
    if (error) {
      Alert.alert(t('plannerCompleteStep') || 'Complete this step', error);
      return;
    }
    const idx = WIZARD_STEPS.indexOf(step);
    if (idx < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[idx + 1]);
  }, [step, validateStep, t]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    const scheduleError = validateStep('schedule');
    if (scheduleError) {
      setStep('schedule');
      Alert.alert(t('plannerCreateError') || 'Could not create task', scheduleError);
      return;
    }
    const financeError = validateStep('finance_review');
    if (financeError) {
      Alert.alert(t('plannerCreateError') || 'Could not create task', financeError);
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert(t('plannerTitleRequiredSubmit') || 'Task title required', t('plannerTitleRequiredSubmitMessage') || 'Please add a title before saving.');
      return;
    }

    const values: TaskEditorValues = {
      title: cleanTitle,
      description,
      due_date: dueDate.trim(),
      status: selectedStatus,
      priority: selectedPriority,
      reminder_mode: reminderMode,
      selected_tag_ids: selectedTagIDs,
      subtasks,
      goal_id: selectedGoalID,
      auto_ledger_enabled: autoLedgerEnabled,
      ledger_type: ledgerType,
      ledger_amount: ledgerAmount,
      ledger_currency: ledgerCurrency,
      ledger_wallet_currency: ledgerWalletCurrency,
      ledger_category: ledgerCategory,
      ledger_description: ledgerDescription,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(values);
      void haptics.success();
      if (!isEditMode) {
        resetWizard();
      }
      if (!isEditMode && userId) {
        await removeStorage(draftStorageKey(userId));
      }
      onClose();
    } catch (err) {
      void haptics.error();
      Alert.alert(
        isEditMode ? (t('plannerUpdateError') || 'Could not update task') : (t('plannerQueueError') || 'Could not queue task'),
        err instanceof Error ? err.message : 'Unknown error'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting,
    validateStep, title, selectedStatus, description,
    selectedPriority, dueDate, selectedGoalID, reminderMode, subtasks,
    autoLedgerEnabled, ledgerType, ledgerAmount, ledgerCurrency,
    ledgerWalletCurrency, ledgerCategory, ledgerDescription,
    selectedTagIDs, onSubmit, resetWizard, userId, onClose, isEditMode, t,
  ]);

  const handleDiscard = useCallback(() => {
    Alert.alert(
      t('plannerDiscardConfirmTitle') || (isEditMode ? 'Discard changes?' : 'Discard draft?'),
      t('plannerDiscardConfirmMessage') || 'All your progress on this task will be lost.',
      [
        { text: t('plannerClose') || 'Cancel', style: 'cancel' },
        {
          text: t('plannerDiscard') || 'Discard',
          style: 'destructive',
          onPress: () => {
            if (!isEditMode) {
              resetWizard();
              if (userId) void removeStorage(draftStorageKey(userId));
            }
            onClose();
          },
        },
      ],
    );
  }, [isEditMode, onClose, resetWizard, t, userId]);

  const addSubtask = useCallback(() => {
    const text = subtaskDraft.trim();
    if (!text) return;
    setSubtasks((prev) => [...prev, { id: `sub-${Date.now()}-${prev.length}`, title: text, done: false }]);
    setSubtaskDraft('');
    void haptics.light();
  }, [subtaskDraft]);

  const removeSubtask = useCallback((id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleDateSelect = useCallback((date: string) => {
    setDueDate(normalizePlannerDueDate(date));
    if (date.trim() && reminderMode === 'off') setReminderMode('aggressive');
  }, [reminderMode]);

  const stepLabels: Record<TaskWizardStep, string> = {
    basics: t('plannerStepBasics') || 'Basics',
    schedule: t('plannerStepSchedule') || 'Schedule',
    organization: t('plannerStepOrganization') || 'Organization',
    finance_review: t('plannerStepFinanceReview') || 'Finance & Review',
  };
  const shortStepLabels: Record<TaskWizardStep, string> = {
    basics: t('plannerStepBasicsShort') || 'Basics',
    schedule: t('plannerStepScheduleShort') || 'Schedule',
    organization: t('plannerStepOrganizationShort') || 'Org',
    finance_review: t('plannerStepFinanceReviewShort') || 'Review',
  };
  const stepItems: MultiStepWizardItem[] = WIZARD_STEPS.map((wizardStep) => ({
    key: wizardStep,
    label: stepLabels[wizardStep],
    shortLabel: shortStepLabels[wizardStep],
  }));
  const reviewJumpItems: MultiStepWizardItem[] = WIZARD_STEPS.slice(0, 3).map((wizardStep) => ({
    key: wizardStep,
    label: (t('plannerEditStep') || 'Edit {{step}}').replace('{{step}}', stepLabels[wizardStep]),
  }));
  const statusLabel = (s: PlannerStatus) => getStatusLabel(s, t as (key: string) => string | undefined);
  const contentGap = isPhone ? 12 : 14;
  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedTagIDs.includes(tag.id)),
    [selectedTagIDs, tags]
  );
  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalID),
    [goals, selectedGoalID]
  );
  const tagOptions = useMemo(
    () => tags.map((tag) => ({ value: tag.id, label: tag.name })),
    [tags]
  );
  const goalOptions = useMemo(
    () => [
      { value: '__none__', label: t('plannerNoLinkedGoal') || 'No linked goal' },
      ...goals.map((goal) => ({
        value: goal.id,
        label: goal.name,
        description: `${Math.round(goal.progress)}% ${(t('plannerDone') || 'Done').toLowerCase()}`,
      })),
    ],
    [goals, t]
  );
  const closeWizard = isEditMode ? handleDiscard : onClose;

  return (
    <>
      <MultiStepWizardScreen
        eyebrow={isEditMode ? (t('plannerEditTask') || 'Edit Task') : (t('plannerTaskWizard') || 'Task Setup Wizard')}
        title={stepLabels[step]}
        steps={stepItems}
        activeStep={step}
        onStepPress={(stepKey) => setStep(stepKey as TaskWizardStep)}
        onClose={closeWizard}
        onDiscard={handleDiscard}
        onBack={goBack}
        onPrimaryAction={step === 'finance_review' ? handleSubmit : goNext}
        primaryLabel={step === 'finance_review'
          ? (isEditMode ? (t('plannerSaveChanges') || 'Save Changes') : (t('plannerCreateTask') || 'Create Task'))
          : (t('plannerNext') || 'Next')}
        isPrimaryLoading={step === 'finance_review' ? isSubmitting : false}
        canGoBack={step !== 'basics'}
        discardAccessibilityLabel={isEditMode ? (t('plannerDiscard') || 'Discard changes') : (t('plannerDiscardDraft') || 'Discard draft')}
        closeLabel={t('plannerClose') || 'Close'}
        backLabel={t('plannerBack') || 'Back'}
      >
            {!isEditMode && storedDraft ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.accent + '44',
                  backgroundColor: colors.accent + '12',
                  borderRadius: 16,
                  padding: 14,
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                    {t('plannerResumeDraft') || 'Resume task draft?'}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {t('plannerResumeDraftMessage') || 'Continue where you left off in the task setup wizard?'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setStoredDraft(null);
                      void removeStorage(draftStorageKey(userId));
                    }}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        paddingVertical: 10,
                      },
                      pressed && { opacity: 0.72 },
                    ]}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                      {t('plannerDiscardDraft') || 'Discard'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => applyDraft(storedDraft)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                        backgroundColor: colors.accent,
                        paddingVertical: 10,
                      },
                      pressed && { opacity: 0.78 },
                    ]}
                  >
                    <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 13 }}>
                      {t('plannerResume') || 'Resume'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {step === 'basics' && (
              <View style={{ gap: contentGap }}>
                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6, fontFamily: 'Inter_600SemiBold' }}>
                    {t('plannerTaskTitle') || 'Title'} *
                  </Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t('plannerTaskTitle') || 'What needs to be done?'}
                    placeholderTextColor={colors.placeholder}
                    maxLength={200}
                    style={{
                      borderWidth: 1, borderColor: title.trim() ? colors.accent + '44' : colors.border,
                      backgroundColor: colors.card,
                      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground,
                      fontSize: 15, fontFamily: 'Inter_500Medium',
                    }}
                  />
                </View>
                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6, fontFamily: 'Inter_600SemiBold' }}>
                    {t('plannerDescription') || 'Description'}
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('plannerDescription') || 'Add details (optional)'}
                    placeholderTextColor={colors.placeholder}
                    multiline
                    style={{
                      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
                      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                      color: colors.foreground, minHeight: 82, textAlignVertical: 'top',
                      fontSize: 14,
                    }}
                  />
                </View>
                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, fontFamily: 'Inter_600SemiBold' }}>
                    {t('plannerInitialColumn') || 'Initial column'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {COLUMN_ORDER.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setSelectedStatus(s)}
                        style={({ pressed }) => [{
                          paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
                          borderColor: selectedStatus === s ? colors.accent : colors.border,
                          backgroundColor: selectedStatus === s ? colors.accent + '22' : colors.card,
                        }, pressed && { opacity: 0.72 }]}
                      >
                        <Text style={{
                          color: selectedStatus === s ? colors.accent : colors.foreground,
                          fontSize: 13, fontFamily: selectedStatus === s ? 'Inter_600SemiBold' : 'Inter_500Medium',
                        }}>
                          {statusLabel(s)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {step === 'schedule' && (
              <View style={{ gap: contentGap }}>
                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6, fontFamily: 'Inter_600SemiBold' }}>
                    {t('plannerSelectDueDate') || 'Due Date'}
                  </Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={({ pressed }) => [{
                      borderWidth: 1,
                      borderColor: dueDateValidationError ? colors.danger : dueDate ? colors.accent + '44' : colors.border,
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      flexDirection: isCompactPhone ? 'column' : 'row',
                      alignItems: isCompactPhone ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      gap: isCompactPhone ? 10 : 12,
                    }, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={{ color: dueDate ? colors.foreground : colors.placeholder, fontSize: 14, fontFamily: dueDate ? 'Inter_500Medium' : undefined, flexShrink: 1 }}>
                      {dueDate || (t('plannerSelectDueDate') || 'Select due date (optional)')}
                    </Text>
                    <View style={{
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                      backgroundColor: colors.accent + '18',
                      alignSelf: isCompactPhone ? 'flex-start' : 'auto',
                    }}>
                      <Text style={{ color: colors.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                        {t('plannerSelectDate') || 'Pick'}
                      </Text>
                    </View>
                  </Pressable>
                  {dueDateValidationError && (
                    <Text style={{ color: colors.danger, fontSize: 11, marginTop: 4, fontFamily: 'Inter_500Medium' }}>
                      {dueDateValidationError}
                    </Text>
                  )}
                </View>

                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, fontFamily: 'Inter_600SemiBold' }}>
                    {t('plannerPriority') || 'Priority'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['low', 'medium', 'high'] as const).map((p) => {
                      const badge = PRIORITY_COLORS[p];
                      return (
                        <Pressable
                          key={p}
                          onPress={() => {
                            setSelectedPriority(p);
                            void haptics.selection();
                          }}
                          style={({ pressed }) => [{
                            flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1,
                            borderColor: selectedPriority === p ? badge.text + '55' : colors.border,
                            backgroundColor: selectedPriority === p ? badge.bg : colors.card,
                            paddingVertical: 12, minHeight: 44, justifyContent: 'center',
                          }, pressed && { opacity: 0.72 }]}
                        >
                          <Text style={{
                            color: selectedPriority === p ? badge.text : colors.foreground,
                            fontSize: 13, fontFamily: 'Inter_600SemiBold',
                          }}>
                            {t(`priority${p.charAt(0).toUpperCase() + p.slice(1)}` as any) || p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8, fontFamily: 'Inter_600SemiBold' }}>
                    {t('plannerReminderMode') || 'Reminder mode'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['off', 'aggressive'] as const).map((mode) => (
                      <Pressable
                        key={mode}
                        onPress={() => setReminderMode(mode)}
                        style={({ pressed }) => [{
                          flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1,
                          borderColor: reminderMode === mode ? colors.accent : colors.border,
                          backgroundColor: reminderMode === mode ? colors.accent + '22' : colors.card,
                          paddingVertical: 10,
                        }, pressed && { opacity: 0.72 }]}
                      >
                        <Text style={{
                          color: reminderMode === mode ? colors.accent : colors.foreground,
                          fontSize: 13, fontFamily: 'Inter_600SemiBold',
                        }}>
                          {mode === 'aggressive' ? (t('plannerReminderAggressive') || 'Aggressive') : (t('plannerReminderOff') || 'Off')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {step === 'organization' && (
              <View style={{ gap: contentGap }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Tag size={13} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginStart: 6 }}>
                        {t('plannerTags') || 'Tags'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setShowTagSheet(true)}
                      style={({ pressed }) => [{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: colors.card,
                      }, pressed && { opacity: 0.76 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                        {selectedTags.length > 0
                          ? `${selectedTags.length} ${(t('plannerTags') || 'Tags')}`
                          : (t('plannerManageTags') || 'Select tags')}
                      </Text>
                    </Pressable>
                  </View>
                  {selectedTags.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {selectedTags.map((tag) => (
                        <Pressable
                          key={tag.id}
                          onPress={() => setSelectedTagIDs((prev) => prev.filter((id) => id !== tag.id))}
                          style={({ pressed }) => [{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.accent,
                            backgroundColor: colors.accent + '24',
                          }, pressed && { opacity: 0.78 }]}
                        >
                          <Text style={{ color: colors.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                            {tag.name}
                          </Text>
                          <X size={12} color={colors.accent} />
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {t('plannerNoTagsSelected') || 'No tags selected yet.'}
                    </Text>
                  )}
                </View>

                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {t('plannerGoalLinkage') || 'Goal linkage (optional)'}
                    </Text>
                    <Pressable
                      onPress={() => setShowGoalSheet(true)}
                      style={({ pressed }) => [{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: colors.card,
                      }, pressed && { opacity: 0.76 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                        {selectedGoal ? (t('plannerChange') || 'Change') : (t('plannerSelect') || 'Select')}
                      </Text>
                    </Pressable>
                  </View>
                  {selectedGoal ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        borderWidth: 1,
                        borderColor: colors.accent,
                        backgroundColor: colors.accent + '14',
                        borderRadius: 14,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.accent, fontSize: 13, fontFamily: 'Inter_700Bold' }}>
                          {selectedGoal.name}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                          {Math.round(selectedGoal.progress)}% {(t('plannerDone') || 'Done').toLowerCase()}
                        </Text>
                      </View>
                      <Pressable onPress={() => setSelectedGoalID(undefined)} hitSlop={6}>
                        <X size={14} color={colors.accent} />
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {t('plannerNoLinkedGoal') || 'No linked goal'}
                    </Text>
                  )}
                </View>

                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>
                    {t('plannerSubtasks') || 'Subtasks'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <TextInput
                      value={subtaskDraft}
                      onChangeText={setSubtaskDraft}
                      placeholder={t('plannerAddChecklistItem') || 'Add checklist item'}
                      placeholderTextColor={colors.placeholder}
                      style={{
                        flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                        paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, backgroundColor: colors.card,
                      }}
                    />
                    <Pressable
                      onPress={addSubtask}
                      style={({ pressed }) => [{
                        width: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: colors.accent,
                      }, pressed && { opacity: 0.75 }]}
                    >
                      <Plus size={16} color={colors.accentForeground} />
                    </Pressable>
                  </View>
                  {subtasks.length > 0 ? (
                    subtasks.map((sub) => (
                      <View key={sub.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 10 }}>
                        <Text style={{ color: colors.foreground, flex: 1 }}>{sub.title}</Text>
                        <Pressable onPress={() => removeSubtask(sub.id)}>
                          <Trash2 size={14} color={colors.danger} />
                        </Pressable>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {t('plannerNoSubtasks') || 'No subtasks yet.'}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {step === 'finance_review' && (
              <View style={{ gap: contentGap }}>
                <Pressable
                  onPress={() => setAutoLedgerEnabled((prev) => !prev)}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10,
                    backgroundColor: autoLedgerEnabled ? colors.accent + '18' : colors.card,
                  }, pressed && { opacity: 0.76 }]}
                >
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                    {t('plannerAutoLedger') || 'Auto-ledger on completion'}
                  </Text>
                  <Text style={{ color: autoLedgerEnabled ? colors.accent : colors.mutedForeground }}>
                    {autoLedgerEnabled ? (t('plannerOn') || 'On') : (t('plannerOff') || 'Off')}
                  </Text>
                </Pressable>

                {autoLedgerEnabled && (
                  <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.card, gap: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['debit', 'credit'] as const).map((type) => (
                        <Pressable
                          key={type}
                          onPress={() => setLedgerType(type)}
                          style={({ pressed }) => [{
                            flex: 1, borderWidth: 1,
                            borderColor: ledgerType === type ? colors.accent : colors.border,
                            borderRadius: 10, paddingVertical: 8, alignItems: 'center',
                            backgroundColor: ledgerType === type ? colors.accent + '22' : colors.background,
                          }, pressed && { opacity: 0.72 }]}
                        >
                          <Text style={{ color: ledgerType === type ? colors.accent : colors.foreground }}>
                            {type.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <TextInput
                      value={ledgerAmount}
                      onChangeText={setLedgerAmount}
                      placeholder={t('plannerAmount') || 'Amount'}
                      keyboardType="decimal-pad"
                      placeholderTextColor={colors.placeholder}
                      style={{
                        borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                        paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground,
                      }}
                    />

                    <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => setShowSourceCurrencyPicker(true)}
                        style={{
                          flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                          paddingHorizontal: 10, paddingVertical: 10, backgroundColor: colors.background,
                        }}
                      >
                        <Text style={{ color: ledgerCurrency ? colors.foreground : colors.placeholder, fontSize: 14 }}>
                          {ledgerCurrency || (t('plannerSourceCurrency') || 'Source currency')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setShowWalletCurrencyPicker(true)}
                        style={{
                          flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                          paddingHorizontal: 10, paddingVertical: 10, backgroundColor: colors.background,
                        }}
                      >
                        <Text style={{ color: ledgerWalletCurrency ? colors.foreground : colors.placeholder, fontSize: 14 }}>
                          {ledgerWalletCurrency || (t('plannerWalletCurrency') || 'Wallet currency')}
                        </Text>
                      </Pressable>
                    </View>

                    <TextInput
                      value={ledgerCategory}
                      onChangeText={setLedgerCategory}
                      placeholder={t('plannerCategory') || 'Category'}
                      placeholderTextColor={colors.placeholder}
                      style={{
                        borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                        paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground,
                      }}
                    />

                    <TextInput
                      value={ledgerDescription}
                      onChangeText={setLedgerDescription}
                      placeholder={t('plannerLedgerDescription') || 'Ledger description'}
                      placeholderTextColor={colors.placeholder}
                      style={{
                        borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                        paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground,
                      }}
                    />
                  </View>
                )}

                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.card }}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>
                    {t('plannerReview') || 'Review'}
                  </Text>
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('plannerReviewTitle') || 'Title:'}</Text>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                        {title || (t('plannerUntitled') || 'Untitled')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('plannerReviewStatus') || 'Status:'}</Text>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                        {statusLabel(selectedStatus)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('plannerReviewPriority') || 'Priority:'}</Text>
                      {(() => {
                        const badge = PRIORITY_COLORS[selectedPriority];
                        return (
                          <View style={{ backgroundColor: badge.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}>
                            <Text style={{ color: badge.text, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                              {t(`priority${selectedPriority.charAt(0).toUpperCase() + selectedPriority.slice(1)}` as any) || selectedPriority.charAt(0).toUpperCase() + selectedPriority.slice(1)}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {t('plannerReviewReminder') || 'Reminder:'} {reminderMode === 'aggressive' ? (t('plannerReminderAggressive') || 'Aggressive') : (t('plannerReminderOff') || 'Off')}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {t('plannerReviewTags') || 'Tags:'} {selectedTagIDs.length}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {t('plannerReviewSubtasks') || 'Subtasks:'} {subtasks.length}
                    </Text>
                    {selectedGoal ? (
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                        {(t('plannerGoalLinkage') || 'Goal linkage') + ':'} {selectedGoal.name}
                      </Text>
                    ) : null}
                  </View>

                  <WizardStepJumpChips
                    items={reviewJumpItems}
                    onPress={(stepKey) => setStep(stepKey as TaskWizardStep)}
                  />
                </View>
              </View>
            )}
      </MultiStepWizardScreen>

      <PlannerSelectionSheet
        visible={showTagSheet}
        title={t('plannerTags') || 'Tags'}
        options={tagOptions}
        selectedValues={selectedTagIDs}
        onToggle={(value) => {
          setSelectedTagIDs((prev) =>
            prev.includes(value) ? prev.filter((id) => id !== value) : [...prev, value]
          );
        }}
        onClose={() => setShowTagSheet(false)}
        multiple
        searchPlaceholder={t('plannerSearchTags') || 'Search tags'}
      />

      <PlannerSelectionSheet
        visible={showGoalSheet}
        title={t('plannerGoalLinkage') || 'Goal linkage'}
        options={goalOptions}
        selectedValues={selectedGoalID ? [selectedGoalID] : ['__none__']}
        onToggle={(value) => {
          setSelectedGoalID(value === '__none__' ? undefined : value);
        }}
        onClose={() => setShowGoalSheet(false)}
        searchPlaceholder={t('plannerSearchGoals') || 'Search goals'}
      />

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateSelect}
        initialDate={dueDate}
      />

      <CurrencyPicker
        visible={showSourceCurrencyPicker}
        onClose={() => setShowSourceCurrencyPicker(false)}
        onSelect={(c) => setLedgerCurrency(c)}
        selectedCurrency={ledgerCurrency}
        title={t('plannerSourceCurrency') || 'Source Currency'}
      />

      <CurrencyPicker
        visible={showWalletCurrencyPicker}
        onClose={() => setShowWalletCurrencyPicker(false)}
        onSelect={(c) => setLedgerWalletCurrency(c)}
        selectedCurrency={ledgerWalletCurrency}
        title={t('plannerWalletCurrency') || 'Wallet Currency'}
      />
    </>
  );
}

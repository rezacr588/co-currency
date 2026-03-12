import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Plus, Tag, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'styled-components/native';
import { DatePickerModal } from './DatePickerModal';
import { CurrencyPicker } from '../../ui/CurrencyPicker';
import { useLanguage } from '../../../context/LanguageContext';
import { useScreenLayout } from '../../../hooks/useScreenLayout';
import { haptics } from '../../../utils/haptics';
import { readJSON, removeStorage, writeJSON } from '../../../utils/storage';
import { isValidPlannerDueDate } from '../../../utils/plannerDate';
import type { Goal } from '../../../types/goal';
import { COLUMN_ORDER, PRIORITY_COLORS, getStatusLabel } from '../../../utils/plannerConstants';
import type {
  CreateTaskRequest,
  PlannerBoardResponse,
  PlannerStatus,
  TaskSubtask,
  TaskWizardDraft,
  TaskWizardStep,
} from '../../../types/planner';

const TASK_WIZARD_DRAFT_VERSION = 1;
const WIZARD_STEPS: TaskWizardStep[] = ['basics', 'schedule', 'organization', 'finance_review'];

function draftStorageKey(userID: string): string {
  return `@task_wizard_draft:${userID}`;
}

function nextSortOrder(board: PlannerBoardResponse, status: PlannerStatus): number {
  const column = board.columns.find((c) => c.status === status);
  const items = (column?.items ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (items.length === 0) return 1;
  const tail = items[items.length - 1];
  return (tail.sort_order ?? items.length) + 1;
}

interface TaskWizardModalProps {
  onClose: () => void;
  onSubmit: (payload: CreateTaskRequest, tagIds: string[]) => Promise<void>;
  userId: string;
  effectiveBoard: PlannerBoardResponse;
  tags: Array<{ id: string; name: string }>;
  goals: Goal[];
}

export function TaskWizardModal({
  onClose,
  onSubmit,
  userId,
  effectiveBoard,
  tags,
  goals,
}: TaskWizardModalProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { width, isCompactPhone, isPhone } = useScreenLayout();

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

  const resetWizard = useCallback(() => {
    setStep('basics');
    setTitle('');
    setDescription('');
    setDueDate('');
    setSelectedStatus('todo');
    setSelectedPriority('medium');
    setReminderMode('off');
    setSelectedTagIDs([]);
    setSelectedGoalID(undefined);
    setAutoLedgerEnabled(false);
    setLedgerType('debit');
    setLedgerAmount('');
    setLedgerCurrency('USD');
    setLedgerWalletCurrency('USD');
    setLedgerCategory('');
    setLedgerDescription('');
    setSubtasks([]);
    setSubtaskDraft('');
  }, []);

  const applyDraft = useCallback((draft: TaskWizardDraft) => {
    setStep(draft.step);
    setTitle(draft.title);
    setDescription(draft.description);
    setDueDate(draft.due_date);
    setSelectedStatus(draft.status);
    setSelectedPriority(draft.priority);
    setReminderMode(draft.reminder_mode);
    setSelectedTagIDs(draft.selected_tag_ids);
    setSelectedGoalID(draft.goal_id);
    setAutoLedgerEnabled(draft.auto_ledger_enabled);
    setLedgerType(draft.ledger_type);
    setLedgerAmount(draft.ledger_amount);
    setLedgerCurrency(draft.ledger_currency || 'USD');
    setLedgerWalletCurrency(draft.ledger_wallet_currency || 'USD');
    setLedgerCategory(draft.ledger_category);
    setLedgerDescription(draft.ledger_description);
    setSubtasks(draft.subtasks);
  }, []);

  useEffect(() => {
    // Always start with a clean slate immediately
    resetWizard();

    if (!userId) return;

    void (async () => {
      const stored = await readJSON<TaskWizardDraft>(draftStorageKey(userId));
      if (!stored) return;

      Alert.alert(
        t('plannerResumeDraft') || 'Resume task draft?',
        t('plannerResumeDraftMessage') || 'Continue where you left off in the task setup wizard?',
        [
          {
            text: t('plannerDiscardDraft') || 'Discard',
            style: 'destructive',
            onPress: () => {
              void removeStorage(draftStorageKey(userId));
            },
          },
          {
            text: t('plannerResume') || 'Resume',
            onPress: () => applyDraft(stored),
          },
        ],
      );
    })();
  }, [userId, resetWizard, applyDraft, t]);

  useEffect(() => {
    if (!userId) return;

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
    userId, step, title, description, dueDate, selectedStatus,
    selectedPriority, reminderMode, selectedTagIDs, subtasks, selectedGoalID,
    autoLedgerEnabled, ledgerType, ledgerAmount, ledgerCurrency,
    ledgerWalletCurrency, ledgerCategory, ledgerDescription,
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

    const sortOrder = nextSortOrder(effectiveBoard, selectedStatus);
    const payload: CreateTaskRequest = {
      title: cleanTitle,
      description: description.trim() || undefined,
      status: selectedStatus,
      priority: selectedPriority,
      due_date: dueDate.trim() || undefined,
      goal_id: selectedGoalID,
      sort_order: sortOrder,
      reminder_mode: reminderMode,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      auto_ledger_enabled: autoLedgerEnabled,
      ledger_type: autoLedgerEnabled ? ledgerType : undefined,
      ledger_amount: autoLedgerEnabled && ledgerAmount ? Number(ledgerAmount) : undefined,
      ledger_currency: autoLedgerEnabled ? ledgerCurrency : undefined,
      ledger_wallet_currency: autoLedgerEnabled ? ledgerWalletCurrency : undefined,
      ledger_category: autoLedgerEnabled ? ledgerCategory.trim() || undefined : undefined,
      ledger_description: autoLedgerEnabled ? ledgerDescription.trim() || undefined : undefined,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload, selectedTagIDs);
      void haptics.success();
      resetWizard();
      if (userId) await removeStorage(draftStorageKey(userId));
      onClose();
    } catch (err) {
      void haptics.error();
      Alert.alert(t('plannerQueueError') || 'Could not queue task', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting,
    validateStep, title, effectiveBoard, selectedStatus, description,
    selectedPriority, dueDate, selectedGoalID, reminderMode, subtasks,
    autoLedgerEnabled, ledgerType, ledgerAmount, ledgerCurrency,
    ledgerWalletCurrency, ledgerCategory, ledgerDescription,
    selectedTagIDs, onSubmit, resetWizard, userId, onClose,
  ]);

  const handleDiscard = useCallback(() => {
    Alert.alert(
      t('plannerDiscardConfirmTitle') || 'Discard draft?',
      t('plannerDiscardConfirmMessage') || 'All your progress on this task will be lost.',
      [
        { text: t('plannerClose') || 'Cancel', style: 'cancel' },
        {
          text: t('plannerDiscard') || 'Discard',
          style: 'destructive',
          onPress: () => {
            resetWizard();
            if (userId) void removeStorage(draftStorageKey(userId));
            onClose();
          },
        },
      ],
    );
  }, [resetWizard, userId, onClose, t]);

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
    setDueDate(date);
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
  const statusLabel = (s: PlannerStatus) => getStatusLabel(s, t as (key: string) => string | undefined);
  const currentStepNumber = WIZARD_STEPS.indexOf(step) + 1;
  const pageMaxWidth = width >= 1280 ? 1080 : width >= 960 ? 960 : 880;
  const shellPaddingX = isCompactPhone ? 12 : isPhone ? 16 : 24;
  const shellPaddingBottom = Math.max(insets.bottom + (isPhone ? 8 : 12), isPhone ? 16 : 20);
  const heroRadius = isPhone ? 18 : 24;
  const cardRadius = isPhone ? 24 : 28;
  const heroPaddingX = isCompactPhone ? 14 : isPhone ? 16 : 20;
  const heroPaddingY = isCompactPhone ? 10 : isPhone ? 12 : 16;
  const mobileStepWidth = isCompactPhone ? 116 : 132;
  const contentGap = isPhone ? 12 : 14;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.backgroundSecondary, colors.background]} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, paddingHorizontal: shellPaddingX, paddingTop: isPhone ? 8 : 10, paddingBottom: shellPaddingBottom }}>
            <View style={{ width: '100%', maxWidth: pageMaxWidth, alignSelf: 'center', flex: 1 }}>
              <View
                style={{
                  overflow: 'hidden',
                  borderRadius: heroRadius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: isPhone ? 12 : 16,
                  shadowColor: colors.accent,
                  shadowOpacity: 0.16,
                  shadowRadius: isPhone ? 14 : 20,
                  shadowOffset: { width: 0, height: isPhone ? 6 : 10 },
                  elevation: isPhone ? 3 : 5,
                }}
              >
                <LinearGradient
                  colors={[colors.accent + '2A', colors.card, colors.backgroundSecondary]}
                  style={{ paddingHorizontal: heroPaddingX, paddingVertical: heroPaddingY }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: isPhone ? 8 : 12 }}>
                    <Pressable
                      onPress={onClose}
                      hitSlop={8}
                      style={({ pressed }) => [{
                        minHeight: isPhone ? 38 : 42,
                        borderRadius: 999,
                        paddingHorizontal: isCompactPhone ? 12 : 14,
                        paddingVertical: isPhone ? 8 : 9,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.background + 'E6',
                        borderWidth: 1,
                        borderColor: colors.border,
                      }, pressed && { opacity: 0.72 }]}
                    >
                      <ArrowLeft size={16} color={colors.foreground} />
                      {!isCompactPhone && (
                        <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>
                          {t('plannerClose') || 'Close'}
                        </Text>
                      )}
                    </Pressable>

                    <View
                      style={{
                        minHeight: isPhone ? 38 : 42,
                        borderRadius: 999,
                        paddingHorizontal: isCompactPhone ? 12 : 14,
                        paddingVertical: isPhone ? 8 : 9,
                        backgroundColor: colors.foreground,
                      }}
                    >
                      <Text style={{ color: colors.background, fontSize: 13, fontFamily: 'Inter_700Bold' }}>
                        {currentStepNumber} / {WIZARD_STEPS.length}
                      </Text>
                    </View>
                  </View>

                  {!isPhone && (
                    <>
                      <Text style={{ color: colors.accent, fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {t('plannerTaskWizard') || 'Task Setup Wizard'}
                      </Text>
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 28, marginTop: 6 }}>
                        {stepLabels[step]}
                      </Text>
                    </>
                  )}

                  {isPhone ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={{ gap: 8, marginTop: isPhone ? 6 : 16, paddingRight: 4 }}
                    >
                      {WIZARD_STEPS.map((s, idx) => {
                        const active = step === s;
                        const completed = currentStepNumber - 1 > idx;
                        const stepNum = idx + 1;
                        return (
                          <Pressable
                            key={s}
                            onPress={() => setStep(s)}
                            style={{ width: mobileStepWidth }}
                          >
                            <View
                              style={{
                                minHeight: 46,
                                borderRadius: 16,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                gap: 6,
                                borderWidth: 1,
                                borderColor: active ? colors.foreground : completed ? colors.success + '55' : colors.border,
                                backgroundColor: active ? colors.foreground : completed ? colors.success + '16' : colors.background + 'E8',
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: active ? colors.accent : completed ? colors.success : colors.muted,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: active ? colors.accentForeground : completed ? '#fff' : colors.mutedForeground,
                                      fontSize: 11,
                                      fontFamily: 'Inter_700Bold',
                                    }}
                                  >
                                    {stepNum}
                                  </Text>
                                </View>
                                <Text
                                  numberOfLines={1}
                                  style={{
                                    flex: 1,
                                    fontSize: isCompactPhone ? 10 : 11,
                                    color: active ? colors.background : completed ? colors.success : colors.foreground,
                                    fontFamily: active ? 'Inter_700Bold' : 'Inter_600SemiBold',
                                  }}
                                >
                                  {shortStepLabels[s]}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 4 }}>
                      {WIZARD_STEPS.map((s, idx) => {
                        const active = step === s;
                        const completed = currentStepNumber - 1 > idx;
                        const stepNum = idx + 1;
                        return (
                          <Pressable
                            key={s}
                            onPress={() => setStep(s)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                          >
                            <View
                              style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: active ? colors.foreground : completed ? colors.success + '20' : colors.background + 'E8',
                                borderWidth: 1,
                                borderColor: active ? colors.foreground : completed ? colors.success + '55' : colors.border,
                                borderRadius: 16,
                                paddingHorizontal: 10,
                                paddingVertical: 10,
                                gap: 8,
                              }}
                            >
                              <View
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: active ? colors.accent : completed ? colors.success : colors.muted,
                                }}
                              >
                                <Text
                                  style={{
                                    color: active ? colors.accentForeground : completed ? '#fff' : colors.mutedForeground,
                                    fontSize: 11,
                                    fontFamily: 'Inter_700Bold',
                                  }}
                                >
                                  {stepNum}
                                </Text>
                              </View>
                              <Text
                                numberOfLines={1}
                                style={{
                                  flex: 1,
                                  fontSize: 11,
                                  color: active ? colors.background : completed ? colors.success : colors.foreground,
                                  fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                                }}
                              >
                                {stepLabels[s]}
                              </Text>
                            </View>
                            {idx < WIZARD_STEPS.length - 1 && (
                              <ChevronRight size={12} color={colors.border} style={{ marginHorizontal: 1 }} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </LinearGradient>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderRadius: cardRadius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: isCompactPhone ? 14 : isPhone ? 16 : 20,
                  paddingTop: isPhone ? 14 : 18,
                  paddingBottom: isPhone ? 12 : 14,
                }}
              >
                <View style={{ marginBottom: isPhone ? 10 : 14 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {currentStepNumber} of {WIZARD_STEPS.length}
                  </Text>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: isPhone ? 18 : 22, marginTop: 4 }}>
                    {stepLabels[step]}
                  </Text>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: isPhone ? 16 : 12 }}
                >
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Tag size={13} color={colors.mutedForeground} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 6 }}>
                      {t('plannerTags') || 'Tags'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {tags.map((tag) => {
                      const selected = selectedTagIDs.includes(tag.id);
                      return (
                        <Pressable
                          key={tag.id}
                          onPress={() => setSelectedTagIDs((prev) =>
                            selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                          )}
                          style={({ pressed }) => [{
                            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                            borderColor: selected ? colors.accent : colors.border,
                            backgroundColor: selected ? colors.accent + '24' : colors.card,
                          }, pressed && { opacity: 0.78 }]}
                        >
                          <Text style={{ color: selected ? colors.accent : colors.foreground, fontSize: 12 }}>
                            {tag.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>
                    {t('plannerGoalLinkage') || 'Goal linkage (optional)'}
                  </Text>
                  {isPhone ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Pressable
                        onPress={() => setSelectedGoalID(undefined)}
                        style={({ pressed }) => [{
                          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                          borderColor: !selectedGoalID ? colors.accent : colors.border,
                          backgroundColor: !selectedGoalID ? colors.accent + '24' : colors.card,
                        }, pressed && { opacity: 0.76 }]}
                      >
                        <Text style={{ color: !selectedGoalID ? colors.accent : colors.foreground, fontSize: 12 }}>
                          {t('plannerNoLinkedGoal') || 'No linked goal'}
                        </Text>
                      </Pressable>
                      {goals.map((goal: Goal) => {
                        const selected = selectedGoalID === goal.id;
                        return (
                          <Pressable
                            key={goal.id}
                            onPress={() => setSelectedGoalID(goal.id)}
                            style={({ pressed }) => [{
                              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                              borderColor: selected ? colors.accent : colors.border,
                              backgroundColor: selected ? colors.accent + '24' : colors.card,
                            }, pressed && { opacity: 0.76 }]}
                          >
                            <Text style={{ color: selected ? colors.accent : colors.foreground, fontSize: 12 }}>
                              {goal.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      <Pressable
                        onPress={() => setSelectedGoalID(undefined)}
                        style={({ pressed }) => [{
                          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                          borderColor: !selectedGoalID ? colors.accent : colors.border,
                          backgroundColor: !selectedGoalID ? colors.accent + '24' : colors.card,
                        }, pressed && { opacity: 0.76 }]}
                      >
                        <Text style={{ color: !selectedGoalID ? colors.accent : colors.foreground, fontSize: 12 }}>
                          {t('plannerNoLinkedGoal') || 'No linked goal'}
                        </Text>
                      </Pressable>
                      {goals.map((goal: Goal) => {
                        const selected = selectedGoalID === goal.id;
                        return (
                          <Pressable
                            key={goal.id}
                            onPress={() => setSelectedGoalID(goal.id)}
                            style={({ pressed }) => [{
                              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                              borderColor: selected ? colors.accent : colors.border,
                              backgroundColor: selected ? colors.accent + '24' : colors.card,
                            }, pressed && { opacity: 0.76 }]}
                          >
                            <Text style={{ color: selected ? colors.accent : colors.foreground, fontSize: 12 }}>
                              {goal.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
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
                  {subtasks.map((sub) => (
                    <View key={sub.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                      <Text style={{ color: colors.foreground, flex: 1 }}>{sub.title}</Text>
                      <Pressable onPress={() => removeSubtask(sub.id)}>
                        <Trash2 size={14} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
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
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {WIZARD_STEPS.slice(0, 3).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setStep(s)}
                        style={({ pressed }) => [{
                          borderRadius: 999, borderWidth: 1, borderColor: colors.border,
                          paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.background,
                        }, pressed && { opacity: 0.72 }]}
                      >
                        <Text style={{ color: colors.foreground, fontSize: 11 }}>
                          {(t('plannerEditStep') || 'Edit {{step}}').replace('{{step}}', stepLabels[s])}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

                <View style={{ height: 1, backgroundColor: colors.border, marginTop: isPhone ? 10 : 14, marginBottom: isPhone ? 10 : 12 }} />

                <View style={{ flexDirection: 'row', gap: isCompactPhone ? 6 : 8, alignItems: 'center' }}>
            <Pressable
              onPress={handleDiscard}
              hitSlop={4}
              accessibilityLabel={t('plannerDiscardDraft') || 'Discard draft'}
              accessibilityRole="button"
              style={({ pressed }) => [{
                borderRadius: isPhone ? 14 : 16, borderWidth: 1, borderColor: colors.danger + '44',
                backgroundColor: colors.danger + '10', alignItems: 'center', justifyContent: 'center',
                paddingVertical: isPhone ? 13 : 14, paddingHorizontal: isPhone ? 14 : 16, minWidth: isPhone ? 48 : 52, minHeight: isPhone ? 48 : 52,
              }, pressed && { opacity: 0.72 }]}
            >
              <Trash2 size={16} color={colors.danger} />
            </Pressable>

            <Pressable
              onPress={goBack}
              disabled={step === 'basics'}
              style={({ pressed }) => [{
                flex: 1, borderRadius: isPhone ? 14 : 16, borderWidth: 1, borderColor: colors.border,
                backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center', paddingVertical: isPhone ? 13 : 14,
                opacity: step === 'basics' ? 0.45 : pressed ? 0.72 : 1,
              }]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                {t('plannerBack') || 'Back'}
              </Text>
            </Pressable>

            {step !== 'finance_review' ? (
              <Pressable
                onPress={goNext}
                style={({ pressed }) => [{
                  flex: 1.5, borderRadius: isPhone ? 14 : 16, backgroundColor: colors.foreground,
                  alignItems: 'center', justifyContent: 'center', paddingVertical: isPhone ? 13 : 14,
                  shadowColor: colors.foreground, shadowOpacity: 0.18, shadowRadius: 16,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 4,
                  opacity: pressed ? 0.78 : 1,
                }]}
              >
                <Text style={{ color: colors.background, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                  {t('plannerNext') || 'Next'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={({ pressed }) => [{
                  flex: 1.5, borderRadius: isPhone ? 14 : 16, backgroundColor: colors.accent,
                  alignItems: 'center', justifyContent: 'center', paddingVertical: isPhone ? 13 : 14,
                  shadowColor: colors.accent, shadowOpacity: 0.34, shadowRadius: 14,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 4,
                  opacity: isSubmitting ? 0.6 : pressed ? 0.78 : 1,
                }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.accentForeground} />
                ) : (
                  <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                    {t('plannerCreateTask') || 'Create Task'}
                  </Text>
                )}
              </Pressable>
            )}
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>

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
    </SafeAreaView>
  );
}

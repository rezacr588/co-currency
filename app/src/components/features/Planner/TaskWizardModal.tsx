import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Tag, Trash2 } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { DatePickerModal } from './DatePickerModal';
import { CurrencyPicker } from '../../ui/CurrencyPicker';
import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';
import { readJSON, removeStorage, writeJSON } from '../../../utils/storage';
import { isValidPlannerDueDate } from '../../../utils/plannerDate';
import type { Goal } from '../../../types/goal';
import type {
  CreateTaskRequest,
  PlannerBoardResponse,
  PlannerStatus,
  TaskSubtask,
  TaskWizardDraft,
  TaskWizardStep,
} from '../../../types/planner';

const COLUMN_ORDER: PlannerStatus[] = ['todo', 'in_progress', 'done', 'archived'];
const TASK_WIZARD_DRAFT_VERSION = 1;
const WIZARD_STEPS: TaskWizardStep[] = ['basics', 'schedule', 'organization', 'finance_review'];

const COLUMN_LABELS: Record<PlannerStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  archived: 'Archived',
};

const PRIORITY_BADGE: Record<string, { bg: string; text: string }> = {
  low: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  medium: { bg: 'rgba(250,204,21,0.15)', text: '#facc15' },
  high: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

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
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTaskRequest, tagIds: string[]) => Promise<void>;
  userId: string;
  effectiveBoard: PlannerBoardResponse;
  tags: Array<{ id: string; name: string }>;
  goals: Goal[];
}

export function TaskWizardModal({
  visible,
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
    if (!visible) return;
    if (!userId) {
      resetWizard();
      return;
    }

    void (async () => {
      const stored = await readJSON<TaskWizardDraft>(draftStorageKey(userId));
      if (!stored) {
        resetWizard();
        return;
      }

      Alert.alert(
        t('plannerResumeDraft') || 'Resume task draft?',
        t('plannerResumeDraftMessage') || 'Continue where you left off in the task setup wizard?',
        [
          {
            text: t('plannerDiscardDraft') || 'Discard',
            style: 'destructive',
            onPress: () => {
              resetWizard();
              void removeStorage(draftStorageKey(userId));
            },
          },
          {
            text: 'Resume',
            onPress: () => applyDraft(stored),
          },
        ],
      );
    })();
  }, [visible, userId, resetWizard, applyDraft, t]);

  useEffect(() => {
    if (!visible || !userId) return;

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
    visible, userId, step, title, description, dueDate, selectedStatus,
    selectedPriority, reminderMode, selectedTagIDs, subtasks, selectedGoalID,
    autoLedgerEnabled, ledgerType, ledgerAmount, ledgerCurrency,
    ledgerWalletCurrency, ledgerCategory, ledgerDescription,
  ]);

  const dueDateValidationError = useMemo(() => {
    if (isValidPlannerDueDate(dueDate)) return null;
    return t('plannerCompleteStep') || 'Use YYYY-MM-DD (for example, 2026-03-01).';
  }, [dueDate, t]);

  const validateStep = useCallback((s: TaskWizardStep): string | null => {
    if (s === 'basics' && !title.trim()) return t('plannerTaskTitle') ? 'Please add a task title.' : 'Please add a task title.';
    if (s === 'schedule' && dueDateValidationError) return dueDateValidationError;
    if (s === 'finance_review' && autoLedgerEnabled) {
      const amount = Number(ledgerAmount);
      if (!Number.isFinite(amount) || amount <= 0) return 'Ledger amount must be greater than zero.';
      if (!ledgerCurrency.trim()) return 'Ledger currency is required when auto-ledger is on.';
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
    const scheduleError = validateStep('schedule');
    if (scheduleError) {
      setStep('schedule');
      Alert.alert('Could not create task', scheduleError);
      return;
    }
    const financeError = validateStep('finance_review');
    if (financeError) {
      Alert.alert('Could not create task', financeError);
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Task title required', 'Please add a title before saving.');
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

    try {
      await onSubmit(payload, selectedTagIDs);
      void haptics.success();
      resetWizard();
      if (userId) void removeStorage(draftStorageKey(userId));
      onClose();
    } catch (err) {
      void haptics.error();
      Alert.alert('Could not queue task', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    validateStep, title, effectiveBoard, selectedStatus, description,
    selectedPriority, dueDate, selectedGoalID, reminderMode, subtasks,
    autoLedgerEnabled, ledgerType, ledgerAmount, ledgerCurrency,
    ledgerWalletCurrency, ledgerCategory, ledgerDescription,
    selectedTagIDs, onSubmit, resetWizard, userId, onClose,
  ]);

  const handleDiscard = useCallback(() => {
    resetWizard();
    if (userId) void removeStorage(draftStorageKey(userId));
    onClose();
  }, [resetWizard, userId, onClose]);

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

  const statusLabel = (s: PlannerStatus) => {
    const i18nMap: Record<PlannerStatus, string> = {
      todo: t('plannerToDo') || 'To Do',
      in_progress: t('plannerInProgress') || 'In Progress',
      done: t('plannerDone') || 'Done',
      archived: t('plannerArchived') || 'Archived',
    };
    return i18nMap[s];
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View
          style={{
            maxHeight: '92%',
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom + 12, 20),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 17 }}>
              {t('plannerTaskWizard') || 'Task Setup Wizard'}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{t('plannerClose') || 'Close'}</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {WIZARD_STEPS.map((s) => {
              const active = step === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setStep(s)}
                  style={({ pressed }) => [{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.accent + '22' : colors.card,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }, pressed && { opacity: 0.74 }]}
                >
                  <Text style={{ color: active ? colors.accent : colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                    {stepLabels[s]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView showsVerticalScrollIndicator={false}>
            {step === 'basics' && (
              <View style={{ gap: 10 }}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('plannerTaskTitle') || 'Task title'}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
                    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground,
                  }}
                />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('plannerDescription') || 'Description'}
                  placeholderTextColor={colors.placeholder}
                  multiline
                  style={{
                    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
                    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
                    color: colors.foreground, minHeight: 82, textAlignVertical: 'top',
                  }}
                />
                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>
                    {t('plannerInitialColumn') || 'Initial column'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {COLUMN_ORDER.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setSelectedStatus(s)}
                        style={({ pressed }) => [{
                          paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                          borderColor: selectedStatus === s ? colors.accent : colors.border,
                          backgroundColor: selectedStatus === s ? colors.accent + '22' : colors.card,
                        }, pressed && { opacity: 0.72 }]}
                      >
                        <Text style={{ color: selectedStatus === s ? colors.accent : colors.foreground, fontSize: 12 }}>
                          {statusLabel(s)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {step === 'schedule' && (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={{
                    borderWidth: 1,
                    borderColor: dueDateValidationError ? colors.danger : colors.border,
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: dueDate ? colors.foreground : colors.placeholder, fontSize: 14 }}>
                    {dueDate || (t('plannerSelectDueDate') || 'Select due date (optional)')}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {t('plannerSelectDate') || 'Pick'}
                  </Text>
                </Pressable>

                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>
                    {t('plannerPriority') || 'Priority'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['low', 'medium', 'high'] as const).map((p) => {
                      const badge = PRIORITY_BADGE[p];
                      return (
                        <Pressable
                          key={p}
                          onPress={() => {
                            setSelectedPriority(p);
                            void haptics.selection();
                          }}
                          style={({ pressed }) => [{
                            flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1,
                            borderColor: selectedPriority === p ? colors.accent : colors.border,
                            backgroundColor: selectedPriority === p ? badge.bg : colors.card,
                            paddingVertical: 8,
                          }, pressed && { opacity: 0.72 }]}
                        >
                          <Text style={{
                            color: selectedPriority === p ? badge.text : colors.foreground,
                            fontSize: 12, fontFamily: 'Inter_600SemiBold',
                          }}>
                            {t(`priority${p.charAt(0).toUpperCase() + p.slice(1)}` as any) || p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>
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
                          paddingVertical: 8,
                        }, pressed && { opacity: 0.72 }]}
                      >
                        <Text style={{
                          color: reminderMode === mode ? colors.accent : colors.foreground,
                          fontSize: 12, fontFamily: 'Inter_600SemiBold',
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
              <View style={{ gap: 12 }}>
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
              <View style={{ gap: 12 }}>
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

                    <View style={{ flexDirection: 'row', gap: 8 }}>
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
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Title:</Text>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                        {title || (t('plannerUntitled') || 'Untitled')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Status:</Text>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                        {statusLabel(selectedStatus)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Priority:</Text>
                      {(() => {
                        const badge = PRIORITY_BADGE[selectedPriority];
                        return (
                          <View style={{ backgroundColor: badge.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}>
                            <Text style={{ color: badge.text, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                              {selectedPriority.charAt(0).toUpperCase() + selectedPriority.slice(1)}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      Reminder: {reminderMode === 'aggressive' ? (t('plannerReminderAggressive') || 'Aggressive') : (t('plannerReminderOff') || 'Off')}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      Tags: {selectedTagIDs.length}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      Subtasks: {subtasks.length}
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
                          Edit {stepLabels[s]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Pressable
              onPress={handleDiscard}
              style={({ pressed }) => [{
                borderRadius: 12, borderWidth: 1, borderColor: colors.danger + '55',
                backgroundColor: colors.danger + '16', alignItems: 'center', justifyContent: 'center',
                paddingVertical: 12, paddingHorizontal: 14,
              }, pressed && { opacity: 0.72 }]}
            >
              <Text style={{ color: colors.danger, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                {t('plannerDiscardDraft') || 'Discard'}
              </Text>
            </Pressable>

            <Pressable
              onPress={goBack}
              disabled={step === 'basics'}
              style={({ pressed }) => [{
                flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
                opacity: step === 'basics' ? 0.55 : pressed ? 0.72 : 1,
              }]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                {t('plannerBack') || 'Back'}
              </Text>
            </Pressable>

            {step !== 'finance_review' ? (
              <Pressable
                onPress={goNext}
                style={({ pressed }) => [{
                  flex: 1, borderRadius: 12, backgroundColor: colors.accent,
                  alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
                  shadowColor: colors.accent, shadowOpacity: 0.34, shadowRadius: 14,
                  shadowOffset: { width: 0, height: 0 },
                  opacity: pressed ? 0.78 : 1,
                }]}
              >
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold' }}>
                  {t('plannerNext') || 'Next'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [{
                  flex: 1, borderRadius: 12, backgroundColor: colors.accent,
                  alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
                  shadowColor: colors.accent, shadowOpacity: 0.34, shadowRadius: 14,
                  shadowOffset: { width: 0, height: 0 },
                  opacity: pressed ? 0.78 : 1,
                }]}
              >
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold' }}>
                  {t('plannerCreateTask') || 'Create Task'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

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
    </Modal>
  );
}

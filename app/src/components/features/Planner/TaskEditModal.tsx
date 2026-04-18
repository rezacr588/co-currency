import { useCallback, useEffect, useRef, useState, Fragment } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DollarSign, Trash2 } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { DatePickerModal } from './DatePickerModal';
import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';
import { normalizePlannerDueDate } from '../../../utils/plannerDate';
import { COLUMN_ORDER, getStatusLabel, usePriorityColors } from '../../../utils/plannerConstants';
import type { PlannerStatus, Task, UpdateTaskRequest } from '../../../types/planner';

interface TaskEditModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: (taskId: string, updates: UpdateTaskRequest) => Promise<void>;
  onAddTransaction?: (taskId: string) => void;
  onDelete?: (taskId: string) => Promise<void> | void;
}

export function TaskEditModal({ visible, task, onClose, onSave, onAddTransaction, onDelete }: TaskEditModalProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const priorityColors = usePriorityColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<PlannerStatus>('todo');
  const [reminderMode, setReminderMode] = useState<'off' | 'aggressive'>('off');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Track initial values for unsaved changes detection
  const initialValuesRef = useRef({ title: '', description: '', dueDate: '', priority: 'medium', status: 'todo' as PlannerStatus, reminderMode: 'off' });

  useEffect(() => {
    if (task && visible) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(normalizePlannerDueDate(task.due_date));
      setPriority((task.priority as 'low' | 'medium' | 'high') || 'medium');
      setStatus(task.status);
      setReminderMode(task.reminder_mode || 'off');
      setIsSaving(false);
      initialValuesRef.current = {
        title: task.title,
        description: task.description || '',
        dueDate: normalizePlannerDueDate(task.due_date),
        priority: (task.priority as string) || 'medium',
        status: task.status,
        reminderMode: task.reminder_mode || 'off',
      };
    }
  }, [task, visible]);

  const hasUnsavedChanges = useCallback(() => {
    const init = initialValuesRef.current;
    return title !== init.title || description !== init.description ||
      dueDate !== init.dueDate || priority !== init.priority ||
      status !== init.status || reminderMode !== init.reminderMode;
  }, [title, description, dueDate, priority, status, reminderMode]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        t('plannerUnsavedTitle') || 'Unsaved changes',
        t('plannerUnsavedMessage') || 'You have unsaved changes. Discard them?',
        [
          { text: t('plannerClose') || 'Cancel', style: 'cancel' },
          { text: t('plannerDiscard') || 'Discard', style: 'destructive', onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose, t]);

  const handleSave = useCallback(async () => {
    if (!task || isSaving) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert(t('plannerTitleRequired') || 'Title required', t('plannerTitleRequiredMessage') || 'Please add a task title.');
      return;
    }

    const updates: UpdateTaskRequest = {
      title: cleanTitle,
      description: description.trim(),
      due_date: dueDate.trim() || undefined,
      priority,
      status,
      reminder_mode: reminderMode,
    };

    setIsSaving(true);
    try {
      await onSave(task.id, updates);
      void haptics.success();
      onClose();
    } catch (err) {
      void haptics.error();
      Alert.alert(t('plannerUpdateError') || 'Could not update task', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }, [task, isSaving, title, description, dueDate, priority, status, reminderMode, onSave, onClose]);

  const handleDelete = useCallback(() => {
    if (!task || !onDelete) return;

    Alert.alert(
      t('plannerDeleteTitle') || 'Delete task?',
      t('plannerDeleteMessage') || 'This task will be removed from your planner.',
      [
        { text: t('plannerClose') || 'Cancel', style: 'cancel' },
        {
          text: t('plannerDelete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            void haptics.error();
            try {
              await onDelete(task.id);
              onClose();
            } catch (err) {
              Alert.alert(
                t('plannerDeleteError') || 'Could not delete task',
                err instanceof Error ? err.message : 'Unknown error',
              );
            }
          },
        },
      ],
    );
  }, [task, onDelete, onClose, t]);

  if (!task) return null;

  return (
    <Fragment>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View
          style={{
            maxHeight: '88%',
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
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingBottom: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>
              {t('plannerEditTask') || 'Edit Task'}
            </Text>
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('a11yClose') || 'Close'}
              style={({ pressed }) => [{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                backgroundColor: colors.muted,
              }, pressed && { opacity: 0.72 }]}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{t('plannerClose') || 'Close'}</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: 14 }}>
              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerTaskTitle') || 'Title'} *
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('plannerTaskTitle') || 'Task title'}
                  placeholderTextColor={colors.placeholder}
                  maxLength={200}
                  style={{
                    borderWidth: 1, borderColor: title.trim() ? theme.alpha(colors.accent, 0.27) : colors.border,
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
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerSelectDueDate') || 'Due Date'}
                </Text>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('plannerSelectDueDate') || 'Select due date'}
                  style={({ pressed }) => [{
                    borderWidth: 1, borderColor: dueDate ? theme.alpha(colors.accent, 0.27) : colors.border,
                    backgroundColor: colors.card,
                    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                  }, pressed && { opacity: 0.8 }]}
                >
                  <Calendar size={14} color={dueDate ? colors.accent : colors.mutedForeground} />
                  <Text style={{ color: dueDate ? colors.foreground : colors.placeholder, flex: 1, fontFamily: dueDate ? 'Inter_500Medium' : undefined }}>
                    {dueDate || (t('plannerSelectDueDate') || 'Select due date')}
                  </Text>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                    backgroundColor: theme.alpha(colors.accent, 0.1),
                  }}>
                    <Text style={{ color: colors.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                      {t('plannerSelectDate') || 'Pick'}
                    </Text>
                  </View>
                </Pressable>
              </View>

              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerPriority') || 'Priority'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['low', 'medium', 'high'] as const).map((p) => {
                    const badge = priorityColors[p];
                    return (
                      <Pressable
                        key={p}
                        onPress={() => {
                          setPriority(p);
                          void haptics.selection();
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: priority === p }}
                        accessibilityLabel={t(`priority${p.charAt(0).toUpperCase() + p.slice(1)}` as any) || p}
                        style={({ pressed }) => [{
                          flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1,
                          borderColor: priority === p ? theme.alpha(badge.text, 0.33) : colors.border,
                          backgroundColor: priority === p ? badge.bg : colors.card,
                          paddingVertical: 12, minHeight: 44,
                          justifyContent: 'center',
                        }, pressed && { opacity: 0.72 }]}
                      >
                        <Text style={{
                          color: priority === p ? badge.text : colors.foreground,
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
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerStatus') || 'Status'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COLUMN_ORDER.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setStatus(s)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: status === s }}
                      accessibilityLabel={getStatusLabel(s, t as (key: string) => string | undefined)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
                        borderColor: status === s ? colors.accent : colors.border,
                        backgroundColor: status === s ? theme.alpha(colors.accent, 0.13) : colors.card,
                        minHeight: 40,
                        justifyContent: 'center',
                      }, pressed && { opacity: 0.72 }]}
                    >
                      <Text style={{
                        color: status === s ? colors.accent : colors.foreground,
                        fontSize: 13, fontFamily: status === s ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      }}>
                        {getStatusLabel(s, t as (key: string) => string | undefined)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerReminderMode') || 'Reminder mode'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['off', 'aggressive'] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => setReminderMode(mode)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: reminderMode === mode }}
                      style={({ pressed }) => [{
                        flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1,
                        borderColor: reminderMode === mode ? colors.accent : colors.border,
                        backgroundColor: reminderMode === mode ? theme.alpha(colors.accent, 0.13) : colors.card,
                        paddingVertical: 10, minHeight: 44,
                        justifyContent: 'center',
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

              {onAddTransaction && (
                <Pressable
                  onPress={() => {
                    onClose();
                    onAddTransaction(task.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('plannerLinkTransaction') || 'Link Transaction'}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    borderWidth: 1, borderColor: theme.alpha(colors.accent, 0.27), backgroundColor: theme.alpha(colors.accent, 0.07),
                    borderRadius: 12, paddingVertical: 12,
                  }, pressed && { opacity: 0.72 }]}
                >
                  <DollarSign size={14} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                    {t('plannerLinkTransaction') || 'Link Transaction'}
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>

          {/* Separator */}
          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 14, marginBottom: 12 }} />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onDelete ? (
              <Pressable
                onPress={handleDelete}
                hitSlop={4}
                accessibilityLabel={t('plannerDelete') || 'Delete'}
                accessibilityRole="button"
                style={({ pressed }) => [{
                  borderRadius: 12, borderWidth: 1, borderColor: theme.alpha(colors.danger, 0.27),
                  backgroundColor: theme.alpha(colors.danger, 0.06), alignItems: 'center', justifyContent: 'center',
                  paddingVertical: 14, paddingHorizontal: 16, minWidth: 48, minHeight: 48,
                }, pressed && { opacity: 0.72 }]}
              >
                <Trash2 size={16} color={colors.danger} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [{
                flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
              }, pressed && { opacity: 0.72 }]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                {t('plannerClose') || 'Cancel'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => [{
                flex: 1.5, borderRadius: 12, backgroundColor: colors.accent,
                alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
                shadowColor: colors.accent, shadowOpacity: 0.34, shadowRadius: 14,
                shadowOffset: { width: 0, height: 0 },
                elevation: 4,
                opacity: isSaving ? 0.6 : pressed ? 0.78 : 1,
              }]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.accentForeground} />
              ) : (
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                  {t('plannerSaveChanges') || 'Save Changes'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>

    <DatePickerModal
      visible={showDatePicker}
      onClose={() => setShowDatePicker(false)}
      onSelect={(d) => setDueDate(d)}
      initialDate={dueDate}
    />
    </Fragment>
  );
}

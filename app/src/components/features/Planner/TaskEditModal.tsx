import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DollarSign, Trash2 } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { DatePickerModal } from './DatePickerModal';
import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';
import type { PlannerStatus, TodoItem, UpdateTaskRequest } from '../../../types/planner';

const COLUMN_ORDER: PlannerStatus[] = ['todo', 'in_progress', 'done', 'archived'];

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  medium: { bg: 'rgba(250,204,21,0.15)', text: '#facc15' },
  high: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

interface TaskEditModalProps {
  visible: boolean;
  task: TodoItem | null;
  onClose: () => void;
  onSave: (taskId: string, updates: UpdateTaskRequest) => Promise<void>;
  onAddTransaction?: (taskId: string) => void;
  onDelete?: (taskId: string) => Promise<void> | void;
}

export function TaskEditModal({ visible, task, onClose, onSave, onAddTransaction, onDelete }: TaskEditModalProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<PlannerStatus>('todo');
  const [reminderMode, setReminderMode] = useState<'off' | 'aggressive'>('off');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (task && visible) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(task.due_date || '');
      setPriority((task.priority as 'low' | 'medium' | 'high') || 'medium');
      setStatus(task.status);
      setReminderMode('off');
    }
  }, [task, visible]);

  const handleSave = useCallback(async () => {
    if (!task) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Title required', 'Please add a task title.');
      return;
    }

    const updates: UpdateTaskRequest = {
      title: cleanTitle,
      description: description.trim() || undefined,
      due_date: dueDate.trim() || undefined,
      priority,
      status,
      reminder_mode: reminderMode,
    };

    try {
      await onSave(task.id, updates);
      void haptics.success();
      onClose();
    } catch (err) {
      void haptics.error();
      Alert.alert('Could not update task', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [task, title, description, dueDate, priority, status, reminderMode, onSave, onClose]);

  const handleDelete = useCallback(() => {
    if (!task || !onDelete) return;

    Alert.alert(
      t('plannerDeleteTitle') || 'Delete task?',
      t('plannerDeleteMessage') || 'This task will be removed from your planner.',
      [
        { text: t('plannerClose') || 'Cancel', style: 'cancel' },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: () => {
            void haptics.error();
            void onDelete(task.id);
            onClose();
          },
        },
      ],
    );
  }, [task, onDelete, onClose, t]);

  const statusLabel = (s: PlannerStatus) => {
    const map: Record<PlannerStatus, string> = {
      todo: t('plannerToDo') || 'To Do',
      in_progress: t('plannerInProgress') || 'In Progress',
      done: t('plannerDone') || 'Done',
      archived: t('plannerArchived') || 'Archived',
    };
    return map[s];
  };

  if (!task) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
              onPress={onClose}
              hitSlop={8}
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
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerSelectDueDate') || 'Due Date'}
                </Text>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={({ pressed }) => [{
                    borderWidth: 1, borderColor: dueDate ? colors.accent + '44' : colors.border,
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
                    backgroundColor: colors.accent + '18',
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
                    const badge = PRIORITY_COLORS[p];
                    return (
                      <Pressable
                        key={p}
                        onPress={() => {
                          setPriority(p);
                          void haptics.selection();
                        }}
                        style={({ pressed }) => [{
                          flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1,
                          borderColor: priority === p ? badge.text + '55' : colors.border,
                          backgroundColor: priority === p ? badge.bg : colors.card,
                          paddingVertical: 10,
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
                  Status
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COLUMN_ORDER.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setStatus(s)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
                        borderColor: status === s ? colors.accent : colors.border,
                        backgroundColor: status === s ? colors.accent + '22' : colors.card,
                      }, pressed && { opacity: 0.72 }]}
                    >
                      <Text style={{
                        color: status === s ? colors.accent : colors.foreground,
                        fontSize: 13, fontFamily: status === s ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      }}>
                        {statusLabel(s)}
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

              {task.type === 'task' && onAddTransaction && (
                <Pressable
                  onPress={() => {
                    onClose();
                    onAddTransaction(task.id);
                  }}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    borderWidth: 1, borderColor: colors.accent + '44', backgroundColor: colors.accent + '12',
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
                style={({ pressed }) => [{
                  borderRadius: 12, borderWidth: 1, borderColor: colors.danger + '44',
                  backgroundColor: colors.danger + '10', alignItems: 'center', justifyContent: 'center',
                  paddingVertical: 14, paddingHorizontal: 16,
                }, pressed && { opacity: 0.72 }]}
              >
                <Trash2 size={16} color={colors.danger} />
              </Pressable>
            ) : null}

            <Pressable
              onPress={onClose}
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
              style={({ pressed }) => [{
                flex: 1.5, borderRadius: 12, backgroundColor: colors.accent,
                alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
                shadowColor: colors.accent, shadowOpacity: 0.34, shadowRadius: 14,
                shadowOffset: { width: 0, height: 0 },
                elevation: 4,
              }, pressed && { opacity: 0.78 }]}
            >
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>
                {t('plannerSaveChanges') || 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(d) => setDueDate(d)}
        initialDate={dueDate}
      />
    </Modal>
  );
}

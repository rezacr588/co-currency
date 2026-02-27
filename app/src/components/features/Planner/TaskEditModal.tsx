import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DollarSign } from 'lucide-react-native';
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
}

export function TaskEditModal({ visible, task, onClose, onSave, onAddTransaction }: TaskEditModalProps) {
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 17 }}>
              {t('plannerEditTask') || 'Edit Task'}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{t('plannerClose') || 'Close'}</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>
                  {t('plannerTaskTitle') || 'Title'}
                </Text>
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
              </View>

              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>
                  {t('plannerDescription') || 'Description'}
                </Text>
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
              </View>

              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>
                  {t('plannerSelectDueDate') || 'Due date'}
                </Text>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={{
                    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
                    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                  }}
                >
                  <Calendar size={14} color={colors.mutedForeground} />
                  <Text style={{ color: dueDate ? colors.foreground : colors.placeholder, flex: 1 }}>
                    {dueDate || (t('plannerSelectDueDate') || 'Select due date')}
                  </Text>
                </Pressable>
              </View>

              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>
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
                          borderColor: priority === p ? colors.accent : colors.border,
                          backgroundColor: priority === p ? badge.bg : colors.card,
                          paddingVertical: 8,
                        }, pressed && { opacity: 0.72 }]}
                      >
                        <Text style={{
                          color: priority === p ? badge.text : colors.foreground,
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
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>
                  Status
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COLUMN_ORDER.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setStatus(s)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                        borderColor: status === s ? colors.accent : colors.border,
                        backgroundColor: status === s ? colors.accent + '22' : colors.card,
                      }, pressed && { opacity: 0.72 }]}
                    >
                      <Text style={{ color: status === s ? colors.accent : colors.foreground, fontSize: 12 }}>
                        {statusLabel(s)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>
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

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [{
                flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
              }, pressed && { opacity: 0.72 }]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                {t('plannerClose') || 'Cancel'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [{
                flex: 1, borderRadius: 12, backgroundColor: colors.accent,
                alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
                shadowColor: colors.accent, shadowOpacity: 0.34, shadowRadius: 14,
                shadowOffset: { width: 0, height: 0 },
              }, pressed && { opacity: 0.78 }]}
            >
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold' }}>
                {t('plannerSaveChanges') || 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(d) => setDueDate(d)}
        initialDate={dueDate}
      />
    </Modal>
  );
}

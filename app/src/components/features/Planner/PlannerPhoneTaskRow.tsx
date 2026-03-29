import { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Calendar, Check, ChevronRight, GripHorizontal, KanbanSquare, Target } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { SwipeableRow } from '../../ui/SwipeableRow';
import { useLanguage } from '../../../context/LanguageContext';
import { normalizePlannerDueDate } from '../../../utils/plannerDate';
import { PRIORITY_COLORS } from '../../../utils/plannerConstants';
import type { PlannerPendingMarker, TodoItem } from '../../../types/planner';

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Parse YYYY-MM-DD manually to avoid Android/Hermes date parsing inconsistencies
  const parts = dueDate.split('-');
  if (parts.length < 3) return false;
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(due.getTime())) return false;
  return due < today;
}

interface PlannerPhoneTaskRowProps {
  item: TodoItem;
  marker?: PlannerPendingMarker;
  onOpen: (item: TodoItem) => void;
  onRequestMove: (item: TodoItem) => void;
  onCompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export const PlannerPhoneTaskRow = memo(function PlannerPhoneTaskRow({
  item,
  marker,
  onOpen,
  onRequestMove,
  onCompleteTask,
  onDeleteTask,
}: PlannerPhoneTaskRowProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const isTask = item.type === 'task';
  const canCompleteTask = isTask && item.status !== 'done' && item.status !== 'archived';
  const normalizedDueDate = normalizePlannerDueDate(item.due_date);
  const overdue = isOverdue(normalizedDueDate);
  const priorityInfo = item.priority ? PRIORITY_COLORS[item.priority] : undefined;
  const subtaskText = useMemo(() => {
    if (item.subtask_total && item.subtask_total > 0) {
      return `${item.subtask_done ?? 0}/${item.subtask_total}`;
    }
    return null;
  }, [item.subtask_done, item.subtask_total]);

  const pendingTone = marker?.sync_error
    ? colors.danger
    : marker?.pending_verification || marker?.is_pending_sync
      ? colors.warning
      : null;

  const row = (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: marker?.sync_error
          ? colors.danger + '44'
          : marker?.pending_verification || marker?.is_pending_sync
            ? colors.warning + '44'
            : colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {canCompleteTask ? (
          <Pressable
            onPress={() => onCompleteTask(item.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('plannerTaskCompleted') || 'Complete task'}
            style={({ pressed }) => [
              {
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.success + '16',
              },
              pressed && { opacity: 0.72 },
            ]}
          >
            <Check size={15} color={colors.success} />
          </Pressable>
        ) : (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isTask ? colors.muted : colors.warning + '18',
            }}
          >
            {isTask ? (
              <KanbanSquare size={14} color={colors.mutedForeground} />
            ) : (
              <Target size={14} color={colors.warning} />
            )}
          </View>
        )}

        <Pressable
          onPress={() => (isTask ? onOpen(item) : onRequestMove(item))}
          style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.78 }]}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontFamily: 'Inter_600SemiBold',
                flex: 1,
              }}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {pendingTone ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: pendingTone,
                }}
              />
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
            {priorityInfo && item.priority ? (
              <View style={{ backgroundColor: priorityInfo.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: priorityInfo.text, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                  {t(`priority${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}` as any) || item.priority}
                </Text>
              </View>
            ) : null}

            {normalizedDueDate ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  backgroundColor: overdue ? colors.danger + '14' : colors.muted,
                }}
              >
                <Calendar size={10} color={overdue ? colors.danger : colors.mutedForeground} />
                <Text
                  style={{
                    color: overdue ? colors.danger : colors.mutedForeground,
                    fontSize: 10,
                    fontFamily: 'Inter_500Medium',
                  }}
                >
                  {normalizedDueDate}
                </Text>
              </View>
            ) : null}

            {subtaskText ? (
              <View style={{ backgroundColor: colors.muted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_500Medium' }}>
                  {subtaskText}
                </Text>
              </View>
            ) : null}

            {!isTask ? (
              <View style={{ backgroundColor: colors.warning + '14', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: colors.warning, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                  {t('goal') || 'Goal'}
                </Text>
              </View>
            ) : null}

            {item.tag_names?.slice(0, 1).map((tagName) => (
              <View key={tagName} style={{ backgroundColor: colors.accent + '12', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: colors.accent, fontSize: 10, fontFamily: 'Inter_500Medium' }}>
                  {tagName}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>

        <Pressable
          onPress={() => onRequestMove(item)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('plannerMoveTo') || 'Move to'}
          style={({ pressed }) => [
            {
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.muted,
            },
            pressed && { opacity: 0.72 },
          ]}
        >
          <ChevronRight size={15} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {(marker?.is_pending_sync || marker?.pending_verification || marker?.sync_error) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 42 }}>
          <GripHorizontal size={10} color={pendingTone || colors.mutedForeground} />
          <Text style={{ color: pendingTone || colors.mutedForeground, fontSize: 10 }} numberOfLines={1}>
            {marker?.sync_error
              ? marker.sync_error
              : marker?.pending_verification
                ? (t('plannerGoalFunding') || 'Pending funding verification')
                : (t('plannerPendingSync') || 'Pending sync')}
          </Text>
        </View>
      )}
    </View>
  );

  const rightActions = isTask
    ? [
        {
          icon: 'delete' as const,
          color: colors.danger,
          backgroundColor: colors.danger + '16',
          onPress: () => onDeleteTask(item.id),
        },
      ]
    : [];

  return <SwipeableRow rightActions={rightActions} enabled={isTask}>{row}</SwipeableRow>;
});

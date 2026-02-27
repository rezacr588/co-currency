import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Check, GripHorizontal, KanbanSquare, Target, Calendar, Flag } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { SwipeableRow } from '../../ui/SwipeableRow';
import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';
import { readStorage, writeStorage } from '../../../utils/storage';
import type { PlannerPendingMarker, PlannerStatus, TodoItem } from '../../../types/planner';

const COLUMN_ORDER: PlannerStatus[] = ['todo', 'in_progress', 'done', 'archived'];

type DragDirection = 'left' | 'right' | null;

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Low' },
  medium: { bg: 'rgba(250,204,21,0.15)', text: '#facc15', label: 'Med' },
  high: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'High' },
};

function dragHintStorageKey(userId: string): string {
  return `@planner_drag_hint_seen:${userId}`;
}

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  return due < today;
}

interface PlannerCardProps {
  item: TodoItem;
  columnIndex: number;
  marker?: PlannerPendingMarker;
  onMove: (item: TodoItem, nextStatus: PlannerStatus) => void;
  onCompleteTask: (taskID: string) => void;
  onDeleteTask: (taskID: string) => void;
  onEdit?: (item: TodoItem) => void;
  onAddTransaction?: (taskID: string) => void;
  isLaunchingTransaction?: boolean;
  onDragStateChange: (dragging: boolean) => void;
  onDragDirectionChange: (direction: DragDirection) => void;
  showDragHint?: boolean;
  isCompleting?: boolean;
  userId?: string;
}

export function PlannerCard({
  item,
  columnIndex,
  marker,
  onMove,
  onCompleteTask,
  onDeleteTask,
  onEdit,
  onAddTransaction,
  isLaunchingTransaction,
  onDragStateChange,
  onDragDirectionChange,
  showDragHint: showDragHintProp,
  isCompleting,
  userId,
}: PlannerCardProps) {
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lift = useSharedValue(0);
  const completionScale = useSharedValue(1);
  const completionOpacity = useSharedValue(0);

  const isTask = item.type === 'task';
  const canCompleteTask = isTask && item.status !== 'done' && item.status !== 'archived';
  const overdue = isOverdue(item.due_date);
  const priorityInfo = item.priority ? PRIORITY_COLORS[item.priority] : undefined;

  const [hintSeen, setHintSeen] = useState(true);

  useEffect(() => {
    if (!userId || showDragHintProp === false) return;
    void (async () => {
      const val = await readStorage(dragHintStorageKey(userId));
      if (val !== 'true') setHintSeen(false);
    })();
  }, [userId, showDragHintProp]);

  const markHintSeen = useCallback(async () => {
    if (!userId) return;
    setHintSeen(true);
    await writeStorage(dragHintStorageKey(userId), 'true');
  }, [userId]);

  useEffect(() => {
    if (isCompleting) {
      completionScale.value = withSequence(
        withTiming(1.06, { duration: 180 }),
        withTiming(1, { duration: 180 }),
      );
      completionOpacity.value = withSequence(
        withTiming(0.35, { duration: 180 }),
        withTiming(0, { duration: 400 }),
      );
    }
  }, [isCompleting, completionScale, completionOpacity]);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(220)
    .onBegin(() => {
      lift.value = withTiming(1, { duration: 160 });
      runOnJS(onDragStateChange)(true);
      runOnJS(onDragDirectionChange)(null);
      runOnJS(haptics.medium)();
      if (!hintSeen) runOnJS(markHintSeen)();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;

      let direction: DragDirection = null;
      if (event.translationX > 42) direction = 'right';
      else if (event.translationX < -42) direction = 'left';
      runOnJS(onDragDirectionChange)(direction);
    })
    .onEnd((event) => {
      let nextStatus: PlannerStatus | null = null;
      if (event.translationX > 88 && columnIndex < COLUMN_ORDER.length - 1) {
        nextStatus = COLUMN_ORDER[columnIndex + 1];
      }
      if (event.translationX < -88 && columnIndex > 0) {
        nextStatus = COLUMN_ORDER[columnIndex - 1];
      }
      if (nextStatus) {
        runOnJS(onMove)(item, nextStatus);
        runOnJS(haptics.success)();
      }

      translateX.value = withSpring(0, { damping: 16, stiffness: 220 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 220 });
      lift.value = withTiming(0, { duration: 180 });
      runOnJS(onDragStateChange)(false);
      runOnJS(onDragDirectionChange)(null);
    })
    .onFinalize(() => {
      translateX.value = withSpring(0, { damping: 16, stiffness: 220 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 220 });
      lift.value = withTiming(0, { duration: 180 });
      runOnJS(onDragStateChange)(false);
      runOnJS(onDragDirectionChange)(null);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: (1 + lift.value * 0.024) * completionScale.value },
    ],
    zIndex: lift.value > 0 ? 40 : 1,
    shadowOpacity: 0.2 + lift.value * 0.28,
    shadowRadius: 12 + lift.value * 10,
  }));

  const completionOverlayStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: colors.success,
    opacity: completionOpacity.value,
  }));

  const swipeRightActions = useMemo(() => {
    const actions = [];
    if (isTask && onEdit) {
      actions.push({
        icon: 'edit' as const,
        color: colors.accent,
        backgroundColor: colors.accent + '20',
        onPress: () => onEdit(item),
      });
    }
    if (isTask) {
      actions.push({
        icon: 'delete' as const,
        color: colors.danger,
        backgroundColor: colors.danger + '18',
        onPress: () => onDeleteTask(item.id),
      });
    }
    return actions;
  }, [isTask, onEdit, onDeleteTask, item, colors]);

  const subtaskText = useMemo(() => {
    if (item.subtask_total && item.subtask_total > 0) {
      return `${item.subtask_done ?? 0}/${item.subtask_total}`;
    }
    return null;
  }, [item.subtask_total, item.subtask_done]);

  return (
    <SwipeableRow rightActions={swipeRightActions} enabled={isTask}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={animatedStyle}>
          <View
            style={{
              backgroundColor: isTask ? colors.card : colors.cardElevated,
              borderWidth: 1,
              borderColor: marker?.sync_error
                ? colors.danger + '66'
                : marker?.is_pending_sync
                  ? colors.warning + '66'
                  : isTask
                    ? colors.border
                    : colors.accent + '55',
              borderRadius: 16,
              padding: 12,
              marginBottom: 10,
              shadowColor: isTask ? '#111827' : colors.accent,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.16,
              elevation: 4,
            }}
          >
            <Animated.View style={completionOverlayStyle} pointerEvents="none" />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                {isTask ? <KanbanSquare size={14} color={colors.accent} /> : <Target size={14} color={colors.warning} />}
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: 'Inter_700Bold',
                    fontSize: 14,
                    flexShrink: 1,
                  }}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {canCompleteTask && (
                  <Pressable
                    onPress={() => onCompleteTask(item.id)}
                    style={({ pressed }) => [{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.success + '18',
                    }, pressed && { opacity: 0.72 }]}
                  >
                    <Check size={14} color={colors.success} />
                  </Pressable>
                )}
                <GripHorizontal size={14} color={colors.mutedForeground} />
              </View>
            </View>

            {item.description ? (
              <Text style={{ color: colors.mutedForeground, marginTop: 6, fontSize: 12 }} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
              {priorityInfo && (
                <View style={{ backgroundColor: priorityInfo.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: priorityInfo.text, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                    {priorityInfo.label}
                  </Text>
                </View>
              )}

              {item.due_date && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    backgroundColor: overdue ? colors.danger + '18' : colors.muted,
                    borderRadius: 6,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Calendar size={10} color={overdue ? colors.danger : colors.mutedForeground} />
                  <Text style={{ color: overdue ? colors.danger : colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_500Medium' }}>
                    {item.due_date}
                  </Text>
                </View>
              )}

              {subtaskText && (
                <View style={{ backgroundColor: colors.muted, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_500Medium' }}>
                    {subtaskText}
                  </Text>
                </View>
              )}

              {item.tag_names?.slice(0, 2).map((tagName) => (
                <View key={tagName} style={{ backgroundColor: colors.accent + '14', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: colors.accent, fontSize: 10, fontFamily: 'Inter_500Medium' }}>
                    {tagName}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ marginTop: 6 }}>
              {!hintSeen && (
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                  {t('plannerDragHint') || 'Long-press + drag to move'}
                </Text>
              )}
              {marker?.is_pending_sync ? (
                <Text style={{ color: colors.warning, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerPendingSync') || 'Pending sync'}
                </Text>
              ) : null}
              {marker?.pending_verification ? (
                <Text style={{ color: colors.warning, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerGoalFunding') || 'Pending funding verification'}
                </Text>
              ) : null}
              {marker?.sync_error ? (
                <Text style={{ color: colors.danger, fontSize: 10 }} numberOfLines={2}>
                  {marker.sync_error}
                </Text>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </SwipeableRow>
  );
}

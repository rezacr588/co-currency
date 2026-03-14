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
import { Calendar, Check, ChevronLeft, ChevronRight, GripHorizontal, KanbanSquare, Pencil, Target } from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { SwipeableRow } from '../../ui/SwipeableRow';
import { useLanguage } from '../../../context/LanguageContext';
import { haptics } from '../../../utils/haptics';
import { readStorage, writeStorage } from '../../../utils/storage';
import { COLUMN_ORDER, PRIORITY_COLORS, getStatusLabel } from '../../../utils/plannerConstants';
import type { PlannerPendingMarker, PlannerStatus, TodoItem } from '../../../types/planner';

type DragDirection = 'left' | 'right' | null;

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
  interactionMode?: 'gesture' | 'explicit';
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
  interactionMode = 'gesture',
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
  const allowGestures = interactionMode === 'gesture';
  const previousStatus = columnIndex > 0 ? COLUMN_ORDER[columnIndex - 1] : null;
  const nextStatus = columnIndex < COLUMN_ORDER.length - 1 ? COLUMN_ORDER[columnIndex + 1] : null;

  const [hintSeen, setHintSeen] = useState(true);

  useEffect(() => {
    if (!allowGestures || !userId || showDragHintProp === false) return;
    void (async () => {
      const val = await readStorage(dragHintStorageKey(userId));
      if (val !== 'true') setHintSeen(false);
    })();
  }, [allowGestures, userId, showDragHintProp]);

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

  const statusLabel = useCallback((s: PlannerStatus) => {
    return getStatusLabel(s, t as (key: string) => string | undefined);
  }, [t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: (1 + lift.value * 0.024) * completionScale.value },
    ],
    zIndex: lift.value > 0 ? 40 : 1,
    elevation: lift.value > 0 ? 12 : 4,
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
    if (!allowGestures) return [];

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
  }, [allowGestures, isTask, onEdit, onDeleteTask, item, colors]);

  const subtaskText = useMemo(() => {
    if (item.subtask_total && item.subtask_total > 0) {
      return `${item.subtask_done ?? 0}/${item.subtask_total}`;
    }
    return null;
  }, [item.subtask_total, item.subtask_done]);

  const cardContent = (
    <Animated.View style={[animatedStyle, { width: '100%' }]}>
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
                hitSlop={6}
                style={({ pressed }) => [{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.success + '18',
                }, pressed && { opacity: 0.72 }]}
              >
                <Check size={16} color={colors.success} />
              </Pressable>
            )}
            {!allowGestures && isTask && onEdit ? (
              <Pressable
                onPress={() => onEdit(item)}
                hitSlop={6}
                style={({ pressed }) => [{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.accent + '16',
                }, pressed && { opacity: 0.72 }]}
              >
                <Pencil size={15} color={colors.accent} />
              </Pressable>
            ) : null}
            {allowGestures ? <GripHorizontal size={14} color={colors.mutedForeground} /> : null}
          </View>
        </View>

        {item.description ? (
          <Text style={{ color: colors.mutedForeground, marginTop: 6, fontSize: 12 }} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
          {priorityInfo && item.priority && (
            <View style={{ backgroundColor: priorityInfo.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ color: priorityInfo.text, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                {t(`priority${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}` as any) || item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
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

        {!allowGestures && (previousStatus || nextStatus) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {previousStatus ? (
              <Pressable
                onPress={() => {
                  void haptics.selection();
                  onMove(item, previousStatus);
                }}
                style={({ pressed }) => [{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  flexShrink: 1,
                }, pressed && { opacity: 0.72 }]}
              >
                <ChevronLeft size={14} color={colors.mutedForeground} />
                <Text
                  style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold', flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {(t('plannerMoveTo') || 'Move to') + ' ' + statusLabel(previousStatus)}
                </Text>
              </Pressable>
            ) : null}
            {nextStatus ? (
              <Pressable
                onPress={() => {
                  void haptics.selection();
                  onMove(item, nextStatus);
                }}
                style={({ pressed }) => [{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: colors.accent + '44',
                  backgroundColor: colors.accent + '12',
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  flexShrink: 1,
                }, pressed && { opacity: 0.72 }]}
              >
                <Text
                  style={{ color: colors.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold', flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {(t('plannerMoveTo') || 'Move to') + ' ' + statusLabel(nextStatus)}
                </Text>
                <ChevronRight size={14} color={colors.accent} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {(allowGestures && (!hintSeen || marker?.is_pending_sync || marker?.pending_verification || marker?.sync_error)) && (
          <View style={{ marginTop: 8, gap: 3 }}>
            {!hintSeen && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.muted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' }}>
                <GripHorizontal size={9} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_500Medium' }}>
                  {t('plannerDragHint') || 'Long-press + drag to move'}
                </Text>
              </View>
            )}
            {marker?.is_pending_sync ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warning + '18', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' }}>
                <Text style={{ color: colors.warning, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerPendingSync') || 'Pending sync'}
                </Text>
              </View>
            ) : null}
            {marker?.pending_verification ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warning + '18', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' }}>
                <Text style={{ color: colors.warning, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerGoalFunding') || 'Pending funding verification'}
                </Text>
              </View>
            ) : null}
            {marker?.sync_error ? (
              <View style={{ backgroundColor: colors.danger + '14', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' }}>
                <Text style={{ color: colors.danger, fontSize: 10 }} numberOfLines={2}>
                  {marker.sync_error}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Animated.View>
  );

  return (
    <SwipeableRow rightActions={swipeRightActions} enabled={isTask && allowGestures}>
      {allowGestures ? <GestureDetector gesture={gesture}>{cardContent}</GestureDetector> : cardContent}
    </SwipeableRow>
  );
}

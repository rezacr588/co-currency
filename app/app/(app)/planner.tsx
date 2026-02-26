import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Check,
  GripHorizontal,
  KanbanSquare,
  Plus,
  Sparkles,
  Tag,
  Target,
  Trash2,
} from 'lucide-react-native';
import { api } from '../../src/api';
import { useTheme } from 'styled-components/native';
import { ModeSwitch } from '../../src/components/navigation/ModeSwitch';
import type {
  CreateTaskRequest,
  GoalFundingRequired,
  PlannerBoardResponse,
  PlannerStatus,
  TaskSubtask,
  TodoItem,
} from '../../src/types/planner';
import { GoalFundingRequiredError } from '../../src/api/planner';

const COLUMN_ORDER: PlannerStatus[] = ['todo', 'in_progress', 'done', 'archived'];

const COLUMN_META: Record<PlannerStatus, { label: string; glow: string; border: string }> = {
  todo: {
    label: 'To Do',
    glow: 'rgba(59,130,246,0.25)',
    border: 'rgba(59,130,246,0.45)',
  },
  in_progress: {
    label: 'In Progress',
    glow: 'rgba(245,158,11,0.28)',
    border: 'rgba(245,158,11,0.5)',
  },
  done: {
    label: 'Done',
    glow: 'rgba(34,197,94,0.24)',
    border: 'rgba(34,197,94,0.45)',
  },
  archived: {
    label: 'Archived',
    glow: 'rgba(148,163,184,0.18)',
    border: 'rgba(148,163,184,0.38)',
  },
};

function plannerColumnMap(board: PlannerBoardResponse): Record<PlannerStatus, TodoItem[]> {
  const map: Record<PlannerStatus, TodoItem[]> = {
    todo: [],
    in_progress: [],
    done: [],
    archived: [],
  };
  for (const column of board.columns) {
    map[column.status] = column.items ?? [];
  }
  return map;
}

function buildBoardFromMap(map: Record<PlannerStatus, TodoItem[]>, summary: PlannerBoardResponse['summary']): PlannerBoardResponse {
  return {
    summary,
    columns: COLUMN_ORDER.map((status) => ({ status, items: map[status] ?? [] })),
  };
}

function PlannerCard({
  item,
  columnIndex,
  onMove,
  onCompleteTask,
  onDeleteTask,
  onAddTransaction,
  isLaunchingTransaction,
}: {
  item: TodoItem;
  columnIndex: number;
  onMove: (item: TodoItem, nextStatus: PlannerStatus) => void;
  onCompleteTask: (taskID: string) => void;
  onDeleteTask: (taskID: string) => void;
  onAddTransaction?: (taskID: string) => void;
  isLaunchingTransaction?: boolean;
}) {
  const theme = useTheme();
  const colors = theme.colors;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lift = useSharedValue(0);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(180)
    .onBegin(() => {
      lift.value = withTiming(1, { duration: 160 });
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      let nextStatus: PlannerStatus | null = null;
      if (event.translationX > 80 && columnIndex < COLUMN_ORDER.length - 1) {
        nextStatus = COLUMN_ORDER[columnIndex + 1];
      }
      if (event.translationX < -80 && columnIndex > 0) {
        nextStatus = COLUMN_ORDER[columnIndex - 1];
      }
      if (nextStatus) {
        runOnJS(onMove)(item, nextStatus);
      }

      translateX.value = withSpring(0, { damping: 16, stiffness: 220 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 220 });
      lift.value = withTiming(0, { duration: 180 });
    })
    .onFinalize(() => {
      translateX.value = withSpring(0, { damping: 16, stiffness: 220 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 220 });
      lift.value = withTiming(0, { duration: 180 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: 1 + lift.value * 0.02 },
    ],
    zIndex: lift.value > 0 ? 100 : 1,
    shadowOpacity: 0.18 + lift.value * 0.28,
    shadowRadius: 12 + lift.value * 10,
  }));

  const isTask = item.type === 'task';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <View
          style={{
            backgroundColor: isTask ? colors.card : colors.cardElevated,
            borderWidth: 1,
            borderColor: isTask ? colors.border : colors.accent + '55',
            borderRadius: 16,
            padding: 12,
            marginBottom: 10,
            shadowColor: isTask ? '#111827' : colors.accent,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              {isTask ? (
                <KanbanSquare size={14} color={colors.accent} />
              ) : (
                <Target size={14} color={colors.warning} />
              )}
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 14,
                  flexShrink: 1,
                }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
            </View>
            <GripHorizontal size={14} color={colors.mutedForeground} />
          </View>

          {item.description ? (
            <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 12 }} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', marginTop: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              Swipe to move
            </Text>
            {isTask ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => onAddTransaction?.(item.id)}
                  disabled={isLaunchingTransaction}
                  style={({ pressed }) => [{
                    minWidth: 44,
                    paddingHorizontal: 8,
                    height: 28,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.accent + '20',
                    borderWidth: 1,
                    borderColor: colors.accent + '44',
                    opacity: isLaunchingTransaction ? 0.7 : 1,
                  }, pressed && { opacity: 0.72 }]}
                >
                  {isLaunchingTransaction ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={{ color: colors.accent, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                      Txn
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => onCompleteTask(item.id)}
                  style={({ pressed }) => [{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.success + '20',
                  }, pressed && { opacity: 0.72 }]}
                >
                  <Check size={14} color={colors.success} />
                </Pressable>
                <Pressable
                  onPress={() => onDeleteTask(item.id)}
                  style={({ pressed }) => [{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.danger + '18',
                  }, pressed && { opacity: 0.72 }]}
                >
                  <Trash2 size={14} color={colors.danger} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function PlannerScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const [boardState, setBoardState] = useState<PlannerBoardResponse | null>(null);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [fundingRequired, setFundingRequired] = useState<GoalFundingRequired | null>(null);
  const [launchingTaskID, setLaunchingTaskID] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<PlannerStatus>('todo');
  const [selectedTagIDs, setSelectedTagIDs] = useState<string[]>([]);
  const [autoLedgerEnabled, setAutoLedgerEnabled] = useState(false);
  const [ledgerType, setLedgerType] = useState<'credit' | 'debit'>('debit');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerCurrency, setLedgerCurrency] = useState('USD');
  const [ledgerCategory, setLedgerCategory] = useState('');
  const [ledgerDescription, setLedgerDescription] = useState('');
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');

  const isDesktop = width >= 1024;
  const columnWidth = isDesktop ? 320 : Math.min(width - 38, 320);

  const { data: board, isLoading: isBoardLoading, refetch: refetchBoard } = useQuery({
    queryKey: ['planner-board'],
    queryFn: () => api.planner.getBoard(),
    staleTime: 15 * 1000,
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: CreateTaskRequest) => {
      const response = await api.tasks.create(payload);
      if (selectedTagIDs.length > 0) {
        await Promise.all(selectedTagIDs.map((tagID) => api.tasks.addTag(response.task.id, tagID)));
      }
      return response;
    },
    onSuccess: async () => {
      setIsTaskModalVisible(false);
      resetTaskForm();
      await queryClient.invalidateQueries({ queryKey: ['planner-board'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await refetchBoard();
    },
    onError: (error) => {
      Alert.alert('Could not create task', error instanceof Error ? error.message : 'Unknown error');
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskID: string) => api.tasks.complete(taskID),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['planner-board'] });
      await queryClient.invalidateQueries({ queryKey: ['wallet'] });
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await refetchBoard();
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskID: string) => api.tasks.remove(taskID),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['planner-board'] });
      await refetchBoard();
    },
  });

  useEffect(() => {
    if (board) {
      setBoardState(board);
    }
  }, [board]);

  const resetTaskForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setSelectedStatus('todo');
    setSelectedTagIDs([]);
    setAutoLedgerEnabled(false);
    setLedgerType('debit');
    setLedgerAmount('');
    setLedgerCurrency('USD');
    setLedgerCategory('');
    setLedgerDescription('');
    setSubtasks([]);
    setSubtaskDraft('');
  }, []);

  const tags = tagsData?.tags || [];

  const summary = useMemo(() => {
    if (!boardState) {
      return [
        { label: 'Total', value: 0 },
        { label: 'In Progress', value: 0 },
        { label: 'Done', value: 0 },
      ];
    }
    return [
      { label: 'Total', value: boardState.summary.total },
      { label: 'In Progress', value: boardState.summary.in_progress },
      { label: 'Done', value: boardState.summary.done },
    ];
  }, [boardState]);

  const handleMoveItem = useCallback(
    async (item: TodoItem, nextStatus: PlannerStatus) => {
      if (!boardState || item.status === nextStatus) {
        return;
      }

      const previous = boardState;
      const map = plannerColumnMap(previous);
      const withoutItem = Object.fromEntries(
        Object.entries(map).map(([status, items]) => [status, items.filter((entry) => entry.id !== item.id)])
      ) as Record<PlannerStatus, TodoItem[]>;

      const targetItems = [...withoutItem[nextStatus]];
      const sortOrder = targetItems.length > 0
        ? (targetItems[targetItems.length - 1].sort_order ?? targetItems.length) + 1
        : 1;

      targetItems.push({ ...item, status: nextStatus, sort_order: sortOrder });
      withoutItem[nextStatus] = targetItems;

      setBoardState(buildBoardFromMap(withoutItem, previous.summary));

      try {
        await api.planner.moveItem(item.type, item.id, { status: nextStatus, sort_order: sortOrder });
        await queryClient.invalidateQueries({ queryKey: ['planner-board'] });
        await queryClient.invalidateQueries({ queryKey: ['goals'] });
      } catch (error) {
        setBoardState(previous);
        if (error instanceof GoalFundingRequiredError) {
          setFundingRequired(error.details);
          return;
        }
        Alert.alert('Could not move item', error instanceof Error ? error.message : 'Unknown error');
      }
    },
    [boardState, queryClient]
  );

  const submitTask = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Task title required', 'Please add a title before saving.');
      return;
    }

    const payload: CreateTaskRequest = {
      title: cleanTitle,
      description: description.trim() || undefined,
      status: selectedStatus,
      due_date: dueDate.trim() || undefined,
      reminder_mode: dueDate.trim() ? 'aggressive' : 'off',
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      auto_ledger_enabled: autoLedgerEnabled,
      ledger_type: autoLedgerEnabled ? ledgerType : undefined,
      ledger_amount: autoLedgerEnabled && ledgerAmount ? Number(ledgerAmount) : undefined,
      ledger_currency: autoLedgerEnabled ? ledgerCurrency : undefined,
      ledger_category: autoLedgerEnabled ? ledgerCategory.trim() || undefined : undefined,
      ledger_description: autoLedgerEnabled ? ledgerDescription.trim() || undefined : undefined,
    };

    createTaskMutation.mutate(payload);
  };

  const addSubtask = () => {
    const text = subtaskDraft.trim();
    if (!text) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: `sub-${Date.now()}-${prev.length}`,
        title: text,
        done: false,
      },
    ]);
    setSubtaskDraft('');
  };

  const removeSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((sub) => sub.id !== id));
  };

  const openAddTransactionForTask = useCallback(async (taskID: string) => {
    setLaunchingTaskID(taskID);
    try {
      const taskResponse = await api.tasks.get(taskID);
      const task = taskResponse.task;
      const params: Record<string, string> = {
        linked_task_id: taskID,
        return_to: encodeURIComponent('/todo'),
      };

      if (task.ledger_type === 'credit' || task.ledger_type === 'debit') {
        params.type = task.ledger_type;
      }
      if (typeof task.ledger_amount === 'number' && task.ledger_amount > 0) {
        params.amount = String(task.ledger_amount);
      }
      if (task.ledger_currency) {
        params.currency = task.ledger_currency;
      }
      if (task.ledger_wallet_currency) {
        params.wallet_currency = task.ledger_wallet_currency;
      }
      if (task.ledger_category) {
        params.category = task.ledger_category;
      }
      const resolvedDescription = task.ledger_description?.trim() || task.title;
      if (resolvedDescription) {
        params.description = resolvedDescription;
      }

      router.push({
        pathname: '/(app)/(tabs)/add',
        params,
      } as any);
    } catch (error) {
      Alert.alert('Could not open transaction flow', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLaunchingTaskID(null);
    }
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary, colors.background]}
        style={{ flex: 1 }}
      >
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{
                width: 34,
                height: 34,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }, pressed && { opacity: 0.72 }]}
            >
              <ArrowLeft size={16} color={colors.foreground} />
            </Pressable>
            <View>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>Planner Board</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Tasks + goals with finance sync</Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <ModeSwitch />
            <Pressable
              onPress={() => setIsTaskModalVisible(true)}
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.accent,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                shadowColor: colors.accent,
                shadowOpacity: 0.38,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 0 },
              }, pressed && { opacity: 0.78 }]}
            >
              <Plus size={14} color={colors.accentForeground} />
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 6 }}>New Task</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 14, flexDirection: 'row', gap: 10 }}>
          {summary.map((metric) => (
            <Animated.View
              key={metric.label}
              entering={FadeInDown.duration(350)}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{metric.label}</Text>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 2 }}>{metric.value}</Text>
            </Animated.View>
          ))}
        </View>

        {isBoardLoading && !boardState ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom + 22, 36),
              gap: 12,
            }}
          >
            {COLUMN_ORDER.map((status, columnIndex) => {
              const column = boardState?.columns.find((entry) => entry.status === status);
              const items = column?.items || [];
              const meta = COLUMN_META[status];

              return (
                <Animated.View
                  key={status}
                  entering={FadeInDown.duration(420).delay(columnIndex * 60)}
                  style={{
                    width: columnWidth,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: meta.border,
                    backgroundColor: colors.card,
                    padding: 12,
                    shadowColor: meta.glow,
                    shadowOpacity: 0.42,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 2 },
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{meta.label}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{items.length}</Text>
                  </View>

                  {items.length === 0 ? (
                    <View style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderStyle: 'dashed',
                      borderRadius: 14,
                      paddingVertical: 24,
                      alignItems: 'center',
                      backgroundColor: colors.muted,
                    }}>
                      <Sparkles size={16} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8 }}>Drop items here</Text>
                    </View>
                  ) : (
                    items
                      .slice()
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((item) => (
                        <PlannerCard
                          key={item.id}
                          item={item}
                          columnIndex={columnIndex}
                          onMove={handleMoveItem}
                          onAddTransaction={item.type === 'task' ? openAddTransactionForTask : undefined}
                          isLaunchingTransaction={item.type === 'task' && launchingTaskID === item.id}
                          onCompleteTask={(taskID) => completeTaskMutation.mutate(taskID)}
                          onDeleteTask={(taskID) => deleteTaskMutation.mutate(taskID)}
                        />
                      ))
                  )}
                </Animated.View>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      <Modal visible={isTaskModalVisible} transparent animationType="slide" onRequestClose={() => setIsTaskModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View
            style={{
              maxHeight: '88%',
              backgroundColor: colors.background,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom + 12, 20),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 }}>Create Task</Text>
              <Pressable onPress={() => setIsTaskModalVisible(false)}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Close</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  marginBottom: 10,
                }}
              />

              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Description"
                placeholderTextColor={colors.placeholder}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  marginBottom: 10,
                  minHeight: 74,
                  textAlignVertical: 'top',
                }}
              />

              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="Due date (ISO format, optional)"
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  marginBottom: 10,
                }}
              />

              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>Status</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COLUMN_ORDER.map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => setSelectedStatus(status)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selectedStatus === status ? colors.accent : colors.border,
                        backgroundColor: selectedStatus === status ? colors.accent + '22' : colors.card,
                      }, pressed && { opacity: 0.75 }]}
                    >
                      <Text style={{ color: selectedStatus === status ? colors.accent : colors.foreground, fontSize: 12 }}>
                        {COLUMN_META[status].label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Tag size={13} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 6 }}>Tags</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map((tag) => {
                    const selected = selectedTagIDs.includes(tag.id);
                    return (
                      <Pressable
                        key={tag.id}
                        onPress={() =>
                          setSelectedTagIDs((prev) =>
                            selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                          )
                        }
                        style={({ pressed }) => [{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: selected ? colors.accent : colors.border,
                          backgroundColor: selected ? colors.accent + '24' : colors.card,
                        }, pressed && { opacity: 0.78 }]}
                      >
                        <Text style={{ color: selected ? colors.accent : colors.foreground, fontSize: 12 }}>{tag.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ marginBottom: 12 }}>
                <Pressable
                  onPress={() => setAutoLedgerEnabled((prev) => !prev)}
                  style={({ pressed }) => [{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 10,
                    backgroundColor: autoLedgerEnabled ? colors.accent + '18' : colors.card,
                  }, pressed && { opacity: 0.76 }]}
                >
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>Auto-ledger on completion</Text>
                  <Text style={{ color: autoLedgerEnabled ? colors.accent : colors.mutedForeground }}>
                    {autoLedgerEnabled ? 'On' : 'Off'}
                  </Text>
                </Pressable>
              </View>

              {autoLedgerEnabled ? (
                <View style={{ marginBottom: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.card }}>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    {(['debit', 'credit'] as const).map((type) => (
                      <Pressable
                        key={type}
                        onPress={() => setLedgerType(type)}
                        style={({ pressed }) => [{
                          flex: 1,
                          borderWidth: 1,
                          borderColor: ledgerType === type ? colors.accent : colors.border,
                          borderRadius: 10,
                          paddingVertical: 8,
                          alignItems: 'center',
                          backgroundColor: ledgerType === type ? colors.accent + '22' : colors.background,
                        }, pressed && { opacity: 0.72 }]}
                      >
                        <Text style={{ color: ledgerType === type ? colors.accent : colors.foreground }}>{type.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    value={ledgerAmount}
                    onChangeText={setLedgerAmount}
                    placeholder="Amount"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      color: colors.foreground,
                      marginBottom: 8,
                    }}
                  />

                  <TextInput
                    value={ledgerCurrency}
                    onChangeText={(value) => setLedgerCurrency(value.toUpperCase())}
                    placeholder="Currency"
                    maxLength={3}
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      color: colors.foreground,
                      marginBottom: 8,
                    }}
                  />

                  <TextInput
                    value={ledgerCategory}
                    onChangeText={setLedgerCategory}
                    placeholder="Category"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      color: colors.foreground,
                      marginBottom: 8,
                    }}
                  />

                  <TextInput
                    value={ledgerDescription}
                    onChangeText={setLedgerDescription}
                    placeholder="Ledger description"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      color: colors.foreground,
                    }}
                  />
                </View>
              ) : null}

              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>Subtasks</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TextInput
                    value={subtaskDraft}
                    onChangeText={setSubtaskDraft}
                    placeholder="Add checklist item"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      color: colors.foreground,
                      backgroundColor: colors.card,
                    }}
                  />
                  <Pressable
                    onPress={addSubtask}
                    style={({ pressed }) => [{
                      width: 36,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.accent,
                    }, pressed && { opacity: 0.75 }]}
                  >
                    <Plus size={16} color={colors.accentForeground} />
                  </Pressable>
                </View>

                {subtasks.map((subtask) => (
                  <View key={subtask.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text style={{ color: colors.foreground, flex: 1 }}>{subtask.title}</Text>
                    <Pressable onPress={() => removeSubtask(subtask.id)}>
                      <Trash2 size={14} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>

            <Pressable
              onPress={submitTask}
              disabled={createTaskMutation.isPending}
              style={({ pressed }) => [{
                marginTop: 12,
                borderRadius: 12,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                shadowColor: colors.accent,
                shadowOpacity: 0.35,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 0 },
                opacity: createTaskMutation.isPending ? 0.7 : 1,
              }, pressed && { opacity: 0.78 }]}
            >
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold' }}>
                {createTaskMutation.isPending ? 'Saving...' : 'Create Task'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!fundingRequired} transparent animationType="fade" onRequestClose={() => setFundingRequired(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: 16,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
          }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 8 }}>
              Goal Funding Required
            </Text>
            <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
              This financial goal still needs {fundingRequired?.remaining.toFixed(2)} {fundingRequired?.currency} before it can be moved to done.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable
                onPress={() => {
                  setFundingRequired(null);
                  router.push('/(app)/(tabs)/goals');
                }}
                style={({ pressed }) => [{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: colors.accent,
                }, pressed && { opacity: 0.78 }]}
              >
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' }}>Open Goals</Text>
              </Pressable>
              <Pressable
                onPress={() => setFundingRequired(null)}
                style={({ pressed }) => [{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }, pressed && { opacity: 0.78 }]}
              >
                <Text style={{ color: colors.foreground }}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

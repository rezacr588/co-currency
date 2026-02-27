import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  KanbanSquare,
  Plus,
  RotateCw,
  Sparkles,
  Tag,
  Target,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import { AppSwitcherTrigger } from '../../src/components/navigation/AppSwitcherTrigger';
import { useToast } from '../../src/components/ui/Toast';
import {
  clearPlannerFundingRequired,
  getPlannerBoardCache,
  getPlannerFundingRequiredMap,
  setPlannerBoardCache,
  setPlannerFundingRequired,
} from '../../src/offline/plannerCache';
import {
  discardFailedPlannerOps,
  enqueuePlannerOp,
  getPlannerOutbox,
  retryFailedPlannerOps,
  subscribePlannerOutbox,
  type PlannerOutboxOp,
} from '../../src/offline/plannerOutbox';
import {
  applyOutboxLocally,
  buildPlannerPendingMarkers,
  isPlannerOnline,
  syncPlannerOutbox,
} from '../../src/offline/plannerSyncEngine';
import type { Goal } from '../../src/types/goal';
import type {
  CreateTaskRequest,
  GoalFundingRequired,
  PlannerBoardResponse,
  PlannerPendingMarker,
  PlannerStatus,
  TaskSubtask,
  TaskWizardDraft,
  TaskWizardStep,
  TodoItem,
} from '../../src/types/planner';
import { readJSON, removeStorage, writeJSON } from '../../src/utils/storage';
import { isValidPlannerDueDate } from '../../src/utils/plannerDate';

const COLUMN_ORDER: PlannerStatus[] = ['todo', 'in_progress', 'done', 'archived'];
const TASK_WIZARD_DRAFT_VERSION = 1;

type DragDirection = 'left' | 'right' | null;

const COLUMN_META: Record<PlannerStatus, { label: string; glow: string; border: string }> = {
  todo: {
    label: 'To Do',
    glow: 'rgba(59,130,246,0.30)',
    border: 'rgba(59,130,246,0.5)',
  },
  in_progress: {
    label: 'In Progress',
    glow: 'rgba(250,204,21,0.34)',
    border: 'rgba(250,204,21,0.52)',
  },
  done: {
    label: 'Done',
    glow: 'rgba(16,185,129,0.30)',
    border: 'rgba(16,185,129,0.5)',
  },
  archived: {
    label: 'Archived',
    glow: 'rgba(148,163,184,0.24)',
    border: 'rgba(148,163,184,0.42)',
  },
};

function emptyBoard(): PlannerBoardResponse {
  return {
    summary: {
      total: 0,
      todo: 0,
      in_progress: 0,
      done: 0,
      archived: 0,
    },
    columns: COLUMN_ORDER.map((status) => ({ status, items: [] })),
  };
}

function draftStorageKey(userID: string): string {
  return `@task_wizard_draft:${userID}`;
}

function createTempTaskID(): string {
  return `temp-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function statusToLabel(status: PlannerStatus): string {
  return COLUMN_META[status].label;
}

function summarize(board: PlannerBoardResponse): { label: string; value: number }[] {
  return [
    { label: 'Total', value: board.summary.total },
    { label: 'In Progress', value: board.summary.in_progress },
    { label: 'Done', value: board.summary.done },
  ];
}

function markerKey(item: TodoItem): string {
  return `${item.type}:${item.id}`;
}

function getColumnItems(board: PlannerBoardResponse, status: PlannerStatus): TodoItem[] {
  const column = board.columns.find((entry) => entry.status === status);
  return (column?.items ?? [])
    .slice()
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

function nextSortOrder(board: PlannerBoardResponse, status: PlannerStatus, movingID?: string): number {
  const filtered = getColumnItems(board, status).filter((item) => item.id !== movingID);
  if (filtered.length === 0) {
    return 1;
  }
  const tail = filtered[filtered.length - 1];
  return (tail.sort_order ?? filtered.length) + 1;
}

function buildTaskDraft(state: {
  step: TaskWizardStep;
  title: string;
  description: string;
  due_date: string;
  status: PlannerStatus;
  priority: 'low' | 'medium' | 'high';
  reminder_mode: 'off' | 'aggressive';
  selected_tag_ids: string[];
  subtasks: TaskSubtask[];
  goal_id?: string;
  auto_ledger_enabled: boolean;
  ledger_type: 'credit' | 'debit';
  ledger_amount: string;
  ledger_currency: string;
  ledger_wallet_currency: string;
  ledger_category: string;
  ledger_description: string;
}): TaskWizardDraft {
  return {
    version: TASK_WIZARD_DRAFT_VERSION,
    updated_at: Date.now(),
    step: state.step,
    title: state.title,
    description: state.description,
    due_date: state.due_date,
    status: state.status,
    priority: state.priority,
    reminder_mode: state.reminder_mode,
    selected_tag_ids: state.selected_tag_ids,
    subtasks: state.subtasks,
    goal_id: state.goal_id,
    auto_ledger_enabled: state.auto_ledger_enabled,
    ledger_type: state.ledger_type,
    ledger_amount: state.ledger_amount,
    ledger_currency: state.ledger_currency,
    ledger_wallet_currency: state.ledger_wallet_currency,
    ledger_category: state.ledger_category,
    ledger_description: state.ledger_description,
  };
}

function PlannerCard({
  item,
  columnIndex,
  marker,
  onMove,
  onCompleteTask,
  onDeleteTask,
  onAddTransaction,
  isLaunchingTransaction,
  onDragStateChange,
  onDragDirectionChange,
}: {
  item: TodoItem;
  columnIndex: number;
  marker?: PlannerPendingMarker;
  onMove: (item: TodoItem, nextStatus: PlannerStatus) => void;
  onCompleteTask: (taskID: string) => void;
  onDeleteTask: (taskID: string) => void;
  onAddTransaction?: (taskID: string) => void;
  isLaunchingTransaction?: boolean;
  onDragStateChange: (dragging: boolean) => void;
  onDragDirectionChange: (direction: DragDirection) => void;
}) {
  const theme = useTheme();
  const colors = theme.colors;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lift = useSharedValue(0);
  const isTask = item.type === 'task';
  const canCompleteTask = isTask && item.status !== 'done' && item.status !== 'archived';

  const gesture = Gesture.Pan()
    .activateAfterLongPress(220)
    .onBegin(() => {
      lift.value = withTiming(1, { duration: 160 });
      runOnJS(onDragStateChange)(true);
      runOnJS(onDragDirectionChange)(null);
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;

      let direction: DragDirection = null;
      if (event.translationX > 42) {
        direction = 'right';
      } else if (event.translationX < -42) {
        direction = 'left';
      }
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
      { scale: 1 + lift.value * 0.024 },
    ],
    zIndex: lift.value > 0 ? 40 : 1,
    shadowOpacity: 0.2 + lift.value * 0.28,
    shadowRadius: 12 + lift.value * 10,
  }));

  return (
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
            <GripHorizontal size={14} color={colors.mutedForeground} />
          </View>

          {item.description ? (
            <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 12 }} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', marginTop: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Long-press + drag</Text>
              {marker?.is_pending_sync ? (
                <Text style={{ color: colors.warning, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                  Pending sync
                </Text>
              ) : null}
              {marker?.pending_verification ? (
                <Text style={{ color: colors.warning, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                  Pending funding verification
                </Text>
              ) : null}
              {marker?.sync_error ? (
                <Text style={{ color: colors.danger, fontSize: 10 }} numberOfLines={2}>
                  {marker.sync_error}
                </Text>
              ) : null}
            </View>

            {isTask ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => onAddTransaction?.(item.id)}
                  disabled={isLaunchingTransaction}
                  style={({ pressed }) => [{
                    minWidth: 56,
                    paddingHorizontal: 10,
                    height: 44,
                    borderRadius: 9,
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
                    <Text style={{ color: colors.accent, fontSize: 11, fontFamily: 'Inter_700Bold' }}>
                      Txn
                    </Text>
                  )}
                </Pressable>
                {canCompleteTask ? (
                  <Pressable
                    onPress={() => onCompleteTask(item.id)}
                    style={({ pressed }) => [{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.success + '20',
                    }, pressed && { opacity: 0.72 }]}
                  >
                    <Check size={16} color={colors.success} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => onDeleteTask(item.id)}
                  style={({ pressed }) => [{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.danger + '18',
                  }, pressed && { opacity: 0.72 }]}
                >
                  <Trash2 size={16} color={colors.danger} />
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
  const { user } = useAuth();
  const userID = user?.id || '';
  const { showToast } = useToast();

  const isDesktop = width >= 1024;
  const isCompact = width < 1024;
  const pageWidth = Math.max(width - 32, 280);

  const [cachedBoard, setCachedBoard] = useState<PlannerBoardResponse | null>(null);
  const [outbox, setOutbox] = useState<PlannerOutboxOp[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [fundingRequired, setFundingRequired] = useState<GoalFundingRequired | null>(null);
  const [fundingRequiredMap, setFundingRequiredMap] = useState<Record<string, GoalFundingRequired>>({});

  const [isTaskWizardVisible, setIsTaskWizardVisible] = useState(false);
  const [launchingTaskID, setLaunchingTaskID] = useState<string | null>(null);

  const [activeColumn, setActiveColumn] = useState<PlannerStatus>('todo');
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [dragDirection, setDragDirection] = useState<DragDirection>(null);

  const pagerRef = useRef<ScrollView>(null);
  const syncInFlightRef = useRef(false);

  const [wizardStep, setWizardStep] = useState<TaskWizardStep>('basics');
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

  const boardQueryKey = useMemo(() => ['planner-board', userID], [userID]);
  const tagsQueryKey = useMemo(() => ['tags', userID], [userID]);
  const goalsQueryKey = useMemo(() => ['goals', userID], [userID]);

  const boardQuery = useQuery({
    queryKey: boardQueryKey,
    queryFn: () => api.planner.getBoard(),
    enabled: !!userID,
    staleTime: 15 * 1000,
    retry: 1,
  });

  const tagsQuery = useQuery({
    queryKey: tagsQueryKey,
    queryFn: () => api.tags.list(),
    enabled: !!userID,
  });

  const goalsQuery = useQuery({
    queryKey: goalsQueryKey,
    queryFn: () => api.goals.list(),
    enabled: !!userID,
  });

  const resetWizard = useCallback(() => {
    setWizardStep('basics');
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
    setWizardStep(draft.step);
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
    if (!userID) {
      setCachedBoard(null);
      setOutbox([]);
      setFundingRequiredMap({});
      setFundingRequired(null);
      return;
    }

    let active = true;

    void (async () => {
      const [cache, queue, online, storedFundingRequired] = await Promise.all([
        getPlannerBoardCache(userID),
        getPlannerOutbox(userID),
        isPlannerOnline(),
        getPlannerFundingRequiredMap(userID),
      ]);

      if (!active) return;

      setCachedBoard(cache?.board ?? null);
      setOutbox(queue);
      setIsOnline(online);
      setFundingRequiredMap(storedFundingRequired);

      const firstFunding = Object.values(storedFundingRequired)[0];
      if (firstFunding) {
        setFundingRequired(firstFunding);
      }
    })();

    const unsubscribe = subscribePlannerOutbox(userID, (queue) => {
      setOutbox(queue);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userID]);

  useEffect(() => {
    if (!userID || !boardQuery.data) return;

    setCachedBoard(boardQuery.data);
    void setPlannerBoardCache(userID, boardQuery.data);
  }, [boardQuery.data, userID]);

  const syncOutboxNow = useCallback(async () => {
    if (!userID || syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      const result = await syncPlannerOutbox(userID);
      setIsOnline(result.is_online);

      if (result.conflicts > 0) {
        showToast('Some planner changes conflicted with server and were rolled back.', 'warning');
        for (const details of result.funding_required) {
          await setPlannerFundingRequired(userID, details);
        }

        if (result.funding_required.length > 0) {
          setFundingRequired((current) => current ?? result.funding_required[0]);
          setFundingRequiredMap((current) => {
            const next = { ...current };
            for (const details of result.funding_required) {
              next[details.goal_id] = details;
            }
            return next;
          });
        }
      }

      if (result.synced > 0 || result.needs_refresh) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['planner-board'] }),
          queryClient.invalidateQueries({ queryKey: boardQueryKey }),
          queryClient.invalidateQueries({ queryKey: ['tasks'] }),
          queryClient.invalidateQueries({ queryKey: ['goals'] }),
          queryClient.invalidateQueries({ queryKey: goalsQueryKey }),
          queryClient.invalidateQueries({ queryKey: ['tags'] }),
          queryClient.invalidateQueries({ queryKey: tagsQueryKey }),
          queryClient.invalidateQueries({ queryKey: ['wallet'] }),
          queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['reports'] }),
        ]);
        await boardQuery.refetch();
      }
    } finally {
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  }, [boardQuery, boardQueryKey, goalsQueryKey, queryClient, showToast, tagsQueryKey, userID]);

  const pendingCount = useMemo(
    () => outbox.filter((op) => op.status === 'pending' || op.status === 'syncing').length,
    [outbox]
  );

  const failedCount = useMemo(
    () => outbox.filter((op) => op.status === 'failed').length,
    [outbox]
  );

  const pendingCountRef = useRef(pendingCount);
  pendingCountRef.current = pendingCount;

  const syncOutboxNowRef = useRef(syncOutboxNow);
  syncOutboxNowRef.current = syncOutboxNow;

  useEffect(() => {
    if (!userID) return;

    let active = true;

    const evaluate = async () => {
      const online = await isPlannerOnline();
      if (!active) return;
      setIsOnline(online);

      if (online && pendingCountRef.current > 0) {
        await syncOutboxNowRef.current();
      }
    };

    void evaluate();

    const interval = setInterval(() => {
      void evaluate();
    }, 10_000);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void evaluate();
      }
    });

    return () => {
      active = false;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [userID]);

  const canonicalBoard = boardQuery.data ?? cachedBoard ?? emptyBoard();
  const effectiveBoard = useMemo(
    () => applyOutboxLocally(canonicalBoard, outbox),
    [canonicalBoard, outbox]
  );

  const pendingMarkers = useMemo(() => {
    const base = buildPlannerPendingMarkers(outbox);

    for (const [goalID, details] of Object.entries(fundingRequiredMap)) {
      base[`goal:${goalID}`] = {
        entity_id: goalID,
        entity_type: 'goal',
        is_pending_sync: false,
        sync_error: details.message || 'Goal funding required before completion.',
      };
    }

    return base;
  }, [fundingRequiredMap, outbox]);

  useEffect(() => {
    if (!userID) return;
    if (!boardQuery.data && !cachedBoard) return;

    const goalItemsByID = new Map<string, TodoItem>();
    for (const column of canonicalBoard.columns) {
      for (const item of column.items) {
        if (item.type === 'goal') {
          goalItemsByID.set(item.id, item);
        }
      }
    }

    const resolvedGoalIDs = Object.keys(fundingRequiredMap).filter((goalID) => {
      const goalItem = goalItemsByID.get(goalID);
      if (!goalItem) {
        return true;
      }
      return goalItem.status === 'done';
    });

    if (resolvedGoalIDs.length === 0) {
      return;
    }

    setFundingRequiredMap((current) => {
      const next = { ...current };
      for (const goalID of resolvedGoalIDs) {
        delete next[goalID];
      }
      return next;
    });

    setFundingRequired((current) => {
      if (!current) return current;
      return resolvedGoalIDs.includes(current.goal_id) ? null : current;
    });

    void Promise.all(resolvedGoalIDs.map((goalID) => clearPlannerFundingRequired(userID, goalID)));
  }, [boardQuery.data, cachedBoard, canonicalBoard, fundingRequiredMap, userID]);

  const summaryCards = useMemo(() => summarize(effectiveBoard), [effectiveBoard]);

  const tags = tagsQuery.data?.tags || [];
  const goals = goalsQuery.data?.goals || [];

  const statusCounts = useMemo(() => {
    const counts: Record<PlannerStatus, number> = {
      todo: 0,
      in_progress: 0,
      done: 0,
      archived: 0,
    };

    for (const column of effectiveBoard.columns) {
      counts[column.status] = column.items.length;
    }

    return counts;
  }, [effectiveBoard]);

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

  const handleMoveItem = useCallback(
    async (item: TodoItem, nextStatus: PlannerStatus) => {
      if (!userID || item.status === nextStatus) {
        return;
      }

      try {
        const sortOrder = nextSortOrder(effectiveBoard, nextStatus, item.id);

        if (item.type === 'goal' && nextStatus === 'done') {
          await enqueuePlannerOp({
            user_id: userID,
            op_type: 'goal_mark_done',
            entity_type: 'goal',
            entity_id: item.id,
            payload: {
              previous_status: item.status,
              queued_offline: !isOnline,
            },
          });
        } else {
          await enqueuePlannerOp({
            user_id: userID,
            op_type: 'item_move',
            entity_type: item.type,
            entity_id: item.id,
            payload: {
              status: nextStatus,
              sort_order: sortOrder,
            },
          });
        }

        void syncOutboxNow();
      } catch (error) {
        Alert.alert('Could not queue item move', error instanceof Error ? error.message : 'Unknown error');
      }
    },
    [effectiveBoard, isOnline, syncOutboxNow, userID]
  );

  const handleCompleteTask = useCallback(
    async (taskID: string) => {
      if (!userID) return;
      try {
        await enqueuePlannerOp({
          user_id: userID,
          op_type: 'task_complete',
          entity_type: 'task',
          entity_id: taskID,
          payload: {},
        });
        void syncOutboxNow();
      } catch (error) {
        Alert.alert('Could not queue task completion', error instanceof Error ? error.message : 'Unknown error');
      }
    },
    [syncOutboxNow, userID]
  );

  const queueDeleteTask = useCallback(async (taskID: string) => {
    if (!userID) return;
    try {
      await enqueuePlannerOp({
        user_id: userID,
        op_type: 'task_delete',
        entity_type: 'task',
        entity_id: taskID,
        payload: {},
      });
      void syncOutboxNow();
    } catch (error) {
      Alert.alert('Could not queue task delete', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [syncOutboxNow, userID]);

  const handleDeleteTask = useCallback((taskID: string) => {
    Alert.alert(
      'Delete task?',
      'This task will be removed from your planner.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void queueDeleteTask(taskID);
          },
        },
      ]
    );
  }, [queueDeleteTask]);

  const addSubtask = useCallback(() => {
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
  }, [subtaskDraft]);

  const removeSubtask = useCallback((id: string) => {
    setSubtasks((prev) => prev.filter((sub) => sub.id !== id));
  }, []);

  const openTaskWizard = useCallback(async () => {
    setIsTaskWizardVisible(true);

    if (!userID) {
      resetWizard();
      return;
    }

    const storedDraft = await readJSON<TaskWizardDraft>(draftStorageKey(userID));
    if (!storedDraft) {
      resetWizard();
      return;
    }

    Alert.alert('Resume task draft?', 'Continue where you left off in the task setup wizard?', [
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          resetWizard();
          void removeStorage(draftStorageKey(userID));
        },
      },
      {
        text: 'Resume',
        onPress: () => applyDraft(storedDraft),
      },
    ]);
  }, [applyDraft, resetWizard, userID]);

  useEffect(() => {
    if (!isTaskWizardVisible || !userID) {
      return;
    }

    const draft = buildTaskDraft({
      step: wizardStep,
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
    });

    const timeout = setTimeout(() => {
      void writeJSON(draftStorageKey(userID), draft);
    }, 420);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    autoLedgerEnabled,
    description,
    dueDate,
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
    subtasks,
    title,
    userID,
    wizardStep,
    isTaskWizardVisible,
  ]);

  const dueDateValidationError = useMemo(() => {
    if (isValidPlannerDueDate(dueDate)) {
      return null;
    }
    return 'Use YYYY-MM-DD (for example, 2026-03-01).';
  }, [dueDate]);

  const validateWizardStep = useCallback((step: TaskWizardStep): string | null => {
    if (step === 'basics') {
      if (!title.trim()) {
        return 'Please add a task title.';
      }
    }

    if (step === 'schedule') {
      if (dueDateValidationError) {
        return dueDateValidationError;
      }
    }

    if (step === 'finance_review' && autoLedgerEnabled) {
      const amount = Number(ledgerAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return 'Ledger amount must be greater than zero.';
      }
      if (!ledgerCurrency.trim()) {
        return 'Ledger currency is required when auto-ledger is on.';
      }
    }

    return null;
  }, [autoLedgerEnabled, dueDateValidationError, ledgerAmount, ledgerCurrency, title]);

  const wizardSteps: TaskWizardStep[] = ['basics', 'schedule', 'organization', 'finance_review'];

  const goWizardBack = useCallback(() => {
    const index = wizardSteps.indexOf(wizardStep);
    if (index > 0) {
      setWizardStep(wizardSteps[index - 1]);
    }
  }, [wizardStep, wizardSteps]);

  const goWizardNext = useCallback(() => {
    const error = validateWizardStep(wizardStep);
    if (error) {
      Alert.alert('Complete this step', error);
      return;
    }

    const index = wizardSteps.indexOf(wizardStep);
    if (index < wizardSteps.length - 1) {
      setWizardStep(wizardSteps[index + 1]);
    }
  }, [validateWizardStep, wizardStep, wizardSteps]);

  const submitTaskWizard = useCallback(async () => {
    if (!userID) return;

    const scheduleError = validateWizardStep('schedule');
    if (scheduleError) {
      setWizardStep('schedule');
      Alert.alert('Could not create task', scheduleError);
      return;
    }

    const error = validateWizardStep('finance_review');
    if (error) {
      Alert.alert('Could not create task', error);
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Task title required', 'Please add a title before saving.');
      return;
    }

    const sortOrder = nextSortOrder(effectiveBoard, selectedStatus);
    const tempTaskID = createTempTaskID();

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
      const createOp = await enqueuePlannerOp({
        user_id: userID,
        op_type: 'task_create',
        entity_type: 'task',
        entity_id: tempTaskID,
        payload: {
          ...payload,
          local_temp_id: tempTaskID,
        },
      });

      if (createOp && selectedTagIDs.length > 0) {
        for (const tagID of selectedTagIDs) {
          await enqueuePlannerOp({
            user_id: userID,
            op_type: 'task_add_tag',
            entity_type: 'task',
            entity_id: tempTaskID,
            payload: { tag_id: tagID },
            depends_on: createOp.id,
          });
        }
      }

      setIsTaskWizardVisible(false);
      resetWizard();
      await removeStorage(draftStorageKey(userID));
      void syncOutboxNow();
    } catch (queueError) {
      Alert.alert('Could not queue task', queueError instanceof Error ? queueError.message : 'Unknown error');
    }
  }, [
    autoLedgerEnabled,
    description,
    dueDate,
    effectiveBoard,
    ledgerAmount,
    ledgerCategory,
    ledgerCurrency,
    ledgerDescription,
    ledgerType,
    ledgerWalletCurrency,
    reminderMode,
    resetWizard,
    selectedGoalID,
    selectedPriority,
    selectedStatus,
    selectedTagIDs,
    subtasks,
    syncOutboxNow,
    title,
    userID,
    validateWizardStep,
  ]);

  const discardTaskWizard = useCallback(() => {
    setIsTaskWizardVisible(false);
    resetWizard();
    if (userID) {
      void removeStorage(draftStorageKey(userID));
    }
  }, [resetWizard, userID]);

  const retryFailed = useCallback(async () => {
    if (!userID) return;
    await retryFailedPlannerOps(userID);
    await syncOutboxNow();
  }, [syncOutboxNow, userID]);

  const discardFailed = useCallback(async () => {
    if (!userID) return;
    await discardFailedPlannerOps(userID);
    await boardQuery.refetch();
  }, [boardQuery, userID]);

  const jumpToColumn = useCallback((status: PlannerStatus) => {
    const index = COLUMN_ORDER.indexOf(status);
    setActiveColumn(status);
    pagerRef.current?.scrollTo({ x: index * pageWidth, y: 0, animated: true });
  }, [pageWidth]);

  const renderColumn = useCallback((status: PlannerStatus, columnIndex: number, widthOverride?: number) => {
    const items = getColumnItems(effectiveBoard, status);
    const meta = COLUMN_META[status];

    return (
      <Animated.View
        key={status}
        entering={FadeInDown.duration(420).delay(columnIndex * 56)}
        style={{
          width: widthOverride ?? (isDesktop ? 320 : pageWidth),
          borderRadius: 18,
          borderWidth: 1,
          borderColor: meta.border,
          backgroundColor: colors.card,
          padding: 12,
          shadowColor: meta.glow,
          shadowOpacity: 0.46,
          shadowRadius: 15,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{meta.label}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{items.length}</Text>
        </View>

        {items.length === 0 ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderStyle: 'dashed',
              borderRadius: 14,
              paddingVertical: 24,
              alignItems: 'center',
              backgroundColor: colors.muted,
            }}
          >
            <Sparkles size={16} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8 }}>Drop items here</Text>
          </View>
        ) : (
          items.map((item) => (
            <PlannerCard
              key={item.id}
              item={item}
              marker={pendingMarkers[markerKey(item)]}
              columnIndex={columnIndex}
              onMove={handleMoveItem}
              onDragStateChange={setIsDraggingCard}
              onDragDirectionChange={setDragDirection}
              onAddTransaction={item.type === 'task' ? openAddTransactionForTask : undefined}
              isLaunchingTransaction={item.type === 'task' && launchingTaskID === item.id}
              onCompleteTask={handleCompleteTask}
              onDeleteTask={handleDeleteTask}
            />
          ))
        )}
      </Animated.View>
    );
  }, [
    colors.border,
    colors.card,
    colors.foreground,
    colors.muted,
    colors.mutedForeground,
    effectiveBoard,
    handleCompleteTask,
    handleDeleteTask,
    handleMoveItem,
    isDesktop,
    launchingTaskID,
    openAddTransactionForTask,
    pageWidth,
    pendingMarkers,
  ]);

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
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
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>Todo Planner</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>
                Full board mode with offline-first sync
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppSwitcherTrigger variant="header_inline" />
            <Pressable
              onPress={openTaskWizard}
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

        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: isOnline ? colors.success + '66' : colors.danger + '66',
                backgroundColor: isOnline ? colors.success + '1A' : colors.danger + '1A',
              }}
            >
              {isOnline ? <Wifi size={12} color={colors.success} /> : <WifiOff size={12} color={colors.danger} />}
              <Text
                style={{
                  color: isOnline ? colors.success : colors.danger,
                  fontSize: 11,
                  marginLeft: 5,
                  fontFamily: 'Inter_600SemiBold',
                }}
              >
                {isOnline ? (isSyncing ? 'Syncing...' : 'Online') : 'Offline'}
              </Text>
            </View>

            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_500Medium' }}>
                {pendingCount} pending
              </Text>
            </View>

            {failedCount > 0 ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.danger + '66',
                  backgroundColor: colors.danger + '16',
                }}
              >
                <Text style={{ color: colors.danger, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                  {failedCount} failed
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>
              {failedCount > 0 ? (
                <>
                  <Pressable
                    onPress={retryFailed}
                    style={({ pressed }) => [{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }, pressed && { opacity: 0.72 }]}
                  >
                    <RotateCw size={12} color={colors.foreground} />
                    <Text style={{ color: colors.foreground, fontSize: 11, marginLeft: 5, fontFamily: 'Inter_600SemiBold' }}>
                      Retry
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={discardFailed}
                    style={({ pressed }) => [{
                      borderWidth: 1,
                      borderColor: colors.danger + '66',
                      backgroundColor: colors.danger + '14',
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }, pressed && { opacity: 0.72 }]}
                  >
                    <Text style={{ color: colors.danger, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>Discard</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {summaryCards.map((metric) => (
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {COLUMN_ORDER.map((status) => {
              const active = activeColumn === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => jumpToColumn(status)}
                  style={({ pressed }) => [{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderWidth: 1,
                    borderColor: active ? COLUMN_META[status].border : colors.border,
                    backgroundColor: active ? COLUMN_META[status].glow : colors.card,
                    shadowColor: active ? COLUMN_META[status].glow : 'transparent',
                    shadowOpacity: active ? 0.42 : 0,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 0 },
                  }, pressed && { opacity: 0.74 }]}
                >
                  <Text
                    style={{
                      color: active ? colors.foreground : colors.mutedForeground,
                      fontSize: 12,
                      fontFamily: active ? 'Inter_700Bold' : 'Inter_600SemiBold',
                    }}
                  >
                    {statusToLabel(status)}
                  </Text>
                  <Text style={{ color: active ? colors.foreground : colors.mutedForeground, fontSize: 11, marginLeft: 6 }}>
                    {statusCounts[status]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {boardQuery.isLoading && !cachedBoard ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : isCompact ? (
          <View style={{ flex: 1, marginTop: 12 }}>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={!isDraggingCard}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                const safeIndex = Math.max(0, Math.min(index, COLUMN_ORDER.length - 1));
                setActiveColumn(COLUMN_ORDER[safeIndex]);
              }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: Math.max(insets.bottom + 20, 30),
              }}
            >
              {COLUMN_ORDER.map((status, index) => (
                <View key={status} style={{ width: pageWidth, paddingRight: 10 }}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={!isDraggingCard}
                    contentContainerStyle={{ paddingBottom: 14 }}
                  >
                    {renderColumn(status, index, pageWidth - 6)}
                  </ScrollView>
                </View>
              ))}
            </ScrollView>

            {isDraggingCard ? (
              <>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 14,
                    bottom: 20,
                    left: 8,
                    width: 34,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: dragDirection === 'left' ? colors.accent + '99' : colors.border,
                    backgroundColor: dragDirection === 'left' ? colors.accent + '26' : colors.card + '8A',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.accent,
                    shadowOpacity: dragDirection === 'left' ? 0.36 : 0,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <ChevronLeft size={16} color={dragDirection === 'left' ? colors.accent : colors.mutedForeground} />
                </View>

                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 14,
                    bottom: 20,
                    right: 8,
                    width: 34,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: dragDirection === 'right' ? colors.accent + '99' : colors.border,
                    backgroundColor: dragDirection === 'right' ? colors.accent + '26' : colors.card + '8A',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.accent,
                    shadowOpacity: dragDirection === 'right' ? 0.36 : 0,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <ChevronRight size={16} color={dragDirection === 'right' ? colors.accent : colors.mutedForeground} />
                </View>
              </>
            ) : null}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom + 24, 36),
              gap: 12,
            }}
          >
            {COLUMN_ORDER.map((status, index) => renderColumn(status, index))}
          </ScrollView>
        )}
      </LinearGradient>

      <Modal
        visible={isTaskWizardVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTaskWizardVisible(false)}
      >
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
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 17 }}>Task Setup Wizard</Text>
              <Pressable onPress={() => setIsTaskWizardVisible(false)}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Close</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {wizardSteps.map((step) => {
                const active = wizardStep === step;
                return (
                  <Pressable
                    key={step}
                    onPress={() => setWizardStep(step)}
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
                      {step.replace('_', ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView showsVerticalScrollIndicator={false}>
              {wizardStep === 'basics' ? (
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Task title"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.foreground,
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
                      minHeight: 82,
                      textAlignVertical: 'top',
                    }}
                  />

                  <View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>Initial column</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {COLUMN_ORDER.map((status) => (
                        <Pressable
                          key={status}
                          onPress={() => setSelectedStatus(status)}
                          style={({ pressed }) => [{
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: selectedStatus === status ? colors.accent : colors.border,
                            backgroundColor: selectedStatus === status ? colors.accent + '22' : colors.card,
                          }, pressed && { opacity: 0.72 }]}
                        >
                          <Text style={{ color: selectedStatus === status ? colors.accent : colors.foreground, fontSize: 12 }}>
                            {statusToLabel(status)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}

              {wizardStep === 'schedule' ? (
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={dueDate}
                    onChangeText={(value) => {
                      setDueDate(value);
                      if (value.trim() && reminderMode === 'off') {
                        setReminderMode('aggressive');
                      }
                    }}
                    placeholder="Due date (YYYY-MM-DD, optional)"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: dueDateValidationError ? colors.danger : colors.border,
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.foreground,
                    }}
                  />
                  <Text style={{ color: dueDateValidationError ? colors.danger : colors.mutedForeground, fontSize: 11 }}>
                    {dueDateValidationError ?? 'Format: YYYY-MM-DD'}
                  </Text>

                  <View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>Priority</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['low', 'medium', 'high'] as const).map((priority) => (
                        <Pressable
                          key={priority}
                          onPress={() => setSelectedPriority(priority)}
                          style={({ pressed }) => [{
                            flex: 1,
                            alignItems: 'center',
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: selectedPriority === priority ? colors.accent : colors.border,
                            backgroundColor: selectedPriority === priority ? colors.accent + '22' : colors.card,
                            paddingVertical: 8,
                          }, pressed && { opacity: 0.72 }]}
                        >
                          <Text style={{ color: selectedPriority === priority ? colors.accent : colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                            {priority.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>Reminder mode</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['off', 'aggressive'] as const).map((mode) => (
                        <Pressable
                          key={mode}
                          onPress={() => setReminderMode(mode)}
                          style={({ pressed }) => [{
                            flex: 1,
                            alignItems: 'center',
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: reminderMode === mode ? colors.accent : colors.border,
                            backgroundColor: reminderMode === mode ? colors.accent + '22' : colors.card,
                            paddingVertical: 8,
                          }, pressed && { opacity: 0.72 }]}
                        >
                          <Text style={{ color: reminderMode === mode ? colors.accent : colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                            {mode === 'aggressive' ? 'Aggressive' : 'Off'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}

              {wizardStep === 'organization' ? (
                <View style={{ gap: 12 }}>
                  <View>
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
                            onPress={() => setSelectedTagIDs((prev) => (selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]))}
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

                  <View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>Goal linkage (optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      <Pressable
                        onPress={() => setSelectedGoalID(undefined)}
                        style={({ pressed }) => [{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: !selectedGoalID ? colors.accent : colors.border,
                          backgroundColor: !selectedGoalID ? colors.accent + '24' : colors.card,
                        }, pressed && { opacity: 0.76 }]}
                      >
                        <Text style={{ color: !selectedGoalID ? colors.accent : colors.foreground, fontSize: 12 }}>No linked goal</Text>
                      </Pressable>
                      {goals.map((goal: Goal) => {
                        const selected = selectedGoalID === goal.id;
                        return (
                          <Pressable
                            key={goal.id}
                            onPress={() => setSelectedGoalID(goal.id)}
                            style={({ pressed }) => [{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 999,
                              borderWidth: 1,
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
                          width: 38,
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
                </View>
              ) : null}

              {wizardStep === 'finance_review' ? (
                <View style={{ gap: 12 }}>
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

                  {autoLedgerEnabled ? (
                    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.card, gap: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
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
                        }}
                      />

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput
                          value={ledgerCurrency}
                          onChangeText={(value) => setLedgerCurrency(value.toUpperCase())}
                          placeholder="Source currency"
                          maxLength={3}
                          placeholderTextColor={colors.placeholder}
                          style={{
                            flex: 1,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 10,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            color: colors.foreground,
                          }}
                        />
                        <TextInput
                          value={ledgerWalletCurrency}
                          onChangeText={(value) => setLedgerWalletCurrency(value.toUpperCase())}
                          placeholder="Wallet currency"
                          maxLength={3}
                          placeholderTextColor={colors.placeholder}
                          style={{
                            flex: 1,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 10,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            color: colors.foreground,
                          }}
                        />
                      </View>

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

                  <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.card }}>
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>Review</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>Title: {title || 'Untitled'}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>Status: {statusToLabel(selectedStatus)}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>Priority: {selectedPriority}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>Reminder: {reminderMode}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}>Tags: {selectedTagIDs.length}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Subtasks: {subtasks.length}</Text>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {wizardSteps.slice(0, 3).map((step) => (
                        <Pressable
                          key={step}
                          onPress={() => setWizardStep(step)}
                          style={({ pressed }) => [{
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.border,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: colors.background,
                          }, pressed && { opacity: 0.72 }]}
                        >
                          <Text style={{ color: colors.foreground, fontSize: 11 }}>Edit {step.replace('_', ' ')}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable
                onPress={discardTaskWizard}
                style={({ pressed }) => [{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.danger + '55',
                  backgroundColor: colors.danger + '16',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                }, pressed && { opacity: 0.72 }]}
              >
                <Text style={{ color: colors.danger, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Discard</Text>
              </Pressable>

              <Pressable
                onPress={goWizardBack}
                disabled={wizardStep === 'basics'}
                style={({ pressed }) => [{
                  flex: 1,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  opacity: wizardStep === 'basics' ? 0.55 : pressed ? 0.72 : 1,
                }]}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Back</Text>
              </Pressable>

              {wizardStep !== 'finance_review' ? (
                <Pressable
                  onPress={goWizardNext}
                  style={({ pressed }) => [{
                    flex: 1,
                    borderRadius: 12,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 12,
                    shadowColor: colors.accent,
                    shadowOpacity: 0.34,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                    opacity: pressed ? 0.78 : 1,
                  }]}
                >
                  <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold' }}>Next</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={submitTaskWizard}
                  style={({ pressed }) => [{
                    flex: 1,
                    borderRadius: 12,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 12,
                    shadowColor: colors.accent,
                    shadowOpacity: 0.34,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                    opacity: pressed ? 0.78 : 1,
                  }]}
                >
                  <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold' }}>Create Task</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!fundingRequired} transparent animationType="fade" onRequestClose={() => setFundingRequired(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              borderRadius: 16,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <AlertTriangle size={16} color={colors.warning} />
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 16, marginLeft: 8 }}>
                Goal Funding Required
              </Text>
            </View>
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

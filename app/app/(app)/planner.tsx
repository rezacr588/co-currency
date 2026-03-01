import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Platform,
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  KanbanSquare,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  WifiOff,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { AppSwitcherTrigger } from '../../src/components/navigation/AppSwitcherTrigger';
import { useToast } from '../../src/components/ui/Toast';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PlannerCard } from '../../src/components/features/Planner/PlannerCard';
import { TaskWizardModal } from '../../src/components/features/Planner/TaskWizardModal';
import { TaskEditModal } from '../../src/components/features/Planner/TaskEditModal';
import { haptics } from '../../src/utils/haptics';
import { useDebounce } from '../../src/hooks/useDebounce';
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
  TodoItem,
  UpdateTaskRequest,
} from '../../src/types/planner';

const COLUMN_ORDER: PlannerStatus[] = ['todo', 'in_progress', 'done', 'archived'];

type DragDirection = 'left' | 'right' | null;

const COLUMN_META: Record<PlannerStatus, { glow: string; border: string }> = {
  todo: { glow: 'rgba(59,130,246,0.30)', border: 'rgba(59,130,246,0.5)' },
  in_progress: { glow: 'rgba(250,204,21,0.34)', border: 'rgba(250,204,21,0.52)' },
  done: { glow: 'rgba(16,185,129,0.30)', border: 'rgba(16,185,129,0.5)' },
  archived: { glow: 'rgba(148,163,184,0.24)', border: 'rgba(148,163,184,0.42)' },
};

function emptyBoard(): PlannerBoardResponse {
  return {
    summary: { total: 0, todo: 0, in_progress: 0, done: 0, archived: 0 },
    columns: COLUMN_ORDER.map((status) => ({ status, items: [] })),
  };
}

function createTempTaskID(): string {
  return `temp-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function markerKey(item: TodoItem): string {
  return `${item.type}:${item.id}`;
}

function getColumnItems(board: PlannerBoardResponse, status: PlannerStatus): TodoItem[] {
  const column = board.columns.find((entry) => entry.status === status);
  return (column?.items ?? []).slice().sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

function nextSortOrder(board: PlannerBoardResponse, status: PlannerStatus, movingID?: string): number {
  const filtered = getColumnItems(board, status).filter((item) => item.id !== movingID);
  if (filtered.length === 0) return 1;
  const tail = filtered[filtered.length - 1];
  return (tail.sort_order ?? filtered.length) + 1;
}

export default function PlannerScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userID = user?.id || '';
  const { showToast } = useToast();

  const isDesktop = width >= 1024;
  const isCompact = width < 1024;
  const pageWidth = Math.max(width - 32, 280);

  // --- Core state ---
  const [cachedBoard, setCachedBoard] = useState<PlannerBoardResponse | null>(null);
  const [outbox, setOutbox] = useState<PlannerOutboxOp[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [fundingRequired, setFundingRequired] = useState<GoalFundingRequired | null>(null);
  const [fundingRequiredMap, setFundingRequiredMap] = useState<Record<string, GoalFundingRequired>>({});

  const [isTaskWizardVisible, setIsTaskWizardVisible] = useState(false);
  const [launchingTaskID, setLaunchingTaskID] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TodoItem | null>(null);
  const [completingTaskID, setCompletingTaskID] = useState<string | null>(null);

  const [activeColumn, setActiveColumn] = useState<PlannerStatus>('todo');
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [dragDirection, setDragDirection] = useState<DragDirection>(null);

  // --- Search & filter ---
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 300);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  // --- Undo ---
  const [undoTaskID, setUndoTaskID] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pagerRef = useRef<ScrollView>(null);
  const syncInFlightRef = useRef(false);

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

  const tagsQuery = useQuery({ queryKey: tagsQueryKey, queryFn: () => api.tags.list(), enabled: !!userID });
  const goalsQuery = useQuery({ queryKey: goalsQueryKey, queryFn: () => api.goals.list(), enabled: !!userID });

  // --- Cache + outbox bootstrap ---
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
      const [cache, queue, online, storedFunding] = await Promise.all([
        getPlannerBoardCache(userID),
        getPlannerOutbox(userID),
        isPlannerOnline(),
        getPlannerFundingRequiredMap(userID),
      ]);
      if (!active) return;
      setCachedBoard(cache?.board ?? null);
      setOutbox(queue);
      setIsOnline(online);
      setFundingRequiredMap(storedFunding);
      const first = Object.values(storedFunding)[0];
      if (first) setFundingRequired(first);
    })();

    const unsubscribe = subscribePlannerOutbox(userID, (queue) => setOutbox(queue));
    return () => { active = false; unsubscribe(); };
  }, [userID]);

  useEffect(() => {
    if (!userID || !boardQuery.data) return;
    setCachedBoard(boardQuery.data);
    void setPlannerBoardCache(userID, boardQuery.data);
  }, [boardQuery.data, userID]);

  // --- Sync ---
  const syncOutboxNow = useCallback(async () => {
    if (!userID || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncPlannerOutbox(userID);
      setIsOnline(result.is_online);
      if (result.conflicts > 0) {
        showToast(t('plannerSyncFailed') || 'Some planner changes conflicted with server and were rolled back.', 'warning');
        for (const details of result.funding_required) {
          await setPlannerFundingRequired(userID, details);
        }
        if (result.funding_required.length > 0) {
          setFundingRequired((c) => c ?? result.funding_required[0]);
          setFundingRequiredMap((c) => {
            const next = { ...c };
            for (const d of result.funding_required) next[d.goal_id] = d;
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
  }, [boardQuery, boardQueryKey, goalsQueryKey, queryClient, showToast, tagsQueryKey, userID, t]);

  const pendingCount = useMemo(() => outbox.filter((op) => op.status === 'pending' || op.status === 'syncing').length, [outbox]);
  const failedCount = useMemo(() => outbox.filter((op) => op.status === 'failed').length, [outbox]);

  const pendingCountRef = useRef(pendingCount);
  pendingCountRef.current = pendingCount;
  const syncOutboxNowRef = useRef(syncOutboxNow);
  syncOutboxNowRef.current = syncOutboxNow;

  // --- Periodic sync ---
  useEffect(() => {
    if (!userID) return;
    let active = true;
    const evaluate = async () => {
      const online = await isPlannerOnline();
      if (!active) return;
      setIsOnline(online);
      if (online && pendingCountRef.current > 0) await syncOutboxNowRef.current();
    };
    void evaluate();
    const interval = setInterval(() => void evaluate(), 10_000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void evaluate(); });
    return () => { active = false; clearInterval(interval); sub.remove(); };
  }, [userID]);

  // --- Board derived state ---
  const canonicalBoard = boardQuery.data ?? cachedBoard ?? emptyBoard();
  const effectiveBoard = useMemo(() => applyOutboxLocally(canonicalBoard, outbox), [canonicalBoard, outbox]);

  const pendingMarkers = useMemo(() => {
    const base = buildPlannerPendingMarkers(outbox);
    for (const [goalID, details] of Object.entries(fundingRequiredMap)) {
      base[`goal:${goalID}`] = {
        entity_id: goalID, entity_type: 'goal', is_pending_sync: false,
        sync_error: details.message || 'Goal funding required before completion.',
      };
    }
    return base;
  }, [fundingRequiredMap, outbox]);

  // --- Funding resolution ---
  useEffect(() => {
    if (!userID) return;
    if (!boardQuery.data && !cachedBoard) return;
    const goalItemsByID = new Map<string, TodoItem>();
    for (const col of canonicalBoard.columns) for (const item of col.items) if (item.type === 'goal') goalItemsByID.set(item.id, item);
    const resolved = Object.keys(fundingRequiredMap).filter((gid) => {
      const g = goalItemsByID.get(gid);
      return !g || g.status === 'done';
    });
    if (resolved.length === 0) return;
    setFundingRequiredMap((c) => { const n = { ...c }; for (const id of resolved) delete n[id]; return n; });
    setFundingRequired((c) => (!c ? c : resolved.includes(c.goal_id) ? null : c));
    void Promise.all(resolved.map((gid) => clearPlannerFundingRequired(userID, gid)));
  }, [boardQuery.data, cachedBoard, canonicalBoard, fundingRequiredMap, userID]);

  // --- Summary (now with To Do) ---
  const summaryCards = useMemo(() => [
    { label: t('plannerTotal') || 'Total', value: effectiveBoard.summary.total },
    { label: t('plannerToDo') || 'To Do', value: effectiveBoard.summary.todo },
    { label: t('plannerInProgress') || 'In Progress', value: effectiveBoard.summary.in_progress },
    { label: t('plannerDone') || 'Done', value: effectiveBoard.summary.done },
  ], [effectiveBoard, t]);

  const tags = tagsQuery.data?.tags || [];
  const goals = goalsQuery.data?.goals || [];

  const statusCounts = useMemo(() => {
    const counts: Record<PlannerStatus, number> = { todo: 0, in_progress: 0, done: 0, archived: 0 };
    for (const col of effectiveBoard.columns) counts[col.status] = col.items.length;
    return counts;
  }, [effectiveBoard]);

  const columnLabel = useCallback((s: PlannerStatus) => {
    const map: Record<PlannerStatus, string> = {
      todo: t('plannerToDo') || 'To Do',
      in_progress: t('plannerInProgress') || 'In Progress',
      done: t('plannerDone') || 'Done',
      archived: t('plannerArchived') || 'Archived',
    };
    return map[s];
  }, [t]);

  // --- Actions ---
  const openAddTransactionForTask = useCallback(async (taskID: string) => {
    setLaunchingTaskID(taskID);
    try {
      const taskResponse = await api.tasks.get(taskID);
      const task = taskResponse.task;
      const params: Record<string, string> = { linked_task_id: taskID, return_to: encodeURIComponent('/todo') };
      if (task.ledger_type === 'credit' || task.ledger_type === 'debit') params.type = task.ledger_type;
      if (typeof task.ledger_amount === 'number' && task.ledger_amount > 0) params.amount = String(task.ledger_amount);
      if (task.ledger_currency) params.currency = task.ledger_currency;
      if (task.ledger_wallet_currency) params.wallet_currency = task.ledger_wallet_currency;
      if (task.ledger_category) params.category = task.ledger_category;
      const desc = task.ledger_description?.trim() || task.title;
      if (desc) params.description = desc;
      router.push({ pathname: '/(app)/(tabs)/add', params } as any);
    } catch (error) {
      Alert.alert('Could not open transaction flow', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLaunchingTaskID(null);
    }
  }, [router]);

  const handleMoveItem = useCallback(async (item: TodoItem, nextStatus: PlannerStatus) => {
    if (!userID || item.status === nextStatus) return;
    try {
      const sortOrder = nextSortOrder(effectiveBoard, nextStatus, item.id);
      if (item.type === 'goal' && nextStatus === 'done') {
        await enqueuePlannerOp({ user_id: userID, op_type: 'goal_mark_done', entity_type: 'goal', entity_id: item.id, payload: { previous_status: item.status, queued_offline: !isOnline } });
      } else {
        await enqueuePlannerOp({ user_id: userID, op_type: 'item_move', entity_type: item.type, entity_id: item.id, payload: { status: nextStatus, sort_order: sortOrder } });
      }
      void syncOutboxNow();
    } catch (error) {
      Alert.alert('Could not queue item move', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [effectiveBoard, isOnline, syncOutboxNow, userID]);

  const handleCompleteTask = useCallback(async (taskID: string) => {
    if (!userID) return;
    setCompletingTaskID(taskID);
    void haptics.success();
    try {
      await enqueuePlannerOp({ user_id: userID, op_type: 'task_complete', entity_type: 'task', entity_id: taskID, payload: {} });
      void syncOutboxNow();
      showToast(t('plannerTaskCompleted') || 'Task completed!', 'success');

      // Show undo bar
      setUndoTaskID(taskID);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoTaskID(null), 5000);
    } catch (error) {
      Alert.alert('Could not queue task completion', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setTimeout(() => setCompletingTaskID(null), 600);
    }
  }, [syncOutboxNow, userID, showToast, t]);

  const handleUndoComplete = useCallback(async () => {
    if (!undoTaskID || !userID) return;
    setUndoTaskID(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    try {
      await enqueuePlannerOp({ user_id: userID, op_type: 'item_move', entity_type: 'task', entity_id: undoTaskID, payload: { status: 'todo', sort_order: 1 } });
      void syncOutboxNow();
      showToast(t('plannerUndo') || 'Task restored', 'info');
    } catch { /* silent */ }
  }, [undoTaskID, userID, syncOutboxNow, showToast, t]);

  const queueDeleteTask = useCallback(async (taskID: string) => {
    if (!userID) return;
    try {
      await enqueuePlannerOp({ user_id: userID, op_type: 'task_delete', entity_type: 'task', entity_id: taskID, payload: {} });
      void syncOutboxNow();
      showToast(t('plannerTaskDeleted') || 'Task deleted', 'info');
    } catch (error) {
      Alert.alert('Could not queue task delete', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [syncOutboxNow, userID, showToast, t]);

  const handleDeleteTask = useCallback((taskID: string) => {
    Alert.alert(
      t('plannerDeleteTitle') || 'Delete task?',
      t('plannerDeleteMessage') || 'This task will be removed from your planner.',
      [{ text: t('plannerClose') || 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void queueDeleteTask(taskID) }],
    );
  }, [queueDeleteTask, t]);

  const handleEditTask = useCallback(async (taskId: string, updates: UpdateTaskRequest) => {
    if (!userID) return;
    await enqueuePlannerOp({
      user_id: userID, op_type: 'task_update', entity_type: 'task', entity_id: taskId, payload: updates,
    });
    void syncOutboxNow();
    showToast(t('plannerTaskUpdated') || 'Task updated', 'success');
  }, [userID, syncOutboxNow, showToast, t]);

  const handleWizardSubmit = useCallback(async (payload: CreateTaskRequest, tagIds: string[]) => {
    if (!userID) return;
    const tempTaskID = createTempTaskID();
    const createOp = await enqueuePlannerOp({
      user_id: userID, op_type: 'task_create', entity_type: 'task', entity_id: tempTaskID,
      payload: { ...payload, local_temp_id: tempTaskID },
    });
    if (createOp && tagIds.length > 0) {
      for (const tagID of tagIds) {
        await enqueuePlannerOp({ user_id: userID, op_type: 'task_add_tag', entity_type: 'task', entity_id: tempTaskID, payload: { tag_id: tagID }, depends_on: createOp.id });
      }
    }
    void syncOutboxNow();
    showToast(t('plannerTaskCreated') || 'Task created!', 'success');
  }, [userID, syncOutboxNow, showToast, t]);

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

  // --- Filtering ---
  const filterItems = useCallback((items: TodoItem[]) => {
    let filtered = items;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter((i) => i.title.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
    }
    if (priorityFilter) {
      filtered = filtered.filter((i) => i.priority === priorityFilter);
    }
    return filtered;
  }, [debouncedSearch, priorityFilter]);

  // --- Render column ---
  const renderColumn = useCallback((status: PlannerStatus, columnIndex: number, widthOverride?: number) => {
    const rawItems = getColumnItems(effectiveBoard, status);
    const items = filterItems(rawItems);
    const meta = COLUMN_META[status];

    return (
      <Animated.View
        key={status}
        entering={FadeInDown.duration(420).delay(columnIndex * 56)}
        style={{
          width: widthOverride ?? (isDesktop ? 320 : pageWidth),
          borderRadius: 18, borderWidth: 1, borderColor: meta.border,
          backgroundColor: colors.card, padding: 12,
          shadowColor: meta.glow, shadowOpacity: 0.46, shadowRadius: 15, shadowOffset: { width: 0, height: 2 },
          elevation: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{columnLabel(status)}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{items.length}</Text>
        </View>

        {items.length === 0 ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 24, alignItems: 'center', backgroundColor: colors.muted }}>
            <Sparkles size={16} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8 }}>
              {t('plannerDropHere') || 'Drop items here'}
            </Text>
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
              onEdit={item.type === 'task' ? (i) => setEditingTask(i) : undefined}
              onAddTransaction={item.type === 'task' ? openAddTransactionForTask : undefined}
              isLaunchingTransaction={item.type === 'task' && launchingTaskID === item.id}
              onCompleteTask={handleCompleteTask}
              onDeleteTask={handleDeleteTask}
              isCompleting={completingTaskID === item.id}
              userId={userID}
            />
          ))
        )}
      </Animated.View>
    );
  }, [
    colors, effectiveBoard, filterItems, handleCompleteTask, handleDeleteTask,
    handleMoveItem, isDesktop, launchingTaskID, openAddTransactionForTask,
    pageWidth, pendingMarkers, completingTaskID, userID, columnLabel, t,
  ]);

  const isEmpty = effectiveBoard.summary.total === 0;

  // --- Sync bar visibility ---
  const showSyncBar = !isOnline || failedCount > 0 || isSyncing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      <LinearGradient colors={[colors.background, colors.backgroundSecondary, colors.background]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{
          paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
          borderBottomWidth: 1, borderBottomColor: colors.border,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, elevation: 2 }, pressed && { opacity: 0.72 }]}
            >
              <ArrowLeft size={18} color={colors.foreground} />
            </Pressable>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>
                {t('plannerTitle') || 'Todo Planner'}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>
                {t('plannerSubtitle') || 'Your tasks and goals at a glance'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppSwitcherTrigger variant="header_inline" />
            <Pressable
              onPress={() => setIsTaskWizardVisible(true)}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                shadowColor: colors.accent, shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
                elevation: 4,
              }, pressed && { opacity: 0.78 }]}
            >
              <Plus size={14} color={colors.accentForeground} />
              <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', marginLeft: 6 }}>
                {t('plannerNewTask') || 'New Task'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          {/* Sync bar — only when needed */}
          {showSyncBar && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {!isOnline && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: 999, borderWidth: 1, borderColor: colors.danger + '66', backgroundColor: colors.danger + '1A',
                }}>
                  <WifiOff size={12} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontSize: 11, marginLeft: 5, fontFamily: 'Inter_600SemiBold' }}>
                    {t('plannerOffline') || 'Offline'}
                  </Text>
                </View>
              )}

              {isSyncing && isOnline && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
                  borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
                }}>
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 5 }} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_500Medium' }}>
                    {t('plannerSyncing') || 'Syncing...'}
                  </Text>
                </View>
              )}

              {failedCount > 0 && (
                <>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                    borderWidth: 1, borderColor: colors.danger + '66', backgroundColor: colors.danger + '16',
                  }}>
                    <Text style={{ color: colors.danger, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                      {t('plannerSyncFailed') || 'Some changes failed'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>
                    <Pressable
                      onPress={retryFailed}
                      style={({ pressed }) => [{
                        flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
                        backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
                      }, pressed && { opacity: 0.72 }]}
                    >
                      <RotateCw size={12} color={colors.foreground} />
                      <Text style={{ color: colors.foreground, fontSize: 11, marginLeft: 5, fontFamily: 'Inter_600SemiBold' }}>
                        {t('plannerRetry') || 'Retry'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={discardFailed}
                      style={({ pressed }) => [{
                        borderWidth: 1, borderColor: colors.danger + '66', backgroundColor: colors.danger + '14',
                        borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
                      }, pressed && { opacity: 0.72 }]}
                    >
                      <Text style={{ color: colors.danger, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                        {t('plannerDiscard') || 'Discard'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Summary cards */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {summaryCards.map((metric) => (
              <Animated.View
                key={metric.label}
                entering={FadeInDown.duration(350)}
                style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 10 }}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{metric.label}</Text>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 2 }}>{metric.value}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Search & priority filter */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
              borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
            }}>
              <Search size={14} color={colors.mutedForeground} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder={t('plannerSearch') || 'Search tasks...'}
                placeholderTextColor={colors.placeholder}
                style={{ flex: 1, color: colors.foreground, fontSize: 13, paddingVertical: 2 }}
              />
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Pressable
              onPress={() => setPriorityFilter(null)}
              style={({ pressed }) => [{
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
                borderColor: !priorityFilter ? colors.accent : colors.border,
                backgroundColor: !priorityFilter ? colors.accent + '22' : colors.card,
              }, pressed && { opacity: 0.72 }]}
            >
              <Text style={{ color: !priorityFilter ? colors.accent : colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                {t('plannerFilterAll') || 'All'}
              </Text>
            </Pressable>
            {(['low', 'medium', 'high'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPriorityFilter(priorityFilter === p ? null : p)}
                style={({ pressed }) => [{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
                  borderColor: priorityFilter === p ? colors.accent : colors.border,
                  backgroundColor: priorityFilter === p ? colors.accent + '22' : colors.card,
                }, pressed && { opacity: 0.72 }]}
              >
                <Text style={{ color: priorityFilter === p ? colors.accent : colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                  {t(`priority${p.charAt(0).toUpperCase() + p.slice(1)}` as any) || p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Column tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {COLUMN_ORDER.map((status) => {
              const active = activeColumn === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => jumpToColumn(status)}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', borderRadius: 999,
                    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1,
                    borderColor: active ? COLUMN_META[status].border : colors.border,
                    backgroundColor: active ? COLUMN_META[status].glow : colors.card,
                    shadowColor: active ? COLUMN_META[status].glow : 'transparent',
                    shadowOpacity: active ? 0.42 : 0, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
                    elevation: active ? 4 : 0,
                  }, pressed && { opacity: 0.74 }]}
                >
                  <Text style={{ color: active ? colors.foreground : colors.mutedForeground, fontSize: 12, fontFamily: active ? 'Inter_700Bold' : 'Inter_600SemiBold' }}>
                    {columnLabel(status)}
                  </Text>
                  <Text style={{ color: active ? colors.foreground : colors.mutedForeground, fontSize: 11, marginLeft: 6 }}>
                    {statusCounts[status]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Board content */}
        {boardQuery.isLoading && !cachedBoard ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : isEmpty && !debouncedSearch && !priorityFilter ? (
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 24 }}>
            <EmptyState
              icon={KanbanSquare}
              title={t('plannerEmptyTitle') || 'No tasks yet'}
              description={t('plannerEmptyDescription') || 'Create your first task to get started with planning.'}
              actionLabel={t('plannerNewTask') || 'New Task'}
              onAction={() => setIsTaskWizardVisible(true)}
            />
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
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom + 20, 30) }}
            >
              {COLUMN_ORDER.map((status, index) => (
                <View key={status} style={{ width: pageWidth, paddingRight: 10 }}>
                  <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={!isDraggingCard} contentContainerStyle={{ paddingBottom: 14 }}>
                    {renderColumn(status, index, pageWidth - 6)}
                  </ScrollView>
                </View>
              ))}
            </ScrollView>

            {isDraggingCard && (
              <>
                <View pointerEvents="none" style={{
                  position: 'absolute', top: 14, bottom: 20, left: 8, width: 34, borderRadius: 16,
                  borderWidth: 1, borderColor: dragDirection === 'left' ? colors.accent + '99' : colors.border,
                  backgroundColor: dragDirection === 'left' ? colors.accent + '26' : colors.card + '8A',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: colors.accent, shadowOpacity: dragDirection === 'left' ? 0.36 : 0, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
                  elevation: dragDirection === 'left' ? 6 : 0,
                }}>
                  <ChevronLeft size={16} color={dragDirection === 'left' ? colors.accent : colors.mutedForeground} />
                </View>
                <View pointerEvents="none" style={{
                  position: 'absolute', top: 14, bottom: 20, right: 8, width: 34, borderRadius: 16,
                  borderWidth: 1, borderColor: dragDirection === 'right' ? colors.accent + '99' : colors.border,
                  backgroundColor: dragDirection === 'right' ? colors.accent + '26' : colors.card + '8A',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: colors.accent, shadowOpacity: dragDirection === 'right' ? 0.36 : 0, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
                  elevation: dragDirection === 'right' ? 6 : 0,
                }}>
                  <ChevronRight size={16} color={dragDirection === 'right' ? colors.accent : colors.mutedForeground} />
                </View>
              </>
            )}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: Math.max(insets.bottom + 24, 36), gap: 12 }}
          >
            {COLUMN_ORDER.map((status, index) => renderColumn(status, index))}
          </ScrollView>
        )}

        {/* Undo bar */}
        {undoTaskID && (
          <View style={{
            position: 'absolute', bottom: Math.max(insets.bottom + 8, 20), left: 16, right: 16,
            backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 14, paddingVertical: 10,
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}>
            <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
              {t('plannerTaskCompleted') || 'Task completed'}
            </Text>
            <Pressable onPress={handleUndoComplete}>
              <Text style={{ color: colors.accent, fontSize: 13, fontFamily: 'Inter_700Bold' }}>
                {t('plannerUndo') || 'Undo'}
              </Text>
            </Pressable>
          </View>
        )}
      </LinearGradient>

      {/* Task Wizard Modal */}
      <TaskWizardModal
        visible={isTaskWizardVisible}
        onClose={() => setIsTaskWizardVisible(false)}
        onSubmit={handleWizardSubmit}
        userId={userID}
        effectiveBoard={effectiveBoard}
        tags={tags}
        goals={goals}
      />

      {/* Task Edit Modal */}
      <TaskEditModal
        visible={!!editingTask}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEditTask}
        onAddTransaction={openAddTransactionForTask}
      />

      {/* Funding Required Modal */}
      <Modal visible={!!fundingRequired} transparent animationType="fade" onRequestClose={() => setFundingRequired(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 360, borderRadius: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <AlertTriangle size={16} color={colors.warning} />
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 16, marginLeft: 8 }}>
                {t('plannerGoalFunding') || 'Goal Funding Required'}
              </Text>
            </View>
            <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
              This financial goal still needs {fundingRequired?.remaining.toFixed(2)} {fundingRequired?.currency} before it can be moved to done.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable
                onPress={() => { setFundingRequired(null); router.push('/(app)/(tabs)/goals'); }}
                style={({ pressed }) => [{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.accent }, pressed && { opacity: 0.78 }]}
              >
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerOpenGoals') || 'Open Goals'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFundingRequired(null)}
                style={({ pressed }) => [{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, pressed && { opacity: 0.78 }]}
              >
                <Text style={{ color: colors.foreground }}>{t('plannerDismiss') || 'Dismiss'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

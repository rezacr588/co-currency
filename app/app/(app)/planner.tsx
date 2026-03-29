import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  ArrowLeft,
  KanbanSquare,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react-native';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { AppSwitcherTrigger } from '../../src/components/navigation/AppSwitcherTrigger';
import { useToast } from '../../src/components/ui/Toast';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PlannerCard } from '../../src/components/features/Planner/PlannerCard';
import { PlannerPhoneTaskRow } from '../../src/components/features/Planner/PlannerPhoneTaskRow';
import { PlannerStatusSheet } from '../../src/components/features/Planner/PlannerStatusSheet';
import { TaskEditModal } from '../../src/components/features/Planner/TaskEditModal';
import { PlannerUndoBar } from '../../src/components/features/Planner/PlannerUndoBar';
import { PlannerSummaryCards } from '../../src/components/features/Planner/PlannerSummaryCards';
import { useScreenLayout } from '../../src/hooks/useScreenLayout';
import { haptics } from '../../src/utils/haptics';
import { useDebounce } from '../../src/hooks/useDebounce';
import { buildPlannerPhoneSections, type PlannerPhoneSectionKey } from '../../src/utils/plannerPhoneSections';
import {
  clearPlannerFundingRequired,
  getPlannerBoardCache,
  getPlannerFundingRequiredMap,
  setPlannerBoardCache,
  setPlannerFundingRequired,
} from '../../src/offline/plannerCache';
import {
  getPlannerBoardBackup,
  plannerBoardsEqual,
  setPlannerBoardBackup,
  shouldUseLocalPlannerBackup,
} from '../../src/offline/plannerBackup';
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
import { COLUMN_ORDER, getStatusLabel } from '../../src/utils/plannerConstants';
import type { Goal } from '../../src/types/goal';
import type {
  GoalFundingRequired,
  PlannerBoardResponse,
  PlannerPendingMarker,
  PlannerStatus,
  Task,
  TodoItem,
  UpdateTaskRequest,
} from '../../src/types/planner';

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

export function PlannerScreenContent() {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width, isCompactPhone, isPhone, isTablet, isDesktop } = useScreenLayout();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userID = user?.id || '';
  const { showToast } = useToast();

  const boardGap = 12;
  const boardHorizontalPadding = 32;
  const desktopColumnCount = COLUMN_ORDER.length;
  const desktopColumnWidth = Math.max(
    Math.floor((width - boardHorizontalPadding - boardGap * (desktopColumnCount - 1)) / desktopColumnCount),
    240,
  );
  const tabletColumnWidth = Math.max(
    Math.min(Math.floor((width - boardHorizontalPadding - boardGap) / 2), 420),
    300,
  );

  // --- Core state ---
  const [cachedBoard, setCachedBoard] = useState<PlannerBoardResponse | null>(null);
  const [backupBoard, setBackupBoard] = useState<PlannerBoardResponse | null>(null);
  const backupTimestampRef = useRef<number>(0);
  const [outbox, setOutbox] = useState<PlannerOutboxOp[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [fundingRequired, setFundingRequired] = useState<GoalFundingRequired | null>(null);
  const [fundingRequiredMap, setFundingRequiredMap] = useState<Record<string, GoalFundingRequired>>({});

  const [launchingTaskID, setLaunchingTaskID] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completingTaskID, setCompletingTaskID] = useState<string | null>(null);
  const [statusSheetTask, setStatusSheetTask] = useState<TodoItem | null>(null);

  const [activeColumn, setActiveColumn] = useState<PlannerStatus>('todo');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Search & filter ---
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 300);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  // --- Undo ---
  const [undoTaskID, setUndoTaskID] = useState<string | null>(null);
  const [undoOriginalStatus, setUndoOriginalStatus] = useState<PlannerStatus>('todo');
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pagerRef = useRef<ScrollView>(null);
  const syncInFlightRef = useRef(false);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bug #8: Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    };
  }, []);

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
      setBackupBoard(null);
      setOutbox([]);
      setFundingRequiredMap({});
      setFundingRequired(null);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const [cache, backup, queue, online, storedFunding] = await Promise.all([
          getPlannerBoardCache(userID),
          getPlannerBoardBackup(userID),
          getPlannerOutbox(userID),
          isPlannerOnline(),
          getPlannerFundingRequiredMap(userID),
        ]);
        if (!active) return;
        setCachedBoard(cache?.board ?? null);
        setBackupBoard(backup?.board ?? null);
        backupTimestampRef.current = backup?.updated_at ?? 0;
        setOutbox(queue);
        setIsOnline(online);
        setFundingRequiredMap(storedFunding);
        const first = Object.values(storedFunding)[0];
        if (first) setFundingRequired(first);
      } catch {
        // Storage read failures should not crash the screen; start with empty state
        if (!active) return;
        setCachedBoard(null);
        setBackupBoard(null);
        setOutbox([]);
        setIsOnline(true);
      }
    })();

    const unsubscribe = subscribePlannerOutbox(userID, (queue) => setOutbox(queue));
    return () => { active = false; unsubscribe(); };
  }, [userID]);

  useEffect(() => {
    if (!userID || !boardQuery.data) return;

    const remoteBoard = boardQuery.data;
    const localBoard = backupBoard ?? cachedBoard;
    if (shouldUseLocalPlannerBackup(remoteBoard, localBoard, backupTimestampRef.current, boardQuery.dataUpdatedAt) && outbox.length === 0) {
      return;
    }

    setCachedBoard(remoteBoard);
    void setPlannerBoardCache(userID, remoteBoard);
  }, [backupBoard, boardQuery.data, cachedBoard, outbox.length, userID]);

  // --- Sync ---
  const invalidateBoard = useCallback(() => {
    return Promise.all([
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
  }, [boardQueryKey, goalsQueryKey, queryClient, tagsQueryKey]);

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
        await invalidateBoard();
      }
    } finally {
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  }, [invalidateBoard, showToast, userID, t]);

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
  const localPlannerBoard = backupBoard ?? cachedBoard;
  const isUsingLocalPlannerBackup = shouldUseLocalPlannerBackup(boardQuery.data, localPlannerBoard, backupTimestampRef.current, boardQuery.dataUpdatedAt) && outbox.length === 0;
  const canonicalBoard = (isUsingLocalPlannerBackup ? localPlannerBoard : boardQuery.data) ?? cachedBoard ?? backupBoard ?? emptyBoard();
  const effectiveBoard = useMemo(() => applyOutboxLocally(canonicalBoard, outbox), [canonicalBoard, outbox]);

  const prevEffectiveBoardRef = useRef<PlannerBoardResponse | null>(null);
  useEffect(() => {
    if (!userID) return;
    // Only update backup if the effective board actually changed (avoid infinite loop)
    if (prevEffectiveBoardRef.current && plannerBoardsEqual(prevEffectiveBoardRef.current, effectiveBoard)) {
      return;
    }
    prevEffectiveBoardRef.current = effectiveBoard;
    if (!plannerBoardsEqual(backupBoard, effectiveBoard)) {
      setBackupBoard(effectiveBoard);
      backupTimestampRef.current = Date.now();
    }
    void setPlannerBoardBackup(userID, effectiveBoard);
  }, [effectiveBoard, userID]); // Removed backupBoard from deps to break the cycle

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
    if (!boardQuery.data && !cachedBoard && !backupBoard) return;
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
  }, [backupBoard, boardQuery.data, cachedBoard, canonicalBoard, fundingRequiredMap, userID]);

  // --- Summary (now with To Do) ---
  const summaryCards = useMemo(() => [
    { label: t('plannerTotal') || 'Total', value: effectiveBoard.summary.total },
    { label: t('plannerToDo') || 'To Do', value: effectiveBoard.summary.todo },
    { label: t('plannerInProgress') || 'In Progress', value: effectiveBoard.summary.in_progress },
    { label: t('plannerDone') || 'Done', value: effectiveBoard.summary.done },
  ], [effectiveBoard, t]);
  const summaryGap = 10;
  const summaryColumnCount = isCompactPhone ? 1 : isPhone ? 2 : isTablet ? 2 : summaryCards.length;
  const summaryCardWidth = !isDesktop
    ? Math.max(
        Math.floor((Math.max(width - boardHorizontalPadding, 0) - summaryGap * (summaryColumnCount - 1)) / summaryColumnCount),
        0,
      )
    : undefined;

  const tags = tagsQuery.data?.tags || [];
  const goals = goalsQuery.data?.goals || [];

  const statusCounts = useMemo(() => {
    const counts: Record<PlannerStatus, number> = { todo: 0, in_progress: 0, done: 0, archived: 0 };
    for (const col of effectiveBoard.columns) counts[col.status] = col.items.length;
    return counts;
  }, [effectiveBoard]);

  const activeFilters = useMemo(() => {
    const filters: string[] = [];
    if (debouncedSearch.trim()) {
      filters.push(`"${debouncedSearch.trim()}"`);
    }
    if (priorityFilter) {
      filters.push(
        t(`priority${priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)}` as any) ||
          priorityFilter
      );
    }
    return filters;
  }, [debouncedSearch, priorityFilter, t]);

  const columnLabel = useCallback((s: PlannerStatus) => {
    return getStatusLabel(s, t as (key: string) => string | undefined);
  }, [t]);

  const phoneSectionLabel = useCallback((section: PlannerPhoneSectionKey) => {
    switch (section) {
      case 'overdue':
        return t('plannerSectionOverdue') || 'Overdue';
      case 'today':
        return t('plannerSectionToday') || 'Today';
      case 'upcoming':
        return t('plannerSectionUpcoming') || 'Upcoming';
      case 'no_date':
        return t('plannerSectionNoDate') || 'No date';
      case 'recent':
      default:
        return t('plannerSectionRecent') || 'Recently updated';
    }
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
      router.push({ pathname: '/transaction-create', params } as any);
    } catch (error) {
      Alert.alert(t('plannerTransactionError') || 'Could not open transaction flow', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLaunchingTaskID(null);
    }
  }, [router, t]);

  const openTaskEditor = useCallback(async (item: TodoItem) => {
    if (isPhone) {
      router.push({ pathname: '/planner-create', params: { task_id: item.id } } as any);
      return;
    }

    try {
      const response = await api.tasks.get(item.id);
      setEditingTask(response.task);
    } catch (error) {
      Alert.alert(
        t('plannerUpdateError') || 'Could not open task editor',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }, [isPhone, router, t]);

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
      Alert.alert(t('plannerMoveError') || 'Could not queue item move', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [effectiveBoard, isOnline, syncOutboxNow, userID, t]);

  const handleCompleteTask = useCallback(async (taskID: string) => {
    if (!userID) return;
    // Find the task's current status for undo
    let originalStatus: PlannerStatus = 'todo';
    for (const col of effectiveBoard.columns) {
      const found = col.items.find((i) => i.id === taskID);
      if (found) { originalStatus = col.status; break; }
    }
    setCompletingTaskID(taskID);
    void haptics.success();
    try {
      await enqueuePlannerOp({ user_id: userID, op_type: 'task_complete', entity_type: 'task', entity_id: taskID, payload: {} });
      void syncOutboxNow();
      showToast(t('plannerTaskCompleted') || 'Task completed!', 'success');

      // Show undo bar
      setUndoTaskID(taskID);
      setUndoOriginalStatus(originalStatus);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoTaskID(null), 5000);
    } catch (error) {
      Alert.alert(t('plannerCompleteError') || 'Could not queue task completion', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setTimeout(() => setCompletingTaskID(null), 600);
    }
  }, [effectiveBoard, syncOutboxNow, userID, showToast, t]);

  const handleUndoComplete = useCallback(async () => {
    if (!undoTaskID || !userID) return;
    setUndoTaskID(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    try {
      void haptics.light();
      await enqueuePlannerOp({ user_id: userID, op_type: 'item_move', entity_type: 'task', entity_id: undoTaskID, payload: { status: undoOriginalStatus, sort_order: 1 } });
      void syncOutboxNow();
      showToast(t('plannerUndo') || 'Task restored', 'info');
    } catch { /* silent */ }
  }, [undoTaskID, undoOriginalStatus, userID, syncOutboxNow, showToast, t]);

  const queueDeleteTask = useCallback(async (taskID: string) => {
    if (!userID) return;
    try {
      await enqueuePlannerOp({ user_id: userID, op_type: 'task_delete', entity_type: 'task', entity_id: taskID, payload: {} });
      void syncOutboxNow();
      showToast(t('plannerTaskDeleted') || 'Task deleted', 'info');
    } catch (error) {
      Alert.alert(t('plannerDeleteError') || 'Could not queue task delete', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [syncOutboxNow, userID, showToast, t]);

  const handleDeleteTask = useCallback((taskID: string) => {
    Alert.alert(
      t('plannerDeleteTitle') || 'Delete task?',
      t('plannerDeleteMessage') || 'This task will be removed from your planner.',
      [{ text: t('plannerClose') || 'Cancel', style: 'cancel' }, { text: t('plannerDelete') || 'Delete', style: 'destructive', onPress: () => void queueDeleteTask(taskID) }],
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

  const retryFailed = useCallback(async () => {
    if (!userID) return;
    await retryFailedPlannerOps(userID);
    await syncOutboxNow();
  }, [syncOutboxNow, userID]);

  const discardFailed = useCallback(() => {
    if (!userID) return;
    Alert.alert(
      t('plannerDiscardFailedTitle') || 'Discard failed changes?',
      t('plannerDiscardFailedMessage') || 'This will permanently remove all failed operations. You cannot undo this.',
      [
        { text: t('plannerClose') || 'Cancel', style: 'cancel' },
        {
          text: t('plannerDiscard') || 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardFailedPlannerOps(userID);
            await invalidateBoard();
          },
        },
      ],
    );
  }, [invalidateBoard, userID, t]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncOutboxNow();
      await invalidateBoard();
    } finally {
      setIsRefreshing(false);
    }
  }, [syncOutboxNow, invalidateBoard]);

  const jumpToColumn = useCallback((status: PlannerStatus) => {
    const index = COLUMN_ORDER.indexOf(status);
    setActiveColumn(status);
    if (isPhone) {
      return;
    }
    if (isTablet) {
      pagerRef.current?.scrollTo({ x: index * (tabletColumnWidth + boardGap), y: 0, animated: true });
    }
    // On desktop, all columns are visible in flex row — no scroll needed
  }, [boardGap, isPhone, isTablet, tabletColumnWidth]);

  const handleDragStateChange = useCallback((_dragging: boolean) => {}, []);
  const handleDragDirectionChange = useCallback((_direction: 'left' | 'right' | null) => {}, []);

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

  // --- Render board column ---
  const renderColumn = useCallback((status: PlannerStatus, columnIndex: number, widthOverride?: number) => {
    const rawItems = getColumnItems(effectiveBoard, status);
    const items = filterItems(rawItems);
    const meta = COLUMN_META[status];

    return (
      <Animated.View
        key={status}
        entering={FadeInDown.duration(420).delay(columnIndex * 56)}
        style={{
          width: widthOverride ?? '100%',
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
              {(debouncedSearch || priorityFilter)
                ? (t('plannerNoResults') || 'No matching tasks')
                : (t('plannerDropHere') || 'Drop items here')}
            </Text>
            {(debouncedSearch || priorityFilter) && (
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                {t('plannerNoResultsDescription') || 'Try adjusting your search or filters.'}
              </Text>
            )}
          </View>
        ) : (
          items.map((item) => (
            <PlannerCard
              key={item.id}
              item={item}
              marker={pendingMarkers[markerKey(item)]}
              columnIndex={columnIndex}
              onMove={handleMoveItem}
              onDragStateChange={handleDragStateChange}
              onDragDirectionChange={handleDragDirectionChange}
              onEdit={item.type === 'task' ? openTaskEditor : undefined}
              onRequestMove={isPhone ? setStatusSheetTask : undefined}
              onAddTransaction={item.type === 'task' ? openAddTransactionForTask : undefined}
              isLaunchingTransaction={item.type === 'task' && launchingTaskID === item.id}
              onCompleteTask={handleCompleteTask}
              onDeleteTask={handleDeleteTask}
              isCompleting={completingTaskID === item.id}
              userId={userID}
              interactionMode="gesture"
            />
          ))
        )}
      </Animated.View>
    );
  }, [
    colors, debouncedSearch, effectiveBoard, filterItems, handleCompleteTask, handleDeleteTask,
    handleMoveItem, handleDragDirectionChange, handleDragStateChange, isPhone, launchingTaskID, openAddTransactionForTask, openTaskEditor,
    pendingMarkers, priorityFilter, completingTaskID, userID, columnLabel, t,
  ]);

  type PhoneFlatItem =
    | { kind: 'section'; key: string; sectionKey: PlannerPhoneSectionKey; count: number }
    | { kind: 'item'; key: string; item: TodoItem };

  const phoneFlatData = useMemo((): PhoneFlatItem[] => {
    const items = filterItems(getColumnItems(effectiveBoard, activeColumn));
    const sections = buildPlannerPhoneSections(items, activeColumn);
    const flat: PhoneFlatItem[] = [];
    for (const section of sections) {
      flat.push({ kind: 'section', key: `hdr:${section.key}`, sectionKey: section.key, count: section.items.length });
      for (const item of section.items) {
        flat.push({ kind: 'item', key: item.id, item });
      }
    }
    return flat;
  }, [activeColumn, effectiveBoard, filterItems]);

  const renderPhoneFlatItem = useCallback(({ item: row }: { item: PhoneFlatItem }) => {
    if (row.kind === 'section') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_700Bold' }}>
            {phoneSectionLabel(row.sectionKey)}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {row.count}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ marginBottom: 8 }}>
        <PlannerPhoneTaskRow
          item={row.item}
          marker={pendingMarkers[markerKey(row.item)]}
          onOpen={openTaskEditor}
          onRequestMove={setStatusSheetTask}
          onCompleteTask={handleCompleteTask}
          onDeleteTask={handleDeleteTask}
        />
      </View>
    );
  }, [colors.foreground, colors.mutedForeground, handleCompleteTask, handleDeleteTask, openTaskEditor, pendingMarkers, phoneSectionLabel]);

  const phoneEmptyComponent = useMemo(() => (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
        borderRadius: 16,
        paddingVertical: 28,
        paddingHorizontal: 16,
        alignItems: 'center',
        backgroundColor: colors.muted,
      }}
    >
      <Sparkles size={16} color={colors.mutedForeground} />
      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8 }}>
        {(debouncedSearch || priorityFilter)
          ? (t('plannerNoResults') || 'No matching tasks')
          : (t('plannerEmptyStatus') || 'No items in this list yet')}
      </Text>
      {(debouncedSearch || priorityFilter) && (
        <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4, opacity: 0.7 }}>
          {t('plannerNoResultsDescription') || 'Try adjusting your search or filters.'}
        </Text>
      )}
    </View>
  ), [colors.border, colors.muted, colors.mutedForeground, debouncedSearch, priorityFilter, t]);

  const isEmpty = effectiveBoard.summary.total === 0;

  // --- Sync bar visibility ---
  const showSyncBar = !isOnline || failedCount > 0 || isSyncing || isUsingLocalPlannerBackup;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={isDesktop ? [] : ['top']}>
      <LinearGradient colors={[colors.background, colors.backgroundSecondary, colors.background]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{
          paddingHorizontal: 16,
          paddingTop: isDesktop ? 24 : 16,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{ 
                width: 40, height: 40, borderRadius: 12, 
                alignItems: 'center', justifyContent: 'center', 
                backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
              }, pressed && { opacity: 0.72 }]}
              accessibilityRole="button"
              accessibilityLabel={t('goBack') || 'Go Back'}
            >
              <ArrowLeft size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ 
                width: 32, height: 32, borderRadius: 8, 
                backgroundColor: colors.accent + '1A', 
                alignItems: 'center', justifyContent: 'center' 
              }}>
                <KanbanSquare size={16} color={colors.accent} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text 
                  style={{ 
                    color: colors.foreground, 
                    fontFamily: 'Inter_700Bold', 
                    fontSize: isDesktop ? 28 : 24,
                    lineHeight: isDesktop ? 36 : 32,
                  }}
                  numberOfLines={1}
                >
                  {t('plannerTitle') || 'Todo Planner'}
                </Text>
                {!isCompactPhone && (
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                    {t('plannerSubtitle') || 'Your tasks and goals at a glance'}
                  </Text>
                )}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginStart: 12 }}>
            <AppSwitcherTrigger variant="header_inline" />
            <Pressable
              onPress={() => router.push('/planner-create' as any)}
              style={({ pressed }) => [{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.accent,
                paddingHorizontal: isCompactPhone ? 12 : 16,
                paddingVertical: 10,
                borderRadius: 999,
                shadowColor: colors.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={t('plannerNewTask') || 'New Task'}
            >
              <Plus size={16} color={colors.accentForeground} />
              {!isCompactPhone ? (
                <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', fontSize: 14, marginStart: 6 }}>
                  {t('plannerNewTask') || 'New Task'}
                </Text>
              ) : null}
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          {/* Sync bar — only when needed */}
          {showSyncBar && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {isUsingLocalPlannerBackup && (
                <View
                  accessibilityRole="alert"
                  accessibilityLabel={t('plannerLocalBackup') || 'Local backup in use'}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.warning + '66',
                    backgroundColor: colors.warning + '16',
                  }}
                >
                  <AlertTriangle size={12} color={colors.warning} />
                  <Text style={{ color: colors.warning, fontSize: 11, marginStart: 5, fontFamily: 'Inter_600SemiBold' }}>
                    {t('plannerLocalBackup') || 'Local backup'}
                  </Text>
                </View>
              )}

              {!isOnline && (
                <View
                  accessibilityRole="alert"
                  accessibilityLabel={t('plannerOffline') || 'Offline'}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
                    borderRadius: 999, borderWidth: 1, borderColor: colors.danger + '66', backgroundColor: colors.danger + '1A',
                  }}
                >
                  <WifiOff size={12} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontSize: 11, marginStart: 5, fontFamily: 'Inter_600SemiBold' }}>
                    {t('plannerOffline') || 'Offline'}
                  </Text>
                </View>
              )}

              {isSyncing && isOnline && (
                <View
                  accessibilityLabel={t('plannerSyncing') || 'Syncing...'}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
                    borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
                  }}
                >
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginEnd: 5 }} />
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
                  <View style={{ flexDirection: 'row', gap: 8, marginStart: 'auto' }}>
                    <Pressable
                      onPress={retryFailed}
                      disabled={isSyncing}
                      style={({ pressed }) => [{
                        flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
                        backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
                        opacity: isSyncing ? 0.5 : pressed ? 0.72 : 1,
                      }]}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size={12} color={colors.foreground} />
                      ) : (
                        <RotateCw size={12} color={colors.foreground} />
                      )}
                      <Text style={{ color: colors.foreground, fontSize: 11, marginStart: 5, fontFamily: 'Inter_600SemiBold' }}>
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
          <PlannerSummaryCards
            cards={summaryCards}
            isPhone={isPhone}
            isDesktop={isDesktop}
            summaryGap={summaryGap}
            summaryCardWidth={summaryCardWidth}
          />

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
                accessibilityLabel={t('plannerSearchTasks') || 'Search tasks'}
                returnKeyType="search"
                style={{ flex: 1, color: colors.foreground, fontSize: 13, paddingVertical: 2 }}
              />
              {searchText ? (
                <Pressable onPress={() => setSearchText('')} hitSlop={6}>
                  <X size={14} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Pressable
              onPress={() => setPriorityFilter(null)}
              style={({ pressed }) => [{
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, minHeight: 36,
                justifyContent: 'center' as const,
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
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, minHeight: 36,
                  justifyContent: 'center' as const,
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

          {activeFilters.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: colors.accent + '33',
                backgroundColor: colors.accent + '10',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>
                {(t('plannerShowingResults') || 'Showing results for') + ' ' + activeFilters.join(' • ')}
              </Text>
              <Pressable
                onPress={() => {
                  setSearchText('');
                  setPriorityFilter(null);
                }}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                  pressed && { opacity: 0.72 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                  {t('plannerClearFilters') || 'Clear'}
                </Text>
              </Pressable>
            </View>
          ) : null}

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
                    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, minHeight: 36,
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
                  <Text style={{ color: active ? colors.foreground : colors.mutedForeground, fontSize: 11, marginStart: 6 }}>
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
              onAction={() => router.push('/planner-create' as any)}
            />
          </View>
        ) : isPhone ? (
          <View style={{ flex: 1, marginTop: 12 }}>
            <FlatList<PhoneFlatItem>
              data={phoneFlatData}
              keyExtractor={(row) => row.key}
              renderItem={renderPhoneFlatItem}
              ListEmptyComponent={phoneEmptyComponent}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[plannerStyles.flatListContent, { paddingBottom: Math.max(insets.bottom + 20, 30) }]}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={7}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.accent}
                  colors={[colors.accent]}
                />
              }
            />
          </View>
        ) : isTablet ? (
          <View style={{ flex: 1, marginTop: 12 }}>
            <ScrollView
              ref={pagerRef}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[plannerStyles.tabletScrollContent, { paddingBottom: Math.max(insets.bottom + 24, 36), gap: boardGap }]}
            >
              {COLUMN_ORDER.map((status, index) => (
                <View key={status} style={{ width: tabletColumnWidth }}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={plannerStyles.columnScrollContent}
                    refreshControl={
                      <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                      />
                    }
                  >
                    {renderColumn(status, index, undefined)}
                  </ScrollView>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, paddingBottom: Math.max(insets.bottom + 24, 36), gap: boardGap }}>
            {COLUMN_ORDER.map((status, index) => (
              <View key={status} style={{ flex: 1, minWidth: 240 }}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 14 }}
                  refreshControl={
                    <RefreshControl
                      refreshing={isRefreshing}
                      onRefresh={handleRefresh}
                      tintColor={colors.accent}
                      colors={[colors.accent]}
                    />
                  }
                >
                  {renderColumn(status, index, undefined)}
                </ScrollView>
              </View>
            ))}
          </View>
        )}

        {/* Undo bar */}
        {undoTaskID && (
          <PlannerUndoBar onUndo={handleUndoComplete} />
        )}
      </LinearGradient>

      {/* Task Edit Modal */}
      <TaskEditModal
        visible={!!editingTask}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEditTask}
        onAddTransaction={openAddTransactionForTask}
        onDelete={queueDeleteTask}
      />

      <PlannerStatusSheet
        visible={!!statusSheetTask}
        task={statusSheetTask}
        onClose={() => setStatusSheetTask(null)}
        onSelect={(status) => {
          if (!statusSheetTask) return;
          void handleMoveItem(statusSheetTask, status);
          setStatusSheetTask(null);
        }}
      />

      {/* Funding Required Modal */}
      <Modal visible={!!fundingRequired} transparent animationType="fade" onRequestClose={() => setFundingRequired(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 360, borderRadius: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <AlertTriangle size={16} color={colors.warning} />
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 16, marginStart: 8 }}>
                {t('plannerGoalFunding') || 'Goal Funding Required'}
              </Text>
            </View>
            <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>
              {(t('plannerGoalFundingMessage') || 'This financial goal still needs {{amount}} {{currency}} before it can be moved to done.')
                .replace('{{amount}}', fundingRequired?.remaining.toFixed(2) ?? '')
                .replace('{{currency}}', fundingRequired?.currency ?? '')}
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

export default function PlannerScreen() {
  const theme = useTheme();
  const { width, isPhone } = useScreenLayout();

  // Wait for valid dimensions before deciding layout
  if (width === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (isPhone) {
    return <Redirect href={"/(app)/(tabs)/planner" as any} />;
  }

  return <PlannerScreenContent />;
}

const plannerStyles = StyleSheet.create({
  flatListContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  tabletScrollContent: {
    paddingHorizontal: 16,
  },
  columnScrollContent: {
    paddingBottom: 14,
  },
});

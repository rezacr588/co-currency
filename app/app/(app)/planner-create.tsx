import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { TaskWizardModal } from '../../src/components/features/Planner/TaskWizardModal';
import { useToast } from '../../src/components/ui/Toast';
import { useAuth } from '../../src/context/AuthContext';
import { getPlannerBoardBackup } from '../../src/offline/plannerBackup';
import { getPlannerBoardCache } from '../../src/offline/plannerCache';
import { enqueuePlannerOp, getPlannerOutbox } from '../../src/offline/plannerOutbox';
import { applyOutboxLocally, syncPlannerOutbox } from '../../src/offline/plannerSyncEngine';
import { useLanguage } from '../../src/context/LanguageContext';
import { COLUMN_ORDER } from '../../src/utils/plannerConstants';
import type { Goal } from '../../src/types/goal';
import type {
  CreateTaskRequest,
  PlannerBoardResponse,
  PlannerStatus,
  TaskEditorValues,
  UpdateTaskRequest,
} from '../../src/types/planner';

function emptyBoard(): PlannerBoardResponse {
  return {
    summary: { total: 0, todo: 0, in_progress: 0, done: 0, archived: 0 },
    columns: COLUMN_ORDER.map((status) => ({ status, items: [] })),
  };
}

function createTempTaskID(): string {
  return `temp-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextSortOrder(board: PlannerBoardResponse, status: PlannerStatus): number {
  const column = board.columns.find((entry) => entry.status === status);
  const items = (column?.items ?? [])
    .slice()
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
  if (items.length === 0) return 1;
  const tail = items[items.length - 1];
  return (tail.sort_order ?? items.length) + 1;
}

function buildCreatePayload(values: TaskEditorValues, board: PlannerBoardResponse): CreateTaskRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    status: values.status,
    priority: values.priority,
    due_date: values.due_date.trim() || undefined,
    goal_id: values.goal_id,
    sort_order: nextSortOrder(board, values.status),
    reminder_mode: values.reminder_mode,
    subtasks: values.subtasks.length > 0 ? values.subtasks : undefined,
    auto_ledger_enabled: values.auto_ledger_enabled,
    ledger_type: values.auto_ledger_enabled ? values.ledger_type : undefined,
    ledger_amount:
      values.auto_ledger_enabled && values.ledger_amount
        ? Number(values.ledger_amount)
        : undefined,
    ledger_currency: values.auto_ledger_enabled ? values.ledger_currency : undefined,
    ledger_wallet_currency: values.auto_ledger_enabled
      ? values.ledger_wallet_currency
      : undefined,
    ledger_category: values.auto_ledger_enabled
      ? values.ledger_category.trim() || undefined
      : undefined,
    ledger_description: values.auto_ledger_enabled
      ? values.ledger_description.trim() || undefined
      : undefined,
  };
}

function buildUpdatePayload(values: TaskEditorValues): UpdateTaskRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status,
    priority: values.priority,
    due_date: values.due_date.trim(),
    goal_id: values.goal_id ?? '',
    reminder_mode: values.reminder_mode,
    subtasks: values.subtasks,
    auto_ledger_enabled: values.auto_ledger_enabled,
    ledger_type: values.auto_ledger_enabled ? values.ledger_type : '',
    ledger_amount: values.auto_ledger_enabled
      ? Number(values.ledger_amount)
      : null,
    ledger_currency: values.auto_ledger_enabled ? values.ledger_currency : '',
    ledger_wallet_currency: values.auto_ledger_enabled
      ? values.ledger_wallet_currency
      : '',
    ledger_category: values.auto_ledger_enabled ? values.ledger_category.trim() : '',
    ledger_description: values.auto_ledger_enabled
      ? values.ledger_description.trim()
      : '',
  };
}

export default function PlannerCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ task_id?: string | string[] }>();
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  const userID = user?.id || '';
  const taskID = Array.isArray(params.task_id) ? params.task_id[0] : params.task_id;
  const isEditMode = Boolean(taskID);

  const [cachedBoard, setCachedBoard] = useState<PlannerBoardResponse | null>(null);
  const [backupBoard, setBackupBoard] = useState<PlannerBoardResponse | null>(null);
  const [outbox, setOutbox] = useState<Awaited<ReturnType<typeof getPlannerOutbox>>>([]);

  useEffect(() => {
    if (!userID) {
      setCachedBoard(null);
      setBackupBoard(null);
      setOutbox([]);
      return;
    }

    let active = true;
    void (async () => {
      const [cache, backup, queue] = await Promise.all([
        getPlannerBoardCache(userID),
        getPlannerBoardBackup(userID),
        getPlannerOutbox(userID),
      ]);
      if (!active) return;
      setCachedBoard(cache?.board ?? null);
      setBackupBoard(backup?.board ?? null);
      setOutbox(queue);
    })();

    return () => {
      active = false;
    };
  }, [userID]);

  const boardQuery = useQuery({
    queryKey: ['planner-board', userID],
    queryFn: () => api.planner.getBoard(),
    enabled: !!userID,
    staleTime: 15 * 1000,
    retry: 1,
  });

  const tagsQuery = useQuery({
    queryKey: ['tags', userID],
    queryFn: () => api.tags.list(),
    enabled: !!userID,
    retry: 1,
  });

  const goalsQuery = useQuery({
    queryKey: ['goals', userID],
    queryFn: () => api.goals.list(),
    enabled: !!userID,
    retry: 1,
  });

  const taskQuery = useQuery({
    queryKey: ['task', taskID],
    queryFn: () => api.tasks.get(taskID as string),
    enabled: !!userID && isEditMode && !!taskID,
    retry: 1,
  });

  const taskTagsQuery = useQuery({
    queryKey: ['task-tags', taskID],
    queryFn: () => api.tasks.getTags(taskID as string),
    enabled: !!userID && isEditMode && !!taskID,
    retry: 1,
  });

  useEffect(() => {
    if (!boardQuery.data) return;
    setCachedBoard(boardQuery.data);
  }, [boardQuery.data]);

  const effectiveBoard = useMemo(() => {
    return applyOutboxLocally(
      boardQuery.data ?? backupBoard ?? cachedBoard ?? emptyBoard(),
      outbox
    );
  }, [backupBoard, boardQuery.data, cachedBoard, outbox]);

  const tags = tagsQuery.data?.tags || [];
  const goals = goalsQuery.data?.goals || [];
  const initialTagIDs = useMemo(
    () => taskTagsQuery.data?.tags.map((tag) => tag.id) ?? [],
    [taskTagsQuery.data]
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const invalidatePlannerQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['planner-board'] }),
      queryClient.invalidateQueries({ queryKey: ['planner-board', userID] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['task'] }),
      queryClient.invalidateQueries({ queryKey: ['task-tags'] }),
      queryClient.invalidateQueries({ queryKey: ['tags'] }),
      queryClient.invalidateQueries({ queryKey: ['goals'] }),
      queryClient.invalidateQueries({ queryKey: ['wallet'] }),
      queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ]);
  }, [queryClient, userID]);

  const handleSubmit = useCallback(async (values: TaskEditorValues) => {
    if (!userID) return;

    if (isEditMode && taskID) {
      const payload = buildUpdatePayload(values);
      await api.tasks.update(taskID, payload);

      const previousTagIDs = new Set(initialTagIDs);
      const nextTagIDs = new Set(values.selected_tag_ids);
      const tagAdds = values.selected_tag_ids.filter((id) => !previousTagIDs.has(id));
      const tagRemovals = initialTagIDs.filter((id) => !nextTagIDs.has(id));

      await Promise.all([
        ...tagAdds.map((tagID) => api.tasks.addTag(taskID, tagID)),
        ...tagRemovals.map((tagID) => api.tasks.removeTag(taskID, tagID)),
      ]);

      await invalidatePlannerQueries();
      showToast(t('plannerTaskUpdated') || 'Task updated', 'success');
      return;
    }

    const payload = buildCreatePayload(values, effectiveBoard);
    const tempTaskID = createTempTaskID();
    const createOp = await enqueuePlannerOp({
      user_id: userID,
      op_type: 'task_create',
      entity_type: 'task',
      entity_id: tempTaskID,
      payload: { ...payload, local_temp_id: tempTaskID },
    });

    if (createOp && values.selected_tag_ids.length > 0) {
      for (const tagID of values.selected_tag_ids) {
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

    void syncPlannerOutbox(userID);
    showToast(t('plannerTaskCreated') || 'Task created!', 'success');
  }, [
    effectiveBoard,
    initialTagIDs,
    invalidatePlannerQueries,
    isEditMode,
    showToast,
    t,
    taskID,
    userID,
  ]);

  const isLoadingEditor =
    !userID ||
    tagsQuery.isLoading ||
    goalsQuery.isLoading ||
    (isEditMode && (taskQuery.isLoading || taskTagsQuery.isLoading));
  const loadError =
    tagsQuery.error ||
    goalsQuery.error ||
    taskQuery.error ||
    taskTagsQuery.error;

  if (isLoadingEditor) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          paddingHorizontal: 24,
          gap: 14,
        }}
      >
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>
          {t('plannerUpdateError') || 'Could not load task editor'}
        </Text>
        <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
          {loadError instanceof Error ? loadError.message : 'Unknown error'}
        </Text>
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            {
              borderRadius: 12,
              backgroundColor: colors.accent,
              paddingHorizontal: 16,
              paddingVertical: 12,
            },
            pressed && { opacity: 0.78 },
          ]}
        >
          <Text style={{ color: colors.accentForeground, fontFamily: 'Inter_700Bold' }}>
            {t('plannerClose') || 'Close'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <TaskWizardModal
      onClose={handleClose}
      onSubmit={handleSubmit}
      userId={userID}
      tags={tags}
      goals={goals as Goal[]}
      mode={isEditMode ? 'edit' : 'create'}
      initialTask={taskQuery.data?.task ?? null}
      initialTagIDs={initialTagIDs}
    />
  );
}

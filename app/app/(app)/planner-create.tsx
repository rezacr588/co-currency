import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'styled-components/native';
import { api } from '../../src/api';
import { TaskWizardModal } from '../../src/components/features/Planner/TaskWizardModal';
import { useToast } from '../../src/components/ui/Toast';
import { useAuth } from '../../src/context/AuthContext';
import {
  getPlannerBoardCache,
} from '../../src/offline/plannerCache';
import {
  getPlannerBoardBackup,
} from '../../src/offline/plannerBackup';
import {
  enqueuePlannerOp,
  getPlannerOutbox,
} from '../../src/offline/plannerOutbox';
import {
  applyOutboxLocally,
  syncPlannerOutbox,
} from '../../src/offline/plannerSyncEngine';
import { COLUMN_ORDER } from '../../src/utils/plannerConstants';
import { useLanguage } from '../../src/context/LanguageContext';
import type { Goal } from '../../src/types/goal';
import type {
  CreateTaskRequest,
  PlannerBoardResponse,
  TodoItem,
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

export default function PlannerCreateScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  const userID = user?.id || '';

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

  useEffect(() => {
    if (!boardQuery.data) return;
    setCachedBoard(boardQuery.data);
  }, [boardQuery.data]);

  const effectiveBoard = useMemo(() => {
    return applyOutboxLocally(boardQuery.data ?? backupBoard ?? cachedBoard ?? emptyBoard(), outbox);
  }, [backupBoard, boardQuery.data, cachedBoard, outbox]);

  const tags = tagsQuery.data?.tags || [];
  const goals = goalsQuery.data?.goals || [];

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleSubmit = useCallback(async (payload: CreateTaskRequest, tagIds: string[]) => {
    if (!userID) return;

    const tempTaskID = createTempTaskID();
    const createOp = await enqueuePlannerOp({
      user_id: userID,
      op_type: 'task_create',
      entity_type: 'task',
      entity_id: tempTaskID,
      payload: { ...payload, local_temp_id: tempTaskID },
    });

    if (createOp && tagIds.length > 0) {
      for (const tagID of tagIds) {
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
    router.back();
  }, [router, showToast, t, userID]);

  if (!userID) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <TaskWizardModal
      onClose={handleClose}
      onSubmit={handleSubmit}
      userId={userID}
      effectiveBoard={effectiveBoard}
      tags={tags}
      goals={goals as Goal[]}
    />
  );
}

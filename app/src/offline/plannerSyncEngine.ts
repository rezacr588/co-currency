import * as Network from 'expo-network';
import { api } from '../api';
import { GoalFundingRequiredError } from '../api/planner';
import type {
  GoalFundingRequired,
  MovePlannerItemRequest,
  PlannerBoardResponse,
  PlannerPendingMarker,
  PlannerStatus,
  TodoItem,
} from '../types/planner';
import type {
  PlannerGoalMarkDonePayload,
  PlannerOutboxOp,
  PlannerTaskCreatePayload,
  PlannerTaskTagPayload,
} from './plannerOutbox';
import {
  getPlannerOutbox,
  replacePlannerOutbox,
  resolvePlannerEntityID,
  setPlannerTempID,
} from './plannerOutbox';

const MAX_ATTEMPTS = 6;
const MAX_BACKOFF_MS = 60_000;

export interface PlannerSyncResult {
  synced: number;
  failed: number;
  conflicts: number;
  remaining: number;
  is_online: boolean;
  needs_refresh: boolean;
  funding_required: GoalFundingRequired[];
}

function emptyBoard(): PlannerBoardResponse {
  return {
    summary: {
      total: 0,
      todo: 0,
      in_progress: 0,
      done: 0,
      archived: 0,
    },
    columns: [
      { status: 'todo', items: [] },
      { status: 'in_progress', items: [] },
      { status: 'done', items: [] },
      { status: 'archived', items: [] },
    ],
  };
}

function plannerStatusOrder(): PlannerStatus[] {
  return ['todo', 'in_progress', 'done', 'archived'];
}

function asStatus(value: string | undefined): PlannerStatus {
  if (value === 'in_progress' || value === 'done' || value === 'archived') {
    return value;
  }
  return 'todo';
}

function toColumnMap(board: PlannerBoardResponse): Record<PlannerStatus, TodoItem[]> {
  const map: Record<PlannerStatus, TodoItem[]> = {
    todo: [],
    in_progress: [],
    done: [],
    archived: [],
  };

  for (const column of board.columns) {
    map[column.status] = (column.items ?? []).map((item) => ({ ...item }));
  }

  return map;
}

function sortColumn(items: TodoItem[]): TodoItem[] {
  return items
    .slice()
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

function buildBoardFromMap(map: Record<PlannerStatus, TodoItem[]>): PlannerBoardResponse {
  const columns = plannerStatusOrder().map((status) => ({
    status,
    items: sortColumn(map[status]),
  }));

  const summary = {
    total: columns.reduce((acc, column) => acc + column.items.length, 0),
    todo: columns.find((column) => column.status === 'todo')?.items.length ?? 0,
    in_progress: columns.find((column) => column.status === 'in_progress')?.items.length ?? 0,
    done: columns.find((column) => column.status === 'done')?.items.length ?? 0,
    archived: columns.find((column) => column.status === 'archived')?.items.length ?? 0,
  };

  return { columns, summary };
}

function removeItemEverywhere(map: Record<PlannerStatus, TodoItem[]>, entityID: string): void {
  for (const status of plannerStatusOrder()) {
    map[status] = map[status].filter((item) => item.id !== entityID);
  }
}

function findItem(map: Record<PlannerStatus, TodoItem[]>, entityID: string): TodoItem | null {
  for (const status of plannerStatusOrder()) {
    const found = map[status].find((item) => item.id === entityID);
    if (found) {
      return found;
    }
  }
  return null;
}

function materializeTask(payload: PlannerTaskCreatePayload, entityID: string): TodoItem {
  const now = new Date().toISOString();

  return {
    id: entityID,
    type: 'task',
    title: payload.title,
    description: payload.description,
    status: payload.status ?? 'todo',
    priority: payload.priority ?? 'medium',
    sort_order: payload.sort_order ?? Date.now(),
    due_date: payload.due_date,
    goal_id: payload.goal_id,
    transaction_id: payload.transaction_id,
    created_at: now,
    updated_at: now,
    is_pending_sync: true,
  };
}

function applyMove(
  map: Record<PlannerStatus, TodoItem[]>,
  entityID: string,
  nextStatus: PlannerStatus,
  sortOrder: number,
  pendingVerification = false
): void {
  const existing = findItem(map, entityID);
  if (!existing) {
    return;
  }

  removeItemEverywhere(map, entityID);
  map[nextStatus].push({
    ...existing,
    status: nextStatus,
    sort_order: sortOrder,
    pending_verification: pendingVerification,
    is_pending_sync: true,
  });
}

export function applyOutboxLocally(
  board: PlannerBoardResponse | null,
  outbox: PlannerOutboxOp[]
): PlannerBoardResponse {
  const base = board ?? emptyBoard();
  const map = toColumnMap(base);

  for (const op of outbox) {
    if (op.status !== 'pending' && op.status !== 'syncing') {
      continue;
    }

    switch (op.op_type) {
      case 'task_create': {
        if (findItem(map, op.entity_id)) {
          break;
        }
        const task = materializeTask(op.payload as PlannerTaskCreatePayload, op.entity_id);
        map[task.status].push(task);
        break;
      }
      case 'task_update': {
        const task = findItem(map, op.entity_id);
        if (!task || task.type !== 'task') {
          break;
        }
        const payload = op.payload as Record<string, unknown>;
        const nextStatus = asStatus(
          typeof payload.status === 'string' ? payload.status : task.status
        );
        removeItemEverywhere(map, op.entity_id);

        map[nextStatus].push({
          ...task,
          title: typeof payload.title === 'string' ? payload.title : task.title,
          description:
            typeof payload.description === 'string'
              ? payload.description
              : task.description,
          due_date: typeof payload.due_date === 'string' ? payload.due_date : task.due_date,
          goal_id: typeof payload.goal_id === 'string' ? payload.goal_id : task.goal_id,
          priority:
            typeof payload.priority === 'string'
              ? payload.priority
              : task.priority,
          sort_order:
            typeof payload.sort_order === 'number' ? payload.sort_order : task.sort_order,
          status: nextStatus,
          updated_at: new Date().toISOString(),
          is_pending_sync: true,
        });
        break;
      }
      case 'task_delete': {
        removeItemEverywhere(map, op.entity_id);
        break;
      }
      case 'task_complete': {
        const task = findItem(map, op.entity_id);
        if (!task || task.type !== 'task') {
          break;
        }
        applyMove(
          map,
          op.entity_id,
          'done',
          typeof task.sort_order === 'number' ? task.sort_order : Date.now()
        );
        break;
      }
      case 'task_add_tag':
      case 'task_remove_tag':
        break;
      case 'item_move': {
        const payload = op.payload as MovePlannerItemRequest;
        applyMove(map, op.entity_id, payload.status, payload.sort_order);
        break;
      }
      case 'goal_mark_done': {
        applyMove(map, op.entity_id, 'done', Date.now(), true);
        break;
      }
      default:
        break;
    }
  }

  return buildBoardFromMap(map);
}

function opEntityKey(op: PlannerOutboxOp): string {
  return `${op.entity_type}:${op.entity_id}`;
}

export function buildPlannerPendingMarkers(outbox: PlannerOutboxOp[]): Record<string, PlannerPendingMarker> {
  const markers: Record<string, PlannerPendingMarker> = {};

  for (const op of outbox) {
    const key = opEntityKey(op);

    if (op.status === 'pending' || op.status === 'syncing') {
      markers[key] = {
        entity_id: op.entity_id,
        entity_type: op.entity_type,
        is_pending_sync: true,
        pending_verification: op.op_type === 'goal_mark_done',
      };
      continue;
    }

    if (op.status === 'failed') {
      markers[key] = {
        entity_id: op.entity_id,
        entity_type: op.entity_type,
        is_pending_sync: false,
        sync_error: op.last_error,
      };
    }
  }

  return markers;
}

function backoffDelayMs(attemptCount: number): number {
  const exponent = Math.max(0, attemptCount);
  return Math.min(1_000 * 2 ** exponent, MAX_BACKOFF_MS);
}

function normalizeSyncingOps(ops: PlannerOutboxOp[]): PlannerOutboxOp[] {
  return ops.map((op) => {
    if (op.status !== 'syncing') return op;
    return {
      ...op,
      status: 'pending',
    };
  });
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof GoalFundingRequiredError) {
    return false;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('socket') ||
    message.includes('internet')
  );
}

async function executePlannerOp(userID: string, op: PlannerOutboxOp): Promise<{
  ok: boolean;
  defer?: boolean;
  networkError?: boolean;
  conflict?: GoalFundingRequired;
  errorMessage?: string;
}> {
  try {
    let entityID = op.entity_id;

    if (op.op_type !== 'task_create') {
      entityID = await resolvePlannerEntityID(userID, op.entity_id);
      if (entityID.startsWith('temp-task-')) {
        return { ok: false, defer: true };
      }
    }

    switch (op.op_type) {
      case 'task_create': {
        const payload = op.payload as PlannerTaskCreatePayload;
        const response = await api.tasks.create(payload);
        if (op.entity_id.startsWith('temp-task-')) {
          await setPlannerTempID(userID, op.entity_id, response.task.id);
        }
        return { ok: true };
      }
      case 'task_update': {
        await api.tasks.update(entityID, op.payload as Record<string, unknown>);
        return { ok: true };
      }
      case 'task_delete': {
        await api.tasks.remove(entityID);
        return { ok: true };
      }
      case 'task_complete': {
        await api.tasks.complete(entityID);
        return { ok: true };
      }
      case 'task_add_tag': {
        const payload = op.payload as PlannerTaskTagPayload;
        await api.tasks.addTag(entityID, payload.tag_id);
        return { ok: true };
      }
      case 'task_remove_tag': {
        const payload = op.payload as PlannerTaskTagPayload;
        await api.tasks.removeTag(entityID, payload.tag_id);
        return { ok: true };
      }
      case 'item_move': {
        await api.planner.moveItem(op.entity_type, entityID, op.payload as MovePlannerItemRequest);
        return { ok: true };
      }
      case 'goal_mark_done': {
        await api.planner.markGoalDone(entityID);
        return { ok: true };
      }
      default:
        return { ok: true };
    }
  } catch (error) {
    if (error instanceof GoalFundingRequiredError) {
      return {
        ok: false,
        conflict: error.details,
        errorMessage: error.message,
      };
    }

    return {
      ok: false,
      networkError: isNetworkError(error),
      errorMessage: error instanceof Error ? error.message : 'Unknown sync error',
    };
  }
}

export async function isPlannerOnline(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function syncPlannerOutbox(userID: string): Promise<PlannerSyncResult> {
  const online = await isPlannerOnline();
  if (!online) {
    const queue = await getPlannerOutbox(userID);
    return {
      synced: 0,
      failed: 0,
      conflicts: 0,
      remaining: queue.length,
      is_online: false,
      needs_refresh: false,
      funding_required: [],
    };
  }

  let ops = await getPlannerOutbox(userID);
  if (ops.length === 0) {
    return {
      synced: 0,
      failed: 0,
      conflicts: 0,
      remaining: 0,
      is_online: true,
      needs_refresh: false,
      funding_required: [],
    };
  }

  let synced = 0;
  let failed = 0;
  let conflicts = 0;
  let needsRefresh = false;
  const fundingRequired: GoalFundingRequired[] = [];

  const now = Date.now();

  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];

    if (op.status === 'failed') {
      continue;
    }

    if (op.depends_on) {
      const dependency = ops.find((entry) => entry.id === op.depends_on);
      if (dependency) {
        if (dependency.status !== 'failed') {
          continue;
        }

        failed += 1;
        needsRefresh = true;
        ops[index] = {
          ...op,
          status: 'failed',
          attempt_count: op.attempt_count + 1,
          last_error: `Dependency failed (${dependency.op_type}).`,
        };
        await replacePlannerOutbox(userID, ops);
        continue;
      }
    }

    if (op.last_attempt_at && now - op.last_attempt_at < backoffDelayMs(op.attempt_count)) {
      continue;
    }

    const syncingOp: PlannerOutboxOp = {
      ...op,
      status: 'syncing',
      last_attempt_at: Date.now(),
    };

    ops[index] = syncingOp;
    await replacePlannerOutbox(userID, ops);

    const result = await executePlannerOp(userID, syncingOp);

    if (result.ok) {
      ops.splice(index, 1);
      index -= 1;
      synced += 1;
      needsRefresh = true;
      await replacePlannerOutbox(userID, ops);
      continue;
    }

    if (result.defer) {
      ops[index] = {
        ...syncingOp,
        status: 'pending',
      };
      await replacePlannerOutbox(userID, ops);
      continue;
    }

    if (result.networkError) {
      ops[index] = {
        ...syncingOp,
        status: 'pending',
        last_error: result.errorMessage,
      };
      ops = normalizeSyncingOps(ops);
      await replacePlannerOutbox(userID, ops);
      break;
    }

    const nextAttempt = syncingOp.attempt_count + 1;
    const errorMessage = result.errorMessage || 'Sync rejected by server';

    if (result.conflict) {
      conflicts += 1;
      failed += 1;
      needsRefresh = true;
      fundingRequired.push(result.conflict);
      ops[index] = {
        ...syncingOp,
        status: 'failed',
        attempt_count: nextAttempt,
        last_error: errorMessage,
      };
      await replacePlannerOutbox(userID, ops);
      continue;
    }

    if (nextAttempt >= MAX_ATTEMPTS) {
      failed += 1;
      needsRefresh = true;
      ops[index] = {
        ...syncingOp,
        status: 'failed',
        attempt_count: nextAttempt,
        last_error: errorMessage,
      };
      await replacePlannerOutbox(userID, ops);
      continue;
    }

    ops[index] = {
      ...syncingOp,
      status: 'pending',
      attempt_count: nextAttempt,
      last_error: errorMessage,
    };
    await replacePlannerOutbox(userID, ops);
  }

  ops = await getPlannerOutbox(userID);

  return {
    synced,
    failed,
    conflicts,
    remaining: ops.length,
    is_online: true,
    needs_refresh: needsRefresh,
    funding_required: fundingRequired,
  };
}

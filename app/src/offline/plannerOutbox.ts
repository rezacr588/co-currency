import type {
  CreateTaskRequest,
  MovePlannerItemRequest,
  PlannerItemType,
  PlannerStatus,
  UpdateTaskRequest,
} from '../types/planner';
import { readJSON, removeStorage, writeJSON } from '../utils/storage';

const OUTBOX_KEY_PREFIX = '@planner_outbox:';
const TEMP_ID_MAP_KEY_PREFIX = '@planner_temp_to_server_id:';
const MAX_OUTBOX_SIZE = 500;

// Promise-based mutex to serialize all outbox writes and prevent race conditions
let outboxLockPromise: Promise<void> = Promise.resolve();

function withOutboxLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = outboxLockPromise;
  let resolve: () => void;
  outboxLockPromise = new Promise<void>((r) => { resolve = r; });
  return prev.then(fn).finally(() => resolve!());
}

export type PlannerOutboxStatus = 'pending' | 'syncing' | 'failed';

export type PlannerOutboxOpType =
  | 'task_create'
  | 'task_update'
  | 'task_delete'
  | 'task_complete'
  | 'task_add_tag'
  | 'task_remove_tag'
  | 'item_move'
  | 'goal_mark_done';

export type PlannerEntityType = Extract<PlannerItemType, 'task' | 'goal'>;

export interface PlannerTaskCreatePayload extends CreateTaskRequest {
  local_temp_id?: string;
}

export interface PlannerTaskTagPayload {
  tag_id: string;
}

export interface PlannerGoalMarkDonePayload {
  previous_status?: PlannerStatus;
  queued_offline?: boolean;
}

export type PlannerOutboxPayload =
  | PlannerTaskCreatePayload
  | UpdateTaskRequest
  | PlannerTaskTagPayload
  | MovePlannerItemRequest
  | PlannerGoalMarkDonePayload
  | Record<string, never>;

export interface PlannerOutboxOp<TPayload = PlannerOutboxPayload> {
  id: string;
  user_id: string;
  op_type: PlannerOutboxOpType;
  entity_type: PlannerEntityType;
  entity_id: string;
  payload: TPayload;
  created_at: number;
  attempt_count: number;
  last_error?: string;
  status: PlannerOutboxStatus;
  depends_on?: string;
  last_attempt_at?: number;
}

export interface EnqueuePlannerOpInput<TPayload = PlannerOutboxPayload> {
  user_id: string;
  op_type: PlannerOutboxOpType;
  entity_type: PlannerEntityType;
  entity_id: string;
  payload: TPayload;
  depends_on?: string;
}

export interface PlannerOutboxSummary {
  total: number;
  pending: number;
  syncing: number;
  failed: number;
}

type OutboxListener = (ops: PlannerOutboxOp[]) => void;

const listeners = new Map<string, Set<OutboxListener>>();

function outboxKey(userID: string): string {
  return `${OUTBOX_KEY_PREFIX}${userID}`;
}

function tempIDMapKey(userID: string): string {
  return `${TEMP_ID_MAP_KEY_PREFIX}${userID}`;
}

function sortOutbox(ops: PlannerOutboxOp[]): PlannerOutboxOp[] {
  return ops.slice().sort((a, b) => a.created_at - b.created_at);
}

function notify(userID: string, ops: PlannerOutboxOp[]): void {
  const set = listeners.get(userID);
  if (!set) return;
  for (const listener of set) {
    listener(ops);
  }
}

function isPendingLike(status: PlannerOutboxStatus): boolean {
  return status === 'pending' || status === 'syncing';
}

function buildOpID(): string {
  return `planner-op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractTagID(payload: PlannerOutboxPayload): string | null {
  if (!payload || typeof payload !== 'object') return null;
  if ('tag_id' in payload && typeof payload.tag_id === 'string') {
    return payload.tag_id;
  }
  return null;
}

function compactOutboxForInsert(existing: PlannerOutboxOp[], candidate: PlannerOutboxOp): {
  ops: PlannerOutboxOp[];
  addCandidate: boolean;
} {
  const ops = existing.slice();

  // create + delete same temporary task before sync => drop both and dependencies.
  // Only compact 'pending' ops — never touch 'syncing' ops that are in-flight.
  if (candidate.op_type === 'task_delete' && candidate.entity_id.startsWith('temp-task-')) {
    const createOp = ops.find(
      (op) =>
        op.entity_id === candidate.entity_id &&
        op.op_type === 'task_create' &&
        op.status === 'pending'
    );

    if (createOp) {
      const filtered = ops.filter(
        (op) => op.id !== createOp.id && op.depends_on !== createOp.id && (op.entity_id !== candidate.entity_id || op.status === 'syncing')
      );
      return { ops: filtered, addCandidate: false };
    }
  }

  // Keep latest update/move op for same entity (only compact pending, not syncing).
  if (candidate.op_type === 'task_update' || candidate.op_type === 'item_move') {
    const index = ops.findIndex(
      (op) =>
        op.op_type === candidate.op_type &&
        op.entity_type === candidate.entity_type &&
        op.entity_id === candidate.entity_id &&
        op.status === 'pending'
    );
    if (index >= 0) {
      ops.splice(index, 1);
    }
  }

  // Collapse add/remove tag when net operation is no-op (only pending ops).
  if (candidate.op_type === 'task_add_tag' || candidate.op_type === 'task_remove_tag') {
    const tagID = extractTagID(candidate.payload);
    if (tagID) {
      const oppositeType: PlannerOutboxOpType =
        candidate.op_type === 'task_add_tag' ? 'task_remove_tag' : 'task_add_tag';
      const oppositeIndex = ops.findIndex((op) => {
        if (op.status !== 'pending') return false;
        if (op.op_type !== oppositeType) return false;
        if (op.entity_id !== candidate.entity_id) return false;
        return extractTagID(op.payload) === tagID;
      });

      if (oppositeIndex >= 0) {
        ops.splice(oppositeIndex, 1);
        return { ops, addCandidate: false };
      }

      const sameIndex = ops.findIndex((op) => {
        if (op.status !== 'pending') return false;
        if (op.op_type !== candidate.op_type) return false;
        if (op.entity_id !== candidate.entity_id) return false;
        return extractTagID(op.payload) === tagID;
      });

      if (sameIndex >= 0) {
        ops.splice(sameIndex, 1);
      }
    }
  }

  return { ops, addCandidate: true };
}

export async function getPlannerOutbox(userID: string): Promise<PlannerOutboxOp[]> {
  if (!userID) return [];

  const data = await readJSON<PlannerOutboxOp[]>(outboxKey(userID));
  if (!Array.isArray(data)) {
    return [];
  }

  return sortOutbox(data);
}

export async function replacePlannerOutbox(userID: string, ops: PlannerOutboxOp[]): Promise<void> {
  if (!userID) return;
  return withOutboxLock(async () => {
    const sorted = sortOutbox(ops);
    await writeJSON(outboxKey(userID), sorted);
    notify(userID, sorted);
  });
}

export async function enqueuePlannerOp<TPayload = PlannerOutboxPayload>(
  input: EnqueuePlannerOpInput<TPayload>
): Promise<PlannerOutboxOp<TPayload> | null> {
  const { user_id: userID } = input;
  if (!userID) return null;

  return withOutboxLock(async () => {
    const current = await getPlannerOutbox(userID);
    const candidate: PlannerOutboxOp<TPayload> = {
      id: buildOpID(),
      user_id: userID,
      op_type: input.op_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      payload: input.payload,
      created_at: Date.now(),
      attempt_count: 0,
      status: 'pending',
      depends_on: input.depends_on,
    };

    const compacted = compactOutboxForInsert(current, candidate as unknown as PlannerOutboxOp);
    const next = compacted.addCandidate
      ? [...compacted.ops, candidate as unknown as PlannerOutboxOp]
      : compacted.ops;

    if (next.length > MAX_OUTBOX_SIZE) {
      throw new Error('Planner offline queue is full. Please sync pending planner changes first.');
    }

    const sorted = sortOutbox(next);
    await writeJSON(outboxKey(userID), sorted);
    notify(userID, sorted);
    return compacted.addCandidate ? candidate : null;
  });
}

export async function updatePlannerOutboxOp(
  userID: string,
  opID: string,
  updater: (op: PlannerOutboxOp) => PlannerOutboxOp
): Promise<void> {
  if (!userID || !opID) return;

  const ops = await getPlannerOutbox(userID);
  const index = ops.findIndex((op) => op.id === opID);
  if (index < 0) return;

  ops[index] = updater(ops[index]);
  await replacePlannerOutbox(userID, ops);
}

export async function removePlannerOutboxOp(userID: string, opID: string): Promise<void> {
  if (!userID || !opID) return;
  const ops = await getPlannerOutbox(userID);
  const next = ops.filter((op) => op.id !== opID);
  await replacePlannerOutbox(userID, next);
}

export async function retryFailedPlannerOps(userID: string): Promise<void> {
  if (!userID) return;
  return withOutboxLock(async () => {
    const ops = await getPlannerOutbox(userID);
    const next = ops.map((op) => {
      if (op.status !== 'failed') return op;
      return {
        ...op,
        status: 'pending' as const,
        last_error: undefined,
      };
    });
    const sorted = sortOutbox(next);
    await writeJSON(outboxKey(userID), sorted);
    notify(userID, sorted);
  });
}

export async function discardFailedPlannerOps(userID: string): Promise<void> {
  if (!userID) return;
  return withOutboxLock(async () => {
    const ops = await getPlannerOutbox(userID);
    const next = ops.filter((op) => op.status !== 'failed');
    const sorted = sortOutbox(next);
    await writeJSON(outboxKey(userID), sorted);
    notify(userID, sorted);
  });
}

export async function clearPlannerOutbox(userID: string): Promise<void> {
  if (!userID) return;
  await removeStorage(outboxKey(userID));
  notify(userID, []);
}

export async function getPlannerOutboxSummary(userID: string): Promise<PlannerOutboxSummary> {
  const ops = await getPlannerOutbox(userID);

  return {
    total: ops.length,
    pending: ops.filter((op) => op.status === 'pending').length,
    syncing: ops.filter((op) => op.status === 'syncing').length,
    failed: ops.filter((op) => op.status === 'failed').length,
  };
}

export async function getPlannerTempIDMap(userID: string): Promise<Record<string, string>> {
  if (!userID) return {};
  const map = await readJSON<Record<string, string>>(tempIDMapKey(userID));
  return map ?? {};
}

export async function setPlannerTempID(userID: string, tempID: string, serverID: string): Promise<void> {
  if (!userID || !tempID || !serverID) return;

  return withOutboxLock(async () => {
    const map = await getPlannerTempIDMap(userID);
    map[tempID] = serverID;
    await writeJSON(tempIDMapKey(userID), map);
  });
}

export async function resolvePlannerEntityID(userID: string, entityID: string): Promise<string> {
  if (!userID || !entityID) return entityID;

  const map = await getPlannerTempIDMap(userID);
  return map[entityID] ?? entityID;
}

export async function clearPlannerTempIDMap(userID: string): Promise<void> {
  if (!userID) return;
  await removeStorage(tempIDMapKey(userID));
}

export async function cleanupPlannerTempIDMap(userID: string): Promise<void> {
  if (!userID) return;
  const [map, ops] = await Promise.all([getPlannerTempIDMap(userID), getPlannerOutbox(userID)]);
  const referencedTempIDs = new Set(ops.map((op) => op.entity_id));
  const keysToRemove = Object.keys(map).filter((tempID) => !referencedTempIDs.has(tempID));
  if (keysToRemove.length === 0) return;
  for (const key of keysToRemove) delete map[key];
  await writeJSON(tempIDMapKey(userID), map);
}

export function subscribePlannerOutbox(userID: string, listener: OutboxListener): () => void {
  if (!listeners.has(userID)) {
    listeners.set(userID, new Set());
  }

  listeners.get(userID)?.add(listener);

  return () => {
    const set = listeners.get(userID);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(userID);
    }
  };
}

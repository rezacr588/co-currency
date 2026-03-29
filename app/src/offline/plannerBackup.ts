import type { PlannerBoardResponse } from '../types/planner';
import { readJSON, writeJSON } from '../utils/storage';

const BOARD_BACKUP_KEY_PREFIX = '@planner_board_backup:';

// Promise-based mutex to serialize backup writes and prevent race conditions
let backupLockPromise: Promise<void> = Promise.resolve();

function withBackupLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = backupLockPromise;
  let resolve: () => void;
  backupLockPromise = new Promise<void>((r) => { resolve = r; });
  return prev.then(fn).finally(() => resolve!());
}

export interface PlannerBoardBackupPayload {
  board: PlannerBoardResponse;
  updated_at: number;
}

function plannerBoardBackupKey(userID: string): string {
  return `${BOARD_BACKUP_KEY_PREFIX}${userID}`;
}

export async function getPlannerBoardBackup(userID: string): Promise<PlannerBoardBackupPayload | null> {
  if (!userID) return null;
  return readJSON<PlannerBoardBackupPayload>(plannerBoardBackupKey(userID));
}

export async function setPlannerBoardBackup(userID: string, board: PlannerBoardResponse): Promise<void> {
  if (!userID) return;

  return withBackupLock(async () => {
    await writeJSON<PlannerBoardBackupPayload>(plannerBoardBackupKey(userID), {
      board,
      updated_at: Date.now(),
    });
  });
}

export function getPlannerBoardTotal(board: PlannerBoardResponse | null | undefined): number {
  return board?.summary.total ?? 0;
}

function collectSortedItemIDs(board: PlannerBoardResponse): string[] {
  const ids: string[] = [];
  for (const col of board.columns) {
    for (const item of col.items) {
      ids.push(item.id);
    }
  }
  return ids.sort();
}

export function plannerBoardsEqual(
  left: PlannerBoardResponse | null | undefined,
  right: PlannerBoardResponse | null | undefined
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  // Compare summary counts first (fast path)
  if (left.summary.total !== right.summary.total ||
      left.summary.todo !== right.summary.todo ||
      left.summary.in_progress !== right.summary.in_progress ||
      left.summary.done !== right.summary.done ||
      left.summary.archived !== right.summary.archived) {
    return false;
  }
  // Compare item ID sets (order-independent)
  const leftIDs = collectSortedItemIDs(left);
  const rightIDs = collectSortedItemIDs(right);
  if (leftIDs.length !== rightIDs.length) return false;
  for (let i = 0; i < leftIDs.length; i++) {
    if (leftIDs[i] !== rightIDs[i]) return false;
  }
  return true;
}

export function shouldUseLocalPlannerBackup(
  remoteBoard: PlannerBoardResponse | null | undefined,
  localBoard: PlannerBoardResponse | null | undefined,
  backupUpdatedAt?: number,
  remoteFetchTime?: number
): boolean {
  if (getPlannerBoardTotal(remoteBoard) !== 0) return false;
  if (!localBoard || getPlannerBoardTotal(localBoard) === 0) return false;
  // Only prefer local backup if it's newer than the remote fetch
  if (remoteFetchTime && backupUpdatedAt && backupUpdatedAt < remoteFetchTime) return false;
  return true;
}

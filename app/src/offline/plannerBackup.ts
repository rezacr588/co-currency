import type { PlannerBoardResponse } from '../types/planner';
import { readJSON, writeJSON } from '../utils/storage';

const BOARD_BACKUP_KEY_PREFIX = '@planner_board_backup:';

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

  await writeJSON<PlannerBoardBackupPayload>(plannerBoardBackupKey(userID), {
    board,
    updated_at: Date.now(),
  });
}

export function getPlannerBoardTotal(board: PlannerBoardResponse | null | undefined): number {
  return board?.summary.total ?? 0;
}

export function plannerBoardsEqual(
  left: PlannerBoardResponse | null | undefined,
  right: PlannerBoardResponse | null | undefined
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function shouldUseLocalPlannerBackup(
  remoteBoard: PlannerBoardResponse | null | undefined,
  localBoard: PlannerBoardResponse | null | undefined
): boolean {
  return getPlannerBoardTotal(remoteBoard) === 0 && getPlannerBoardTotal(localBoard) > 0;
}

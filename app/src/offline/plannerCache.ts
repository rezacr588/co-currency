import type { GoalFundingRequired, PlannerBoardResponse } from '../types/planner';
import { readJSON, removeStorage, writeJSON } from '../utils/storage';

const BOARD_CACHE_KEY_PREFIX = '@planner_board_cache:';
const FUNDING_REQUIRED_KEY_PREFIX = '@planner_funding_required:';

export interface PlannerBoardCachePayload {
  board: PlannerBoardResponse;
  cached_at: number;
}

export type PlannerFundingRequiredMap = Record<string, GoalFundingRequired>;

function boardCacheKey(userID: string): string {
  return `${BOARD_CACHE_KEY_PREFIX}${userID}`;
}

function fundingRequiredKey(userID: string): string {
  return `${FUNDING_REQUIRED_KEY_PREFIX}${userID}`;
}

export async function getPlannerBoardCache(userID: string): Promise<PlannerBoardCachePayload | null> {
  if (!userID) return null;
  return readJSON<PlannerBoardCachePayload>(boardCacheKey(userID));
}

export async function setPlannerBoardCache(userID: string, board: PlannerBoardResponse): Promise<void> {
  if (!userID) return;

  await writeJSON<PlannerBoardCachePayload>(boardCacheKey(userID), {
    board,
    cached_at: Date.now(),
  });
}

export async function clearPlannerBoardCache(userID: string): Promise<void> {
  if (!userID) return;
  await removeStorage(boardCacheKey(userID));
}

export async function getPlannerFundingRequiredMap(userID: string): Promise<PlannerFundingRequiredMap> {
  if (!userID) return {};
  const map = await readJSON<PlannerFundingRequiredMap>(fundingRequiredKey(userID));
  return map ?? {};
}

export async function setPlannerFundingRequired(
  userID: string,
  details: GoalFundingRequired
): Promise<void> {
  if (!userID) return;

  const current = await getPlannerFundingRequiredMap(userID);
  current[details.goal_id] = details;
  await writeJSON<PlannerFundingRequiredMap>(fundingRequiredKey(userID), current);
}

export async function clearPlannerFundingRequired(userID: string, goalID: string): Promise<void> {
  if (!userID || !goalID) return;

  const current = await getPlannerFundingRequiredMap(userID);
  if (!current[goalID]) {
    return;
  }

  delete current[goalID];
  await writeJSON<PlannerFundingRequiredMap>(fundingRequiredKey(userID), current);
}

export async function clearPlannerFundingRequiredAll(userID: string): Promise<void> {
  if (!userID) return;
  await removeStorage(fundingRequiredKey(userID));
}

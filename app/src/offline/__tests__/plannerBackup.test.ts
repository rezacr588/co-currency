import type { PlannerBoardResponse } from '../../types/planner';
import { getPlannerBoardTotal, plannerBoardsEqual, shouldUseLocalPlannerBackup } from '../plannerBackup';

function makeBoard(total: number): PlannerBoardResponse {
  return {
    summary: {
      total,
      todo: total,
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

describe('plannerBackup helpers', () => {
  it('returns board totals defensively', () => {
    expect(getPlannerBoardTotal(null)).toBe(0);
    expect(getPlannerBoardTotal(undefined)).toBe(0);
    expect(getPlannerBoardTotal(makeBoard(3))).toBe(3);
  });

  it('prefers a local backup when the server comes back empty', () => {
    expect(shouldUseLocalPlannerBackup(makeBoard(0), makeBoard(4))).toBe(true);
    expect(shouldUseLocalPlannerBackup(makeBoard(2), makeBoard(4))).toBe(false);
    expect(shouldUseLocalPlannerBackup(makeBoard(0), makeBoard(0))).toBe(false);
  });

  it('compares planner boards structurally', () => {
    expect(plannerBoardsEqual(makeBoard(2), makeBoard(2))).toBe(true);
    expect(plannerBoardsEqual(makeBoard(2), makeBoard(1))).toBe(false);
  });
});

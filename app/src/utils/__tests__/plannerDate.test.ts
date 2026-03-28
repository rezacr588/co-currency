import { isValidPlannerDueDate, normalizePlannerDueDate } from '../plannerDate';

describe('isValidPlannerDueDate', () => {
  it('accepts YYYY-MM-DD dates', () => {
    expect(isValidPlannerDueDate('2026-03-01')).toBe(true);
  });

  it('accepts ISO timestamps after normalization', () => {
    expect(isValidPlannerDueDate('2026-03-01T10:00:00Z')).toBe(true);
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidPlannerDueDate('2026-02-30')).toBe(false);
  });

  it('allows empty values', () => {
    expect(isValidPlannerDueDate('')).toBe(true);
    expect(isValidPlannerDueDate('   ')).toBe(true);
  });

  it('normalizes ISO timestamps into planner dates', () => {
    expect(normalizePlannerDueDate('2026-03-01T10:00:00Z')).toBe('2026-03-01');
  });
});

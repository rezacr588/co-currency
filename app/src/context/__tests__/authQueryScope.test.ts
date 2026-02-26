import { isAuthScopedQueryKey } from '../AuthContext';

describe('isAuthScopedQueryKey', () => {
  it('matches planner and task related caches', () => {
    expect(isAuthScopedQueryKey(['planner-board', 'user-a'])).toBe(true);
    expect(isAuthScopedQueryKey(['tasks'])).toBe(true);
    expect(isAuthScopedQueryKey(['goals', 'user-b'])).toBe(true);
    expect(isAuthScopedQueryKey(['tags', 'user-b'])).toBe(true);
  });

  it('does not match unrelated caches', () => {
    expect(isAuthScopedQueryKey(['wallet'])).toBe(false);
    expect(isAuthScopedQueryKey(['reports'])).toBe(false);
    expect(isAuthScopedQueryKey([])).toBe(false);
  });
});

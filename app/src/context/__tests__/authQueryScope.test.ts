import { isAuthScopedQueryKey } from '../AuthContext';

// Implementation uses a PUBLIC_QUERY_KEYS allowlist (currencies,
// exchange-rates, news). Every other string-keyed cache is considered
// auth-scoped and is cleared on logout. User-scoped data like wallet,
// reports, planner, goals, tags, tasks must NOT survive a session change.
describe('isAuthScopedQueryKey', () => {
  it('treats planner, task, and other user-scoped caches as auth-scoped', () => {
    expect(isAuthScopedQueryKey(['planner-board', 'user-a'])).toBe(true);
    expect(isAuthScopedQueryKey(['tasks'])).toBe(true);
    expect(isAuthScopedQueryKey(['goals', 'user-b'])).toBe(true);
    expect(isAuthScopedQueryKey(['tags', 'user-b'])).toBe(true);
    expect(isAuthScopedQueryKey(['wallet'])).toBe(true);
    expect(isAuthScopedQueryKey(['reports'])).toBe(true);
  });

  it('does not match the public allowlist or non-string heads', () => {
    expect(isAuthScopedQueryKey(['currencies'])).toBe(false);
    expect(isAuthScopedQueryKey(['exchange-rates', 'USD'])).toBe(false);
    expect(isAuthScopedQueryKey(['news'])).toBe(false);
    expect(isAuthScopedQueryKey([])).toBe(false);
  });
});

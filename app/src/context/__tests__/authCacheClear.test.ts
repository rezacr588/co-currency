import { QueryClient } from '@tanstack/react-query';
import { clearAuthScopedQueries } from '../AuthContext';

describe('clearAuthScopedQueries', () => {
  it('removes all user-scoped caches and preserves only the public allowlist', async () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(['planner-board', 'user-a'], { id: 'planner' });
    queryClient.setQueryData(['tasks'], { id: 'tasks' });
    queryClient.setQueryData(['goals', 'user-a'], { id: 'goals' });
    queryClient.setQueryData(['tags', 'user-a'], { id: 'tags' });
    queryClient.setQueryData(['wallet'], { id: 'wallet' });
    queryClient.setQueryData(['reports'], { id: 'reports' });
    queryClient.setQueryData(['currencies'], { id: 'currencies' });
    queryClient.setQueryData(['exchange-rates', 'USD'], { id: 'rates' });
    queryClient.setQueryData(['news'], { id: 'news' });

    await clearAuthScopedQueries(queryClient);

    // Auth-scoped caches are cleared on logout.
    expect(queryClient.getQueryData(['planner-board', 'user-a'])).toBeUndefined();
    expect(queryClient.getQueryData(['tasks'])).toBeUndefined();
    expect(queryClient.getQueryData(['goals', 'user-a'])).toBeUndefined();
    expect(queryClient.getQueryData(['tags', 'user-a'])).toBeUndefined();
    expect(queryClient.getQueryData(['wallet'])).toBeUndefined();
    expect(queryClient.getQueryData(['reports'])).toBeUndefined();

    // Public caches survive across sessions.
    expect(queryClient.getQueryData(['currencies'])).toEqual({ id: 'currencies' });
    expect(queryClient.getQueryData(['exchange-rates', 'USD'])).toEqual({ id: 'rates' });
    expect(queryClient.getQueryData(['news'])).toEqual({ id: 'news' });
  });
});

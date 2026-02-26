import { QueryClient } from '@tanstack/react-query';
import { clearAuthScopedQueries } from '../AuthContext';

describe('clearAuthScopedQueries', () => {
  it('removes auth-scoped planner caches and keeps unrelated caches', async () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(['planner-board', 'user-a'], { id: 'planner' });
    queryClient.setQueryData(['tasks'], { id: 'tasks' });
    queryClient.setQueryData(['goals', 'user-a'], { id: 'goals' });
    queryClient.setQueryData(['tags', 'user-a'], { id: 'tags' });
    queryClient.setQueryData(['wallet'], { id: 'wallet' });

    await clearAuthScopedQueries(queryClient);

    expect(queryClient.getQueryData(['planner-board', 'user-a'])).toBeUndefined();
    expect(queryClient.getQueryData(['tasks'])).toBeUndefined();
    expect(queryClient.getQueryData(['goals', 'user-a'])).toBeUndefined();
    expect(queryClient.getQueryData(['tags', 'user-a'])).toBeUndefined();
    expect(queryClient.getQueryData(['wallet'])).toEqual({ id: 'wallet' });
  });
});

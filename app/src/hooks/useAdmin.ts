import { useQuery } from '@tanstack/react-query';

import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { isAdminEmail } from '../constants/admin';

const STALE_30_SECONDS = 30 * 1000;

/**
 * Returns true when the authenticated user matches the configured admin email.
 * UI-only check — backend re-verifies on every /admin/* request.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return isAdminEmail(user?.email);
}

/**
 * Operator dashboard query. `enabled` defaults to whether the current user
 * is an admin so non-admins never even fire the request.
 */
export function useAdminOverview(options?: { enabled?: boolean; refetchIntervalMs?: number }) {
  const isAdmin = useIsAdmin();
  const enabled = options?.enabled ?? isAdmin;

  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.admin.getOverview(),
    enabled,
    staleTime: STALE_30_SECONDS,
    refetchInterval: options?.refetchIntervalMs,
  });
}

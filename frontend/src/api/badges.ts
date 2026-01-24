import type { Badge, UserBadge, BadgeProgress, BadgeCheckResult } from '../types/goal';
import { fetchAPI } from './base';

export const badges = {
  list: () => fetchAPI<{ badges: Badge[] }>('/badges'),
  getEarned: () => fetchAPI<{ badges: UserBadge[]; count: number }>('/badges/earned'),
  getProgress: () =>
    fetchAPI<{ progress: BadgeProgress[]; total_badges: number; earned_count: number }>(
      '/badges/progress'
    ),
  check: () => fetchAPI<BadgeCheckResult>('/badges/check', { method: 'POST' }),
};

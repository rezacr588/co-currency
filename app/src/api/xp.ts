import { fetchAPI } from './base';

export interface UserXP {
  user_id: string;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  streak_days: number;
  last_activity_date?: string;
}

export interface XPTransaction {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  source_type?: string;
  source_id?: string;
  created_at: string;
}

export interface LevelInfo {
  level: number;
  title: string;
  xp_required: number;
  xp_to_next: number;
  benefits?: string;
}

export interface DailyReward {
  id: string;
  login_date: string;
  consecutive_days: number;
  xp_awarded: number;
  bonus_awarded: boolean;
}

export interface DailyRewardResponse {
  reward: DailyReward;
  leveled_up: boolean;
  new_level?: number;
  already_claimed: boolean;
}

export const xp = {
  // Get current user's XP and level
  getStats: () => fetchAPI<UserXP>('/xp/stats'),

  // Get XP transaction history
  getHistory: (limit = 20) => fetchAPI<{ transactions: XPTransaction[] }>(`/xp/history?limit=${limit}`),

  // Get level info
  getLevelInfo: (level?: number) =>
    fetchAPI<LevelInfo>(`/xp/level${level ? `?level=${level}` : ''}`),

  // Claim daily reward
  claimDailyReward: () => fetchAPI<DailyRewardResponse>('/xp/daily-reward', { method: 'POST' }),

  // Get daily reward status
  getDailyRewardStatus: () =>
    fetchAPI<{ claimed_today: boolean; consecutive_days: number; next_reward_xp: number }>(
      '/xp/daily-reward/status'
    ),

  // Get leaderboard
  getLeaderboard: (limit = 10) =>
    fetchAPI<{ users: { user_id: string; name: string; total_xp: number; level: number }[] }>(
      `/xp/leaderboard?limit=${limit}`
    ),
};

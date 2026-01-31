export type ChallengeType = 'no_spend' | 'save_amount' | 'reduce_category' | 'streak' | 'limit_daily';
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';
export type UserChallengeStatus = 'active' | 'completed' | 'failed' | 'abandoned';

export interface Challenge {
  id: string;
  name: string;
  description: string;
  type: ChallengeType;
  icon: string;
  difficulty: ChallengeDifficulty;
  duration_days: number;
  target_value?: number;
  target_category?: string;
  target_percentage?: number;
  points_reward: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
}

export interface UserChallenge {
  id: string;
  user_id: string;
  challenge_id: string;
  challenge?: Challenge;
  status: UserChallengeStatus;
  progress: number;
  current_value: number;
  started_at: string;
  completed_at?: string;
  streak_days: number;
  ends_at: string;
}

export interface ChallengeWithUserStatus extends Challenge {
  user_status?: UserChallengeStatus;
  user_progress?: number;
  user_challenge_id?: string;
  ends_at?: string;
}

export interface ChallengeStats {
  total_joined: number;
  total_completed: number;
  total_failed: number;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  completion_rate: number;
  active_challenges: number;
}

export interface JoinChallengeRequest {
  challenge_id: string;
}

export const CHALLENGE_ICONS: Record<string, string> = {
  'ban': 'ban',
  'piggy-bank': 'piggy-bank',
  'coffee': 'coffee',
  'trophy': 'trophy',
  'wallet': 'wallet',
  'utensils': 'utensils',
  'zap': 'zap',
  'shopping-bag': 'shopping-bag',
};

export const DIFFICULTY_COLORS: Record<ChallengeDifficulty, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
};

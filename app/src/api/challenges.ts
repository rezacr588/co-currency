import { fetchAPI } from './base';
import type {
  Challenge,
  UserChallenge,
  ChallengeWithUserStatus,
  ChallengeStats,
  JoinChallengeRequest,
} from '../types/challenge';

export const challenges = {
  // Get all available challenges (public)
  list: () =>
    fetchAPI<{ challenges: Challenge[] }>('/challenges'),

  // Get featured challenges (public)
  getFeatured: () =>
    fetchAPI<{ challenges: Challenge[] }>('/challenges/featured'),

  // Get challenges with user status (authenticated)
  browse: () =>
    fetchAPI<{ challenges: ChallengeWithUserStatus[] }>('/challenges/browse'),

  // Join a challenge
  join: (data: JoinChallengeRequest) =>
    fetchAPI<{ user_challenge: UserChallenge }>('/challenges/join', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get user's active challenges
  getActive: () =>
    fetchAPI<{ challenges: UserChallenge[] }>('/challenges/active'),

  // Get user's challenge history
  getHistory: () =>
    fetchAPI<{ challenges: UserChallenge[] }>('/challenges/history'),

  // Get user's challenge stats
  getStats: () =>
    fetchAPI<{ stats: ChallengeStats }>('/challenges/stats'),

  // Abandon a challenge
  abandon: (challengeId: string) =>
    fetchAPI<void>(`/challenges/${challengeId}/abandon`, {
      method: 'DELETE',
    }),

  // Check progress for all active challenges
  checkProgress: () =>
    fetchAPI<{ message: string }>('/challenges/check-progress', {
      method: 'POST',
    }),
};

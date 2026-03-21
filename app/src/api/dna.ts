/**
 * Financial DNA API Client
 * Handles financial personality profiles and behavioral insights
 */

import { fetchAPI } from './base';

// ============================================================================
// Types
// ============================================================================

export type FinancialArchetype =
  | 'conscious_spender'
  | 'steady_saver'
  | 'impulsive_buyer'
  | 'planful_investor'
  | 'balanced_manager'
  | 'cautious_conserver';

export interface DNADimension {
  name: string;
  score: number; // 0-100
  label: string;
  description: string;
}

export interface FinancialDNA {
  id: string;
  user_id: string;
  archetype: FinancialArchetype;
  archetype_label: string;
  archetype_emoji: string;
  spending_temperament: number;
  planning_horizon: number;
  risk_tolerance: number;
  financial_stress: number;
  impulse_control: number;
  dimensions: DNADimension[];
  strengths: string[];
  growth_areas: string[];
  transactions_analyzed: number;
  analysis_period_days: number;
  confidence_score: number;
  last_updated: string;
  created_at: string;
}

export interface BehavioralInsight {
  id: string;
  user_id: string;
  type: 'pattern' | 'recommendation' | 'alert';
  category: 'spending' | 'timing' | 'emotional' | 'comparative';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  severity: 'low' | 'medium' | 'high';
  data?: Record<string, unknown>;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface InsightsResponse {
  insights: BehavioralInsight[];
  unread_count: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  category: string;
  dimension: string;
  options: string[];
}

// ============================================================================
// API Functions
// ============================================================================

export const dna = {
  /**
   * Get the user's financial DNA profile
   */
  getDNA: () => fetchAPI<FinancialDNA>('/dna'),

  /**
   * Force recalculation of financial DNA
   */
  refreshDNA: () =>
    fetchAPI<FinancialDNA>('/dna/refresh', {
      method: 'POST',
    }),

  /**
   * Get behavioral insights
   */
  getInsights: (limit?: number) =>
    fetchAPI<InsightsResponse>(`/dna/insights${limit ? `?limit=${limit}` : ''}`),

  /**
   * Generate new insights from recent activity
   */
  generateInsights: () =>
    fetchAPI<{ status: string; message: string }>('/dna/insights/generate', {
      method: 'POST',
    }),

  /**
   * Mark an insight as read
   */
  markInsightRead: (insightId: string) =>
    fetchAPI<{ status: string }>('/dna/insights/read', {
      method: 'POST',
      body: JSON.stringify({ insight_id: insightId }),
    }),

  /**
   * Get quiz questions for DNA assessment
   */
  getQuizQuestions: () => fetchAPI<QuizQuestion[]>('/dna/quiz'),
};

export default dna;

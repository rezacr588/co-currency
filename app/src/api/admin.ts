/**
 * Admin API — read-only operator dashboard.
 *
 * Backend gate: server-side `RequireAdmin` middleware compares the
 * authenticated email to ADMIN_EMAIL. Non-admins get 403.
 */

import { fetchAPI } from './base';

export interface AdminAppStats {
  users_total: number;
  users_signed_up_24h: number;
  transactions_total: number;
  transactions_last_24h: number;
  conversions_total: number;
  active_plans: number;
  pending_approvals: number;
  chat_messages_total: number;
  chat_messages_last_24h: number;
}

export interface AdminDBTableSummary {
  name: string;
  rows: number;
}

export interface AdminDBStats {
  size_bytes: number;
  tables: AdminDBTableSummary[];
}

export interface AdminRecentSignup {
  email: string;
  created_at: string;
}

export interface AdminRecentEvents {
  signups: AdminRecentSignup[];
}

export interface AdminOverview {
  generated_at: string;
  app: AdminAppStats;
  db: AdminDBStats;
  recent: AdminRecentEvents;
}

export const admin = {
  getOverview: () => fetchAPI<AdminOverview>('/admin/overview'),
};

export default admin;

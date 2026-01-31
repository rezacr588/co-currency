import { fetchAPI } from './base';

export interface NotificationPreferences {
  budget_alerts: boolean;
  loan_reminders: boolean;
  goal_updates: boolean;
  weekly_recap: boolean;
}

export const notifications = {
  // Register push token with backend
  registerToken: (token: string, platform: string) =>
    fetchAPI<{ success: boolean }>('/notifications/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  // Unregister push token
  unregisterToken: (token: string) =>
    fetchAPI<{ success: boolean }>('/notifications/unregister', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  // Get notification preferences
  getPreferences: () =>
    fetchAPI<{ preferences: NotificationPreferences }>('/notifications/preferences'),

  // Update notification preferences
  updatePreferences: (preferences: Partial<NotificationPreferences>) =>
    fetchAPI<{ preferences: NotificationPreferences }>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    }),

  // Manually trigger budget check (for testing)
  checkBudgets: () =>
    fetchAPI<{ alerts_sent: number }>('/notifications/check-budgets', {
      method: 'POST',
    }),
};

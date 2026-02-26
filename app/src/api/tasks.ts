import { fetchAPI } from './base';
import type { CreateTaskRequest, Task, UpdateTaskRequest } from '../types/planner';
import type { Tag } from '../types/goal';

export const tasks = {
  list: (params?: { status?: string; priority?: string; goal_id?: string; transaction_id?: string }) => {
    const pairs: string[] = [];
    if (params?.status) pairs.push(`status=${encodeURIComponent(params.status)}`);
    if (params?.priority) pairs.push(`priority=${encodeURIComponent(params.priority)}`);
    if (params?.goal_id) pairs.push(`goal_id=${encodeURIComponent(params.goal_id)}`);
    if (params?.transaction_id) pairs.push(`transaction_id=${encodeURIComponent(params.transaction_id)}`);
    const suffix = pairs.length > 0 ? `?${pairs.join('&')}` : '';
    return fetchAPI<{ tasks: Task[] }>(`/tasks${suffix}`);
  },

  get: (id: string) =>
    fetchAPI<{ task: Task }>(`/tasks/${id}`),

  create: (data: CreateTaskRequest) =>
    fetchAPI<{ task: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateTaskRequest) =>
    fetchAPI<{ task: Task }>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  complete: (id: string) =>
    fetchAPI<{ task: Task }>(`/tasks/${id}/complete`, {
      method: 'POST',
    }),

  remove: (id: string) =>
    fetchAPI<{ message: string }>(`/tasks/${id}`, {
      method: 'DELETE',
    }),

  getTags: (id: string) =>
    fetchAPI<{ tags: Tag[] }>(`/tasks/${id}/tags`),

  addTag: (id: string, tag_id: string) =>
    fetchAPI<{ message: string }>(`/tasks/${id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_id }),
    }),

  removeTag: (id: string, tagID: string) =>
    fetchAPI<{ message: string }>(`/tasks/${id}/tags/${tagID}`, {
      method: 'DELETE',
    }),
};

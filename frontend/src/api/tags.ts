import type { Tag, CreateTagRequest } from '../types/goal';
import { fetchAPI } from './base';

export const tags = {
  list: () => fetchAPI<{ tags: Tag[] }>('/tags'),
  create: (data: CreateTagRequest) =>
    fetchAPI<Tag>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/tags/${id}`, {
      method: 'DELETE',
    }),
};

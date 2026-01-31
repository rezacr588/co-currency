import type { Note, CreateNoteRequest, UpdateNoteRequest } from '../types/note';
import { fetchAPI } from './base';

export const notes = {
  list: (query?: string) => {
    const params = query ? `?q=${encodeURIComponent(query)}` : '';
    return fetchAPI<{ notes: Note[] }>(`/notes${params}`);
  },

  get: (id: string) => fetchAPI<{ note: Note }>(`/notes/${id}`),

  getByTransaction: (transactionId: string) =>
    fetchAPI<{ notes: Note[] }>(`/notes/transaction/${transactionId}`),

  create: (data: CreateNoteRequest) =>
    fetchAPI<{ note: Note }>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateNoteRequest) =>
    fetchAPI<{ note: Note }>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/notes/${id}`, {
      method: 'DELETE',
    }),

  togglePin: (id: string) =>
    fetchAPI<{ note: Note }>(`/notes/${id}/pin`, {
      method: 'POST',
    }),

  getColors: () => fetchAPI<{ colors: string[] }>('/notes/colors'),
};

import type { Note, CreateNoteRequest, UpdateNoteRequest } from '../types/note';
import { fetchAPI } from './base';
import { createCRUDApi } from './crud';

const crud = createCRUDApi<
  { notes: Note[] },
  { note: Note },
  CreateNoteRequest,
  { note: Note },
  UpdateNoteRequest
>('/notes');

export const notes = {
  ...crud,

  // Override list to support search query
  list: (query?: string) => {
    const params = query ? `?q=${encodeURIComponent(query)}` : '';
    return fetchAPI<{ notes: Note[] }>(`/notes${params}`);
  },

  getByTransaction: (transactionId: string) =>
    fetchAPI<{ notes: Note[] }>(`/notes/transaction/${transactionId}`),

  togglePin: (id: string) =>
    fetchAPI<{ note: Note }>(`/notes/${id}/pin`, {
      method: 'POST',
    }),

  getColors: () => fetchAPI<{ colors: string[] }>('/notes/colors'),
};

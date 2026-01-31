// Note types
export interface Note {
  id: string;
  user_id: string;
  transaction_id?: string;
  title: string;
  content: string;
  color: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteRequest {
  title: string;
  content?: string;
  color?: string;
  is_pinned?: boolean;
  transaction_id?: string;
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  color?: string;
  is_pinned?: boolean;
  transaction_id?: string;
}

export const NOTE_COLORS = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

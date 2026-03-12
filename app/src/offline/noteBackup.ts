import type { Note } from '../types/note';
import { readJSON, writeJSON } from '../utils/storage';

const NOTES_BACKUP_KEY_PREFIX = '@notes_backup:';

export interface NotesBackupPayload {
  notes: Note[];
  updated_at: number;
}

function notesBackupKey(userID: string): string {
  return `${NOTES_BACKUP_KEY_PREFIX}${userID}`;
}

export async function getNotesBackup(userID: string): Promise<NotesBackupPayload | null> {
  if (!userID) return null;
  return readJSON<NotesBackupPayload>(notesBackupKey(userID));
}

export async function setNotesBackup(userID: string, notes: Note[]): Promise<void> {
  if (!userID) return;

  await writeJSON<NotesBackupPayload>(notesBackupKey(userID), {
    notes,
    updated_at: Date.now(),
  });
}

export function sortNotesByPinnedUpdated(notes: Note[]): Note[] {
  return notes.slice().sort((left, right) => {
    if (left.is_pinned !== right.is_pinned) {
      return left.is_pinned ? -1 : 1;
    }

    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

export function filterNotesByQuery(notes: Note[], query: string): Note[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return notes.slice();

  return notes.filter((note) => {
    const title = note.title.toLowerCase();
    const content = (note.content || '').toLowerCase();
    return title.includes(normalized) || content.includes(normalized);
  });
}

export function findNoteInCollection(notes: Note[], noteID: string): Note | null {
  return notes.find((note) => note.id === noteID) ?? null;
}

export function upsertNoteInCollection(notes: Note[], note: Note): Note[] {
  const next = notes.filter((entry) => entry.id !== note.id);
  next.push(note);
  return next;
}

export function removeNoteFromCollection(notes: Note[], noteID: string): Note[] {
  return notes.filter((note) => note.id !== noteID);
}

export async function getBackupNote(userID: string, noteID: string): Promise<Note | null> {
  if (!userID || !noteID) return null;

  const backup = await getNotesBackup(userID);
  return findNoteInCollection(backup?.notes ?? [], noteID);
}

export async function upsertNoteBackup(userID: string, note: Note): Promise<Note[]> {
  if (!userID) return [];

  const current = (await getNotesBackup(userID))?.notes ?? [];
  const next = upsertNoteInCollection(current, note);
  await setNotesBackup(userID, next);
  return next;
}

export async function removeNoteBackup(userID: string, noteID: string): Promise<Note[]> {
  if (!userID) return [];

  const current = (await getNotesBackup(userID))?.notes ?? [];
  const next = removeNoteFromCollection(current, noteID);
  await setNotesBackup(userID, next);
  return next;
}

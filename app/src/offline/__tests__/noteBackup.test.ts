import type { Note } from '../../types/note';
import {
  filterNotesByQuery,
  findNoteInCollection,
  removeNoteFromCollection,
  sortNotesByPinnedUpdated,
  upsertNoteInCollection,
} from '../noteBackup';

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: overrides.id ?? 'note-1',
    user_id: overrides.user_id ?? 'user-1',
    title: overrides.title ?? 'Title',
    content: overrides.content ?? '',
    color: overrides.color ?? 'default',
    is_pinned: overrides.is_pinned ?? false,
    created_at: overrides.created_at ?? '2026-03-10T10:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-03-10T10:00:00.000Z',
    transaction_id: overrides.transaction_id,
  };
}

describe('noteBackup helpers', () => {
  it('sorts pinned notes first, then by updated_at descending', () => {
    const notes = [
      makeNote({ id: 'a', updated_at: '2026-03-10T10:00:00.000Z' }),
      makeNote({ id: 'b', is_pinned: true, updated_at: '2026-03-09T10:00:00.000Z' }),
      makeNote({ id: 'c', updated_at: '2026-03-11T10:00:00.000Z' }),
    ];

    expect(sortNotesByPinnedUpdated(notes).map((note) => note.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters by title and content case-insensitively', () => {
    const notes = [
      makeNote({ id: 'a', title: 'Weekly Plan', content: 'Ship navbar fixes' }),
      makeNote({ id: 'b', title: 'Ideas', content: 'Persist todo backup locally' }),
    ];

    expect(filterNotesByQuery(notes, 'nav')).toEqual([notes[0]]);
    expect(filterNotesByQuery(notes, 'LOCAL')).toEqual([notes[1]]);
    expect(filterNotesByQuery(notes, '')).toHaveLength(2);
  });

  it('upserts and removes notes by id', () => {
    const first = makeNote({ id: 'a', title: 'Old title' });
    const second = makeNote({ id: 'b', title: 'Keep me' });
    const updated = makeNote({ id: 'a', title: 'New title' });

    const upserted = upsertNoteInCollection([first, second], updated);

    expect(findNoteInCollection(upserted, 'a')?.title).toBe('New title');
    expect(removeNoteFromCollection(upserted, 'b').map((note) => note.id)).toEqual(['a']);
  });
});

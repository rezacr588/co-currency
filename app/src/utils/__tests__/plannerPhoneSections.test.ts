import { buildPlannerPhoneSections } from '../plannerPhoneSections';
import type { TodoItem } from '../../types/planner';

function makeItem(overrides: Partial<TodoItem>): TodoItem {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    type: overrides.type || 'task',
    title: overrides.title || 'Task',
    status: overrides.status || 'todo',
    created_at: overrides.created_at || '2026-03-20T00:00:00Z',
    updated_at: overrides.updated_at || '2026-03-20T00:00:00Z',
    ...overrides,
  };
}

describe('buildPlannerPhoneSections', () => {
  it('groups todo items into overdue, today, upcoming, and no date buckets', () => {
    const items = [
      makeItem({ id: 'overdue', due_date: '2026-03-28', sort_order: 2 }),
      makeItem({ id: 'today', due_date: '2026-03-29', sort_order: 3 }),
      makeItem({ id: 'upcoming', due_date: '2026-03-30', sort_order: 1 }),
      makeItem({ id: 'none', due_date: '', sort_order: 4 }),
    ];

    const sections = buildPlannerPhoneSections(items, 'todo', new Date('2026-03-29T10:00:00Z'));

    expect(sections.map((section) => section.key)).toEqual(['overdue', 'today', 'upcoming', 'no_date']);
    expect(sections[0].items.map((item) => item.id)).toEqual(['overdue']);
    expect(sections[1].items.map((item) => item.id)).toEqual(['today']);
    expect(sections[2].items.map((item) => item.id)).toEqual(['upcoming']);
    expect(sections[3].items.map((item) => item.id)).toEqual(['none']);
  });

  it('collapses done items into one recent section ordered by update time', () => {
    const items = [
      makeItem({ id: 'older', status: 'done', updated_at: '2026-03-28T08:00:00Z' }),
      makeItem({ id: 'newer', status: 'done', updated_at: '2026-03-29T08:00:00Z' }),
    ];

    const sections = buildPlannerPhoneSections(items, 'done', new Date('2026-03-29T10:00:00Z'));

    expect(sections.map((section) => section.key)).toEqual(['recent']);
    expect(sections[0].items.map((item) => item.id)).toEqual(['newer', 'older']);
  });
});

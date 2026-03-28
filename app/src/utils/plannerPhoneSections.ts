import { normalizePlannerDueDate, plannerDueDateToDate } from './plannerDate';
import type { PlannerStatus, TodoItem } from '../types/planner';

export type PlannerPhoneSectionKey = 'overdue' | 'today' | 'upcoming' | 'no_date' | 'recent';

export interface PlannerPhoneSection {
  key: PlannerPhoneSectionKey;
  items: TodoItem[];
}

function compareSortOrder(left: TodoItem, right: TodoItem): number {
  const leftSort = left.sort_order ?? Number.MAX_SAFE_INTEGER;
  const rightSort = right.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (leftSort !== rightSort) {
    return leftSort - rightSort;
  }

  return left.title.localeCompare(right.title);
}

function compareDueDate(left: TodoItem, right: TodoItem): number {
  const leftDue = normalizePlannerDueDate(left.due_date);
  const rightDue = normalizePlannerDueDate(right.due_date);

  if (leftDue && rightDue) {
    if (leftDue !== rightDue) {
      return leftDue.localeCompare(rightDue);
    }
    return compareSortOrder(left, right);
  }

  if (leftDue) return -1;
  if (rightDue) return 1;
  return compareSortOrder(left, right);
}

function compareRecent(left: TodoItem, right: TodoItem): number {
  const leftTime = new Date(left.updated_at || left.created_at).getTime();
  const rightTime = new Date(right.updated_at || right.created_at).getTime();
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return compareSortOrder(left, right);
}

export function buildPlannerPhoneSections(
  items: TodoItem[],
  status: PlannerStatus,
  now: Date = new Date()
): PlannerPhoneSection[] {
  if (status === 'done' || status === 'archived') {
    const recentItems = items.slice().sort(compareRecent);
    return recentItems.length > 0 ? [{ key: 'recent', items: recentItems }] : [];
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const grouped: Record<PlannerPhoneSectionKey, TodoItem[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    no_date: [],
    recent: [],
  };

  for (const item of items) {
    const normalized = normalizePlannerDueDate(item.due_date);
    if (!normalized) {
      grouped.no_date.push(item);
      continue;
    }

    const dueDate = plannerDueDateToDate(normalized);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate.getTime() < today.getTime()) {
      grouped.overdue.push(item);
      continue;
    }

    if (dueDate.getTime() === today.getTime()) {
      grouped.today.push(item);
      continue;
    }

    grouped.upcoming.push(item);
  }

  return (['overdue', 'today', 'upcoming', 'no_date'] as const)
    .map((key) => ({ key, items: grouped[key].slice().sort(compareDueDate) }))
    .filter((section) => section.items.length > 0);
}

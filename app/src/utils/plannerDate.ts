const DUE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePlannerDueDate(value?: string | null): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return '';
  }

  if (DUE_DATE_REGEX.test(normalized)) {
    return normalized;
  }

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function plannerDueDateToDate(value?: string | null): Date {
  const normalized = normalizePlannerDueDate(value);
  if (!normalized) {
    return new Date();
  }

  const [yearRaw, monthRaw, dayRaw] = normalized.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date();
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function isValidPlannerDueDate(value: string): boolean {
  const normalized = normalizePlannerDueDate(value);
  if (!normalized) {
    return true;
  }

  if (!DUE_DATE_REGEX.test(normalized)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = normalized.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

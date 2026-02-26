const DUE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidPlannerDueDate(value: string): boolean {
  const normalized = value.trim();
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

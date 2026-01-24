const isBrowser = typeof window !== 'undefined';

export function readStorage(key: string): string | null {
  if (!isBrowser) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

export function removeStorage(key: string): void {
  if (!isBrowser) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

export function readJSON<T>(key: string): T | null {
  const raw = readStorage(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  try {
    writeStorage(key, JSON.stringify(value));
  } catch {
    // Ignore serialization/storage errors
  }
}

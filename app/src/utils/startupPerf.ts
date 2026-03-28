const startupOrigin = globalThis.performance?.now?.() ?? Date.now();
const startupMarks = new Set<string>();

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function markStartup(name: string): void {
  if (!__DEV__ || startupMarks.has(name)) {
    return;
  }

  startupMarks.add(name);
  const elapsedMs = Math.round(now() - startupOrigin);
  console.log(`[startup] ${name} @ ${elapsedMs}ms`);
}

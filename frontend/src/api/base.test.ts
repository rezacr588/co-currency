import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to isolate module state between tests, so we dynamically import
// the module after resetting mocks each time.

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockFetchResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

// Reset module cache to get fresh module-level state (isRefreshing, tokens, etc.)
let fetchAPI: typeof import('./base').fetchAPI;
let setAuthToken: typeof import('./base').setAuthToken;
let setRefreshToken: typeof import('./base').setRefreshToken;
let getAuthToken: typeof import('./base').getAuthToken;
let setOnAuthError: typeof import('./base').setOnAuthError;

beforeEach(async () => {
  vi.useFakeTimers();
  mockFetch.mockReset();
  (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {});
  (localStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation(() => {});

  // Re-import the module to get fresh state
  vi.resetModules();
  const mod = await import('./base');
  fetchAPI = mod.fetchAPI;
  setAuthToken = mod.setAuthToken;
  setRefreshToken = mod.setRefreshToken;
  getAuthToken = mod.getAuthToken;
  setOnAuthError = mod.setOnAuthError;
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper to properly handle rejected promises with fake timers.
// We start the fetchAPI call, then continuously advance timers while
// waiting for the promise to settle.
async function runUntilSettled<T>(promise: Promise<T>): Promise<T> {
  let settled = false;
  let result: T | undefined;
  let error: unknown;

  promise.then(
    (r) => { settled = true; result = r; },
    (e) => { settled = true; error = e; }
  );

  // Keep advancing timers until the promise settles
  for (let i = 0; i < 50 && !settled; i++) {
    await vi.advanceTimersByTimeAsync(1000);
  }

  if (error) throw error;
  return result as T;
}

describe('Token Refresh Single-Flight', () => {
  it('should send auth token in request header', async () => {
    setAuthToken('test-token');

    const successResponse = mockFetchResponse(200, { data: 'ok' });
    mockFetch.mockResolvedValueOnce(successResponse);

    const result = await runUntilSettled(fetchAPI('/test'));

    expect(result).toEqual({ data: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  it('should attempt token refresh on 401 and retry with new token', async () => {
    setAuthToken('old-token');
    setRefreshToken('refresh-token-123');

    // First call: 401
    const unauthorizedResponse = mockFetchResponse(401, { error: 'Unauthorized' });
    // Refresh call: success
    const refreshResponse = mockFetchResponse(200, {
      token: 'new-token',
      refresh_token: 'new-refresh-token',
      user: { id: '1', email: 'test@test.com' },
    });
    // Retry call after successful refresh: success
    const successResponse = mockFetchResponse(200, { data: 'success' });

    mockFetch
      .mockResolvedValueOnce(unauthorizedResponse)
      .mockResolvedValueOnce(refreshResponse)
      .mockResolvedValueOnce(successResponse);

    const result = await runUntilSettled(fetchAPI('/protected'));

    expect(result).toEqual({ data: 'success' });
    // Verify the refresh call was made
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refresh_token: 'refresh-token-123' }),
      })
    );
  });

  it('concurrent 401 responses should only trigger ONE refresh call', async () => {
    setAuthToken('old-token');
    setRefreshToken('valid-refresh');

    let refreshCallCount = 0;

    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/v1/auth/refresh') {
        refreshCallCount++;
        return mockFetchResponse(200, {
          token: 'new-token',
          refresh_token: 'new-refresh',
          user: { id: '1', email: 'test@test.com' },
        });
      }

      // Check if we have the new token (after refresh)
      const token = getAuthToken();
      if (token === 'new-token') {
        return mockFetchResponse(200, { data: 'ok' });
      }
      return mockFetchResponse(401, { error: 'Unauthorized' });
    });

    // Fire two concurrent requests that both get 401
    const p1 = fetchAPI('/endpoint-a');
    const p2 = fetchAPI('/endpoint-b');

    const [result1, result2] = await Promise.all([
      runUntilSettled(p1),
      runUntilSettled(p2),
    ]);

    expect(result1).toEqual({ data: 'ok' });
    expect(result2).toEqual({ data: 'ok' });

    // Only ONE refresh call should have been made despite two concurrent 401s
    expect(refreshCallCount).toBe(1);
  });

  it('should clear tokens and call auth error callback when refresh fails', async () => {
    setAuthToken('old-token');
    setRefreshToken('expired-refresh');

    const authErrorCallback = vi.fn();
    setOnAuthError(authErrorCallback);

    // Provide 401 for all calls - refresh also fails
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/v1/auth/refresh') {
        return mockFetchResponse(401, { error: 'Invalid refresh token' });
      }
      return mockFetchResponse(401, { error: 'Unauthorized' });
    });

    let caughtError: Error | null = null;
    try {
      await runUntilSettled(fetchAPI('/protected'));
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('Session expired. Please log in again.');

    // Auth error callback should have been called
    expect(authErrorCallback).toHaveBeenCalled();
  });

  it('should not retry on 4xx errors other than 401', async () => {
    mockFetch.mockResolvedValue(mockFetchResponse(400, { error: 'Bad request' }));

    let caughtError: Error | null = null;
    try {
      await runUntilSettled(fetchAPI('/bad'));
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('Bad request');

    // Should only be called once (400 is a 4xx that hits the "don't retry" branch)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not attempt refresh when no refresh token exists', async () => {
    setAuthToken('some-token');
    // No refresh token set

    mockFetch.mockResolvedValue(mockFetchResponse(401, { error: 'Unauthorized' }));

    let caughtError: Error | null = null;
    try {
      await runUntilSettled(fetchAPI('/protected'));
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('Session expired. Please log in again.');

    // Verify no refresh endpoint was called
    for (const call of mockFetch.mock.calls) {
      expect(call[0]).not.toBe('/api/v1/auth/refresh');
    }
  });
});

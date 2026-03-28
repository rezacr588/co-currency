import {
  isAuthErrorMessage,
  isNetworkError,
  resolveAuthBootstrapFailure,
} from '../authBootstrap';

describe('authBootstrap helpers', () => {
  it('detects auth failures', () => {
    expect(isAuthErrorMessage('401 Unauthorized')).toBe(true);
    expect(isAuthErrorMessage('Session expired')).toBe(true);
    expect(isAuthErrorMessage('Network request failed')).toBe(false);
  });

  it('detects network failures', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('Network timeout'))).toBe(true);
    expect(isNetworkError(new Error('Unauthorized'))).toBe(false);
  });

  it('clears the session on auth errors', () => {
    expect(resolveAuthBootstrapFailure(new Error('401 Unauthorized'), true)).toBe('clear_session');
    expect(resolveAuthBootstrapFailure(new Error('Session expired'), false)).toBe('clear_session');
  });

  it('keeps the cached profile on transient network failures', () => {
    expect(resolveAuthBootstrapFailure(new TypeError('Failed to fetch'), true)).toBe(
      'keep_cached_profile'
    );
    expect(resolveAuthBootstrapFailure(new Error('network timeout'), true)).toBe(
      'keep_cached_profile'
    );
  });

  it('falls back to unauthenticated when no cache can be trusted', () => {
    expect(resolveAuthBootstrapFailure(new TypeError('Failed to fetch'), false)).toBe(
      'unauthenticated'
    );
    expect(resolveAuthBootstrapFailure(new Error('Unexpected server error'), false)).toBe(
      'unauthenticated'
    );
  });
});

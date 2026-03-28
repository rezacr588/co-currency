export type AuthBootstrapFailureAction =
  | 'clear_session'
  | 'keep_cached_profile'
  | 'unauthenticated';

export function isAuthErrorMessage(message?: string): boolean {
  if (!message) return false;

  return (
    message.includes('Session expired') ||
    message.includes('401') ||
    message.includes('Unauthorized')
  );
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('network') || message.includes('fetch') || message.includes('timeout');
}

export function resolveAuthBootstrapFailure(
  error: unknown,
  hasCachedProfile: boolean
): AuthBootstrapFailureAction {
  const message = error instanceof Error ? error.message : String(error);

  if (isAuthErrorMessage(message)) {
    return 'clear_session';
  }

  if (hasCachedProfile && isNetworkError(error)) {
    return 'keep_cached_profile';
  }

  return 'unauthenticated';
}

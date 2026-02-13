/**
 * Validates that a string has the structure of a JWT token.
 * A JWT consists of 3 dot-separated base64url segments (header.payload.signature).
 */
export function isValidJWT(token: string): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  // Each part must be non-empty and contain only valid base64url characters
  const base64urlPattern = /^[A-Za-z0-9_-]+$/;
  return parts.every((part) => part.length > 0 && base64urlPattern.test(part));
}

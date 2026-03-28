import {
  getOAuthCallbackParams,
  getOAuthCallbackParamsFromUrl,
  hasOAuthCallbackQueryParams,
  isOAuthCallbackUrl,
} from '../oauth';

describe('oauth callback helpers', () => {
  it('recognizes native custom-scheme callback urls', () => {
    expect(isOAuthCallbackUrl('coai://auth/google/callback#token=header.payload.sig')).toBe(true);
    expect(isOAuthCallbackUrl('coai://auth/linkedin/callback?error=Access%20denied')).toBe(true);
  });

  it('parses hash tokens from native callback urls', () => {
    expect(
      getOAuthCallbackParamsFromUrl(
        'coai://auth/google/callback#token=header.payload.sig&refresh_token=refresh-123'
      )
    ).toEqual({
      path: '/auth/google/callback',
      token: 'header.payload.sig',
      refreshToken: 'refresh-123',
      error: undefined,
    });
  });

  it('parses error query params from native callback urls', () => {
    expect(
      getOAuthCallbackParamsFromUrl('coai://auth/linkedin/callback?error=Access%20denied')
    ).toEqual({
      path: '/auth/linkedin/callback',
      token: undefined,
      refreshToken: undefined,
      error: 'Access denied',
    });
  });

  it('falls back to router query params when the current url has no tokens', () => {
    expect(
      getOAuthCallbackParams({
        url: 'coai://auth/google/callback',
        queryParams: {
          token: 'header.payload.sig',
          refresh_token: 'refresh-456',
        },
      })
    ).toEqual({
      path: '/auth/google/callback',
      token: 'header.payload.sig',
      refreshToken: 'refresh-456',
      error: undefined,
    });
  });

  it('detects whether router params contain oauth callback data', () => {
    expect(hasOAuthCallbackQueryParams({ token: 'header.payload.sig' })).toBe(true);
    expect(hasOAuthCallbackQueryParams({ refresh_token: ['refresh-789'] })).toBe(true);
    expect(hasOAuthCallbackQueryParams({})).toBe(false);
  });

  it('ignores non-callback urls', () => {
    expect(isOAuthCallbackUrl('coai://profile')).toBe(false);
    expect(getOAuthCallbackParamsFromUrl('coai://profile')).toBeNull();
  });
});

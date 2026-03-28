export interface OAuthCallbackQueryParams {
  token?: string | string[];
  refresh_token?: string | string[];
  error?: string | string[];
}

export interface OAuthCallbackParams {
  path?: string;
  token?: string;
  refreshToken?: string;
  error?: string;
}

const OAUTH_CALLBACK_PATHS = [
  '/auth/google/callback',
  '/auth/linkedin/callback',
] as const;

function normalizePath(path: string): string {
  if (!path) return '/';
  const normalized = path.replace(/\/+/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value || undefined;
  }

  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === 'string' && first ? first : undefined;
  }

  return undefined;
}

function isKnownCallbackPath(path: string): boolean {
  return OAUTH_CALLBACK_PATHS.includes(path as (typeof OAUTH_CALLBACK_PATHS)[number]);
}

function buildCallbackPath(parsed: URL): string | null {
  const directPath = normalizePath(parsed.pathname || '/');
  if (isKnownCallbackPath(directPath)) {
    return directPath;
  }

  // Custom schemes like coai://auth/google/callback use "auth" as host.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.host) {
    const customSchemePath = normalizePath(`/${parsed.host}${parsed.pathname || ''}`);
    if (isKnownCallbackPath(customSchemePath)) {
      return customSchemePath;
    }
  }

  return null;
}

function getParamValue(
  primaryParams: URLSearchParams | null,
  fallbackParams: URLSearchParams | null,
  key: string
): string | undefined {
  return primaryParams?.get(key) ?? fallbackParams?.get(key) ?? undefined;
}

function parseFallbackUrl(url: string): OAuthCallbackParams | null {
  const [beforeHash, hash = ''] = url.split('#', 2);
  const [pathPart, query = ''] = beforeHash.split('?', 2);
  const normalizedPath = normalizePath(pathPart);

  if (!isKnownCallbackPath(normalizedPath)) {
    return null;
  }

  const hashParams = hash ? new URLSearchParams(hash) : null;
  const queryParams = query ? new URLSearchParams(query) : null;

  return {
    path: normalizedPath,
    token: getParamValue(hashParams, queryParams, 'token'),
    refreshToken: getParamValue(hashParams, queryParams, 'refresh_token'),
    error: getParamValue(hashParams, queryParams, 'error'),
  };
}

export function isOAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    return buildCallbackPath(new URL(url)) !== null;
  } catch {
    return parseFallbackUrl(url) !== null;
  }
}

export function hasOAuthCallbackQueryParams(
  queryParams: OAuthCallbackQueryParams | null | undefined
): boolean {
  if (!queryParams) return false;

  return Boolean(
    firstString(queryParams.token) ||
      firstString(queryParams.refresh_token) ||
      firstString(queryParams.error)
  );
}

export function getOAuthCallbackParamsFromQueryParams(
  queryParams: OAuthCallbackQueryParams | null | undefined
): OAuthCallbackParams | null {
  if (!queryParams) return null;

  const token = firstString(queryParams.token);
  const refreshToken = firstString(queryParams.refresh_token);
  const error = firstString(queryParams.error);

  if (!token && !refreshToken && !error) {
    return null;
  }

  return {
    token,
    refreshToken,
    error,
  };
}

export function getOAuthCallbackParamsFromUrl(
  url: string | null | undefined
): OAuthCallbackParams | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const path = buildCallbackPath(parsed);

    if (!path) {
      return null;
    }

    const hashParams = parsed.hash ? new URLSearchParams(parsed.hash.slice(1)) : null;
    const queryParams = parsed.search ? parsed.searchParams : null;

    return {
      path,
      token: getParamValue(hashParams, queryParams, 'token'),
      refreshToken: getParamValue(hashParams, queryParams, 'refresh_token'),
      error: getParamValue(hashParams, queryParams, 'error'),
    };
  } catch {
    return parseFallbackUrl(url);
  }
}

export function getOAuthCallbackParams(input: {
  url?: string | null;
  queryParams?: OAuthCallbackQueryParams | null;
}): OAuthCallbackParams | null {
  const fromUrl = getOAuthCallbackParamsFromUrl(input.url);
  const fromQuery = getOAuthCallbackParamsFromQueryParams(input.queryParams);

  if (!fromUrl) {
    return fromQuery;
  }

  return {
    path: fromUrl.path,
    token: fromUrl.token ?? fromQuery?.token,
    refreshToken: fromUrl.refreshToken ?? fromQuery?.refreshToken,
    error: fromUrl.error ?? fromQuery?.error,
  };
}

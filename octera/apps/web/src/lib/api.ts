/**
 * Minimal typed API client for the web app.
 *
 * Design notes:
 * - The access token lives in memory only (never localStorage — XSS-hostile).
 * - The refresh token is an httpOnly cookie set by the API; the browser sends
 *   it automatically on /v1/auth/refresh calls with `credentials: 'include'`.
 * - On a 401, we try refresh exactly once, then retry the original request.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  /** Skip the auto-refresh-on-401 behavior. Used internally. */
  _skipRefresh?: boolean;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, auth = true, _skipRefresh, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (auth && accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include', // always include, so refresh cookie rides along
  });

  if (res.status === 401 && auth && !_skipRefresh) {
    // Try a single refresh, then retry.
    const refreshed = await tryRefresh();
    if (refreshed) {
      return api<T>(path, { ...options, _skipRefresh: true });
    }
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error ?? 'unknown_error',
      json?.message ?? res.statusText,
      json?.details
    );
  }

  return json as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

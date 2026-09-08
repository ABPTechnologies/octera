/**
 * CID Global client + profile surface (server-side, app-agnostic).
 *
 * Ported from octera-core / @pex/identity. CID Global owns the canonical KYC
 * level + verified flag; our local User.{cidId,kycLevel,verified} columns are a
 * CACHE refreshed via syncCidProfile (services/auth.service.ts). CID trusts SIO
 * tokens, so the same Keycloak access token authenticates here.
 */
export class CidApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CidApiError';
  }
}

export type KycLevelNum = 0 | 1 | 2 | 3;

export interface CidProfile {
  cidId: string;
  keycloakId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  kycLevel: KycLevelNum;
  verified: boolean;
  createdAt: string;
}

export interface CidClientConfig {
  /** Base URL (e.g. https://api.cidglobal.com). Trailing slash trimmed. */
  baseUrl: string;
}

export function createCidClient(config: CidClientConfig) {
  const baseV1 = `${config.baseUrl.replace(/\/$/, '')}/v1`;

  async function cidRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    accessToken: string,
  ): Promise<T> {
    if (!accessToken) {
      throw new CidApiError(401, 'unauthenticated', 'No Keycloak access token');
    }
    const res = await fetch(baseV1 + path, {
      method,
      headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 204) return undefined as T;
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    const data = contentType.includes('application/json') && text ? JSON.parse(text) : text;
    if (!res.ok) {
      const code =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : 'http_error';
      throw new CidApiError(res.status, code, `${method} ${path} → ${res.status}`);
    }
    return data as T;
  }

  return {
    /** GET /v1/me — caller's CID profile. */
    async fetchProfile(accessToken: string): Promise<CidProfile> {
      const { profile } = await cidRequest<{ profile: CidProfile }>('GET', '/me', accessToken);
      return profile;
    },
  };
}

export type CidClient = ReturnType<typeof createCidClient>;

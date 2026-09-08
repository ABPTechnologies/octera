/**
 * SignInOnce / Keycloak token verifier (stateless, app-agnostic).
 *
 * Ported from octera-core / @pex/identity — every estate backend verifies SIO
 * access tokens against the realm JWKS, never by calling SIO per request. Any
 * throw here = 401. Canonical contract: AI Projects/TradeUnity/SIO_CID_INTEGRATION.md.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/** Subset of Keycloak access-token claims this codebase consumes. */
export interface KeycloakClaims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  realm_access?: { roles: string[] };
  /** Authorized party — Keycloak puts the originating client_id here. */
  azp?: string;
}

export interface KeycloakConfig {
  issuer: string;
  /** KEYCLOAK_AUDIENCE if the realm puts the platform name in `aud`, else client_id. */
  audience: string;
}

/** Cache JWKS handles per-issuer so we don't refetch the realm certs each verify. */
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(issuer: string) {
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
    jwksByIssuer.set(issuer, jwks);
  }
  return jwks;
}

/**
 * Verify a Keycloak-issued access token against the realm's JWKS.
 * Throws on signature, expiry, or issuer/audience mismatch — treat as 401.
 * A small clockTolerance absorbs host drift.
 */
export async function verifyKeycloakToken(
  token: string,
  config: KeycloakConfig,
): Promise<KeycloakClaims> {
  const { payload } = await jwtVerify(token, getJwks(config.issuer), {
    issuer: config.issuer,
    audience: config.audience,
    clockTolerance: 5,
  });
  return payload as KeycloakClaims;
}

/** Realm roles array as an O(1) lookup set. */
export function rolesFromClaims(claims: KeycloakClaims): Set<string> {
  return new Set(claims.realm_access?.roles ?? []);
}

/**
 * Generic realm-role → app-role mapper. Pass the precedence list (highest first)
 * and realm-role → app-role pairs; returns the most-privileged match or fallback.
 */
export function mapRoleFromClaims<T extends string>(
  claims: KeycloakClaims,
  mapping: ReadonlyArray<readonly [string, T]>,
  fallback: T,
): T {
  const roles = rolesFromClaims(claims);
  for (const [realmRole, appRole] of mapping) {
    if (roles.has(realmRole)) return appRole;
  }
  return fallback;
}

# Code/octera (portal API) — SignInOnce + CID auth migration

Moves the portal API off local JWT onto the estate-standard **SignInOnce (Keycloak
realm `signinonce`) + CID Global**, mirroring the sibling `octera-core`. Done as a
**dual-mode, env-gated** change: additive, and OFF until `KEYCLOAK_ISSUER` is set —
so nothing breaks and the legacy local login keeps working through the transition.

## How it works
`authenticate` / `requireRole` now resolve a caller two ways (same `req.user` shape,
plus a full `req.authUser`):
1. **SIO Bearer** (preferred when `KEYCLOAK_ISSUER` is set) — verified against the
   realm JWKS (`lib/keycloak.ts`, `jose`), then `findOrProvisionUser` + lazy
   `syncCidProfile`.
2. **Legacy local JWT** — the transition fallback (HS256 against `JWT_SECRET`), so
   existing sessions + `/auth/login` keep working until the web is on SIO.
`KEYCLOAK_ISSUER` blank → local-only (no behaviour change).

**Transition-safe provisioning:** `findOrProvisionUser` links a SIO login to an
EXISTING local user with the same email (sets `keycloakId`) instead of duplicating
— so your current operators/customers keep their row + data on first SIO login.

## Files (additive; edits .bak'd)
- NEW `apps/api/src/lib/keycloak.ts` — JWKS token verifier + role mapper (ported).
- NEW `apps/api/src/lib/cid.ts` — CID Global client (`GET /v1/me`).
- `apps/api/src/services/auth.service.ts` (.bak) — `findOrProvisionUser` (email-link) + `syncCidProfile` (lazy CID cache, never throws into the request).
- `apps/api/src/middleware/auth.ts` (.bak) — dual-mode `authenticate`/`requireRole`; keeps `@fastify/jwt` for the local path + `/login` signing; adds `req.authUser`/`claims`.
- `apps/api/src/lib/env.ts` (.bak) — `KEYCLOAK_ISSUER/AUDIENCE/CLIENT_ID/ADMIN_ROLE`, `AUTH_DEV_BYPASS`, `CID_API_URL`.
- `packages/db/prisma/schema.prisma` (.bak) — `User`: `passwordHash` → nullable; add `keycloakId @unique`, `cidId`, `kycLevel`, `verified`, `cidSyncedAt`.
- `apps/api/package.json` (.bak) — `jose@^5.9.6` (matches octera-core).

## Env (portal API)
```
KEYCLOAK_ISSUER=https://sso.signinonce.com/realms/signinonce   # blank → local-only (default)
KEYCLOAK_CLIENT_ID=octera-portal          # this portal's realm client (register it)
KEYCLOAK_AUDIENCE=                          # only if the realm puts a platform name in aud
KEYCLOAK_ADMIN_ROLE=octera-admin            # realm role → UserRole.ADMIN
CID_API_URL=https://api.cidglobal.com       # blank → CID sync skipped (auth still works)
AUTH_DEV_BYPASS=false                        # local dev only (X-Dev-User header)
```
Role map: `octera-admin→ADMIN`, `octera-broker→BROKER`, `octera-client→CLIENT`, else `USER`.

## Go-live steps (yours)
1. `pnpm install` (pulls `jose`).
2. **Register the `octera-portal` client** in the live `signinonce` realm (redirect for the
   portal web), + the `octera-admin`/`octera-broker`/`octera-client` realm roles if not present.
3. `pnpm --filter @octera/db db:generate` (regenerate the client for the new User fields) then
   `db:migrate` (adds the columns; `passwordHash` widens to nullable — safe).
4. `pnpm --filter @octera/api typecheck && build` — **this is the real type-check** (a Prisma
   schema change can't be verified on the offline sandbox; the two new lib files were tsc-clean
   against jose, and the rest mirrors octera-core's verified pattern).
5. Set the env above; deploy. Local login still works until you cut the web over.

## Verification (sandbox)
`lib/keycloak.ts` + `lib/cid.ts` → `tsc --noEmit` against jose = **0 errors**. The
schema/middleware/service edits need the regenerated Prisma client (step 3) + your build.

## Follow-up (next increment, not in this change)
- **Web side:** `apps/web/src/lib/auth-context.tsx` still uses the local login form + token
  storage. Move it to the SIO OIDC redirect flow (like `web-vaiox`/`web-ordersignup`) so users
  actually sign in via SignInOnce. The API already accepts SIO Bearer tokens.
- Backfill/link existing users (they link automatically by email on first SIO login; or a
  one-off script if you want them linked ahead of time).
- Once the web is on SIO + users linked, retire the local `/auth/{signup,login,refresh,change-password}` routes + the local `@fastify/jwt` fallback.

# Current release: Azure SPA integration, access not configured

As of 2026-10-30, the Pages entry point is the exact built output of `frontend-auth/`. The former root `src/` and tests remain preserved as historical cookie/BFF preparation, not the active authentication implementation. Build the current candidate with `cd frontend-auth && npm ci && npm test && npm run lint && npm run build`, then copy its `dist` files to `docs`. Existing historical assets and security documentation are retained; the current index references only the new build.

The new UI integrates official Microsoft MSAL Authorization Code + PKCE, server-verified bearer access tokens, exact-envelope idempotent recovery, authenticated backup/instructions/restore, and a fail-closed login gate. `docs/dotboard-config.json` deliberately contains provider `unconfigured` and empty settings. No real identity provider, API endpoint, Cosmos connection, private workspace, or credentials are published. This is **not a completed usable Azure deployment**. See [current integration and limitations](frontend-auth/README.md).

This explicitly differs from the historical HttpOnly-cookie/BFF proposal below. Official MSAL redirect uses sessionStorage; memoryStorage is unsupported for that redirect flow. Tokens are managed by MSAL, not manually persisted as a shortcut. The XSS/token-cache tradeoff and real provider/API authorization must be independently reviewed before enabling live access. No cookie/CSRF guarantees are claimed for the new bearer design. Historical source is retained for traceability.

Local verification: 36 tests, TypeScript/Vite production build and lint pass; dependency audit reports zero known vulnerabilities at preparation time. These do not certify live login, browser accessibility, Azure/Cosmos deployment or data migration.

---

## Historical preparation (superseded active client contract)

# DotBoard public web

Frontend-only React/Vite extraction of the existing DotBoard interface. **This is a prepared frontend, not a complete deployed application.** The authenticated backend and identity provider are not wired yet. With API configuration empty, the public page explicitly says access is not configured; it does not collect passwords, fetch boards, or show demo data as real data.

## Separation and privacy

This repository contains UI, public request types, browser transport, synthetic tests and build configuration only. It has no API server, database code, workspace seed, real board IDs/data, credentials, private source history or hosting credentials. The backend remains in a separate private repository. Public source does not imply public workspace access.

The intended model has separate human and assistant identities with audited actors and membership in one shared authorized workspace. Future boards belong to that workspace. These are backend requirements, not a client-side permission grant. No account or credential is created here.

## Build

Node 22.13+; dependencies pinned in package-lock.json.

- `npm ci`
- `npm test`
- `npm run build`

GitHub Pages base is `/dotboard-web/`. Serve only the generated static assets from `dist`, or an exact copy of those assets in the GitHub Pages `main/docs` subtree. A public security document may also remain there. Never copy source/test outputs, `.git`, private files or secrets into the served subtree. `VITE_API_BASE_URL` is optional and public: an HTTPS API origin without paths, credentials, query or fragment. Do not set it until the backend/auth flow is independently verified. Never place keys or tokens in any VITE variable.

## API integration contract, not live implementation

- GET `/api/session`: either 401/403, or `{ authenticated: true, actor: { id, displayName }, workspaceId, csrfToken }`.
- Backend sets and verifies secure HttpOnly session cookie. Browser uses credentials include and no cache. Backend must enforce exact Origin/CORS, membership on every request and CSRF for mutations.
- All POST requests attach session-supplied `X-CSRF-Token`. Identity/Cosmos keys are never supplied by client. Cookies and CSRF are not stored by this UI in localStorage/sessionStorage.
- GET `/auth/login?return_to=...`: actual managed login on backend, with strict server-side redirect allowlist for the public app URL. No fake login or public account signup in frontend.
- POST `/auth/logout`: verified session/CSRF, server invalidates session. On failure the UI clears local rendered data but explicitly reports server logout unconfirmed.
- Existing `/api/workspace` compatibility endpoints remain required for UI CRUD, backup, restore and instruction history. The separate C# prototype does not yet implement all of them. Do not point at an incomplete prototype and call integration complete.
- 401/403 clears rendered workspace. Unknown users never receive workspace data from backend.

GitHub Pages (`github.io`) and Azure (`azurewebsites.net`) are cross-site. Browser third-party-cookie policies may block this cookie session even with `SameSite=None; Secure`. Before claiming usable integration, use approved same-site frontend/API routing or an explicitly reviewed authentication approach. Do not weaken CORS/CSRF, bypass browser privacy protections or persist bearer tokens as a shortcut. Client tests do not prove cookie deployment works. The transport alone is not an authentication system.

## Verification

21 transport/public-boundary tests pass, and TypeScript plus Vite production build pass with existing installed dependencies. These validate client contracts and static build only, not real login/Cosmos/API behavior. Attempted local Chromium verification was blocked by environment process-singleton socket permission (`Operation not permitted`) before any page opened. No visual, mobile, keyboard or end-to-end browser pass is claimed. A test harness is supplied for a supported environment.

No infrastructure, deployment or credentials were created by this preparation.

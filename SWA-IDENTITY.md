# Isolated SWA identity setup (manual)

This is a parallel, identity-only release. Existing docs/ (GitHub Pages), the normal index.html/main.tsx application and the private Site are untouched. Only frontend-auth/dist is published. No API calls or workspace component are included in this build. No data is initialized.

- Hosting: dotboard-web-prod, Azure Static Web Apps Free.
- Exact origin: https://red-mushroom-06ff8430f.5.azurestaticapps.net
- Start: /identity.html, top-level browser window.
- Root / is the dedicated same-origin MSAL v5 redirect bridge. It has no COOP header; all responses use no-store and no-referrer.
- MSAL Browser is pinned at 5.27.0. Popup only, memoryStorage for durable tokens; MSAL may use sessionStorage for temporary protocol state. No claim is made that browser storage is entirely unused. Clearing the result also clears the MSAL cache, not Microsoft's sign-in cookies.
- The access token is verified locally with jose 6.1.3 against the fixed tenant JWKS. No token is logged, displayed, uploaded to a verifier, or written to a file. Only the allowlisted verified claims are displayed. Synthetic test tokens never represent a real account.
- An access token must have RS256 signature, v1 issuer, exact API audience, unexpired exp, valid nbf, expected tenant, Web client appid, human-shaped oid (the operator must privately compare the verified oid with the intended owner), explicit delegated DotBoard.Access scope and nonempty sub. ID-token claims and oid/email are never substituted for sub. App-only tokens, roles of any shape, idtyp other than absent/user, audience arrays, noncanonical GUIDs, noninteger or incoherent timestamps, duplicate/malformed scopes and duplicate root JSON keys fail closed. JWT or at+jwt header type is required.
- This client diagnostic is not the API authorization boundary. Backend membership/session configuration still requires the observed verified access-token sub and separate server checks.

## Publication

The only new workflow is frontend-swa.yml. Its validation job runs on PRs, main pushes and manual dispatch without environment secrets. A separate publication job accepts workflow_dispatch on current main only, uses contents:read only, the dotboard-swa-production environment, and its site-specific AZURE_STATIC_WEB_APPS_API_TOKEN_DOTBOARD secret. It downloads the audited dist produced by the same run and re-audits it before upload. No automatic push deployment, PR preview, API upload, backend OIDC reuse or repo token is configured. The environment must restrict deployments to main. Store the deployment token through the approved secure channel, never this repository.

Official Azure/static-web-apps-deploy v1 head was resolved to 4d27395796ac319302594769cfe812bd207490b1 and its action.yml reviewed. Its Dockerfile uses Microsoft's deployment image; pinning action source does not make that upstream container immutable.

Run npm ci --ignore-scripts, tests, lint, typecheck, runtime audit, and vite build --config vite.swa.config.ts in frontend-auth. Then from repo root run node scripts/SwaArtifact.mjs prepare. The latter renames bridge.html to index.html and writes reviewed public configuration plus security headers before applying strict artifact checks. Never publish the raw repository.

## Live validation still required

The publication job checks the action output URL against the exact approved origin and fetches every published static file to compare its bytes and security headers with the audited dist, without requesting any API endpoint. Upload success alone is not deployment verification. Then open /identity.html and exercise successful login, wrong account, cancelled/blocked popup, retry, repeated clicks, refresh and back/forward. Never capture the authentication popup URL, raw token or cache. Only read the selected result fields after cryptographic validation. Record the real access-token sub for the server membership step. Do not request /api/workspace, mount BoardApp, import data or enable retention. Unit tests/build do not prove live login or deployment success.

References: Microsoft MSAL browser docs caching.md, initialization.md and redirect-bridge.md in AzureAD/microsoft-authentication-library-for-js; installed 5.27.0 package exports @azure/msal-browser/redirect-bridge. Standard supported popup APIs are used, not manual OAuth or a forged Origin.

Dependency review: runtime audit reports zero vulnerabilities. Full development-tool audit reports seven moderate findings from minimatch 10.2.6 through the existing typescript-eslint 8.72.1 chain (GHSA-g3hv-75wg-m249). These tools are not shipped in dist. No forced breaking dependency downgrade was applied.

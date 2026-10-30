# Public-safe DotBoard frontend authentication preparation

No live configuration, private workspace, seeds, server source, secrets or Git
history are included. This is a bounded integration adapter, NOT the deployed
DotBoard UI or proof of a successful real login.

## What was actually inspected

Production v9 source `app/board-app.tsx` uses same-origin fetch to `/api/workspace`
for reads and POST `{revision, operation}` with `X-Dot-Board-Local`. Additional
fetch sites exist in `app/project-instructions.tsx` (current/history),
`app/backup-download.tsx`, and `app/local-backups.tsx` (restore).
Those files were inspected, NOT copied/published or silently switched to Azure.
All must ultimately use the same authenticated transport, with actual route and
request schema agreement. Existing UI maintains revision monotonicity and a
mutation lock; preserve those behaviors. Do not replace workspace with a stale
backup or ship a production seed in a public bundle.

## Conditional Entra adapter

`entra.mjs` imports official `@azure/msal-browser` 5.27.0 and uses its Authorization
Code + PKCE implementation; no manual OAuth crypto. It deliberately supports
only a specific Entra tenant GUID. Actual provider/tenant/client/API scope are
NOT yet confirmed. If the deployment chooses another identity provider, do not
pretend this adapter supports it; integrate that provider's maintained SDK.

Required public configuration: provider=`entra`, tenantId, SPA clientId,
registered same-origin HTTPS redirectUri, HTTPS apiBaseUrl (including `/api`),
and exact delegated DotBoard API scope. No SPA client secret. Browser ID tokens
are never sent as API bearer tokens. Use server-verified issuer/subject for
workspace membership; the UI must not derive membership from email or claims.

Initialize once per page lifecycle and await `handleRedirectPromise` before
loading private data. No cached-first-account selection. Login is deliberate,
uses account selection; repeated attempts are blocked. Silent token failure must
surface a sign-in action, not an endless redirect during autosave/background read.
Logout calls official provider logout; clear rendered workspace and UI caches on
account change/logout before loading another identity. Back/Forward and callback
routing require final UI testing after actual registered URLs exist.

Transport never forwards bearer tokens to arbitrary URLs, excludes cookies and
rejects redirects. Mutations require a stable caller-owned UUID requestId and
revision, never auto-retry/overwrite a409. A network failure is an uncertain
mutation result: preserve requestId/payload and reconcile server receipt/state.
The `{revision, requestId, operation}` envelope must be matched with the final
Functions endpoint; this adapter does not claim current v9 accepts requestId.

## Checks and remaining work

15 local unit checks cover configuration failures, redirect initialization order,
missing/account-mismatched tokens, URL restrictions, bearer transport, preserved
mutation identity,409 without retries, login double clicks/cancellation and
silent-token failures. They use injected fake MSAL/fetch objects ONLY in tests;
production `entra.mjs` constructs the official library. No browser/mobile/live
provider test, UI integration, registration, consent or deployment was performed.

Official references:
- https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser
- https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization
- https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token

## Actual UI integration continuation — 2026-10-30

The earlier adapter-only limitation is superseded locally by a full public-safe
copy of the v9 UI in `app/`, the two required dialog/button components, public
formatting/types/input schemas and CSS. No server, initial-workspace seed, real
cards, Git directory or private backend implementation was copied. The
`workspace-store.ts` copy contains only the public action input schema/type,
not workspace mutation/persistence functions.

All workspace/instructions/history/backup/restore fetch sites now use the
same bearer adapter. The Markdown download also uses authenticated fetch/Blob,
not a tokenless anchor. No old local-header trust or cookies reach the API.
`main.tsx` is a real login/logout gate. Default configuration is unconfigured;
private BoardApp is never mounted until official MSAL returns an account.
Logout/session invalidation unmounts it and aborts/discards in-flight requests.
Back/Forward/pageshow check session absence; login cancellation and double-click
protection are implemented. Provider errors never trigger automatic redirect loops.

The workspace mutation path keeps the same requestId for an uncertain identical
request and blocks sending a different change until the uncertain state is
reconciled. Known client/conflict failures release the pending mutation; network
uncertainty is not reported as saved. No automatic overwrite or retry exists.
Actual provider integration and browser verification remain pending configuration.
The API must support `/workspace/instructions?boardId=...&format=md` for downloads.

`npm run build` produces a Vite static SPA; `npm run lint` checks TypeScript/React
hooks, and `npm test` runs transport/session tests. The config template in
`public/dotboard-config.json` contains no real endpoints or secrets. Register the
actual SPA root URL as a redirect that the static host can serve directly; do not
invent a `/callback` route on a host lacking SPA fallback. Only the `dist/` output
is deployable web content, not tests, node_modules or any backend files.

Final local checks: 25 frontend tests pass (15 transport,4 session/disposal,6 action-schema regression checks), plus TypeScript/Vite build and React/TypeScript lint. Vite8.3.5 and Zod4.6.7 replace vulnerable versions inherited from v9; only this frontend copy changed. The private BoardApp bundle is lazy-loaded after the login gate.

Final Azure caps: workspace4,194,304 UTF-8 bytes, backup/request4,259,840 bytes; four boundary tests added (29 frontend tests total). Existing Site limit unchanged. Both mutation and restore retain request identity under network uncertainty and block a different operation until reconciled.

### Lost-response recovery correction

`PendingWrite` now retains the entire serialized original envelope, not a key
reconstructed from the latest GET revision. Explicit recovery buttons for normal
mutations and restore resend those exact original bytes/IDs/revision. Refreshing
to a newer revision does not alter that envelope. Editing the draft cannot mutate
it. No second unrelated mutation can replace it. Successful verified response
clears the pending state; generic errors, including409, do not erase uncertainty.
A machine-verifiable definite-rejection contract would be needed to safely release
other rejected requests without implying that an uncertain one did not commit.
Four additional tests cover response loss→new revision→exact recovery,409 conflict,
successful acknowledgment and restore recovery. Final frontend count33 tests.

Verified API rejection contract now releases a pending envelope only for an
explicit allowlist of definitive non-commit codes: invalid_request,
invalid_operation, invalid_backup, invalid_commit, json_required, body_too_large
or revision_conflict with the allowed4xx status (revision_conflict requires409).
Drafts remain visible for deliberate correction/reconciliation. An idempotency
conflict, generic409,503, malformed response, timeout, cancellation or network
failure retains the exact original envelope. No automatic new UUID or retry.
Three further checks cover definite rejection, stale revision and uncertain
failures; final frontend count36. This supersedes the generic-error limitation
above; it relies on the Functions contract confirmed by the integration owner.

## Explicit authentication design change and storage gate

This candidate SPA uses independently validated OAuth bearer access tokens through
Microsoft MSAL, not the older proposed server-cookie session contract. It must
not be described as implementing that cookie design unchanged. Tokens are handled
only by MSAL and never manually persisted by DotBoard. Current redirect flow uses
MSAL SessionStorage, which still stores authentication artifacts in browser
session storage and carries an XSS exposure trade-off. It is not a claim of
memory-only token storage or HttpOnly server cookies. Existing public security
notes must be preserved and reconciled before enabling this live configuration.

A requested security review considered switching to MemoryStorage. Official
Microsoft documentation explicitly marks redirect flow unsupported with that
option, and installed MSAL5.27.0 `dist/utils/BrowserUtils.mjs` in
`redirectPreflightCheck` throws `inMemRedirectUnavailable` when cacheLocation is
MemoryStorage. Therefore this candidate does NOT silently change that option or
add handwritten temporary-state/token persistence to bypass the library guard.
Memory-only requires a supported different flow (for example an official popup
flow with its own lifecycle/redirect-bridge validation), or a separately integrated
server-cookie/BFF design. Neither is claimed delivered or activated here.

Sources verified2026-10-30:
https://learn.microsoft.com/en-us/entra/msal/javascript/browser/caching
https://learn.microsoft.com/en-us/entra/msal/javascript/browser/configuration
https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/caching.md

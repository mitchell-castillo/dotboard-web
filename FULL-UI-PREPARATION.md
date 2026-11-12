# Full UI local preparation, 2026-11-12

No deployment, permissions, APIs, data migration or CD activation performed here.

## Build and routes
Root remains the MSAL popup bridge. /identity.html retains safe diagnostics. /app.html is the full React UI, gated by verified human /api/session before binding transport or mounting BoardApp.
Run in frontend-auth: npx tsc --noEmit; npx vite build --config vite.full.config.ts
Then repository root: node scripts/FullSwaArtifact.mjs full-prepare; node scripts/FullSwaArtifact.mjs full-check
Output is frontend-auth/dist-full. Existing diagnostic build/audit/manual workflow are unchanged. Do not silently switch workflows.

## Authentication
Official MSAL popup and MemoryStorage, existing cryptographic token verification, exact workspace/user session check. No token logs or persistent caches. Abort/generation fences, interaction locks and pending-login navigation invalidation prevent stale login responses. Authenticated same-document Back/Forward preserves BoardApp and its in-memory uncertain-write envelope. Silent refresh remains noninteractive. Existing revision/requestId and uncertain-write recovery remain unchanged.

## Security and deployment gates
Separate artifact audit retains config fingerprint, secret/private seed scan and file allowlist. CSP permits exact backend /api/ prefix, Microsoft identity and self. style-src-attr unsafe-inline is restricted to attributes for Radix positioning and UI style props; script-src remains self only, no unsafe-inline/eval. Inline style elements remain blocked and require browser QA. No new permissions or CD.
Once mounted UI can GET workspace (including catch-up side effects) and deliberate mutations. Do not publish until operator confirms data/import/cutover state. No real data embedded. /session success is not Cosmos migration verification.

Manual publication after review. Live popup cancel/retry, mobile/desktop, Back/Forward, logout, account switch, 401/403/409 and stale private UI checks remain required. No browser QA performed. Complete source export/import/readback/cutover remains separate. Do not enable CD solely from this candidate.

Known existing limit: full page teardown or deliberate logout loses component-local pending-write state; do not claim reload-proof reconciliation. This candidate does not expand that behavior. Durable identity-bound recovery across teardown requires separate implementation before unrestricted production editing.

## Approved first release: read-only
The first UI explicitly displays a read-only notice. PopupSessionTransport rejects every non-GET method before token acquisition or network; BoardApp also refuses mutation before PendingWrite.begin. Main passes readOnly and common create/edit/save controls are disabled. This is a client release gate, not a claim to replace backend authorization. It prevents NEW user mutations from creating uncertain envelopes. It does not reconcile any earlier uncertain result. GET workspace may still execute existing backend catch-up behavior; migration/cutover verification remains separate. No new token or private-payload persistence is introduced.

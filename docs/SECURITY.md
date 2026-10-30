# Current Azure SPA release clarification — 2026-10-30

The current served client is built from `frontend-auth/`; the release below retains historical BFF/cookie guidance for traceability. Current authentication is official MSAL Authorization Code + PKCE with bearer access tokens and sessionStorage token cache, not HttpOnly cookies. Memory-only cache is unsupported by the official redirect flow. This entails XSS risk and must be reviewed alongside CSP, dependency safety, issuer/audience/scope validation, exact CORS and server workspace membership before activation. No client header grants identity. No manually persisted bearer shortcut is used.

Configuration remains `provider: unconfigured` with all endpoint/identity fields empty. No real login, API/Cosmos integration or migration is claimed. Preserve the private Site as the source of truth until authorized, independently verified cutover. Current code is public-safe; never publish real workspace backups, seeds, backend code or secrets.

---

## Historical cookie/BFF release gates

# Release gates

1. Review every public file and final bundle for secret/data leaks; never publish private repository history or a workspace backup.
2. Verify deployed session and shared-workspace backend authorization independently; denied and unknown actors must fail closed on every CRUD/export/history route.
3. Configure exact allowed frontend origin/return URL, secure HttpOnly session cookie and CSRF. Client hints are not authorization.
4. Confirm separate human/assistant actors, shared workspace access including new boards, and immutable server-derived audit identity.
5. Validate authenticated/anonymous/expired/denied flows, logout failures, restore conflicts, repeated clicks, browser back, mobile and keyboard accessibility.
6. Preserve current production and provide reviewed data migration/rollback before switching any real workspace. This static frontend cannot migrate data.
7. Public release while backend is absent must clearly state that access is not configured. Never present that state as a functional completed application.

# Missing AI managed context — disabled-by-default security foundation

**State:** testable technical prototype only. **Not hosted, enabled, available for public signup, certified secure, or connected to a production identity provider.** This change must not modify the existing public Missing AI checker, personal private-history tunnel or Orchestryn.

## Why this exists

The self-hosted import flow has been verified end to end, but asking everyday ChatGPT users to install software or SSH into a personal server is a barrier. The managed flow should allow consenting users to authenticate, preview their selected notes, save them, search their own context, and delete it from within ChatGPT. It does **not** access platform conversation history automatically or claim historical messages prove current actions.

## Prototype implementation

- `managed-beta/server.mjs`: **separate, disabled by default** service. Binds only to `127.0.0.1` behind a separately controlled HTTPS proxy; not included in the public deploy command or Pages build.
- `managed-beta/auth.mjs`: independently checks RS256 OAuth access-token signatures against an explicitly configured HTTPS JWKS; checks `iss`, resource `aud`, subject, `exp`, optional `nbf/iat`, and per-tool `context:read` / `context:write` scope. The **verified issuer + subject** derives tenant identity; user-supplied account IDs never select a tenant. JWKS responses are bounded and cached; unknown `kid` cannot force repeated key downloads. No passwords or OAuth authorization server are implemented here.
- `managed-beta/store.mjs`: single-process prototype using Node 22 `node:sqlite` (**experimental**). Separate private directory/SQLite file, AES-256-GCM ciphertext for note contents and pending drafts, per-tenant unique note fingerprints, one-use drafts expiring after five minutes, atomic commits, per-tenant quota 100 notes and content-free audit receipts. No content is printed to server logs. The **encryption key must be injected by an approved secret manager**, never committed to GitHub. The storage format is *not* a production multi-instance or backup/key-rotation solution.
- `managed-beta/portal.mjs`: independent OIDC authorization-code + PKCE browser login; validates issuer, signature, audience, nonce and state; shows exact notes after verifying the SAME tenant; requires a browser checkbox and CSRF token before directly committing the one-use draft. It also provides a same-account portal to export/delete selected notes or wipe active notes after explicit typed confirmation. **Only synthetic provider tests have run; no real identity provider has been connected.**
- `managed-beta/approval.mjs`: optional alternative short-lived RSA-signed, tenant/draft-bound approval proof verifier for non-browser tool writes. It cannot mint a proof; without independent verifier configuration, the save MCP tool is **not advertised at all**. The normal managed beta saves via the authenticated portal, not an AI-controlled flag.
- `managed-beta/mcp.mjs`: stateless JSON-RPC MCP over POST `/mcp`, `/.well-known/oauth-protected-resource` discovery, scope-bearing per-tool security schemes and OAuth error challenges, with generic errors, no CORS wildcard, 48-KB requests and 60 calls/minute per authenticated tenant **per process**. Read/profile/status/search/list, prepare/cancel and audit are tenant-scoped. The alternative signed-proof save tool is exposed only when an independent signer is configured. Destructive deletion and export actions are restricted to the separately authenticated browser portal, not model-generated tool calls. Tool results include context only for that authenticated user.

## ChatGPT integration requirements

Use an **established OAuth 2.1 identity provider**. Configure authorization-code + PKCE S256, consent screen, exact redirect URI, issuer identification, and `resource`-audienced short-lived access tokens. The provider must publish discovery metadata compatible with ChatGPT's CIMD or DCR flow. This repository intentionally **does not invent an OAuth issuer or include authentication credentials**. Production HTTPS, user signup, token revocation, account/session management and real host-side confirmation must be independently tested before anyone enables the new service.

Official guide: https://developers.openai.com/plugins/build/auth

### User journey once finished

1. Install Missing AI plugin and sign in through the verified OAuth provider.
2. Ask ChatGPT to create a short, clearly attributed summary of a chosen conversation. ChatGPT cannot silently read an entire archive.
3. `missing_ai_prepare_context_import` returns the **exact proposed notes** and a five-minute one-use draft ID. A ChatGPT agent must show the proposed notes; it must not invent approval.
4. ChatGPT provides a short-lived **approval URL**. The person opens it in a browser, signs in with the same external OIDC identity provider, reviews the exact notes, checks an approval box and clicks Save. The browser portal commits the draft directly to that user's index. The AI cannot authorize the commit.
5. ChatGPT can then search the user's notes. A separately OIDC-authenticated **account portal** supports viewing, downloading unencrypted approved notes, deleting individual notes and wiping active notes. Provider login and real browser acceptance are **not yet verified**.

**Important current limitation:** The portal is implemented and tested only against **synthetic OIDC credentials and HTTP localhost fixtures**. The signed-proof MCP save tool is hidden unless a separate signer is explicitly configured. Normal managed users approve in a real browser using OAuth and a CSRF-protected form, not through a model-provided `confirmed:true` flag. Before enabling customer accounts, test the actual provider, HTTPS reverse proxy, browser cookies, login/reconnect, cross-account isolation and deletion in staging. Never assume synthetic tests imply real consent/security verification.

## Configuration interface (not deployment instructions)

There is no default runnable production identity. To start, the operator must explicitly set `MISSING_AI_MANAGED_ENABLED=1`, provide an HTTPS issuer, audience/resource, trusted HTTPS JWKS URL, separate private SQLite path, 32-byte base64 encryption key, an approved internal listener port, and a **separately enabled** approval portal (`MISSING_AI_APPROVAL_UI_ENABLED=1`) with a configured OIDC client ID, authorization/token endpoints, callback URI and public HTTPS origin. The optional alternative signed-proof tool requires an approval issuer/public key. Never use an existing private-history directory or public Missing AI service's runtime credentials.

**Do not** copy example credentials or real keys into repository issues, Actions, code, or public logs. A trusted HTTPS proxy must terminate TLS and reject unauthenticated network traffic outside MCP's OAuth flow. The process itself listens on loopback only.

## Security and privacy review: class REVIEW

Threat | Mitigation in prototype | Remaining release blocker
:--|:--|:--
Other account reading/writing a tenant | Verified JWT identity; every SQL operation filtered by tenant | Independent provider-backed two-account adversarial test
Model asks to import without human permission | Portal verifies OIDC session, same tenant, state + PKCE + nonce, CSRF and checkbox; alternative signed tool disabled without signer | Real provider/login-browser two-account acceptance test and consent revocation
Token misuse / expiry | RS256 signature, issuer, audience, time and scope checks | Token revocation and short-lived token policy from IdP; refresh/reconnect tests
Replay / duplicate imports | Transactionally consume draft; tenant-specific dedupe | Multi-instance transactional store and parallel write test
Confidential data in logs | Generic errors, no input/body logging; audit receipts contain action/count only | Proxy/access log inspection and retention policy
Data exposure from storage | AES-GCM note/draft ciphertext; restrictive private database file | Key lifecycle, backup encryption, breach response, GDPR/privacy assessment
Denial of service | Request bounds, per-tenant limits, max 100 notes | Edge limits for unauth traffic, distributed quota, abuse response
Historical inaccuracy | Lexical retrieval and explicit limitations | Omission benchmark, relevance tests; no claims of proof
Account deletion | Separate authenticated portal for export, delete one/all (not AI-authorized tools) | Verified erasure from backups and identity links; retention policy and GDPR review

Node 22's SQLite implementation is experimental. This is acceptable for synthetic developer tests, **not** a production database choice without review. A production deployment needs managed PostgreSQL or another supported encrypted transactional data store, migration testing, secret rotation and multi-worker concurrency protections. The browser portal uses process-memory OAuth state/sessions only, so it is **single-instance prototype code**: a production multi-instance deployment needs a centralized, secure session store and distributed rate limits. User-visible deletion currently removes active database records; encrypted backups and caches require a documented erasure schedule.

## Test and release gates

1. Synthetic authentication, cross-account access, writer-vs-reader scope, stale/forged/expired token, cache-rotation, sensitive-text error, quota, replay, audit, deletion and persistence tests.
2. Independent CI at the exact Git SHA; no tests use real user/customer histories or production keys.
3. Security review of full diff and consent flow by maintainer; any public PR must contain only generic source/tests and this risk assessment.
4. Provider-backed OAuth integration, real browser confirmation, two distinct test accounts, independent read-back/delete and a verified token refresh/revocation test.
5. Infrastructure and data protection review: separate host/container; secure HTTPS, backups, encryption key rotation, data subject export/delete controls, monitoring without plaintext, observability limits, backup restore.
6. Only then private invitation-only beta; broad public launch requires further review, support and capacity limits.

**Rollback:** stop the separate managed-beta process and revoke its OAuth audience/clients. Existing public and personal services must remain unchanged. Backed-up customer data needs a separately authorized retention/deletion plan; stopping the process does not delete the database.

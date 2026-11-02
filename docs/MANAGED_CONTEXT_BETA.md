# Missing AI managed context — disabled-by-default security foundation

**State:** testable technical prototype only. **Not hosted, enabled, available for public signup, certified secure, or connected to a production identity provider.** This change must not modify the existing public Missing AI checker, personal private-history tunnel or Orchestryn.

## Why this exists

The self-hosted import flow has been verified end to end, but asking everyday ChatGPT users to install software or SSH into a personal server is a barrier. The managed flow should allow consenting users to authenticate, preview their selected notes, save them, search their own context, and delete it from within ChatGPT. It does **not** access platform conversation history automatically or claim historical messages prove current actions.

## Prototype implementation

- `managed-beta/server.mjs`: **separate, disabled by default** service. Binds only to `127.0.0.1` behind a separately controlled HTTPS proxy; not included in the public deploy command or Pages build.
- `managed-beta/auth.mjs`: independently checks RS256 OAuth access-token signatures against an explicitly configured HTTPS JWKS; checks `iss`, resource `aud`, subject, `exp`, optional `nbf/iat`, and per-tool `context:read` / `context:write` scope. The **verified issuer + subject** derives tenant identity; user-supplied account IDs never select a tenant. JWKS responses are bounded and cached; unknown `kid` cannot force repeated key downloads. No passwords or OAuth authorization server are implemented here.
- `managed-beta/store.mjs`: single-process prototype using Node 22 `node:sqlite` (**experimental**). Separate private directory/SQLite file, AES-256-GCM ciphertext for note contents and pending drafts, per-tenant unique note fingerprints, one-use drafts expiring after five minutes, atomic commits, per-tenant quota 100 notes and content-free audit receipts. No content is printed to server logs. The **encryption key must be injected by an approved secret manager**, never committed to GitHub. The storage format is *not* a production multi-instance or backup/key-rotation solution.
- `managed-beta/approval.mjs`: verification of a short-lived RSA-signed approval proof minted by a **separate user-authenticated browser portal**. Proofs must bind `tenant`, exact `preview_id`, intended action, issuer, audience and expiry. This code intentionally cannot mint proofs or authenticate browser sessions. The separate portal has **not yet been built or connected**.
- `managed-beta/mcp.mjs`: stateless JSON-RPC MCP over POST `/mcp`, `/.well-known/oauth-protected-resource` discovery, scope-bearing per-tool security schemes and OAuth error challenges, with generic errors, no CORS wildcard, 48-KB requests and 60 calls/minute per authenticated tenant **per process**. Read/status/search/list, prepare/save/cancel, delete one/delete all and audit are tenant-scoped. Tool results include context only for that authenticated user.

## ChatGPT integration requirements

Use an **established OAuth 2.1 identity provider**. Configure authorization-code + PKCE S256, consent screen, exact redirect URI, issuer identification, and `resource`-audienced short-lived access tokens. The provider must publish discovery metadata compatible with ChatGPT's CIMD or DCR flow. This repository intentionally **does not invent an OAuth issuer or include authentication credentials**. Production HTTPS, user signup, token revocation, account/session management and real host-side confirmation must be independently tested before anyone enables the new service.

Official guide: https://developers.openai.com/plugins/build/auth

### User journey once finished

1. Install Missing AI plugin and sign in through the verified OAuth provider.
2. Ask ChatGPT to create a short, clearly attributed summary of a chosen conversation. ChatGPT cannot silently read an entire archive.
3. `missing_ai_prepare_context_import` returns the **exact proposed notes** and a five-minute one-use draft ID. A ChatGPT agent must show the proposed notes; it must not invent approval.
4. The user reviews/approves in a **separately authenticated confirmation interface**. The portal verifies that user's actual identity and issues a short-lived signed approval proof bound to the same tenant and draft. The MCP server independently verifies it before committing. This UI/issuer integration is **not yet implemented**; signing-key tests use synthetic fixtures only.
5. Search/list/check past notes in later chats, with source attribution; delete individual notes or all notes at any time.

**Important current limitation:** `missing_ai_save_approved_context` now **requires a cryptographically signed `approval_proof`**, not a model-provided `confirmed:true` flag. By default, writes fail closed when there is no configured independent approval verifier. A user-authenticated portal that can mint real proofs has **not been implemented** and is a release blocker. ChatGPT's tool-action confirmation should be enabled as an additional layer, not the sole proof of consent.

## Configuration interface (not deployment instructions)

There is no default runnable production identity. To start, the operator must explicitly set `MISSING_AI_MANAGED_ENABLED=1`, provide an HTTPS issuer, audience/resource, trusted HTTPS JWKS URL, separate private SQLite path, 32-byte base64 encryption key, separately trusted approval issuer and approval-verification public key and an approved internal listener port. Never use an existing private-history directory or public Missing AI service's runtime credentials.

**Do not** copy example credentials or real keys into repository issues, Actions, code, or public logs. A trusted HTTPS proxy must terminate TLS and reject unauthenticated network traffic outside MCP's OAuth flow. The process itself listens on loopback only.

## Security and privacy review: class REVIEW

Threat | Mitigation in prototype | Remaining release blocker
:--|:--|:--
Other account reading/writing a tenant | Verified JWT identity; every SQL operation filtered by tenant | Independent provider-backed two-account adversarial test
Model asks to import without human permission | Preview step + one-use server draft; RS256 approval proof bound to tenant/draft | Build independent OAuth-authenticated approval portal and verify signer / same-account behavior
Token misuse / expiry | RS256 signature, issuer, audience, time and scope checks | Token revocation and short-lived token policy from IdP; refresh/reconnect tests
Replay / duplicate imports | Transactionally consume draft; tenant-specific dedupe | Multi-instance transactional store and parallel write test
Confidential data in logs | Generic errors, no input/body logging; audit receipts contain action/count only | Proxy/access log inspection and retention policy
Data exposure from storage | AES-GCM note/draft ciphertext; restrictive private database file | Key lifecycle, backup encryption, breach response, GDPR/privacy assessment
Denial of service | Request bounds, per-tenant limits, max 100 notes | Edge limits for unauth traffic, distributed quota, abuse response
Historical inaccuracy | Lexical retrieval and explicit limitations | Omission benchmark, relevance tests; no claims of proof
Account deletion | Scoped note deletion tools | Verified deletion including backups and identity links; export and retention policy

Node 22's SQLite implementation is experimental. This is acceptable for synthetic developer tests, **not** a production database choice without review. A production deployment needs managed PostgreSQL or another supported encrypted transactional data store, migration testing, secret rotation and multi-worker concurrency protections.

## Test and release gates

1. Synthetic authentication, cross-account access, writer-vs-reader scope, stale/forged/expired token, cache-rotation, sensitive-text error, quota, replay, audit, deletion and persistence tests.
2. Independent CI at the exact Git SHA; no tests use real user/customer histories or production keys.
3. Security review of full diff and consent flow by maintainer; any public PR must contain only generic source/tests and this risk assessment.
4. Provider-backed OAuth integration, real browser confirmation, two distinct test accounts, independent read-back/delete and a verified token refresh/revocation test.
5. Infrastructure and data protection review: separate host/container; secure HTTPS, backups, encryption key rotation, data subject export/delete controls, monitoring without plaintext, observability limits, backup restore.
6. Only then private invitation-only beta; broad public launch requires further review, support and capacity limits.

**Rollback:** stop the separate managed-beta process and revoke its OAuth audience/clients. Existing public and personal services must remain unchanged. Backed-up customer data needs a separately authorized retention/deletion plan; stopping the process does not delete the database.

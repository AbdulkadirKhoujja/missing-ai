# Managed Missing AI — verified identity-provider staging gate

**REVIEW classification / no customer data.** Use this guide to prepare a separately isolated OAuth/OIDC staging environment. Managed Missing AI remains disabled by default; the personal-history tunnel and public checker are unaffected.

## Identity-provider choice

Use an established provider issuing real resource-audienced RS256 access tokens, supporting authorization code + PKCE S256, OpenID discovery, and ChatGPT-compatible CIMD, DCR or predefined client registration. Auth0 is a reasonable managed staging choice, not a requirement for all users.

For Auth0, register a staging API identifier matching the exact canonical MCP resource URL. Enable the Resource Parameter Compatibility Profile so ChatGPT's OAuth resource parameter selects the API audience. Create a separate authorization-code/PKCE client for the approval/account portal, using its exact HTTPS /approve/callback URL. With ChatGPT CIMD, register the exact client metadata document and redirect URI shown by the current plugin builder. Do not guess callback IDs. Restrict signups to two invited synthetic test accounts. Documentation: https://developers.openai.com/plugins/build/auth and https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0 .

## Read-only provider metadata preflight

Configure MISSING_AI_OIDC_ISSUER, MISSING_AI_OIDC_AUDIENCE, MISSING_AI_OIDC_JWKS_URL, MISSING_AI_MCP_RESOURCE, MISSING_AI_OIDC_AUTHORIZATION_URL, MISSING_AI_OIDC_TOKEN_URL, MISSING_AI_OIDC_CLIENT_ID, MISSING_AI_PORTAL_ORIGIN and MISSING_AI_PORTAL_REDIRECT_URI outside source control.

Run node managed-beta/staging-preflight.mjs from a reviewed checkout. It fetches only the configured HTTPS OpenID discovery and JWKS endpoints with time/size limits, and checks pinned issuer, audience, endpoint URLs, PKCE S256, authorization-code support and published RSA signing keys. It prints only a non-sensitive result. It does not create accounts, collect access tokens, start a listening service or enable managed beta. Passing metadata checks is not proof of successful login or two-account isolation.

## Launch gates

1. Configure and verify an actual staging identity provider and separate HTTPS origins with trusted TLS.
2. Log in through the provider and ChatGPT using two independently authenticated real test identities. Approve separate synthetic notes through the browser portal. Verify read, search, export and deletion cannot access the other account.
3. Exercise expiry, wrong issuer, wrong audience, insufficient scope, revoked grants, OIDC callback, signing-key rotation, and token refresh/reconnect through ChatGPT.
4. Restore a verified encrypted snapshot in a separate directory, verify both tenants and wrong-key refusal. Establish backup retention, deletion reconciliation on recovery, key lifecycle and user-facing erasure policy.
5. Independently review no-content logging, reverse proxy security, session handling, rate limits, CSRF, rollback and incident response. Require written go/no-go approval before accepting any customer information.

**Still blocked:** No actual provider tenant, independent real accounts, HTTPS integration, token revocation, key rotation, production database migration or complete backup erasure has been verified by this preflight. Do not enable MISSING_AI_MANAGED_ENABLED for consumers solely because these synthetic tests pass.

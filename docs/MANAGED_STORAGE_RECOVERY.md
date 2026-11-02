# Missing AI managed beta — staging storage and recovery gate

**REVIEW classification. Disabled-by-default technical beta.** This is a staging-only hardening step, not authorization to store consumer histories. The existing public checker and separate personal connector are unaffected.

## Controls implemented

- Context notes and drafts use AES-256-GCM with a versioned encrypted key-check marker. A wrong key causes startup to fail rather than treating existing data as a new empty account.
- On opening the single-process SQLite adapter, secure_delete=ON, synchronous=FULL, trusted_schema=OFF and quick_check apply. The owner-private directory must have mode 0700 and the database file 0600. This does not constitute production-grade multi-tenant database security.
- Operator-only managed-beta/backup.mjs creates SQLite-consistent snapshots in a separate owner-private directory. It verifies integrity and decryptability, uses a temporary staging filename, fsyncs and renames before declaring success. It is not scheduled and is not called by the public API.
- Synthetic tests verify two-account isolation after restore, encrypted content, wrong-key fail-closed behavior, unsafe directory rejection, and deleted notes remaining in older snapshots.

## One-shot offline staging snapshot

Stop the managed staging service first. Provision separate, existing, private source and backup directories owned by the same service identity. Export MISSING_AI_MANAGED_DB as the absolute path to the staging SQLite file. Export MISSING_AI_MANAGED_BACKUP_DIR as the absolute backup directory. Set MISSING_AI_MANAGED_SNAPSHOT_REVIEWED=1 and obtain the base64-encoded 32-byte MISSING_AI_MANAGED_ENCRYPTION_KEY from a private secret store, then run node managed-beta/backup.mjs.

Do not run this procedure on live customer data. Only snapshot basename and byte count should appear in the CLI output. Keep the matching key in a separate restricted recovery mechanism. Never put databases, keys, logs or history exports into public GitHub, websites or CI artifacts.

## Go/no-go evidence required for customer beta

1. Configure a real OIDC identity provider with verified issuer, discovery, signing keys, redirect origins and independent test accounts. Ensure OAuth resource audience and scopes are correctly enforced. Test unknown clients, revoked grants, expiry and signing-key rollover.
2. Deploy the managed service only in a separately isolated HTTPS staging environment behind a controlled reverse proxy, not on the personal history tunnel or the public checker endpoint.
3. With **two independently authenticated users**, record separate explicit approvals of synthetic notes and verify no cross-tenant read, write, export, deletion or audit access through either browser or MCP.
4. Stop staging, take an offline verified snapshot and restore it into a fresh owner-private directory. Verify both accounts' data and audit receipts are recovered without crossing tenants. Reopen with the wrong key and verify startup fails.
5. Delete notes from live storage and verify they disappear from current reads. **Do not claim comprehensive erasure:** a backup made beforehand still retains deleted notes. Establish backup retention, deletion propagation or expiration, restore-time erasure reconciliation, and user notices before accepting real customers.
6. Test encryption-key rotation/recovery, crash consistency, rollback, quotas, rate limiting, content-free monitoring, incident response and an independent security review. Repeat CI on the exact deployed revision.

## Blocking limitations

Node 22 node:sqlite is experimental and the adapter is single-process. No real OIDC provider has been provisioned or tested. No HTTPS two-account end-to-end staging run, enforced backup lifecycle, safe key rotation, token revocation, or consumer signup is verified. Keep MISSING_AI_MANAGED_BETA_ENABLED disabled. Restoring older backups must not resurrect deleted customer records.

## Review and rollback

This public change uses synthetic examples only. No credentials, real history or private host identifiers belong here. Revert the PR to return to the previous disabled managed-beta adapter; it does not update the public checker or personal connector. Passing synthetic tests does not authorize hosting customer data.

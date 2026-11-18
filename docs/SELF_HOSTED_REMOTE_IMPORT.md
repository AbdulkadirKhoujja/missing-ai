# Missing AI — optional private remote import over SSH (technical preview)

**Scope:** a single user/household with an existing private Missing AI index on a trusted SSH host. This is **not** a general hosted, multi-account sync service and does not close the broader [remote onboarding issue](https://github.com/AbdulkadirKhoujja/missing-ai/issues/65).

## Why this option

The public Missing AI page must not accept private uploads or learn SSH credentials. OpenAI/Claude chat models must not have a general private-history write tool. For users who already control a private SSH server, a device-local approval page plus an SSH-backed stdio helper avoids a public write endpoint while preserving the three read-only MCP tools.

The initial **one-time** setup needs a local Node 22+ runtime, a trusted SSH server and an isolated private-history checkout. **Subsequent imports:** open the device-local page, review each note, preview duplicate counts, and explicitly approve import. No SSH command is needed per import. Nothing happens automatically when a ChatGPT chat is opened.

## Data flow and trust boundaries

`User's computer browser → 127.0.0.1 desktop companion → OpenSSH with strict known-host verification → server's fixed private-import command → no-network Node worker → owner-private history folder`.

- The public onboarding website and GitHub receive **no notes**. The on-device companion's browser UI uses DOM text nodes, a strict CSP and same-origin session token. Checked notes are sent to the remote private host **only after each note is selected**.
- The SSH identity remains on the user's computer. The private host's authenticated OS identity controls who may write the history folder. No provider-hosted token or shared API key is created. Do not supply the SSH key to an AI chat.
- A remote preview produces a **one-use, five-minute token** stored only on the owner-controlled host; final commit atomically claims it and appends duplicate-safe notes. A cancelled or expired preview does not import content.
- Up to eight simultaneous pending previews, 2 MB JSONL per import, 20 device-local previews per five minutes. The SSH service's own rate limits still apply.
- Audit receipts record randomized receipt IDs, dates and numeric counts only; never history text, tokens or remote IPs. Authorized user can delete the receipt file and imported records on their own host.
- The existing `missing_ai_history_status`, `missing_ai_search_history`, and `missing_ai_review_answer_history` tools are unchanged and remain read-only. Their source files refresh on later reads.

## Server installation (one-time, trusted administrator)

1. Obtain the reviewed repository commit on the SSH host in an independent checkout. Verify the exact commit, run `npm test` using Node 22+, and ensure it contains `private-history/remote-import-stdio.mjs`, `private-history/import-context-pack.mjs`, and `site/context-onboarding.mjs`. Do **not** update the existing running tunnel checkout as a side effect.
2. Set aside the existing private history location with `0700` directory permissions, owned by the **same unprivileged UID** used by the read-only MCP. Verify the existing `agent-events.jsonl` is owner-private `0600` before attempting any import.
3. Install a root-owned wrapper at `/usr/local/sbin/missing-ai-private-import` with `0755` permissions. Review and customize this **generic template**, rather than executing it blindly:

```sh
#!/bin/sh
set -eu
# Replace these with reviewed local paths and the private-history owner UID.
SOURCE=/srv/missing-ai-reviewed-source
HISTORY=/srv/private-history-directory
OWNER_UID=12345

[ -d "$SOURCE" ] && [ -d "$HISTORY" ] || exit 2
exec /usr/bin/docker run --rm -i --network none --read-only \
  --cap-drop ALL --security-opt no-new-privileges --pids-limit 64 --memory 384m \
  --user "$OWNER_UID:$OWNER_UID" \
  -v "$SOURCE:/app:ro" -v "$HISTORY:/history:rw" \
  -w /app -e MISSING_AI_HISTORY_DIR=/history \
  node:22-alpine node private-history/remote-import-stdio.mjs
```

Use a locally cached, reviewed and pinned Docker image digest if the deployment has a trusted-image policy. The wrapper creates **no listening port**, and its worker has no network access. Restrict the SSH key used for this service, ideally with a forced command and no forwarding. A general root SSH key is not an appropriate default for end users. The wrapper should not be reachable through an unauthenticated HTTP proxy.

4. Validate a **synthetic** preview and then approval in the private environment, verify replay cannot import twice, and check the read-only MCP count. Do not put production conversation text into test logs, public GitHub or the build artifacts.

## User computer (one-time)

Install Node.js 22+ on the device; the OpenSSH client must be available and the server host key already trusted (the companion refuses unknown host keys). Use a **dedicated import-only SSH identity** when possible. Set the following environment variables in the user's shell or a protected local launcher—not in a web page or shared repository:

```sh
export MISSING_AI_REMOTE_SSH_DEST='import-user@private-host.example'
export MISSING_AI_REMOTE_SSH_KEY="$HOME/.ssh/missing_ai_import"
node private-history/remote-import-desktop.mjs
```

Open the printed `http://127.0.0.1:<port>/` URL **on that same device**. You can paste a summary or select an existing reviewed `.jsonl` context pack. Review notes without contacting the server, tick only entries you authorize, then request a remote preview and confirm the final write. Close the companion with Ctrl+C when finished. The imported notes become searchable through the existing private MCP when it next refreshes.

On Windows PowerShell, use `$env:MISSING_AI_REMOTE_SSH_DEST`, `$env:MISSING_AI_REMOTE_SSH_KEY` and `node .\private-history\remote-import-desktop.mjs`; keep the same checked-out repository on the Windows device or a trusted WSL environment. **Do not use a tunnel service key as the SSH identity** or put any secret into the `source-text` input.

## Threat model and limitations

| Threat | Boundary | Remaining risk |
|---|---|---|
| Public user uploads | No public server, no writable MCP tool, loopback-only local UI | Compromised user's device/browser still sees its own notes |
| CSRF / DNS rebinding | Exact loopback `Host`, `Origin`, random session token, strict CSP, no CORS | Malicious local apps with user's privileges may access SSH keys |
| Note manipulation | Browser per-note selection; server schema validation; second confirmation | User may approve inaccurate, sensitive or unconsented summaries |
| Replays / parallel writes | Five-minute server approval, atomic claim, file lock, duplicate suppression | Unfinished previews persist until cleanup; crashed lock requires owner review |
| Host substitution / credential theft | Strict SSH host-key checking, optional forced-command key, bounded fixed remote command | SSH trust rests on a verified key and uncompromised host |
| Cross-user access | OS/SSH identity plus private owner directory; environment-defined path, not request path | NOT a multi-tenant cloud architecture; do not share a history directory |
| Privacy / retention | No raw content in audit receipts; private JSONL stays on user host | SSH host, backups and AI platform when queried can retain selected content |

**Revocation and deletion:** Stop desktop companion to revoke the device-local session. Remove a dedicated SSH import key from the server's authorized keys to revoke future imports. Pending approvals expire within five minutes, and the owner can delete `.missing-ai-remote-pending` after stopping import operations. The private-history owner can delete imported notes from `agent-events.jsonl` after backup and careful review; an authenticated selective-delete UI is **not yet implemented**. Removing a record from the private index does not remove snippets already passed to an AI host; provider retention policies apply. Do not claim full deletion from model providers.

**Review status:** security-sensitive private import transport. Use synthetic test fixtures, run full GitHub CI, document independent security/host acceptance before advising general users to deploy. This feature intentionally does not claim full consumer one-click onboarding, native chat account sync, device pairing beyond SSH, or hosted account separation. Those remain in issue #65.

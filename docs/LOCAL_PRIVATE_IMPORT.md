# Optional local, consent-based private onboarding

**Status:** opt-in technical preview. This is a local companion for people whose private Missing AI history lives on the **same device**. It is not a hosted user account, an automatic ChatGPT history importer, or a replacement for OpenAI's approved export.

## What it does

After a **one-time local start**, open the loopback browser page, paste an approved handoff or select an existing `missing-ai-context-pack.jsonl`, preview the exact entries and count, check permission, and click **Import approved notes to my private history**. New notes are appended to the same private `agent-events.jsonl` already used by `missing_ai_history_status` and `missing_ai_search_history`. Duplicate notes are skipped. The existing MCP remains read-only and reloads files at its next call.

## Setup (local owner-controlled device)

Install Node.js 22+ and obtain a reviewed Missing AI checkout. No `npm install`, network service, account, or browser extension is needed. Run under **the same unprivileged user account that owns** the history folder:

```sh
mkdir -p "$HOME/.missing-ai-history"
chmod 700 "$HOME/.missing-ai-history"
MISSING_AI_HISTORY_DIR="$HOME/.missing-ai-history" node private-history/local-import-server.mjs
```

Open the exact `http://127.0.0.1:<port>/` printed by the program **on that same device**. Stop it with Ctrl+C when finished. Do not browse to a public hostname or proxy this port to the internet. This local companion must share the exact history directory with an existing local MCP instance to update that instance.

If your private history lives on a **remote server** (for example, your own secured host), this local companion **does not** transparently connect to it. A separately reviewed private channel or authenticated per-user synchronization service would be required. Do not publicly expose the loopback importer or forward it to a shared/reachable host. Remote multi-tenant onboarding remains a separate engineering milestone; no website button silently writes to a remote connector.

## Privacy and security boundaries

- The server binds **only to 127.0.0.1** on a system-selected port, and rejects any other bind address and non-loopback client. It checks the exact `Host` header to reduce DNS rebinding, enforces same-origin `Origin` and a random in-memory session token on state-changing requests, and emits no CORS permissions.
- A preview is a read-only dry run; a second, single-use short-lived approval token is required to commit. The browser UI requires a checkbox and explicit confirmation. Changing the text resets the browser's pending approval.
- Only the reviewed-note schema is accepted. Secret-pattern detection is **not** comprehensive; users must remove their own sensitive/private third-party information first. The server logs only the startup URL; no submitted notes or file paths are logged.
- Files are staged in an owner-private temporary directory under the authorized history folder, imported using the existing hardened local CLI routine, and cleaned up. Existing events are preserved. An import does not alter the ChatGPT MCP tool list or remote tunnel process.
- The user account must own the private directory with mode `0700`. Existing history files must be regular, private and non-hardlinked, as enforced by `import-context-pack.mjs`. Concurrent independent imports/writers are not supported; use a single companion per history folder and stop other writers while importing.
- The companion operates over unencrypted **local loopback HTTP**. This protects against network eavesdropping only insofar as loopback traffic stays on a trusted device. It does not protect against local malware, browser extensions, another process with equivalent user privileges, or compromised operating systems.
- This does **not** provide user authentication for a public internet service, multi-user isolation, automatic conversation synchronization or verified semantic truth. Do not deploy it as a public API or advertise it as one-click cross-device sync.

## Acceptance and rollback

Run `node --test tests/local-import-server.test.mjs` and `npm test` on the reviewed commit. Test preview without writes; approval/commit; duplicate replay; forged Origins/tokens; malformed notes; private directory permissions; unchanged existing events; response CSP and no CORS. Browser UI smoke testing is separately required before broad-release claims.

To stop or roll back, Ctrl+C the local companion. It makes no persistent service or account changes. To remove user-approved notes, review and edit the private history under the owner-controlled system; this companion deliberately does not expose deletion or bulk export endpoints. **Do not put private history or secrets in GitHub, CI artifacts, support tickets or publicly shared logs.**

**Disclosure classification:** REVIEW under `docs/OPEN_SOURCE_BOUNDARIES.md` because this is a local write path for user-selected data. Release requires maintainer approval, static inspection and passing independent CI; keep all test fixtures synthetic. Public release of this source does not automatically deploy anything on a private host.

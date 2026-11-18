# Instant context onboarding — opt-in local onboarding — reviewed release candidate

## User-first flow

1. **Start immediately:** Open `site/quickstart.html`. Paste a personally reviewed summary or chosen chat excerpt, or use the optional handoff prompt in a ChatGPT/Claude conversation and review its response.
2. **Preview and explicitly approve:** Each entry is visibly attributed as a *user-reviewed note*, not the original speaker or independent verification. A checkbox confirms permission and redaction before adding it to browser memory.
3. **Use it:** Paste the new AI response to see related historical claims and possible repeated-access/repeated-work warnings. Findings are keyword-based suggestions, not facts.
4. **Keep it optionally:** Download only the approved notes as unencrypted `missing-ai-context-pack.jsonl`, or reopen such a file in the browser. No background upload or automatic chat-history access occurs.
5. **Use with private MCP only when explicitly authorized:** Run the separate `private-history/import-context-pack.mjs` CLI on a trusted private device. It previews counts by default, appends to the private `agent-events.jsonl` only with `--apply`, and skips matching note duplicates. It never prints contents. The private three-tool MCP server stays read-only and auto-refreshes on its next call.
6. **Add the full export later:** The existing `site/history.html` import remains optional for local browser review; the private MCP can read an authorized `conversations.json` placed outside the public repository.

## CLI example (private Linux host with Node 22+)

```sh
# First transfer the user-reviewed JSONL through a secure method and restrict access.
# Use the same private account that owns the history directory; avoid concurrent writers.
export MISSING_AI_HISTORY_DIR="$HOME/.missing-ai-history"
chmod 700 "$MISSING_AI_HISTORY_DIR"
node private-history/import-context-pack.mjs /private/path/missing-ai-context-pack.jsonl --dry-run
node private-history/import-context-pack.mjs /private/path/missing-ai-context-pack.jsonl --apply
```

For an existing Docker-based private MCP, run this CLI in an **isolated, no-network Node 22 container** with a read-only source checkout and the approved history folder mounted read-write, using the same UID as the private MCP. Check `missing_ai_history_status` afterward. Do **not** make private history directories writable by the public web service, publish them on a public URL, or upload JSONL to GitHub. Avoid concurrent writes to `agent-events.jsonl` during import.

## Privacy and trust boundaries

- The static page sends **no data** to Missing AI: `connect-src 'none'`, text inserted with DOM `textContent`, session-only browser memory and explicit local file download. A compromised browser, extension or operating system may still see it.
- The downloaded pack is **unencrypted plain text**. It may contain sensitive personal data. Users must review, protect, and delete it themselves. The UI includes warnings and an explicit download confirmation.
- The common patterns used to flag likely secrets are incomplete: **they are not a credential detector**. The UI requires a separate human review.
- This initial UI does not automatically read entire platform chat histories, transfer notes to a ChatGPT connector, or silently capture future messages. Per-account automatic sync and hosted multi-tenant storage are out of scope.
- The importer requires the private-directory owner identity and rejects symlinks, hardlinked or group-readable history files, oversized and malformed inputs, role spoofing and obvious duplicate notes. It does not parse private history into GitHub or logs. Its append check is not a multi-process transactional lock; run it without concurrent writers. Existing event files keep their ownership; for a newly created file, ensure the service user can read it.
- The search engine remains `context-lexical-v1`; it may miss paraphrases or return irrelevant matches. Historical notes are not verified implementation/access evidence.

## Change classification and review requirements

**REVIEW** under `docs/OPEN_SOURCE_BOUNDARIES.md` because adding a portable history export and a local import CLI changes data-handling flow. New content is generic and synthetic; no tokens, personal conversations, provider secrets, host identifiers or infrastructure configuration are included. A security/privacy/compatibility review, owner disclosure decision, and independent CI must precede publication to the public repo or production release. Publishing site code is separate from installing the private CLI on an authorized device; do not assume the live private MCP has been upgraded.

## Acceptance tests

- A pasted 15,000-character approved summary is split into at most 3,000-character notes, reviewed without external network calls, and searchable immediately.
- Download + restore roundtrip preserves note text and source title; repeated imports don't duplicate identical notes.
- JSONL with forged `assistant` role, symlinks, oversized files, malformed JSON and likely credential patterns are rejected.
- Dry-run does not write history; `--apply` preserves existing agent events and appends only approved notes; MCP subsequently sees them without a restart.
- Browser preview and review never render untrusted snippets as HTML; keyboard/accessibility interactions and narrow-screen layout are checked.

Import the context pack using the same unprivileged UID as the history directory owner. Do not run the importer as root when that directory belongs to another user.

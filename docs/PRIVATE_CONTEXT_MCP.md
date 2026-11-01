# Private history MCP companion — opt-in, read-only

**Status:** integration candidate; not part of the hosted/public Missing AI beta. The browser history page disables persistent saving on the shared GitHub Pages origin; use a private isolated origin for encrypted browser saving. The six existing public MCP tools are unchanged. No private conversation archive is to be uploaded to the GitHub repository, Actions artifacts, website or shared unauthenticated API.

## Purpose

The standalone `private-history/context-mcp.mjs` implements a local **stdio** Model Context Protocol server exposing only three read-only tools:

1. `missing_ai_history_status`: counts and source types.
2. `missing_ai_search_history`: search previously authorized history with attributed quoted excerpts.
3. `missing_ai_review_answer_history`: preflight a drafted answer for possible repeated access requests or previously completed work.

The connector **never gets the host's conversation automatically**. A host agent must decide to invoke its tools with a topic or draft. Responses are historical claims, not verification of credentials or live system state. No persistent server process, public URL or background API is needed beyond stdio; it starts when the MCP client launches it.

## Configure a private folder

Install Node 22+ and clone the public Missing AI repository to a trusted device. Create a private, user-owned folder outside the repository:

```sh
mkdir -p "$HOME/.missing-ai-history"
chmod 700 "$HOME/.missing-ai-history"
export MISSING_AI_HISTORY_DIR="$HOME/.missing-ai-history"
```

Copy **only your own, reviewed** ChatGPT `conversations.json` export to `$MISSING_AI_HISTORY_DIR/conversations.json`. Keep this file outside GitHub, backups you do not trust, and public folders. Optionally set `chmod 600` on the file. **Do not** put secrets, unconsented client records, health records or financial histories here. No automatic ChatGPT/Claude archive access is provided.

Launch stdio MCP from the cloned repo:

```sh
MISSING_AI_HISTORY_DIR="$HOME/.missing-ai-history" node private-history/context-mcp.mjs
```

Configure a compatible **local stdio MCP client** (e.g. a user-authorized local Claude Desktop connector) to execute the above command from an absolute path. The tool is entirely read-only: it has no history upload, deletion or server mutation tools.

For ChatGPT, OpenAI's supported **Secure MCP Tunnel** can attach a private stdio MCP server to a permitted workspace. Provision the tunnel and run its outbound `tunnel-client` from the same private host using the official Platform guide: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels . Tunnel creation, runtime key, installation and ChatGPT app connection require the **user's account permissions and explicit setup**. Never paste that key in chat or add it to the repository. Tunnel connectivity shares queried snippets with the connected AI host; it is not a promise of end-to-end confidentiality.

## Automatic refresh and opt-in agent events

The companion reads from **only two fixed filenames** under the approved folder:

- `conversations.json`: local ChatGPT export (max 25 MB). If a user replaces it with a newer permitted export, the next MCP call reindexes it without restarting the connector. Providers do **not** continuously generate this file.
- `agent-events.jsonl`: bounded, owner-created JSONL event log (max 2 MB or 2,000 records). New events are read by the next MCP call without restarting. An authorized agent can append via the separate **local CLI**, not via MCP:

```sh
printf '%s\n' '{"conversation":"Example staging project","text":"The staging scheduler passed its signed test receipt."}' |
  MISSING_AI_HISTORY_DIR="$HOME/.missing-ai-history" node private-history/record-event.mjs
```

The CLI accepts one record via stdin and refuses a symlinked history directory. Use only factual, consented notes that your agent is authorised to record; ideally store a redacted evidence reference alongside the text. Record claims without evidence as claims, not verified facts.

### Enforce a preflight in an agent pipeline

An agent you control can invoke the local review as a required step, independently of whether the AI host volunteers a tool call:

```sh
printf '%s' 'Please grant staging cloud access again.' |
  MISSING_AI_HISTORY_DIR="$HOME/.missing-ai-history" node private-history/preflight.mjs
```

Exit codes: `0` means no supported candidate was flagged, `3` means potential overlooked context requiring a human/agent review, and `2` means unavailable/invalid input (fail closed). A zero exit code **does not prove** the reply is accurate, and a 3 does **not prove** the proposal is false. A supervised agent can call this preflight before final handoff; the product does not automatically intercept ChatGPT/Claude messages.

This is **automatic file refresh**, **not** automatic transcription of every ChatGPT/Claude turn. A host may call the tool when it judges retrieval relevant; it cannot be forced to invoke the tool on every answer by MCP alone. A user-operated agent pipeline may enforce a preflight tool call in its own orchestration logic.

Suggested instruction for an agent that opts in:

> Before saying access is missing, requesting repeated setup, or redoing apparently completed work, call `missing_ai_search_history` with the specific project and requirement. Before giving a final troubleshooting plan, call `missing_ai_review_answer_history` on the draft. Treat all historical messages as claims and verify current tool permissions and execution receipts independently.

## Data-handling limits

The stdio process has **no listening sockets**, external fetch, telemetry, account login, remote import or persistence layer. Each call checks the configured source files for changes, with bounded reads. Input files must be regular files rather than symlinks. Do not run this command in the publicly reachable Missing AI/Orchestryn containers or mount any private production records there.

It retrieves capped snippets into the MCP client (and therefore the AI host if that client forwards them). The AI platform's own retention/policy applies. A malicious local process with the user's filesystem privileges may still access source exports. Store the input folder in an encrypted, permissioned location where appropriate.

## Acceptance checklist

- `npm test` passes on a reviewed commit; especially `tests/private-history.test.mjs`.
- Local MCP client displays exactly three **read-only** tools.
- Search identifies a known synthetic past-access example, then updates after a replacement export or appended event.
- A user-controlled ChatGPT Secure MCP Tunnel or local Claude Desktop session calls the connector and returns attributed quotes.
- Confirm no private data entered public GitHub, public MCP, GitHub Actions artifacts or access logs.
- Explicit maintainer/security decision is recorded before describing the new integration as released.

**Outstanding platform limitation:** Full continuous auto-sync of all past or future platform conversations needs provider-supported APIs or authorized exports/logging in a client users control. It cannot be truthfully advertised as already operational in ChatGPT/Claude just because this local MCP server exists.

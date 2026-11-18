# Two-provider beta readiness: ChatGPT and Claude custom MCP

**Status: working matrix for the invite-only beta, not a readiness declaration.** It records what the repository's own synthetic tests show about the stateless MCP service when it is reached from the ChatGPT and Claude browser origins, and what has **not** been verified. Related: roadmap [#86](https://github.com/AbdulkadirKhoujja/missing-ai/issues/86).

The custom MCP connection is not a directory-listed or approved plugin for either product.

## Try it locally

Requires Node 22 or later. No account, key or network access is needed.

```bash
node examples/two-provider-mcp-walkthrough.mjs
```

The script starts the service on a loopback port inside its own process, runs the same invented booking review once per origin (`https://chatgpt.com`, `https://claude.ai`), and prints one JSON receipt. The review finds four candidate requirements: two the answer claims to cover, one it contradicts ("Payment receipts have not been implemented.") and one it does not mention.

The receipt always contains `live_chatgpt_client_verified: false` and `live_claude_client_verified: false`. The "host judgments" are a fixed script standing in for a model. The script does not contact the hosted beta.

## Check your own endpoint before connecting it

If you host the service yourself, this runs the same scripted requests against your endpoint for both browser origins and prints one JSON receipt of named checks:

```bash
node examples/check-mcp-endpoint.mjs https://your-host.example/mcp
```

Without a URL it checks an in-process loopback copy, which shows what a passing receipt looks like:

```bash
node examples/check-mcp-endpoint.mjs
```

It checks: an `https://` URL on port 443; the CORS preflight; `initialize`, the `initialized` notification and the six-tool list; one review of the invented booking example; refusal of a fabricated quotation; refusal of a look-alike origin; and that both origins received identical results. Exit status is 0 when every check passes, 1 when any fails and 2 when the URL is refused. Plain `http://` is accepted only for loopback addresses, and URLs containing credentials are refused.

Only the invented booking example is sent, and only to the URL you give. One run makes about a dozen requests, which count toward the service's hourly per-address limit. A passing receipt still contains `live_chatgpt_client_verified: false` and `live_claude_client_verified: false`: the requests come from your machine, not from either product, and the check says nothing about the endpoint's security. It has been run only against the local reference service in `tests/mcp-endpoint-preflight.test.mjs`, not against the hosted beta.

## Record a manual live-client run

The "live client connects" row below can only be filled by a person using ChatGPT or Claude. To write that observation down in one fixed shape:

```bash
node examples/live-client-run-record.mjs --blank chatgpt > chatgpt-run.json
```

Use `claude` for the other client. Do the run by hand with invented example data only, fill the file in, then check it:

```bash
node examples/live-client-run-record.mjs chatgpt-run.json
```

Each of the three steps (`connector_added`, `tools_listed`, `review_completed`) is `pass`, `fail` or `not_run`. The check exits 0 only when the record is well formed and all three passed; a blank, unfinished, failed or malformed record exits 1. It refuses records that add their own fields, skip an earlier step, list a different tool set, name a loopback endpoint, or contain an email address.

The result's `status` is `self_reported_complete`, `failed`, `incomplete` or `invalid`, and every result carries `evidence_level: "self_reported"` and `independently_verified: false`. There is deliberately no `verified` status: a well-formed but invented record passes the same check. This is a format check of a hand-written note. It cannot tell whether the run happened and is not proof. No such record is stored in this repository yet, so the row stays "Not verified".

## Matrix

"Synthetic test" means `tests/two-provider-mcp-parity.test.mjs` against a local server. "Not verified" means no evidence is recorded in this repository by that test; older acceptance notes elsewhere in `docs/` are dated observations, not current proof.

| Capability | ChatGPT origin | Claude origin | Evidence |
|---|---|---|---|
| Origin accepted and echoed for CORS; preflight allows the MCP version header | Yes | Yes | Synthetic test |
| `initialize`, `notifications/initialized` (202), `tools/list` | Same | Same | Synthetic test |
| Six tools, identical definitions: `check_missing`, `fetch_source`, `prepare_review`, `validate_review`, `prepare_bundle`, `validate_bundle` | Same | Same | Synthetic test |
| Same sources and answer give byte-identical prepared packet and validated report | Same | Same | Synthetic test |
| Fabricated quote, shifted offset, missing reference and empty review are refused with the same message | Same | Same | Synthetic test |
| An answer covering nothing produces zero covered and zero contradicted findings | Same | Same | Synthetic test |
| Look-alike or non-HTTPS origins receive 403 and no tool data | n/a | n/a | Synthetic test |
| Live client connects, lists tools and completes a review | Not verified | Not verified | Needs a recorded manual run per client |
| Host model's judgments are semantically correct | Not verified | Not verified | Outside what the service checks |
| Source extraction finds every obligation | Not verified | Not verified | Known misses: #45, #54 |

## Known gaps

These are recorded as `todo` tests. Both would change `server/index.mjs`, which is REVIEW-class under [OPEN_SOURCE_BOUNDARIES.md](OPEN_SOURCE_BOUNDARIES.md), so they await a maintainer decision.

1. **No tool annotations.** None of the six tools declares `readOnlyHint` or `openWorldHint`. The MCP project states that a tool without annotations "is assumed to be non-read-only, potentially destructive, non-idempotent, and open-world" ([MCP blog, 16 March 2026](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/)). OpenAI's server guide says to "set annotations according to actual behavior" and that they help choose confirmation behaviour ([Build an MCP server](https://developers.openai.com/plugins/build/mcp-server), read 15 November 2026). How each live client treats these six unannotated tools was **not** observed.
2. **Malformed JSON.** A body that is not valid JSON gets HTTP 400 with a plain `{"error": ...}` object rather than a JSON-RPC `-32700` parse error.

Deployment note from Anthropic's help page, read 15 November 2026: a custom connector's server "must also be reachable on the standard HTTPS port (443)", and a connector may be added with no sign-in ([Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)). Whether the hosted beta meets this was not checked here.

## What a pass does not show

Identical local responses for two `Origin` values do not show that either product's client was connected, that a model judged the content correctly, that sources were extracted completely, or that anything described in an answer was really implemented. The service has no authentication; do not send confidential or personal data to a public endpoint.

# Missing AI — outside developer handoff

**Last reviewed: 29 October 2026.** This file tells a new maintainer what exists, how to prove it works, where changes go, and what not to claim. Read alongside [CONTRIBUTING](../CONTRIBUTING.md), [SECURITY](../SECURITY.md) and [launch gates](LAUNCH_GATES.md).

## 1. Product contract

Missing AI compares requirements (pasted text or selected public HTTPS pages) against an AI answer and flags **potential gaps in the answer's claims**, not missing code or truth. Two deliberately distinct experiences exist:

- **Web / API lexical-v1:** deterministic token-overlap, sourced findings; no host language model, no semantic certification. Stable endpoint `POST /api/check`.
- **MCP host-assisted semantic:** the connected ChatGPT/Claude host proposes coverage labels. Missing AI mechanically validates exact answer quotations and complete reference accounting. Source text and answer must be treated as untrusted. No independent legal/semantic/implementation verification.

A design change must preserve this separation unless a reviewed product decision explicitly replaces it.

## 2. Local setup without private infrastructure

```sh
git clone https://github.com/AbdulkadirKhoujja/missing-ai.git
cd missing-ai
node --version  # Node 22 or later
npm test
npm run benchmark:challenge
npm start  # separate terminal; defaults to http://localhost:3000
curl http://localhost:3000/health
```

For browser UI, serve the **repository root** (not only `site/`) using `python3 -m http.server 8000` or another local static server. Load `http://localhost:8000/`. Static GitHub Pages deploy packages `site/` with `shared/checker.mjs`.

To avoid remote calls in local browser tests, use a **local, uncommitted** `config.js` with `window.MISSING_AI_API_BASE=""`. The default config points to the live beta URL importer; pasting and checking locally does not require it.

**Expected acceptance:** `npm test` succeeds, `/health` returns `{"ok":true,"service":"missing-ai","engine":"lexical-v1"}`, and the sample checker returns a potential omission rather than asserting missing implementation.

## 3. Code map and data flow

```text
User's browser, pasted text ──> shared/checker.mjs (lexical-v1) ──> local findings
                          └──> optional URL /api/fetch ──> server/source.mjs

ChatGPT or Claude ──MCP──> server/index.mjs
  check_missing / fetch_source ──> lexical checker / public HTTPS fetch
  prepare_review ──> source extraction + answer segments
  host AI proposes per-requirement judgments
  validate_review ──> ID + exact answer-quote validation
  prepare_bundle ──> up to 3 explicit source URLs/texts + source refs
  host AI proposes dedup groups, obligation labels and judgments
  validate_bundle ──> complete accounting + exact quote validation
                     └──> one source-cited Markdown and JSON report
```

Important file ownership: `server/index.mjs` (HTTP and six MCP schemas), `server/source.mjs` (SSRF-safe public fetching and links), `shared/checker.mjs` (lexical-v1), `shared/review-extraction.mjs` (candidate requirement lines), `shared/evidence-review.mjs` (single source), `shared/bundle-review.mjs` (multi source), `site/` (GitHub Pages source), `tests/` (contract regression), `benchmark/` and `scripts/` (evaluations).

**Data limits currently in code:** browser check and MCP have separate input bounds. Bundle: max three explicitly selected sources, 15k chars/source, 35k combined source text, 15k answer, 120 candidate items; each proposed group at most 12 source refs and 3 answer quotations. Source links are **suggestions**, not automatically fetched. Refer to code/tests for final authoritative limits.

## 4. API and MCP smoke

```sh
curl -sS -H 'Content-Type: application/json' --data \
'{"jsonrpc":"2.0","id":1,"method":"tools/list"}' http://localhost:3000/mcp
```

Expected six tool names in order: `check_missing`, `fetch_source`, `prepare_review`, `validate_review`, `prepare_bundle`, `validate_bundle`. This is a stateless JSON-RPC MCP implementation, not a general authentication service.

```sh
curl -sS -H 'Content-Type: application/json' --data \
'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"prepare_review","arguments":{"source_text":"- Must issue payment receipts","ai_output":"Receipts have not been implemented."}}}' http://localhost:3000/mcp
```

Read the precise tool schemas in `server/index.mjs`. Never make claims about actual source code verification from a mechanically accepted report.

## 5. Tests, releases, and measured limits

- `npm test`: unit, MCP integration, SSRF protections, deployment-script tests and benchmark scorer contract tests.
- `npm run benchmark:challenge`: historical **author-labelled** coverage challenge; not a representative quality score.
- `npm run benchmark:candidate:challenge`: experimental checker-v2, **not production**; v2 exhibited too many covered-case false alarms.
- `benchmark/semantic-v1/blind-review-pack.json`: 35 synthetic claim-answer scenarios, 17 equivalence pairs. The reference `provisional.json` has **no independent gold-label adjudication**. [Issue #29](https://github.com/AbdulkadirKhoujja/missing-ai/issues/29) is the human-review gate.
- Historical case study: [GOV.UK two-source review](silver-real-unified-acceptance-002.md). Different hosts gave different groupings (44 versus 45); tool validation does not settle semantic quality.

Use tests as evidence of implementation contracts, not certified semantic quality. New extraction heuristics must add negative examples and avoid false merge of compound and narrow requirements.

## 6. Safe contribution/release workflow

1. Open a scoped issue describing expected behaviour and failure evidence. No secrets.
2. Implement narrowly with tests; preserve backward compatibility and unknown/conditional classifications.
3. Run `npm test`. For browser changes, capture a keyboard and mobile check and inspect GitHub Pages build output. PR review is required before merging.
4. Merge code to public GitHub only after checks and review. **A GitHub merge does not deploy the remote MCP.** The static website may deploy automatically from `main` through GitHub Actions.
5. For any server release, create an isolated candidate, pin a reviewed SHA, test the exact six-tool interface and public URL safety, and roll back without touching private Orchestryn. **Do not replay historical Hetzner scripts against a changed environment.** The existing Silver public beta uses port 3106; prior ports 3101–3105 remain snapshots as of 29 Oct.
6. Do not promote public remote use without [launch gates](LAUNCH_GATES.md), especially private security reporting, privacy, abuse controls and domain isolation.

## 7. Open backlog for handoff

**Suitable for outside contributors:** improve extraction of advisory/contextual examples; reduce false positives for paraphrases; report export readability; accessible web UX; independent browser testing; docs; safe standalone Docker deployment example.

**Requires maintainer/security review:** changes to public URL retrieval/redirect checks; rate limiting; new model providers; data retention or account features; host/caddy configuration; adding broad anonymous traffic; plugin directory submissions.

**Human-gated:** independent gold adjudication of benchmark; privacy/retention policy; verified audit and security assessments; public remote launch approval.

This is designed as a **portable open-source repo**. The existing Hetzner/Orchestryn co-hosting is one operator's beta environment, **not** a dependency for running Missing AI.

# Missing AI

**Find what AI missed. Review the evidence before you trust the result.**

Missing AI is an [MIT-licensed](LICENSE) open-source tool for comparing **original instructions** with **AI-generated answers**. It highlights requirements worth a second look and shows where the evidence came from. It is for students, developers, writers, project managers, researchers, and anyone using AI for work with a brief or checklist.

**Try the free web checker:** https://abdulkadirkhoujja.github.io/missing-ai/  
**Report a bug or suggest a feature:** [GitHub Issues](https://github.com/AbdulkadirKhoujja/missing-ai/issues/new/choose)  
**Start contributing:** [CONTRIBUTING.md](CONTRIBUTING.md) · [Developer handoff](docs/DEVELOPER_HANDOFF.md) · [First issues](https://github.com/AbdulkadirKhoujja/missing-ai/issues?q=is%3Aissue+is%3Aopen)

> **Early beta.** The web checker looks for wording overlaps; it can flag paraphrases and miss implicit requirements. The ChatGPT/Claude workflow uses the host model to interpret meaning, but neither workflow verifies real-world implementation, code correctness, legal compliance, or truth. Source citations and answer quotes are **evidence to review**, not a guarantee.

## Choose how to use it

| Experience | What it does | Where text goes | What it cannot prove |
|---|---|---|---|
| **Free web checker** | Paste a brief and AI answer. Run the deterministic *lexical-v1* comparison and review highlighted lines. | Pasted text stays in your browser for the check. Loading a public URL sends that URL to a separate fetch service. | Semantic equivalence, actual completion or factual accuracy. |
| **ChatGPT / Claude custom MCP (controlled beta)** | Host AI reads up to 3 selected public source webpages or supplied texts, proposes equivalent requirement groups, and sends quotes to Missing AI for mechanical validation. | Source text and AI answer are sent to the beta remote MCP endpoint; do not submit confidential or sensitive material. | Host judgment correctness, whether obligations are legally binding, or whether software works. |
| **Self-hosted** | Run the same open-source Node service yourself and connect compatible MCP clients. | Depends on your deployment. | All of the above, unless separately verified. |

**Not a directory-listed plugin:** the custom MCP service is currently a public-address, unauthenticated **controlled beta**, not a production-grade or approved marketplace listing. Its connection is voluntary, subject to ChatGPT/Claude feature availability. It should **not** be distributed indiscriminately until the [public launch gates](docs/LAUNCH_GATES.md) are satisfied.

## A simple example

**Original instructions**
- Verify webhook signatures.
- Allow booking cancellations.
- Provide payment receipts.

**AI answer:** "Stripe events are checked using the signing secret. Customers can withdraw bookings from their dashboard. Payment receipts have not been implemented."

The semantic review may classify the first two as **claimed covered** and receipts as **contradicted**, citing exact answer wording. That does **not** mean the webhooks or cancellation flow have been tested. The web checker may produce different, less sophisticated lexical candidates.

## What works now

- Public, mobile-responsive browser checker with no login, local comparison, source line references and copyable findings.
- Public HTTPS webpage **URL import** for readable HTML and plain text, via the optional separate API. No authenticated or private pages.
- Six stateless remote MCP tools on the isolated Silver beta deployment:
  - \`check_missing\`, \`fetch_source\` — lexical comparison and bounded public URL retrieval.
  - \`prepare_review\`, \`validate_review\` — one-source, host-assisted interpretation with exact answer quote validation.
  - \`prepare_bundle\`, \`validate_bundle\` — up to three explicitly selected source pages or pasted sources, host-proposed grouping/obligation labels, one Markdown and JSON report with all source references accounted for exactly once.
- Existing lexical-v1 browser/API remains unchanged by the MCP host-assisted features.
- Offline [synthetic coverage benchmarks](docs/accuracy-benchmark.md) and a [provisional semantic challenge set](benchmark/semantic-v1/README.md) (35 synthetic scenarios, 17 duplicate pairs). The latter is **not independently adjudicated**.

**Critical boundaries:** The bundle validator checks exact answer quotation offsets and that source-reference IDs are neither omitted nor duplicated. It does **not** certify whether source items were correctly extracted, semantically equivalent, mandatory, or satisfied by an implementation. Links discovered in a source are not automatically reviewed. The beta service has no user accounts, login, payment features or saved reports.

## Run locally (Node.js 22+)

\`\`\`bash
git clone https://github.com/AbdulkadirKhoujja/missing-ai.git
cd missing-ai
npm test
npm start
\`\`\`

The API listens on **http://localhost:3000** (unless \`PORT\` is set). Check \`http://localhost:3000/health\`. For local browser use, serve the repository root using a static server that supports ES modules, for example \`python3 -m http.server 8000\` then open \`http://localhost:8000/\`. Root \`index.html\`, \`app.js\`, \`styles.css\` and \`config.js\` mirror the deployable \`site/\` assets; the GitHub Pages workflow packages \`site/\` with \`shared/checker.mjs\`.

For an entirely local browser test, set \`window.MISSING_AI_API_BASE=""\` in a *local* \`config.js\` copy to disable remote URL import; pasted comparisons do not need the backend. Don't commit local environment changes to this configuration.

**One-request API example:**

\`\`\`bash
curl -sS -H 'Content-Type: application/json' \
  --data '{"source_text":"- Must provide receipts","ai_output":"Receipts have not been implemented."}' \
  http://localhost:3000/api/check
\`\`\`

For the MCP protocol, tools and source safety limits, read [DEVELOPER_HANDOFF.md](docs/DEVELOPER_HANDOFF.md), [unified review protocol](docs/unified-source-review.md), and the [API implementation](server/index.mjs).

## Project architecture

| Path | Responsibility |
|---|---|
| \`shared/checker.mjs\` | Deterministic lexical-v1 comparison, shared by web and API |
| \`shared/checker-v2.mjs\` | **Experimental, not deployed** lexical alternative |
| \`shared/review-extraction.mjs\` | Conservative source requirement candidates for MCP reviews |
| \`shared/evidence-review.mjs\` | Prepare/validate one-source evidence-first reviews |
| \`shared/bundle-review.mjs\` | Prepare/validate source-scoped groups and generate unified report |
| \`server/source.mjs\` | HTTPS fetch, address restrictions, link discovery and readable text |
| \`server/index.mjs\` | Node HTTP API, tool schemas and MCP routing |
| \`site/\` + root mirrors | Browser UI / static GitHub Pages |
| \`tests/\`, \`benchmark/\`, \`scripts/\` | Deterministic tests and carefully labelled provisional research |
| \`deploy/hetzner/\` | **Operator-specific historical beta runbooks**, not a portable installer |

Do not use the historical Hetzner scripts as a general quickstart: they contain environment-specific Caddy assumptions and prior release checkpoints. Use the local Node commands above, or create your own isolated deployment with explicit security review.

## Contributing and trust

We welcome reproducible bug reports, improved extraction, browser accessibility fixes, examples, documentation, security hardening, and **independently reviewed** evaluations. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md) and [ACCESSIBILITY.md](ACCESSIBILITY.md). Never post secrets, private briefs, or unredacted client content to a public issue.

**Tests:** \`npm test\` and \`npm run benchmark:challenge\` are good starting points. Experimental checker-v2's early challenge run produced excessive false alerts; it was *not* promoted. A green CI run means deterministic tests pass, **not** the product is semantically reliable.

**Release boundary:** The website is a public low-stakes beta; **Silver** (loopback 3106 behind \`https://api.orchestryn.com/missing-ai\`) is the currently accepted controlled remote MCP beta as of **29 October 2026**. All prior versions are separate fallback containers. The public service shares a host/domain with private infrastructure, but uses separate routing, Compose resources and network. **Do not alter private Orchestryn** or assume this beta is suitable for arbitrary public traffic. See [release gates](docs/LAUNCH_GATES.md).

## Privacy, security and limitations

No account is required by the web page. The browser checker uses your pasted text locally, but loading a URL sends the URL to the server, and using the remote MCP sends **source text and AI answers** to that service; service/provider logs may retain metadata. There is no promised end-to-end encryption beyond HTTPS transport, no audited retention guarantee, and no assurance suitable for sensitive information. Prefer self-hosting for private work, after assessing the code.

The public API blocks non-HTTPS and local/private URL targets, pins resolved addresses, enforces request size/time limits and has basic in-process rate limits. These controls are **not a substitute** for authentication, edge protections, abuse review, monitoring or a security audit. See [SECURITY.md](SECURITY.md) and [public launch gates](docs/LAUNCH_GATES.md).

## License

[MIT](LICENSE) © 2026 Abdul Khoujja. No endorsement by ChatGPT/OpenAI, Claude/Anthropic or GOV.UK is implied. Their names refer only to compatible AI-host workflows.

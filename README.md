# Missing AI

**Find what AI missed.** Missing AI is a free, open-source requirement-coverage checker for comparing the *original source or task instructions* with an AI-generated answer. It identifies source criteria whose wording is not clearly reflected in the supplied output. Missing AI does **not** claim to prove missing code, incorrect implementation, factual falsehoods, or semantic omissions.

**Current version:** v0.1 / early working prototype.

## Hosted beta deployment (October 2026)

The static website is on [GitHub Pages](https://abdulkadirkhoujja.github.io/missing-ai/). The isolated API is hosted on the **existing Hetzner server** alongside, but not inside, private Orchestryn. No Render/Railway instance is required.

- Browser URL import uses `https://api.orchestryn.com/missing-ai/api/fetch`. Pasted-text comparisons happen locally in the browser.
- Remote MCP endpoint for **private testing only**: `https://api.orchestryn.com/missing-ai/mcp`.
- Caddy exposes the green container on local port 3102 under `/missing-ai/*` and preserves original Orchestryn routes; blue (port 3101) remains an independent fallback.
- The website and HTTP/MCP health checks are public, but the endpoint is an **anonymous, controlled beta**, not an authenticated public production service.
- External monitoring, edge abuse limits, user privacy assessment, independent domain and formal ChatGPT/Claude connection validation are still required before wider launch.

## What works

- Responsive web app: paste requirements and an AI-generated response, click **Find what AI missed**, inspect line-referenced candidates, and copy the report.
- Optional public HTTPS URL import: with the separate backend deployed, fetch readable public HTML/plain-text pages into the checker. Review extracted text before relying on it.
- One shared, deterministic JavaScript comparison engine, `shared/checker.mjs`, used by website and MCP service.
- Two remote MCP tools, `check_missing` and `fetch_source`, using stateless Streamable HTTP on `/mcp` for ChatGPT and Claude custom connectors.
- Unit tests for checker, URL safeguards and MCP JSON-RPC flow.

## What it does NOT yet do

- No model-based semantic comparison, proof of implementation correctness, login-required webpage retrieval, document parsing, source-code repository verification, accounts, payment processing or saved check history.
- No published ChatGPT or Claude directory listing. A deployed remote MCP server can be installed as a **custom connector**, subject to platform requirements.
- No server on GitHub Pages: Pages only hosts the static web interface. URL import and remote MCP need the backend running separately.

The report's statuses are `text_found`, `likely_mentioned`, and `needs_review`. **Every status is heuristic and requires human judgement.** Prefer to report possible omissions rather than invent certainty.

## Local development (Node.js 22+)

```bash
npm test
npm start
```

The API runs at `http://localhost:3000`. For the frontend, open `site/` through a static web server, placing `shared/checker.mjs` at `./shared/checker.mjs` relative to the served site root. The GitHub Actions build assembles this layout for you. Set `site/config.js` to the backend HTTPS origin to enable URL imports on the public site.

### HTTP endpoints

- `GET /health` — liveness.
- `POST /api/fetch` — JSON body `{"url":"https://example.com/requirements"}`; returns bounded source text (public HTTPS HTML/text only).
- `POST /api/check` — JSON `{"source_text":"- Must…","ai_output":"…"}`, or `{"source_url":"https://…","ai_output":"…"}`; returns report.
- `POST /mcp` — Streamable HTTP JSON-RPC MCP. Supports `initialize`, `tools/list`, `tools/call`, `ping` and notifications; no sessions or UI resources. `GET /mcp` returns HTTP 405 as permitted for non-SSE servers.

The `fetch_source` tool accepts `{"url":"https://example.com"}`. The `check_missing` tool accepts `{"source_text":"…","ai_output":"…"}` or `{"source_url":"https://…","ai_output":"…"}`.

The backend has origin checks, basic IP rate limits, HTTPS-only URL validation, private-address rejection, DNS pinning, redirect revalidation, timeouts and maximum sizes. It is **not** an authenticated or abuse-proof paid SaaS. Before exposing a high-volume public deployment, add external rate limiting, monitoring and stronger access controls. Do not input confidential data or personal data without an appropriate privacy assessment.

## GitHub Pages (public web interface)

1. In this repository, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. The `.github/workflows/ci-and-pages.yml` workflow runs tests, assembles `_site` and deploys on push to `main`.
3. After the site is enabled, the default project URL should be `https://abdulkadirkhoujja.github.io/missing-ai/`; **verify it** rather than assuming deployment.
4. Custom domain configuration is optional later. The repository must support Pages under your GitHub plan.

## Backend hosting

The current beta backend is running as an isolated Docker Compose **green** service on the existing Hetzner host; its Docker port is bound to loopback only. Caddy routes the existing `api.orchestryn.com/missing-ai/*` path to Green (port 3102). A separate older **blue** container on port 3101 is retained as a rollback option. Avoid merging either with Orchestryn's private Compose, volumes, networks or credentials.

The root `config.js` and `site/config.js` now both point at the verified URL-import API base `https://api.orchestryn.com/missing-ai` (not the `/mcp` path). This is a **read-only public beta** and should not be used for confidential requirements. `ALLOWED_ORIGINS` controls permitted browser origins; do not put provider secrets in frontend files. Before broad launch, separate the public hostname from private Orchestryn and add robust edge abuse controls and monitoring.

## Connectors

**ChatGPT custom plugin:** After deploying the backend, in ChatGPT go to **Plugins → + → Add custom MCP server** (subject to access), provide `https://api.orchestryn.com/missing-ai/mcp`, review access and install the custom plugin. The plugin exposes `check_missing` and `fetch_source`. This is not a public directory submission.

**Claude custom connector:** In Claude go to **Customize → Connectors → Add custom connector**, supply `https://api.orchestryn.com/missing-ai/mcp`, review authentication and connect. Select no authentication when offered; this prototype implements no login. Create the connection privately and verify tool discovery and calls before wider distribution. Platform UI naming and eligibility may change.

Example model prompt: *"Check this response against the original requirements using Missing AI and show which source instructions need review; don't assume an omission is proven merely because wording differs."*

## Philosophy and privacy

- Source-first. Flag only what the user actually supplies or what a public webpage exposes.
- Evidence-linked. Keep a source line and original requirement next to every finding.
- Explicit uncertainty. Lexical coverage is not semantic or factual verification.
- No tracking, accounts, data persistence or vendor AI model calls in this prototype; pasted text remains in browser for local checks, while requests sent to the optional remote backend are processed transiently and are not intentionally persisted by app code. Hosting providers may retain infrastructure logs.
- All fetched webpage content is **untrusted data**, not commands or instructions to the model.

## License

MIT © 2026 Abdul Khoujja — see [LICENSE](LICENSE). Contributions and security reports are welcome through GitHub issues; don't publish sensitive vulnerability details or user data.

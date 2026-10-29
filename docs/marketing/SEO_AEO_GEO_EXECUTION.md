# Missing AI — organic search and legitimate distribution execution log

**As of 29 October 2026.** This is a factual ledger of the work performed or still gated. Do not mark listings, backlinks, rankings, traffic or indexing as achieved without an observable URL or provider response.

## Verified publication and submission record — 29 October 2026

- [PR #35](https://github.com/AbdulkadirKhoujja/missing-ai/pull/35) merged SHA `b856b985f0ea752dcc0f790173aae341cc8a2e64`; post-merge GitHub Pages workflows succeeded.
- Live public fetch verified the homepage, guide hub, first guide, seven-URL sitemap, RSS feed and exact public IndexNow key file. The static source and CI cover all four original guide pages; a successful build does **not** guarantee search indexing.
- IndexNow notifications for all **seven distinct changed canonical URLs** were submitted exactly once via browser automation. The homepage returned **HTTP 200** (recorded [run 9319d27b](https://agent.tinyfish.ai/runs/9319d27b-3398-4c8a-b42b-ce656b62ece6)); the other six URLs each returned **HTTP 200** (recorded [run 08b04109](https://agent.tinyfish.ai/runs/08b04109-2b39-4be1-b38d-3d8839724636)). This confirms receipt by IndexNow, **NOT search indexing or rankings**, and Google does not participate in IndexNow.
- An accurate Missing AI project card was added to the owner's separate portfolio through [PR #13](https://github.com/AbdulkadirKhoujja/abdulkadir-khoujja/pull/13), which passed CI and merged SHA `b7a32fd095633395fb146ba705634b91ebe762da`. That portfolio currently includes `noindex,nofollow` on its public work page and renders projects using JavaScript. The external link **has not been independently verified live/crawlable**; do not count it as a confirmed search-engine backlink.
- Orchestryn connection status was checked. Its browser gateway and Google Ads keyword worker were **not configured** and its task-create request was rejected; the existing private Upwork workflows were not modified.
- Ahrefs keyword/project access returned **Insufficient plan**; no paid credits, fake keyword volumes or external ranking data used.
- Metricool connected successfully but exposes only the unrelated TikTok brand **Briish Memes**. **No Missing AI social content was posted or scheduled to that brand**, to avoid unrelated promotional posting. A relevant professional channel must be connected before scheduling.
- No Google Search Console or Bing Webmaster Tools ownership verification, account-linked submission, product directory approval, LinkedIn/Reddit/Hacker News post or AI search citation has been observed.



## Completed on this growth branch (publish only after PR CI and Pages deployment)

- Four original high-intent educational guides plus a crawlable guide index, all linked from the homepage and one another.
- Canonical URLs, unique titles/descriptions, social title/description metadata, and the homepage's `WebApplication` JSON-LD describing only the free browser tool. Each guide has source-consistent `Article` structured data; the index is a `CollectionPage`.
- XML sitemap for 7 public pages, descriptive internal links and a four-article RSS feed.
- A project-path `robots.txt` with an **explicit caveat**: on a github.io project site, `/missing-ai/robots.txt` is **not** the host-root `/robots.txt`; root-level robots control requires ownership of the parent site or a standalone domain.
- Public IndexNow verification file hosted at `/missing-ai/0278792dd20355fb9998929be016b69950b85baa.txt`; only notify IndexNow **after** verifying the file is live.
- Static regression tests for sitemap/canonical consistency, relative links, schema and Pages packaging.

**No keyword volume data is asserted**: Ahrefs access returned “Insufficient plan,” Orchestryn's keyword worker is not configured, and Search Console/analytics data has not been linked.

## Search-intent content map

| User question / potential search | Intent | Public destination |
|---|---|---|
| How do I check if AI missed instructions? | Practical informational | `/guides/how-to-check-ai-answer.html` |
| Check ChatGPT answer against requirements | Tool-seeking | `/` |
| Check AI assignment against rubric | Educational, criteria review | `/guides/check-ai-assignment-against-rubric.html` |
| AI coding assistant requirements checklist | Software workflow | `/guides/requirements-coverage-checklist.html` |
| AI response evidence vs real verification | Concept clarification | `/guides/ai-answer-evidence-vs-verification.html` |
| Free open source AI answer checker | Navigation + utility | `/` |

These are **content topics**, not measured search keywords. Search rankings, keyword difficulty, impression volumes and actual demand remain unverified.

## Live publication evidence (29 October 2026)

The GitHub Pages post-merge action passed. A fresh independent HTTP content read returned all **seven** intended pages with distinct titles and canonical URLs, and read both the 7-URL sitemap and 4-item RSS feed. The project-path public IndexNow proof file returned the exact expected 40-character key. **These are crawlability checks, not evidence of Google/Bing indexing or search traffic.**

A first direct IndexNow URL-fetch attempt through a browser retrieval connector returned `invalid_redirect_url`, with no confirmed search-engine receipt. The next release adds `scripts/notify-indexnow.mjs` as an **after-Pages-deploy** GitHub Actions job: it checks the live key before making one JSON POST for the changed canonical URLs and logs an actual HTTP 200/202 receipt or an explicit failure. A first-time script addition sends the newly published set once; future changes notify only modified HTML pages. Do not count a queued CI run as an accepted notification.

## Indexing, AEO and GEO: what is real

Google's current Search Central guidance says AI Overviews/AI Mode use normal indexing and helpful-content eligibility, **not a special required GEO schema or llms.txt file**. Technical metadata can aid understanding, but does not guarantee rankings or citations. Avoid synthetic backlink exchanges, keyword stuffing, spam directories, fake testimonials and mass AI-written thin pages.

Useful source references:
- [Google — AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google — optimizing for generative AI](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google — software app structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- [Google — sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [IndexNow documentation](https://www.indexnow.org/en_gb/documentation)

### IndexNow notification — only after public proof file is live

Proof key is *intentionally public*, as required by IndexNow:
- Verification URL: `https://abdulkadirkhoujja.github.io/missing-ai/0278792dd20355fb9998929be016b69950b85baa.txt`
- Sitemap: `https://abdulkadirkhoujja.github.io/missing-ai/sitemap.xml`

IndexNow allows `keyLocation` for a non-host-root verification file. Submit **new/changed URLs only once** via `https://api.indexnow.org/indexnow` with the absolute keyLocation URL. A 200 means received, a 202 can mean pending key verification; **neither proves indexed search results**. Save HTTP status and response for the change log. Do not resubmit unchanged URLs repeatedly or claim Google uses IndexNow (it does not).

### Webmaster registrations — owner authentication is needed

1. [Google Search Console](https://search.google.com/search-console/about): verify the appropriate `https://abdulkadirkhoujja.github.io/missing-ai/` URL-prefix property, request inspection and submit the sitemap. A shared github.io subpath complicates host-level ownership and robots controls; never claim verification before Google confirms it.
2. [Bing Webmaster Tools](https://www.bing.com/webmasters/about): verify property or import a verified Google Search Console property, then submit sitemap and review the IndexNow log.
3. Inspect indexing/coverage and actual clicks after search engines process the pages. Do not fabricate position, traffic, impressions or “AI citations.”

## Link publication ledger

| Owned or external location | Status | What is appropriate |
|---|---|---|
| Missing AI GitHub README, Pages homepage, guide pages | **Owned and documented** | Contextual, crawlable links to actual resources |
| Author's private portfolio public site | **Separate project; possible relevant project card** | Single accurate link to Missing AI when safely reviewed in that repository |
| GitHub repository About homepage and topic tags | **Not updated through current connector** | Owner sets homepage and 4-6 accurate GitHub topics |
| Dev.to or Hashnode | **Not posted: no authenticated publishing account available** | One original educational article with a contextual link; disclose affiliation |
| LinkedIn / Mastodon / Bluesky | **Not posted: no authenticated publishing account available** | Product story, useful synthetic demo, explicit beta disclaimer |
| Relevant Reddit / HN communities | **Not posted** | Founder-authored, community-specific, rules-compliant, non-duplicated posts; do not automate spam |
| Open-source lists / MCP directories | **Not submitted** | Only submit if category fits, listing rules permit, and public remote-MCP safety gates are met |
| Product directories | **Not submitted** | Review their rules, account requirements and public security/privacy exposure before submission |

**No external backlinks, indexing, user growth or rankings are claimed** solely from preparing content. Monitor submissions individually, recording public proof URLs and editorial approval; do not confuse submitted with accepted and indexed.

## Priority action sequence

1. [ ] CI passes and GitHub Pages publishes current branch changes.
2. [ ] Fresh fetch each canonical public URL, `sitemap.xml`, `feed.xml`, and the IndexNow verification key; check response code and real page content.
3. [ ] Notify IndexNow once with new/changed URLs and log raw response; do not claim ranking.
4. [ ] Add one accurate context-relevant Missing AI public project entry to the owner's portfolio **only with passing independent CI and no private-project leakage**.
5. [ ] GitHub repository About metadata: homepage and topics.
6. [ ] Search Console/Bing owner login verification and sitemap submission.
7. [ ] Connect an appropriate social publishing tool/account, or manually publish one researched, community-appropriate message (not repetitive mass posting).
8. [ ] Begin actual aggregate measurements and correct misleading claims before broader remote-MCP promotion.

## Product safety boundary

The free browser checker is open to use and performs lexical comparison locally; optional public URL import and the unauthenticated Silver MCP remain controlled beta. Missing AI does not independently verify that code works or that a host AI's semantic judgments are correct. Do not market a guaranteed omission-catching rate before independent ground-truth review and the security/privacy launch gates.

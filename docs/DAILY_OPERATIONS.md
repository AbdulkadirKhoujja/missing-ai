# Missing AI — daily improvement and public benchmark cadence

**Started 29 October 2026.** Scheduled ChatGPT run: **09:30 Europe/London daily**, separate from the public repository's scheduled GitHub Actions workflow. Scheduled execution and independent CI are distinct; neither guarantees that a safe code improvement exists every day.

## Daily loop

1. **Health and safety first:** inspect main commit, latest GitHub Actions, open PRs/issues and public site. Check privacy, open-source publication decisions, accessibility regressions, security disclosure channel and the risk inventory. Do not scrape or use private inputs.
2. **Reproducible benchmark:** run/check `npm test`, the **published lexical-v1** coverage and challenge synthetic fixtures, and report the candidate `lexical-v2` **separately** (never claim it is shipped). Read semantic benchmark adjudication status, but publish no independent semantic-accuracy percentage before the approved gold exists.
3. **Choose one bounded improvement:** user clarity, negative test, source anchoring, safe public documentation or evidence audit. Run tests and open a scoped PR with proof. If risk classification is REVIEW or CLOSED, do not publicly publish the risky details; give owner a sanitized recommendation.
4. **Release decision:** classify OPEN / REVIEW / CLOSED under [OPEN_SOURCE_BOUNDARIES](OPEN_SOURCE_BOUNDARIES.md) before public writes. No automatic merges to main, no production MCP redeploy and no private Orchestryn changes. Treat unknown material as CLOSED pending review.
5. **Public evidence:** a public Actions run/job summary plus artifacts contains dated synthetic metric receipts for the exact commit; the site shows a reproducible build snapshot. Do not present unchanged daily test repetitions as improved quality. Public results are versioned, never silently replaced with hand-labeled “gold”.
6. **Daily summary:** actual commit/PR/issue links, test status, case counts and denominators, changes versus last run if grounded, and the next owner decision. A day with no safe change is an acceptable outcome.

## Review gates

| Area | May be public | Requires owner or specialist check |
|---|---|---|
| Bug/regression | Fictional reproduction and tests | Real user logs, vulnerability details, internal routes |
| Accuracy | Synthetic fixture counts with caveats | Independent gold labels, claimed accuracy or superiority |
| Privacy | High-level data flow and limitations | Data retention guarantee, customer inputs, telemetry additions |
| Security | Generic guidance and sanitized issue | Fetcher, auth, rate limiting, deployment, exploitation steps |
| Open-source | Licensable code and public-scope docs | Third-party licence ambiguity, sensitive platform dependencies |
| Marketing | Verified links and bounded beta language | User testimonials, paid posting, official partnership claims |

**Stop conditions:** failed CI or provenance; possible secrets; user/client data; unknown licence; risky change without private review; misleading statistics; suspected exploitable issue; user request to pause. Unverified GitHub approvals or release permissions are not silently bypassed.

## Benchmark publication semantics

- GitHub workflow schedules a **read-only** public synthetic measurement once per UTC day. The `run-name` and Actions summary show the exact commit and date; the downloadable JSON artifact is source-backed, not human-verified truth.
- GitHub Pages `/benchmarks/` is a **last published build snapshot** of the same deterministic fixtures and ship/candidate labels, not a constantly changing production telemetry chart.
- Two unrelated ChatGPT/Claude evaluations with different labels are research observations, not accuracy rankings. Independent adjudication is a separate human task, tracked at [issue #29](https://github.com/AbdulkadirKhoujja/missing-ai/issues/29).
- Security-sensitive benchmark reports stay private until sanitized and approved. If performance worsens, disclose honest negative results rather than suppressing them.
- A benchmark that uses synthetic author labels must state precisely that the results show *behaviour against those labels*, not world-model correctness.

## Ownership and permissions

The maintainer approves main-branch changes and release decisions. External developers may fork, reproduce synthetic tests, submit PRs and discuss public issues—never production access. The optional daily assistant may draft safe work, but **cannot certify public disclosure or semantic truth** by itself. CODEOWNERS files do not configure GitHub branch protection; enabling required reviews is a maintainer Settings action.

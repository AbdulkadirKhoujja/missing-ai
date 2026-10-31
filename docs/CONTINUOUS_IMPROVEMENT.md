# Continuous product improvement — evidence-gated policy

**Status: read-only triage component proposed; no unattended product deployments, autonomous merges or cross-repository worker access.** This is a public-safe description of the Missing AI quality process, not a diagram or disclosure of any private orchestration environment.

## Goal and scorecard

Improve the chance that a user sees **genuinely missing requirements**, with fewer false alarms, trustworthy evidence and understandable explanations. Prioritise outcomes, not commit counts, fabricated daily progress or the volume of synthetic cases.

Measure these separately, each with dataset name, version, exact commit, denominator and method:

1. **Requirement extraction completeness:** requirements found / known applicable source requirements, with a separate context-only false-extraction count.
2. **Omission recall:** relevant gaps detected / labelled genuine gaps; separately report missed implicit/conditional/sub-requirement cases.
3. **False-alarm rate:** already-covered requirements incorrectly called missing / labelled covered requirements.
4. **Evidence integrity:** exact quote/offset accuracy and source-ID accounting; do not mistake these for semantic truth.
5. **Usefulness and accessibility:** reported user feedback (only with consent and privacy review), manual keyboard and screen-reader findings, reproducible user-flow checks.

Existing **lexical-v1** is the shipped local checker; v2/v3 are candidates. The host-assisted semantic tools validate quotation/reference mechanics but cannot establish implementation, legal correctness or semantic accuracy. Author-labelled synthetic fixtures are not independent gold. Keep unseen holdouts separate from development cases, retain negative findings and never present a model's own interpretation as independent truth.

## One-cycle decision contract

An external controller may request a bounded review every 30 minutes. This repository does **not** schedule those requests. Each cycle must:

1. Confirm active supervision, no overlapping work, and one authenticated collector receipt.
2. Read a recent, **complete** allowlisted public GitHub metadata snapshot. Incomplete, stale or contradictory evidence => `blocked`; never assume empty arrays mean no issues.
3. Reconcile the exact status of tracked issues and their existing PRs. Do not duplicate a proposal when the same fix is already under review or work is in flight.
4. Identify the most useful narrowly scoped improvement. An entirely valid result is `no_change`, a human-review request, or review of an existing PR.
5. For a new permissible OPEN change, prepare a test-first draft PR, run local regression and independent CI for its exact SHA, and record measured comparison with explicit limitations. REVIEW changes require maintainer/security clearance **before** public code disclosure. CLOSED materials never enter this repo.
6. Finish the cycle with a dated evidence receipt, source SHA, selected issue/PR, actions actually taken, outcomes and uncertainties. Do not claim an invocation, worker test or deployment from generated prose alone.

The active lead supervises. A coding worker may implement only in an explicitly authorised repository-scoped workspace; a reviewer may challenge assumptions independently. The scheduling service does not itself confer repository write, production, billing, secret, or CI-runner privileges. A failed worker adapter is an explicit integration gate, not permission to bypass it.

## Reproducible local triage

`scripts/improvement-triage.mjs` is a **pure, offline, read-only** public component. It accepts one bounded JSON file containing an externally collected public snapshot, optionally wrapped as `{"snapshot": {...}, "activeWork": [...]}`. It does not contact GitHub, run models, modify source, create PRs or authorise releases.

```sh
node --test tests/improvement-triage.test.mjs
node scripts/improvement-triage.mjs path/to/public-snapshot.json
```

The snapshot must state an exact 40-hex-digit main SHA, observation time, complete collection status, and tracked issues/PR states. It must be fresh within three minutes. Exit code 1 means blocked, 2 means invalid/unreadable input. Outputs identify an existing PR to review, a maintainer gate, independent human adjudication, an OPEN draft candidate, or no change; they are **recommendations only**.

Current known public dependencies are [imperative extraction #54](https://github.com/AbdulkadirKhoujja/missing-ai/issues/54) and [related PR #46](https://github.com/AbdulkadirKhoujja/missing-ai/pull/46), [semantic adjudication #29](https://github.com/AbdulkadirKhoujja/missing-ai/issues/29), and [accessibility #31](https://github.com/AbdulkadirKhoujja/missing-ai/issues/31) with [PR #58](https://github.com/AbdulkadirKhoujja/missing-ai/pull/58). Their states must be read live; these links do not assert acceptance or deployment.

## Review rhythm and stop conditions

- **Half-hour:** read/triage/resume one bounded issue; minimise redundant work.
- **Daily:** run/check exact-commit tests and fixed benchmark datasets; produce one compact digest with citations, denominators, changed results and blockers. Preserve the already approved daily quality process until an independent replacement is verified.
- **Weekly:** review genuinely new failure classes, blind holdouts, human experience and adoption evidence; select at most three priorities.
- **Monthly:** compare meaningful improvements in omission recall, false alarms, extraction and user value against a preserved baseline; revise direction if no improvement is demonstrated.

Stop before any public write if provenance, licence, disclosure class or sensitive input is uncertain. Do not auto-merge, redeploy hosted MCP, manufacture benchmarks, spend money, run unsafe external checks, or solicit users automatically. See [open-source boundaries](OPEN_SOURCE_BOUNDARIES.md), [daily operations](DAILY_OPERATIONS.md) and [launch gates](LAUNCH_GATES.md).

**Integration limitation:** this triage component is not proof of an operating worker pipeline. A separately reviewed, authenticated, repository-scoped handoff plus exact-commit test evidence is required before autonomous code proposals can be made safely.

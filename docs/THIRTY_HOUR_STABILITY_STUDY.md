# Missing AI — 30-hour controlled stability and extraction study

**Protocol 1.0 · 29 October 2026 · in progress / observations pending.**

This is a reproducibility/diagnostic soak of the *current live connected* Missing AI tools, **not** a claim of 30 independent accuracy measurements, a usability trial, an external audit or confirmation of deployment quality. The study must not be marketed as an increase in accuracy merely because it runs repeatedly.

## Scope and schedule

- **30 hourly observations:** 29 October 2026 at 19:00 through 31 October 2026 at 00:00, Europe/London (GMT); 30 scheduled attempts with `COUNT=30`.
- **One post-study review:** 31 October 2026 at 01:00 Europe/London.
- **Read-only measurement:** no changes to the live API/MCP, GitHub main, private Orchestryn infrastructure, credentials, user telemetry or customer data during hourly observations.
- Source: original fictional or licensed public text only. Connected tools, if available: `prepare_review`, `validate_review`, `prepare_bundle`, `validate_bundle`. Tool invocation success must be evidenced, never inferred from a drafted response.
- **Trace boundary:** this study may preserve private count-only dated evidence in an approved owner-controlled log. Publish a sanitized report only after owner review. Do not publish private paths, prompts from real clients, logs or host topology.

## Baseline, not a fix claim

Before the first scheduled observation, the live `prepare_bundle` returned **3 extracted candidates for 4 plainly imperative fictional source lines**, omitting:

> Issue payment receipts for completed payments.

The remaining line from that source was “Include a support contact in receipts.” This shows **under-extraction on one authored test**. It does **not** establish a population-level 75% recall.

- [Synthetic reproduction, issue #45](https://github.com/AbdulkadirKhoujja/missing-ai/issues/45)
- [Proposed, non-deployed source-extractor regression fix, PR #46](https://github.com/AbdulkadirKhoujja/missing-ai/pull/46)
- The validator's `all_source_requirements_accounted_for` checks **all extracted refs**, not all real obligations in the original source. That distinction is part of the acceptance test.

The current free browser and HTTP checker's **lexical-v1** is separate from host-assisted semantic MCP extraction. Experimental lexical-v2/v3 also remain separate; do not silently mix their labels or evidence.

## Evaluation design

Every scheduled run performs the same exact **fixed canary** (both source pages and the AI answer in #45). Then rotate six *distinct diagnostic families* five times each:

1. Semantic paraphrase of the same claim, without assuming paraphrase = implemented.
2. Compound or timing-sensitive requirements (before/after; partially covered).
3. Negation and explicit “not implemented” evidence.
4. Optional/contextual example bullets vs imperative instructions.
5. Duplicate sources versus narrower/compound requirements: preserve all refs before grouping.
6. Public URL/linked-page scope, unknowns and unreviewed links (no private or authenticated URLs).

**Stability denominator:** scheduled attempts actually executed, successful MCP call batches, repeat failures by family and exact code/release identity. The repetitions assess deterministic consistency and drift only. Source extraction is audited against explicitly written **fictional** obligations with a line-by-line provisional expected count. Host semantic judgments are not independently verified.

At each hour, collect:

| Field | Definition |
|---|---|
| Time / run key | UTC timestamp; stable unique hour key for deduplication |
| Source revision | Recorded GitHub SHA and separately observed deployed engine/connector version, if known; never assume they are identical |
| Tools | Actually invoked names, outcomes and failure conditions; no inferred Claude execution |
| Fixture IDs | Fixed canary + rotating family; original exact texts must remain locally reproducible |
| Explicit source lines | Provisional expected count, independently read from synthetic text, with line refs |
| Extracted candidates | Count and exact source refs returned by the tool |
| Under-extraction | Specific, source-quoted imperative lines dropped; do not hide them behind validator completeness |
| Over-extraction | Contextual/example lines wrongly elevated; manual review needed |
| Quote evidence | Exact original answer substring, start/end offsets and mechanical validation results |
| Host judgments | `claimed_covered`, `contradicted`, `not_clearly_mentioned`, `cannot_determine` as proposals, not verified semantics |
| Limits | Link scope, code visibility, manual review status, inability to access other host runtimes |
| Result | Real passed/failed/degraded/blocked status with verifiable context |

A checked quote only establishes that **those characters occurred at that location in the supplied answer**. It does not establish that the claim is accurate or implemented. When a tool is unavailable, record BLOCKED and do not backfill imagined outcomes.

## Metric handling

- Publish **actual counts with denominators**: successful tool invocations / attempts, explicit fixture obligations retained / expected, false-extracted *synthetic* contextual items / reviewed items, and verified quotes / submitted quotes.
- Always separate **per-unique-case** from **per-hour repeated measurements**. 30 repeated successes are **not** 30 independent model successes or a meaningful accuracy estimate.
- A regression is measured against a pinned source/engine and identical fixture, not a narrative impression. Record failures and ambiguous cases as such.
- This study cannot establish real-world precision/recall, safety, semantic reliability, benchmark superiority, legal obligation status or downstream implementation success. No confidence interval or statistically significant claim from this convenience set.
- Compare fixed canary against the separate PR test after release **only when an independently confirmed deployment is made**. A passing PR CI run is not a production update.
- Future blinded holdouts and two qualified independent reviewers are handled separately in [semantic benchmark protocol](../benchmark/semantic-v1/README.md) and [issue #29](https://github.com/AbdulkadirKhoujja/missing-ai/issues/29).

## Post-study review

1. Audit the observation ledger: count **actual persisted** run notes; reconcile missing, duplicated or failed hours with schedule.
2. Group failure modes: requirement under-extraction, contextual over-extraction, quote-position errors, semantic disagreement, source links, host unavailability, and accidental engine/version mixing.
3. Compare live evidence to candidate regression tests and baseline; determine if failure persisted, improved or changed **without assuming a deploy**.
4. Propose a short ranked improvement backlog with synthetic minimal repro, failure/negative cases, measured risk, and **OPEN / REVIEW / CLOSED** disclosure class.
5. For OPEN-only documentation/UX changes, create an isolated reviewed PR if appropriate. For extractor/core checker, server, security and release changes, seek maintainer decision and separate independent tests before staging or promotion.
6. Publish a factual summary with visible gaps and no synthetic data laundered into “real-world accuracy”. Keep any private diagnostic evidence private.

## Known cross-host limit

The user provided a Claude-app report of all four MCP tools invoked successfully, reproducing the extraction omission. That is not the same as our independent control trace. The Claude worker reached through private Orchestryn during a separate test did **not** have Missing AI tools; this hourly schedule does not repair Claude connectivity or pretend to run Claude itself. Cross-host equality remains a **manual independent follow-up**, not an hourly measurement from the wrong runtime.

**Safety policy:** [open-source disclosure gates](OPEN_SOURCE_BOUNDARIES.md) · [daily operations](DAILY_OPERATIONS.md) · [release gates](LAUNCH_GATES.md). No automatic merge, release, model tuning, or arbitrary user-data collection is authorized by the schedule.

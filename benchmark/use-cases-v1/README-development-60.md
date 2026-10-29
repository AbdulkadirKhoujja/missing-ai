# 60-case source-extraction development benchmark

**29 October 2026. Public synthetic research material — not independent ground truth, not a held-out accuracy benchmark.**

This is a follow-on to the 12 *actually observed remote tool* cases in draft [PR #53](https://github.com/AbdulkadirKhoujja/missing-ai/pull/53) and the source-extractor correction draft [PR #46](https://github.com/AbdulkadirKhoujja/missing-ai/pull/46). The sixty new instructions are **distinct, author-written one-line requirements**, ten per major AI use category: writing/editing, research/information, advice/planning, education/learning, business/workplace deliverables and coding/technical. Twelve ordinary contextual sentences form deliberately limited negative controls.

## Purpose

Test **which explicit source instructions the checked-out source extractor includes**, and which it omits. A string labelled `expected_source_candidate_count: 1` is a *fixture-construction assumption* about an overtly imperative line, not proof of legal obligation or universal semantic ground truth. The accompanying AI answers are realistic fictional context and are **not scored** for semantic coverage.

The public 60-case development set is **NOT independent of the project** and is not hidden from models. Do not report 60 cases as 60 human-reviewed outcomes or extrapolate its coverage percentage to the population.

## Run

```bash
npm test
node scripts/evaluate-extraction-development.mjs benchmark/use-cases-v1/development-60.json
```

The second command produces a structured JSON report of:
- actual positive requirements exactly retained out of sixty;
- specific IDs missed;
- actual contextual negative controls left alone out of twelve;
- per-category denominators and misses;
- explicit source revision and interpretation limitations (to be supplied by whoever runs it).

CI automatically runs the unit test and prints a concise source-capture diagnostic; this is a **local source-code test**, *not* another live MCP request. Candidate and baseline revisions can run the **same pinned fixture**, but never infer that a passing CI patch has been deployed.

## Methodological constraints

- Keep extraction (requirements discovered in source) separate from classification (whether answer appears to address them).
- Context items are only twelve easy negative controls and do not establish a useful false-positive rate in real web documents.
- The first 12-case MCP observation remains a distinct backend measurement; do not silently count local runs as hosted tests.
- Add more challenging sources in subsequent phases including multi-paragraph prose, applicability, footers, choices and linked references; do not blindly add every English imperative to a regex.
- Before product-wide precision/recall claims, use different authors, new cases and defensible evidence oracles; keep source/version provenance.
- Changes to core semantics, benchmark scoring and production release require the repository's REVIEW process.

Useful reference: [majority-use-case plan draft](https://github.com/AbdulkadirKhoujja/missing-ai/pull/52).

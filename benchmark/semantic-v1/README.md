# Semantic reliability benchmark v1 — provisional, source-anchored

**Status: NOT independently adjudicated. This suite MUST NOT be used to claim public semantic accuracy.**

This evaluation was created after [ChatGPT–Claude disagreement](https://github.com/AbdulkadirKhoujja/missing-ai/issues/18) over one real two-page GOV.UK accessibility review. Both hosts completed the MCP integration test, but they disagreed on whether testing claims established working assistive-technology support, whether regular test cadence was evidenced, and which recommendations were mandatory. The Missing AI bundle validator checks the **exact supplied quote and ID accounting**, not semantic truth.

## Scope and provenance (29 October 2026)

- 22 distinct **source-anchored criteria** from two real [GOV.UK accessibility introduction](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) and [accessibility testing](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) pages.
- 35 **synthetic AI answers** varied systematically around those criteria: paraphrase, explicit denial, vague evidence, missing subconditions, an internal-vs-external audit distinction, time and phase boundaries, contextual examples, user cohorts, conditional applicability and *testing versus successful operation*.
- 17 **requirement-equivalence pairs** covering true duplicates and traps (subset vs compound, different phases, alternative placements, same topic but distinct obligation).
- Each record preserves its source URL, exact short anchor excerpt and extracted source ID corresponding to our 29 October Silver public review. All 22 short anchor excerpts were checked against the actual fetched GOV.UK readable text when authored. The synthetic answers are **not real software implementations or client statements**.

**Provenance caveat:** Source excerpt matching is a mechanical check on readable text. The label `mandatory` describes how the GOV.UK guide is interpreted in its relevant service context, not a universal legal determination. Example costs such as an external recruitment agency are `context_only`, not requirements to buy that service.

## Files

| File | Purpose |
|---|---|
| `provisional.json` | Author-proposed source strengths, expected judgments, answer evidence, equivalence decisions and rationales. **Not ground truth.** |
| `blind-review-pack.json` | Same public requirements and scenarios **without** author-proposed labels; use for independent assessors and model runs. |
| `predictions-template.json` | Schema with every case ID and pair ID; complete it for each ChatGPT or Claude run. |
| `scripts/score-semantic-benchmark.mjs` | Offline deterministic scoring of fully completed model outputs against **explicitly provisional** proposed labels, with safety gate on independently adjudicated release scoring. |
| `tests/semantic-benchmark.test.mjs` | Mechanical benchmark/scoring tests. A 100% unit-test fixture mirrors the author labels and is **not** an AI model result or accuracy estimate. |

## Running a blinded host evaluation

1. Give one host **only** `blind-review-pack.json` and `host-evaluation-prompt.md`. Do not include `provisional.json` or earlier ChatGPT/Claude classifications.
2. Ask the host to produce one JSON object following `predictions-template.json`. Require **all 35 case judgments** and **all 17 pair equivalence decisions**, including short reasons; `claimed_covered` or `contradicted` must carry a source-answer-exact `quote` and its zero-based `start`. Explain that this is a claim-coverage study, not checking real implementations.
3. Save separately as, for example, `chatgpt-run-01.json` and `claude-run-01.json`. Record actual host/version, prompt, model settings and run timestamp. Do **not** copy previous host labels.
4. With Node 22+ run:
   ```sh
   node scripts/score-semantic-benchmark.mjs --predictions chatgpt-run-01.json --json > chatgpt-provisional-score.json
   node scripts/score-semantic-benchmark.mjs --predictions claude-run-01.json --json > claude-provisional-score.json
   ```
5. Inspect **per-case disagreements**, not just aggregate percentages. The scorer rejects missing/duplicate IDs, malformed classifications and fabricated or displaced quotes.

Do not use `prepare_bundle` to compare each tiny synthetic answer independently by fetching 35 pages repeatedly. Those public source excerpts are already documented; the host evaluates the blind pack and emits a prediction file. Use the actual Missing AI MCP separately when testing integration.

## Scoring definitions

The scorer reports:

- **4-way judgment exact accuracy and confusion matrix**: `claimed_covered`, `contradicted`, `not_clearly_mentioned`, `cannot_determine`.
- **Source-strength agreement**: `mandatory`, `recommended`, `conditional`, `context_only`, `uncertain`.
- **Omission detection**: test-positive = `contradicted` or `not_clearly_mentioned`; test-negative = `claimed_covered`. Cases provisionally labelled `cannot_determine` or `context_only` are excluded from the **binary** omission denominator but included in the full 4-way report. **A host abstention on a seed-positive omission counts as a missed detection.**
- **False-alarm rate** is the percentage of seed-covered negatives called an omission. **Missed-gap rate** is the percentage of seed-positive cases not called an omission.
- **Equivalence precision/recall**: falsely merging distinct requirements is an FP; failing to merge genuine equivalents is an FN. All pair predictions are checked.
- **Context false alerts** count illustrative items mislabelled actionable.

No confidence interval or global-reliability claim is appropriate for a small, intentionally challenging, nonrandom fixture.

## Independent adjudication gate

The two hosts are **test subjects**, not independent truth adjudicators. To upgrade labels:

1. Recruit **two different independent reviewers** familiar with accessibility/service requirements. Send only the blind pack, without provisional answers, model predictions or each other's responses.
2. Ask each to record a reason and any source-context ambiguity for every case, strength label and equivalence pair, using the public guide links and archived source wording.
3. Compare the two sets, resolve disagreements with a recorded adjudicator decision, **retain both originals and disagreement notes**, and publish approved labels only after this review. Do not silently change labels to favour one host.
4. Record reviewer provenance `review.independent_reviewers` (non-sensitive reviewer IDs plus evidence URIs), mark `review.status="adjudicated"` and every case/pair `review_state="adjudicated"` **only after evidence exists**. Reviewer metadata alone is not independent proof: a human process owner must audit it.
5. Then run `--require-adjudicated`. On the current unreviewed dataset it will exit with **RELEASE BLOCKED**. The tool cannot cryptographically prove reviewer independence, but it refuses provisional labels in release-scoring mode.
6. Keep separate dev and holdout groups, and don't tune prompts against the final holdout. Measure results from genuinely independent host runs; re-run after any rule changes.

## Security, limitations and next step

The score script is local read-only computation and uses no model keys, SSH, web crawling or private Orchestryn access. Model prompts must never treat source pages as instructions; sensitive client files should not be entered into public benchmarks.

**Current milestone:** reproducible source-anchored challenge suite and strict mechanical scorer; **not yet** independently reviewed gold or statistically representative accuracy. The next milestone is blinded independent review, then real ChatGPT/Claude predictions and metric comparison.

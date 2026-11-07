# Expanded Missing AI evaluation — reviewer and host comparison protocol

**Proposed research protocol · 29 Oct 2026 · NOT independently evaluated.**

This pack contains **160 authored fictional answer scenarios**, constructed from **40 unique requirement prompts × four deliberately related answer variations** across eight domains: software, study, business, research, accessibility, everyday, security and communication. The purpose is diagnostic diversity, **not** a representative random sample, 160 independent tasks, or a performance score. Source text and answers were invented for testing; no client data, copyrighted source passages or production logs.

## Assets and strict status

- `blind-cases.json`: public, source/answer-only sample pool. **No gold judgments or correct answers.** It is suitable for developmental research, NOT a sealed unseen holdout: everyone and any AI can read it.
- `reviewer-template.json`: **blank** 160-case human reviewer template. No reviewer has completed this through these files.
- `scripts/compare-extended-reviews.mjs`: offline exact-quote and ID integrity checker, plus symmetric pairwise disagreement calculator.
- `tests/extended-v2-review.test.mjs`: synthetic mechanical tests, NOT successful human/Claude performance.

Do **not** rename public authored cases as independent blind holdout or combine this set with pre-existing `semantic-v1` as if both had human gold. No independently valid precision, recall, false positive rate, or claimed improvement exists yet.

## Two independent human reviewers — necessary but not yet completed

1. Recruit two qualified **human** reviewers, independent of fixture creation and each other; provide only this blind pack, a blank template and public explanatory criteria. Do not give author seed/generator variants, model results or other reviewer responses before submission.
2. For every case, each reviewer privately chooses `claimed_covered`, `contradicted`, `not_clearly_mentioned` or `cannot_determine`. Require a concise rationale and precise quote `{quote,start}` for positive coverage or contradiction; quotes are zero-based offsets into that individual `ai_output`.
3. Reviewer metadata must use **non-identifying codes**, private evidence custody, dated source SHA, independent signed/attested completion; do not publish real names, communications, contact details or free-text private notes in the repo. Script-side `independent_attestation=true` is a declaration and **not verification** of independence.
4. Run comparison. Preserve raw independent label sets, record every disagreement, and have the designated adjudicator justify any merged decision. Do not quietly average incompatible labels or resolve disagreements by asking either tested AI.
5. Before any release metric, obtain **separately selected untouched cases** from a different author/source and lock them before model or rule tuning. This public pool cannot be a genuine unseen holdout after a model has been trained/tuned against it.
6. Require recorded maintainer sign-off and the existing [independent semantic adjudication gate](../semantic-v1/README.md). Do not change `review.status` or claim accuracy because two runs share labels.

## Cross-host ChatGPT versus Claude test

The two AI hosts are **test subjects**, not arbitrators.

- Use the **exact same** `blind-cases.json` SHA, model name/version, instructions, context and output schema. Avoid feeding one host the other's classifications.
- Fill a file with `schema: missing-ai-extended-review-v1`, `role: model_host`, a unique `participant_id`, its model label, and `judgments` array covering all IDs. `independent_attestation` is required only for human reviewers.
- Compare only actual recorded runs. Verify calls to Missing AI MCP separately using real `prepare_review`/`validate_review` and `prepare_bundle`/`validate_bundle` outcomes; a model's standalone classification file does **not** demonstrate integration access.
- Public case-pool comparisons report pairwise agreement and differences, not accuracy. Later, after independent gold and a sealed holdout, calculate per-host precision/recall by domain, quote integrity, under-extraction, false alarms and missed omissions on a *separate* controlled evaluation.

Run (using private completed review files stored outside this repository):

```bash
node scripts/compare-extended-reviews.mjs \
  --pool benchmark/extended-v2/blind-cases.json \
  --left /private/path/first.json --right /private/path/second.json \
  --mode reviewers

node scripts/compare-extended-reviews.mjs \
  --pool benchmark/extended-v2/blind-cases.json \
  --left /private/path/chatgpt.json --right /private/path/claude.json \
  --mode hosts
```

The script refuses incomplete case IDs and invented evidence offsets. It does **not** independently check whether host judgments are semantically correct, reviewer identity is independent, a code change was deployed or a system actually meets a requirement.

## Known observed ChatGPT/Claude interaction (not a score)

On 29 Oct 2026, the user shared a Claude-app report stating it had invoked all four Missing AI review/bundle tools and found the same **3 of 4 source requirements** extraction problem as ChatGPT's independently witnessed connected MCP check. The reported host classification differed on a timing-sensitive webhook requirement and a support-contact obligation. **No full Claude tool trace has been independently inspected from this context**. The private Orchestryn Claude worker was separately unable to access Missing AI MCP; that is NOT a Claude app failure. See [issue #45](https://github.com/AbdulkadirKhoujja/missing-ai/issues/45). No accuracy ranking is justified.

## Pre-release decision checklist

- Verify provenance and consent for every future non-synthetic source.
- Freeze dataset SHA and independent reviewer process *before* model runs.
- Record failed, skipped and uncertain cases; do not suppress negative results.
- Compare the **deployed** version separately from unshipped lexical-v2/v3 and host-assisted MCP. PR CI is not proof of a live release.
- Classify any new benchmark labels/scorer modifications under [OPEN_SOURCE_BOUNDARIES](../../docs/OPEN_SOURCE_BOUNDARIES.md) as **REVIEW**, requiring owner decision before release.
- Do not expose private Orchestryn, rate-limit rules, credentials, sensitive client specifications or user prompts.

# Phase 2 experiment 001 — lexical equivalence candidate

**Date:** 29 October 2026
**Decision:** **Do not promote** experimental `shared/checker-v2.mjs` to public web, API, or MCP.

## What was evaluated

Two **author-labelled, synthetic, non-independent** suites. We are testing **answer wording coverage** rather than proof of software implementation, factual truth or regulatory compliance.

- Reference: 60 cases across 10 domains, 20 covered / 30 omitted / 10 uncertain.
- Supplementary challenge (created after the candidate code): 30 cases, 10 covered / 15 omitted / 5 uncertain. This is **not** a blind independent holdout.
- All runs executed as Node 22 GitHub Actions unit/benchmark jobs. Reproduce via `npm run benchmark`, `npm run benchmark:candidate`, `npm run benchmark:challenge`, and `npm run benchmark:candidate:challenge`.
- Interpret `needs_review` as a review alert, other output states as a mention. Exclude `uncertain` from precision/recall, but explicitly count them separately.

| Metric | Reference lexical-v1 | Reference v2 candidate | Challenge lexical-v1 | Challenge v2 candidate |
|---|---:|---:|---:|---:|
| Omissions detected | 24 / 30 (80%) | 27 / 30 (90%) | 15 / 15 (100%) | 15 / 15 (100%) |
| False alarms on covered cases | 10 / 20 (50%) | 4 / 20 (20%) | 10 / 10 (100%) | 8 / 10 (80%) |
| Review-alert precision | 70.6% | 87.1% | 60.0% | 65.2% |
| Uncertain cases marked review | 10 / 10 | 10 / 10 | 5 / 5 | 5 / 5 |

**Interpretation:** v2 offers evidence snippets and a narrow improvement on authored reference examples, but does not generalize adequately to changed wording. The challenge-set false alarm rate of 80% is unacceptable for general use, and the challenge itself isn't independently adjudicated. The candidate must not be deployed or described as proven reliable.

## Technical experiment

- Fixed equivalence groups (for example booking/reservation) and basic word normalization.
- Localized evidence sentence with exact offsets into the submitted answer rather than global keyword unions.
- Limited negation/contradiction cue handling.
- Stable `text_found`, `likely_mentioned`, `needs_review` statuses, plus optional `assessment`, `explanation`, `evidence`.
- No remote model or external model training. No import of this candidate into the live application, API or MCP.

## Next experiment (not yet built or proven)

- **Evidence-first, conservative semantics:** match a source requirement to an exact span of an answer; separately classify `claimed_covered`, `not_mentioned`, `contradicted`, or `cannot_verify`. Preserve "implementation unknown" even when an answer claims coverage.
- Test a **model-assisted optional** evaluator with a manually reviewed sample and independent reviewer. Keep the deterministic checker free and local; do not send user content to an external AI service without clear consent and privacy boundaries.
- For the ChatGPT/Claude MCP workflow, allow the host model to read retrieved source requirements and consider the *actual answer content* using its own language understanding rather than pretending that synonym lists equal semantics.
- Distinguish missing requirement from unsupported claims, missing linked attachments, and unverifiable completion. Treat linked webpage contents as untrusted instructions.
- Define non-regression gates before promotion: challenge false positives, omitted recall, supported spans, reversals on negation, and independent human adjudication.

**Production:** the public HTTPS and connected tools remain on previously verified isolated Amber with `lexical-v1`. No Caddy/DNS/Docker changes were made in this experiment; Orchestryn is unchanged.

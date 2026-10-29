# Missing AI Phase 2 — evaluation protocol

**Question being tested:** Does an AI-generated *answer* visibly address a stated requirement? We do **not** infer that code has been implemented, a policy followed, or an external factual claim verified.

## Data
`benchmarks/coverage-v1.json` includes 60 authored **synthetic** examples across 10 domains (payments, bookings, accounts, accessibility, research, writing, everyday, source URLs, documents and safety). Each domain has six controlled patterns: exact, paraphrase, omission, negation, ambiguous, and lexical trap. Gold labels: 20 covered, 30 omitted, 10 uncertain.

These are **author-labelled test fixtures, not independently human-reviewed evidence**, and should not be described as representative of real-world performance. Never copy customer, private assignment or client materials into the repository.

## Method

Run `npm run benchmark` for a summary, or `npm run benchmark:json` for traceable case predictions. Each fixture intentionally contains one requirement. The currently deployed checker returns three lexical statuses; for the two-class omission alert evaluation we map `needs_review` → *review*, and `likely_mentioned` / `text_found` → *mentioned*.

* **True positive**: a gold `omitted` requirement is flagged `needs_review`.
* **False negative**: a gold `omitted` requirement is not flagged.
* **False positive**: a gold `covered` requirement is flagged.
* **True negative**: a gold `covered` requirement is recognised as mentioned.
* **Uncertain** is deliberately excluded from binary precision/recall; report how often it is flagged separately.

Precision = TP/(TP+FP), recall = TP/(TP+FN), false-positive rate = FP/(FP+TN). These counts concern **answer phrasing coverage**, not real implementation correctness.

## Rules for improvements

1. Record current baseline *before* changing the algorithm. Record each later delta and show failures by ID and domain.
2. Avoid tuning solely to these 60 authored cases; create a separate held-out dataset with manual review before claiming accuracy progress.
3. Any evidence quote/snippet must be copied verbatim from the submitted answer, with its source ID and offsets where possible. Neither answer wording nor implementation status may be invented.
4. An answer stating "I implemented X" counts as `covered` **in the answer**, not as independently verified code. A generic "all done" claim should be `uncertain`.
5. Negation and contradictory statements must not be accepted as positive coverage merely because vocabulary overlaps.
6. Maintain stable MCP tools, bounded input and SSRF controls; deploy upgraded server separately and test before routing traffic.
7. Evaluate with an explicit uncertainty category and independent adjudication before public accuracy claims.

**Current production:** the live public API remains pinned to its previously validated isolated Amber container; merging benchmark-only code doesn't update that container.

# Lexical-v3 experimental checker — synthetic development comparison

**29 October 2026 · unshipped candidate**. Built to test conservative paraphrase recognition and a small number of explicit contradiction/negation patterns, not to establish semantic or implementation correctness. No public browser, HTTP endpoint or connected MCP tool uses this file.

## Results from GitHub CI

Comparison executed under the project’s existing authored synthetic fixtures; [CI run 40917947485](https://github.com/AbdulkadirKhoujja/missing-ai/actions/runs/40917947485) printed the earlier candidate comparison, and [CI run 40918207986](https://github.com/AbdulkadirKhoujja/missing-ai/actions/runs/40918207986) passed after added deadline/role contradiction tests.

| Experiment | Base 60 cases: omissions found | Base covered false alarms (20 covered) | Challenge 30 cases: omissions found | Challenge covered false alarms (10 covered) |
|---|---:|---:|---:|---:|
| Shipped lexical-v1 | 24/30 | 10/20 | 15/15 | 10/10 |
| Experimental lexical-v2 | 27/30 | 4/20 | 15/15 | 8/10 |
| Experimental lexical-v3 | 27/30 | 4/20 | 15/15 | 4/10 |

The comparison is relative to **author-labelled, deliberately selected synthetic examples**; the v3 vocabulary was altered *after inspecting some of those fixtures*. Therefore the improvement from 8 to 4 false alerts in the challenge set is a **development-set result**, not unbiased evidence that real-world reliability improved. The four additional paraphrase examples and new contradiction tests were also written during development, not a blinded holdout. Do not use these percentages to sell an accuracy guarantee.

## The changes being tested

- Fixed, documented equivalences such as "gratitude" for thanking, specific source-link vocabulary, shellfish terms, rubric/criteria wording and duplicate transaction phrasing.
- A small conservative treatment of a quoted 127.0.0.1 loopback literal.
- Scoped contradiction detection for phrases such as "without using the mouse" in a keyboard-navigation statement, and when an explicitly denied operation is actually still accepted.
- A guard against confusing **after-public-beta promises** with **before-public-beta requirements**, and ordinary users with **administrator-only** features.
- Existing source extraction and public release's lexical-v1 API remain untouched.

## Release review gate

**Class: REVIEW.** Before promotion to the free browser checker or API, review the source-to-answer semantics independently, add blinded fresh multi-domain cases, verify that strong synonym groups do not turn true omissions into “likely mentioned”, evaluate speed/bundle/keyboard accessibility, and obtain maintainer approval for a separate staging/production release. The host-assisted MCP bundle validator still does not independently prove semantic truth. No code in this PR changes the current published checker.

Related: [open-source disclosure boundaries](OPEN_SOURCE_BOUNDARIES.md), [independent semantic adjudication #29](https://github.com/AbdulkadirKhoujja/missing-ai/issues/29).

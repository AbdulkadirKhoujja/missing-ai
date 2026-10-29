# Identical 60-case source capture: main baseline vs extraction-fix candidate

**29 October 2026 · Authored, fictional development fixtures · code-level GitHub CI only.**

Both runs used exactly the same `development-60.json` Git blob **`7d9d171278d23ee1c504825436f6bd695975b2e8`**, the same read-only evaluator, and the same 12 contextual negative-control cases. No live MCP service, Claude app or independent human adjudication was involved in these two local CI evaluations.

| Source-code revision | Captured one-line authored imperatives | Context controls correctly left without extracted candidates | CI |
|---|---:|---:|---|
| Current main baseline at the time (`7ca259161e0f`) | **24/60** | **12/12** | [Passed, workflow 40936059969](https://github.com/AbdulkadirKhoujja/missing-ai/actions/runs/40936059969), PR #55 |
| Proposed unmerged extractor fix (`a9ecc8aa3f21` head of PR #46) | **39/60** | **12/12** | [Passed, workflow 40936213548](https://github.com/AbdulkadirKhoujja/missing-ai/actions/runs/40936213548), PR #46 |

**Observed candidate delta: +15 of 60 authored instruction lines captured; no change on these twelve easy contextual negatives.** These are raw development-count differences, **not** improved product accuracy, representative recall, deployment verification or semantic classification performance. The real service is still on the previous extractor until an independently approved production release.

## Breakdown by the six priority use cases

| Category | Baseline captured / 10 | Candidate captured / 10 | Candidate remaining misses |
|---|---:|---:|---|
| Writing and editing | 3 | 6 | DEV-002, DEV-007, DEV-008, DEV-010 |
| Research and information | 2 | 4 | DEV-011, DEV-015, DEV-017, DEV-018, DEV-019, DEV-020 |
| Advice and planning | 5 | 7 | DEV-021, DEV-023, DEV-027 |
| Education and learning | 3 | 5 | DEV-032, DEV-033, DEV-036, DEV-039, DEV-040 |
| Business deliverables | 4 | 8 | DEV-042, DEV-050 |
| Coding and technical | 7 | 9 | DEV-056 |
| **Total** | **24/60** | **39/60** | **21 still missed** |

The largest remaining holes in this **authored fixture** are research, education and writing. This is evidence for prioritizing new varied natural-language test cases and finding a better extraction model; it is not a basis for claiming those categories are generally less accurate for real users.

## Critical interpretation

- The source extraction code is a lexical heuristic run in CI. It is separate from whether an AI answer was adequately addressed.
- Each expected `1` comes from **one explicitly written synthetic imperative**. The evaluator does not establish source interpretation correctness for arbitrary public webpages or infer legal obligation strength.
- Context controls only cover twelve simple descriptive sentences. The new verbs could still produce **false positives in complex pages**, and no broad false-positive bound can be inferred.
- The earlier **12-case live connected MCP smoke** (PR #53) found 7/12 extracted, with five missing verbs. PR #46 fixes those 12 in its tested code, but the **live MCP has not been changed**.
- Neither the 60-case score nor the 12-case smoke is a sealed holdout, and both were created by this project. Future evaluations should use new writing/research/education sources from different authors and evaluate *both* false extractions and missed requirements before deployment.
- Do not release PR #46 or advertise 39/60 as a product improvement until the maintainer reviews core-parser risk and the separate rollout confirms deployed-engine identity. The existing data-first/public use-case programme remains distinct from the 30-hour stability schedule.

**Next staged decision:** maintain the 21 specific misses as a visible diagnostic backlog; choose a more robust, structurally aware extraction strategy rather than endlessly appending verbs, and then test with independent, untrained examples from the main user use cases. No unapproved code/production changes are authorised by this report.

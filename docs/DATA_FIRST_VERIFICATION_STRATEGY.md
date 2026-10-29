# Missing AI — data-first verification strategy (proposal)

**Discussion proposal, 29 October 2026.** Generic public research/documentation only. **Not an approved semantic benchmark release, verified accuracy claim, or a production MCP change.**

## Principle

Don't try to establish truth by the number of human or AI votes. Test the strongest **available, inspectable evidence** for each specific proposition and preserve what remains unproved.

Missing AI currently checks the supplied **answer** against a supplied **requirement**. Neither a convincing answer nor a verified quote shows real implementation. Humans may adjudicate subjective or unresolved semantic cases, but a crowd's agreement is not a substitute for a test oracle, source provenance, executable tests or actual observable behaviour.

## Separate four proof questions

| Question | Best available evidence | We can verify | Must not claim |
|---|---|---|---|
| **Was a requirement present in a selected source?** | Authoritative, scoped public page/document, exact text, publication version and line/offset, URL retrieval record | Verbatim source text and selected-source trace; manually/automatically detect candidates | We discovered *all* obligations on all linked pages; a source is universally applicable |
| **Did the answer address it?** | Full answer, quotes and offsets; explicit negation; verifiable output rules; contextual reasoning where required | Exact quotation positions, mechanically specified predicates, some direct contradictions | General paraphrase/entailment is automatically established solely by token matching or model agreement |
| **Is the claimed outcome implemented or factual?** | Source code, reproducible tests, schema validators, public datasets, deployed outputs, dated official records | Specific claims supported by scoped checks | A passing test proves every relevant behaviour; a text claim proves live implementation |
| **Was the comparison fair and representative?** | Version-pinned case corpus, source permissions, test oracles, fresh out-of-development cases, complete failure ledger | Repeatability, measured denominators and drift on tested examples | Wide general accuracy from a few authored or repeated synthetic fixtures |

## Preferred verification ladder

1. **Deterministic:** exact source/answer spans and zero-based offsets, file existence, JSON schema, count/length constraints, explicit allow/deny predicates. Evidence can be rerun independently.
2. **Executable behavioural:** code-level or controlled sandbox tests that observe the requested behaviour. Report exact test suite, commit/deployment identity and uncovered cases. Tests may be incomplete.
3. **Documented authoritative record:** verified official source pages, formal published criteria, dated public datasets and recorded applicability conditions. Strong for defining a requirement; *not* proof of implementation.
4. **Semantic inference:** compare source and answer meaning with one or more AI hosts. Keep uncertainty, counterexamples and disagreement. Host consensus is an observation, not ground truth.
5. **Targeted human review:** for genuinely ambiguous, high-impact, or disputed meaning/usefulness questions. Useful corroboration, not automatically a final objective truth.

The ladder is evidence-specific, not a universal ranking for every question: an official rule is authoritative for what the rule **says**; only appropriate tests/observations can support what a particular system **does**.

## Reuse existing public research instead of collecting a million opinions

- **IFEval**, *Instruction-Following Evaluation for Large Language Models* (https://arxiv.org/abs/2311.07911), evaluates automatically checkable instructions with programmatic verifiers. Use as methodological inspiration; review licence, scope and contamination before importing examples.
- **SWE-bench**, official project (https://www.swebench.com/SWE-bench/), measures software patches by applying changes and running tests on real repositories. A pass is a test-conditioned outcome, not universal program correctness. Data/code use must comply with project and upstream licences.
- **GOV.UK accessibility guidance**, e.g. https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction and https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility, provides current source-stated requirements and conditions. Version/date, scope, applicability and relevant linked pages matter; quoting is not an accessibility audit.
- User-supplied requirements or public documents are reviewable **only within approved, rights-cleared scope**. Pretraining exposure or public web visibility does not establish a current source snapshot, grant redistribution rights, or authorize accessing private data.

## Develop a test oracle by construction (distinct from inferred truth)

For **strictly verifiable** source-and-answer tasks, generate a controlled original obligation plus a transformation with a known mechanical result:

- Format: must return valid JSON → parse output; required field must exist → check presence/type.
- Quantity: maximum specified words or items → count using a pinned counting definition.
- Source preservation: exact quotation and reference → verify byte/character span and source ID.
- Explicit denial: answer includes an unambiguous denial of the named capability → check both exact marker and independently defined narrow syntax; **do not treat this limited test as broad semantic inference**.
- Metamorphic invariants: adding unrelated prose must not erase correctly extracted requirements; reordering two independent source pages must preserve source-reference coverage after ID remapping; inserting an ordinary contextual example must not create a false obligation; changing a case's formatting must not silently drop a requirement.

These are **operational oracle definitions**, not automatically “real-world truth”. Test the oracles themselves (edge cases, paraphrase, mixed conditionals, formatting changes, ambiguous nouns), and keep separate deterministic, weakly labelled, and externally adjudicated categories.

### Our observed failure as a falsifiable case

On 29 October, a live selected two-source review extracted **3 of 4 deliberately imperative fictional lines** and omitted “Issue payment receipts for completed payments.” The bundle validator could account for 3/3 *extracted* refs while the source itself held four independently inspectable lines. A candidate fix is in [draft PR #46](https://github.com/AbdulkadirKhoujja/missing-ai/pull/46), not automatically a live release. This supports the narrow claim **“one specifically identified source line was omitted”**; it does not prove population recall of 75%.

## Separate measurement denominators

- **Source candidate capture:** source obligations with specified *test oracle* retained / all source obligations defined by that oracle; report misses and contextual false positives separately.
- **Evidence integrity:** exact quote-and-offset checks passed / all attempted checks; compare generated versus validated results.
- **Deterministic answer compliance:** individually testable constraints passed / applicable constraints, by predicate family.
- **Behavioural verification:** functional tests passed / tests run, including environment/commit/deployment identity and known coverage limits.
- **Semantic assessment:** host judgments, disagreement and uncertainty tracked separately. Do not promote to *semantic accuracy* until a defensible evaluation reference exists; human votes alone are not enough.
- **User benefit:** observed next-step improvement and reduced confusion, not inferred from AI agreement, traffic or synthetic test success.

The existing 30-hour schedule remains **stability/drift testing**. Thirty repeats of one fixture are one fixture tested thirty times, not 30 independent accuracy cases. Maintain a fresh, appropriately controlled test set not used to tune new checker heuristics.

## Implementation boundaries and next owner decisions

- **OPEN:** publish this generic methodological proposal and reproducible purely mechanical synthetic demonstrations in reviewed documentation.
- **REVIEW:** change benchmark labels, scoring/oracles, semantic classification engine, MCP API/schema, source fetch/security, or release gates only after maintainer assessment, appropriate private review where warranted, independent negative tests, and an explicit deployment decision.
- **CLOSED:** no secrets, customer prompts, private repositories, privileged source access or private infrastructure details in public examples.
- Preserve the existing semantic benchmark adjudication gate until the maintainer explicitly decides **which metrics can be supported by deterministic/source-derived oracles** and which still require careful independent assessment. This proposal does *not* silently remove that gate.

**Goal:** report what Missing AI can **prove mechanically**, what it **supports with inspectable external evidence**, what it **infers**, and what remains **unknown**. Never merge those categories into an unsupported “AI mistakes found accurately” headline.

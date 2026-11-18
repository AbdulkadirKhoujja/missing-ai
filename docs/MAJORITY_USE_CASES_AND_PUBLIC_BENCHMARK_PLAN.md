# Missing AI — majority-use-case priorities and public evaluation plan

**Public strategy proposal · 29 October 2026 · English-first · NOT a test-results report.**

## What the evidence actually supports

We should optimise Missing AI around the **jobs people already use AI for** and the subset of those jobs where a second-pass check provides observable value. Broad AI usage is **not** evidence of Missing AI adoption, market share, demand, accuracy or conversion. Studies cover different products/populations and measure different denominators; their percentages must not be added.

- OpenAI, *How people are using ChatGPT* (15 September 2025): practical guidance, seeking information and writing comprise roughly three-quarters of consumer ChatGPT conversations; writing is the most common work task. https://openai.com/index/how-people-are-using-chatgpt/
- UK DSIT, *Public Engagement Survey 2025/2026* (16 July 2026): 58% of generative-AI users in the **online sample** had used AI to write or edit documents; this is a multi-response survey, not Missing AI demand. https://www.gov.uk/government/statistics/dsit-public-engagement-survey-20252026/dsit-public-engagement-survey-20252026
- Gallup, *Organizational AI Adoption Jumps Six Points* (20 July 2026): among workplace AI users, 51% report writing/editing, 49% search/research, and 39% problem-solving; categories overlap. https://www.gallup.com/workplace/712736/organizational-adoption-jumps-six-points.aspx
- Anthropic Economic Index, *Cadences* (26 June 2026): most common outputs in sampled Claude chat/Cowork conversations include explanations (17%), documents/reports (15%), guidance (11%); code and technical work account for about one-sixth. https://www.anthropic.com/research/economic-index-june-2026-report
- Epoch AI / Ipsos 2026 public poll: among surveyed AI users, information/recommendations (80%), writing/editing (59%), advice/learning (55%) and brainstorming (53%) are commonly reported; multiple responses allowed. https://www.ipsos.com/en-us/half-americans-report-using-ai-services-information-and-productivity-leading-use-cases

These studies suggest the initial priority set below, **not a verified ranking of Missing AI users**. Re-rank later using consented, non-identifying usage feedback and measured task success.

## Proposed public use-case taxonomy and evaluation budget

**200 DISTINCT scenario slots** are proposed for a future English-first evaluation release. Allocations express a **deliberate test budget**, not measured population proportions. Existing 35 semantic examples and 160 related-v2 development examples may inform failure modes, but must NOT be relabelled as a fresh held-out 200-case set. Cases with shared instructions or common source passages must be grouped and disclosed when calculating denominators.

| ID | User job | Example input → desired Missing AI check | Proposed slots | Source of expected outcome |
|---|---|---|---:|---|
| U1 | **Writing & editing** | “Write an email under 120 words mentioning two times”; check length and mandatory details, distinguish stylistic choice from violation | **50** | Exact prompt conditions, output word counting; human/semantic uncertainty separately |
| U2 | **Research & information** | “Summarise these two selected public pages, name three conditions, cite each”; check omitted conditions, scope, outdated/unsupported claims and exact citations | **50** | Pinned rights-cleared source snapshots, quotes, linked-page scope, source-specific provenance |
| U3 | **Everyday guidance, advice & planning** | “Plan four activities within £80, no evening visits and include a rest break”; check budget arithmetic and explicit constraints | **40** | Reproducible fixture quantities/time rules, with assumptions and uncertainty |
| U4 | **Study & learning** | “Review a draft against these five rubric points”; identify omitted/partially claimed requirements and original learning tasks | **20** | Public/licensed or fictional rubrics; line-by-line criteria, not grading outcomes |
| U5 | **Workplace & business outputs** | “Produce a project brief covering milestones, owners, scope, risks and approvals”; report missed requested sections | **20** | Fictional/public briefs, checklists and defined fields; no private client material |
| U6 | **Coding & technical tasks** | “Implement cancellation, signed webhooks and receipts”; distinguish claim coverage from executable test results | **20** | Public fixture repository + reproducible tests pinned to SHA, with test limits |
| | **Total** | | **200** | |

The first three use cases receive **140/200 (70%)** of proposed slots. U4–U6 are deliberately retained: coding may have a smaller share of general chatbot use yet offers high-value behavioural tests, and study/business outputs have strong checklist semantics.

### Two user modes to demonstrate across categories

1. **Check my original request:** the user pastes instructions plus an AI answer/deliverable. Missing AI compares what was requested to what is *claimed or visible* in that output.
2. **Check against source material:** the user selects one or more approved public URLs or rights-cleared excerpts, plus an AI answer. Missing AI tracks which *selected* pages and explicitly referenced criteria were reviewed; linked sources found but not selected remain **unreviewed**.

Do not advertise arbitrary internet fact-checking, automatic completeness across the entire web, verified real-world implementation or automatic review of every linked document. The current free browser checker is lexical-v1; the beta MCP workflow uses host-assisted interpretation and mechanical quote/reference validation. Benchmark them **separately**.

## Standard failure-mode coverage for EACH category

Every category should test each of the following; publish per-category counts and denominators instead of one pooled headline:

- **Unambiguous omission:** clearly requested information/constraint absent.
- **Explicit contradiction:** answer admits a requirement is unmet or states the inverse.
- **Paraphrase / equivalence:** answer addresses requirement in different wording; avoid false alarms.
- **Partial and compound coverage:** one clause met, another not; don't collapse into a single “covered” verdict.
- **Conditional / applicability caveat:** requirement only applies when specified conditions are met.
- **Context versus obligation:** illustrative examples, footers and optional suggestions should not be promoted to mandatory requirements.
- **Cross-source reference tracking:** same obligation in two sources, genuinely distinct narrower and broader rules, and deliberately unreviewed linked pages.
- **Quoted evidence integrity:** deliberately wrong offsets, forged quotes, missing and duplicate refs, and stale/pinned versions.
- **Abstention:** answer or source insufficient to determine the result; don't invent unsupported certainty.

Proposed *within-category* test mix, to be pinned before evaluation: **40% clear outcome or deterministic constraints, 30% paraphrase/partial/conditional challenge, 20% context/source provenance and negative controls, 10% ambiguous or unsupported questions**. This is a planning allocation, not independently observed failure rates. Balance failure/no-failure classes so “flag everything” cannot score well.

## Minimum public case card (after implemented and tested)

For each **released** case show:

```text
Case ID / use-case category / fixture license & source
Original user request, exact output, and selected source/version SHA or date
The specific testable requirement(s)
Expected outcome and provenance (deterministic oracle | executable test |
  authoritative source text | semantic judgment awaiting review)
Missing AI result with exact evidence and source refs
Correctly found / false alarm / missed / uncertain / cannot score
Engine + release SHA, host/model when applicable, test command/CI receipt,
  execution timestamp and any failed checks
Known limitations, conditionals and unreviewed links
```

For cases requiring a human or model semantic interpretation, don't falsely label an authored synthetic expectation as objective truth. Present it as a **provisional judgement** until a defensible reference exists. The benchmark must include failures, not just successful illustrative demos.

## Public scorecard layout (design goal, NOT implemented)

The public site should eventually offer **six use-case entry points**, each leading to understandable fictional or openly licensed “Try this example” cases with one-click reproducible input. Keep a clear split between:
- **Live early-beta checker demos:** available now; lexical-v1 output can miss paraphrases and cannot verify factual truth or implementation.
- **Recorded benchmark results:** only for cases actually executed under a pinned version; show executed vs planned counts, failures, evidence type and CI run. Don't include an all-green placeholder.
- **Research candidates:** test fixtures and planned experiments, with “not scored / not yet deployed” prominent.

Required scores **per category and engine** when justified: source requirement capture recall on *specified fixture lines*, unsupported extractions/false alarms, validated quote offsets, omitted/contradicted claims found, paraphrase false-alarm rate, appropriate abstentions, execution failures, and user comprehension/next-action outcomes only after voluntary sessions. Publish the full denominator and evidence/oracle class per metric. Test results on developer-created fixtures cannot establish population-wide accuracy.

### Explicit near-term publication plan

1. Publish/review **this category priority proposal** as public OPEN documentation. Do not confuse a draft PR with a live site page.
2. Select **12 smoke cases (two per category)** from rights-cleared fictional material; include one useful positive and one challenging negative or false alarm. First perform real live tool invocations and record raw results, errors and version; only then display the cases and their outcomes publicly.
3. Expand to **60 distinct cases** (10 per category) as a balanced development benchmark, with source line counts and adversarial negatives. Test source extraction and answer assessment as separate stages.
4. Build towards the **200-case proposed allocation**, using fresh materials and test oracles. Freeze a truly unseen evaluation subset before any further rule tuning, and avoid counting near-duplicate variants as independent.
5. Create an accessible **public benchmark gallery/scorecard** in a reviewed site PR. Only publish verifiable results with pinned artifacts, failures, known limitations and explicit “not measured” labels. A page mockup alone must not be marketed as test evidence.

## Deliberately out of scope for the initial majority-use-case benchmark

- Interpreting image/video/audio inputs, unsupported attachments and live browser interaction as though they're implemented in Missing AI.
- Personal medical diagnoses, individualized legal/financial advice, or disputed political truth claims where verification requires specialist evidence and governance.
- Closed/private documents, account access, client/student confidential content, scraping unselected pages or unconsented conversations.
- Broad claims that AI correctness, implementation or legal compliance can be certified from an answer string alone.

## Release and measurement governance

This is a **public OPEN strategy proposal**. Alterations to the core checker, MCP, source processing, hosted service, benchmark labels/scoring or release metrics are **REVIEW** under [open source boundaries](OPEN_SOURCE_BOUNDARIES.md), requiring maintainer decision before publication/merge/deploy. Never expose CLOSED data.

Existing [30-hour read-only stability study](THIRTY_HOUR_STABILITY_STUDY.md) remains separate: it measures reliability and repeated canary outcomes, not 200 distinct benchmark cases. The prior proposed [data-first evidence strategy](https://github.com/AbdulkadirKhoujja/missing-ai/pull/51) complements this plan but does **not** override the use-case-driven priorities here.

**Decision to confirm:** category order and initial **50/50/40/20/20/20** allocation. Nothing in this document claims that those 200 cases have been authored, adjudicated, run, passed or adopted by users.

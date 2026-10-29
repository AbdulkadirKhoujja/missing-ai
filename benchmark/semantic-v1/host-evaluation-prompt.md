# Missing AI — blinded semantic benchmark host run

You are one of the **test subjects** being evaluated for AI omission detection. This is not an invitation to judge your own accuracy.

Read the attached `blind-review-pack.json` only. Do not access `provisional.json`, past ChatGPT/Claude reviews, the test script's proposed labels, or another host's output. If you cannot see the file, state that limitation instead of inventing requirements.

Evaluate each of the **35 synthetic AI answers** against its own `requirement_id` and the cited public-source `source_excerpt` and page URL. Each scenario assesses what the answer **claims** and whether it clearly addresses that requirement, not code or compliance. For example, claiming a screen-reader test is **not automatically** evidence of successful screen-reader operation. Treat independent vs internally run audits and compound criteria carefully. Differentiate future promises from completed actions and respect conditional applicability.

For EACH scenario provide:
- `case_id`;
- `judgment`: exactly one of `claimed_covered`, `contradicted`, `not_clearly_mentioned`, `cannot_determine`;
- `strength`: exactly one of `mandatory`, `recommended`, `conditional`, `context_only`, `uncertain`; this is **source-stated** strength in context, not a legal ruling;
- `reason`: a concise 12–500 character explanation;
- `evidence`: 1–3 **verbatim** quotations with zero-based `start` offsets from that scenario's AI answer for `claimed_covered` and `contradicted`. For the other two judgments, `[]` is fine.

For EACH of the **17 pairs**, provide `pair_id`, `equivalent` boolean and a 12–500 character `reason`. Equivalent means genuinely the same obligation and applicability, not merely keyword overlap. Compound requirements with additional clauses must not be merged with a narrower rule.

Return **one complete machine-readable JSON object**, not Markdown, following the structure in `predictions-template.json`. Set `schema="missing-ai-semantic-predictions-v1"`; `host` should identify your model and run date. Use `scenario_predictions` and `pair_predictions`; include every ID exactly once. Do not insert extra examples, rename keys or omit uncertain items. If the answer clearly lacks a requirement, say `not_clearly_mentioned` rather than pretending the code is missing.

Do not claim independent implementation verification. Do not compute or claim accuracy yourself. The offline scorer will compare your output against reviewed labels only after adjudication.

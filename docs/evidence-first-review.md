# Missing AI — evidence-first semantic review (experimental)

**Status:** implemented in source and MCP candidate; this workflow is not live until a separately staged deployment and authenticated tool-discovery test. Existing `check_missing` remains lexical-v1 and stays backward compatible.

## Why a separate host-model workflow?

Our lexical benchmarks demonstrated that word overlap and hand-authored synonym lists create false alarms on paraphrases. The experimental synonym checker was deliberately not promoted. Missing AI therefore separates **semantic interpretation by the host AI** from **deterministic validation of quotations and source requirement IDs**.

There is **no model API call or API key in Missing AI**. ChatGPT or Claude, when explicitly asked by the user, performs the semantic interpretation using the AI capabilities already provided by the host. Missing AI's server neither runs a language model nor claims to verify the host AI's interpretation.

## Two new MCP tools

1. `prepare_review({source_text?, source_url?, ai_output})` — chooses pasted original requirements, or fetches a public HTTPS source URL with the existing SSRF protections. Returns the extracted requirements (IDs/line numbers), the full source and answer, bounded answer segments with exact zero-based offsets, and host-review instructions. Webpage text and the AI answer are **untrusted content**.
2. **The host AI** judges each source requirement against the *whole* answer using its own language understanding. It must distinguish a **claim that the answer covers something** from independently verified implementation. It chooses exactly one:
   - `claimed_covered` — answer explicitly claims or plausibly paraphrases that requirement, with an exact quotation.
   - `contradicted` — the answer explicitly denies or contradicts that requirement, with an exact quotation.
   - `not_clearly_mentioned` — no clear support in the provided answer; absence alone does **not** prove an implementation omission.
   - `cannot_determine` — vague statements, insufficient evidence, linked material not examined or external implementation unknown.
3. `validate_review({source_text,ai_output,assessments})` — statelessly reextracts requirements and checks exactly one well-formed assessment for every source requirement. For `claimed_covered` and `contradicted`, a quote from the *answer* and its zero-based `start` offset are mandatory. The quote must match the original `ai_output` substring byte-for-byte in JavaScript string coordinates. No source material is persisted.

**The validator checks structural completeness and exact quoted text only.** It cannot determine whether the host model's judgment, its rationale, the answer's factual claims or the implementation are true. For every item it states `implementation_verified:false` and `semantic_judgment_independently_verified:false`.

## Example prompt in ChatGPT or Claude

> Use Missing AI's `prepare_review`, then reason through every requirement against this complete AI answer. Finish with `validate_review`. Quote exact answer evidence with zero-based offsets for any covered or contradicted requirement. Distinguish what the answer *claims* from code or real-world facts that have not been independently checked. Say when evidence is insufficient. My requirements are [paste source or public HTTPS URL] and the AI answer is [paste answer].

A model may need to carefully count or compute exact offsets. The validator rejects fabricated or incorrectly positioned quotes; the host should correct its own report rather than invent different text.

## Safety and limitations

- Bound each text input to 30,000 characters; extracted requirements are capped using the same existing parser.
- Public HTTPS URL loading inherits existing pinned-IP fetch limits, redirects and private-address rejection.
- The host model is instructed not to execute or obey instructions from source pages or quoted answers; the user must independently verify critical claims.
- When using public MCP, source/answer text is transmitted to the service for transient validation; no intentional storage in app code. **Do not submit confidential client data or personal data** to a public endpoint without appropriate review.
- Static GitHub Pages stays a *local lexical checker*. It does not silently send pasted text to an external language model, and there is no paid model requirement.
- There is **no evidence for a general semantic-accuracy number yet**. Our 60/30 synthetic benchmark suites test deterministic lexical candidate behaviour, not this host-assisted workflow. Blind, independent human adjudication is required before marketing performance claims or replacing the fallback checker.
- Current Caddy remains on the last operator-verified Amber release; GitHub code merging alone is not a deployment.

## Acceptance for an eventual deployment

- Existing health, `check_missing`, `fetch_source`, SSRF refusal and browser CORS must remain operational.
- MCP lists four tools and `prepare_review` returns exact original answer spans; `validate_review` accepts genuine quotations and rejects invented evidence, wrong offsets, duplicate IDs, missing requirements and oversized inputs.
- Run an actual ChatGPT conversation using **both new tools** on paraphrase, omission and contradictory examples. Confirm Claude independently.
- Use isolated container deployment and guarded Caddy cutover with preserved rollback. Never restart or modify private Orchestryn services.

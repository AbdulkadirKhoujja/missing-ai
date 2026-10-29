# Missing AI — one consolidated report from multiple sources

**Status:** candidate workflow. Merging its code does not deploy it. Live public Violet remains unchanged until an independently guarded deployment is tested.

## User goal

Give Missing AI up to **three explicitly selected public HTTPS URLs or pasted source documents** plus one AI-generated answer. It should retrieve each selected public webpage, extract its candidate requirements, then help ChatGPT/Claude produce **one report** where repeated obligations can appear together, the source-stated strength is displayed and every finding is linked back to each source.

## MCP workflow

1. The user asks the host AI to review the starting page and clearly relevant linked pages. The host selects up to three, rather than automatically crawling a website. For additional pages use a later separate bundle. Call `prepare_bundle({sources:[{source_url:"https://..."},{source_url:"https://..."}],ai_output:"..."})`. Each selected URL goes through the existing validated HTTPS fetcher with address pinning and private-IP blocking. Pasted texts use `source_text` instead of `source_url`. The output includes source text, source-scoped refs like `S01:R01`, and links that are **only discovered and not reviewed**.
2. The host AI must account for **every extracted source ref exactly once**. It proposes distinct groups, each with a title, source refs, obligation strength, judgment, reason and verbatim answer evidence. Group two refs only if they are genuinely the same requirement with matching applicability. Never merge a narrow criterion into a broader compound criterion merely because both mention the same topic.
3. Classify *source-stated* obligation strength as `mandatory`, `recommended`, `conditional`, `context_only` or `uncertain`. Do not conflate `must` in a citation or quoted example with a legal obligation. `context_only` is retained in an appendix, not treated as an unresolved implementation finding.
4. Classify *answer claims* as `claimed_covered`, `contradicted`, `not_clearly_mentioned` or `cannot_determine`. For the first two, quote the AI answer verbatim and supply the zero-based `start` offset. Never claim independent code or compliance verification.
5. Call `validate_bundle({sources:[{source_text:"...",source_url:"..."}],ai_output:"...",groups:[...]})`, reusing exact texts returned in preparation. The validator re-extracts the requirements and rejects missing, duplicate or unknown refs, invalid labels, forged answer quotes and wrong offsets. It returns both a structured JSON report and `report_markdown`, ordered by gap type, showing source URL and extracted-text line number per citation.

**Important:** This is a stateless protocol. URL content supplied back for validation is not independently refetched, and the source URL/content association is not cryptographically attested. Text offsets are positions in the supplied AI answer, not in the original web document. Source line numbers refer to the extracted readable text, not rendered HTML line numbers. Host-model proposals of semantic equivalence, obligation strength and coverage remain unverified.

## Practical example

Source A says `Must verify signed payment webhooks`, source B says `Must authenticate signatures on payment events`. The answer says `I verify Stripe events with the signing secret`. The host may propose one group with two source refs, *claimed_covered*, supported by one exact answer quotation. The server checks that both source refs exist, neither is omitted or used twice, and the quote matches. It **does not determine** whether the group is truly equivalent or whether code validates webhook signatures.

## Safety and launch boundaries

- Maximum 3 sources; at most 15k characters per source, 35k combined source text, 15k answer, 120 extracted candidate requirements, 12 refs per group and 3 answer quotations per group.
- Only explicitly selected public HTTPS URLs are fetched. Links surfaced from their HTML are metadata, not silently crawled. URLs are treated as untrusted source data, not instructions.
- Remote MCP requests carry user-provided source text and answers transiently; do not submit private client files or personal information to an anonymous public beta without a privacy review.
- The existing two original tools and the single-source semantic reviewer remain available unchanged.
- No website AI inference or paid external model call is added. The host ChatGPT or Claude interprets meaning.
- No independent human ground truth or real-world performance metric has been established for duplicate accuracy or mandatory/recommended classification.
- This workflow should be tested on actual linked public guidance and independent human-reviewed examples before promotion as a universally reliable mistake finder.

## Acceptance

- Unit/MCP tests: every extracted ref accounted for exactly once; multiple refs can map to a single proposed group; fabricated quotes and wrong offsets are rejected; context-only entries remain traceable.
- Existing lexical-v1 `/api/check`, `fetch_source`, `prepare_review` and `validate_review` continue working.
- Actual running server must fetch two selected GOV.UK guidance URLs, return source-scoped refs and produce one report with exact source URLs/line references. Separately check legacy production and private Orchestryn health.
- All server upgrades require an isolated tested release, guarded Caddy cutover and independent rollback. No change to private Orchestryn.

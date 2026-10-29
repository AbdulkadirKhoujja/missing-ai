# Missing AI — general-user launch kit (organic, evidence-first)

**Prepared 29 October 2026.** This is a reusable, unposted marketing plan. Nothing here claims publicity, signups, endorsements or independently verified omission-detection accuracy. The safest public offer today is the **free local browser checker**, with open-source code and an optional **controlled beta** ChatGPT/Claude MCP integration.

## Positioning that ordinary people understand

**Name:** Missing AI  
**Primary line:** *Find what AI missed.*  
**Functional promise:** *Paste the brief and the AI answer. See which instructions need a second look.*  
**One-sentence explainer:** *Missing AI compares an AI-generated answer with the original checklist or requirements and points you to possible gaps so you can review them yourself.*  
**Proof over hype:** Show the exact source item and the AI's statement. Avoid claiming a hidden semantic truth engine.

**Strongest differentiated angle:** Most users simply rerun a prompt or ask AI “are you sure?” Missing AI helps make a *source-to-claim comparison* explicit. In ChatGPT and Claude, the host model can propose paraphrase-aware coverage and combine selected source pages, but Missing AI checks exact quotation positions and whether source references were accounted for. It does not verify code or facts.

**Plain-language benefits to test in user interviews (hypotheses, not proven customer outcomes):** less time re-reading briefs; fewer requirements left out of an AI handoff; easier to ask focused follow-up questions; more confidence about what remains uncertain.

## Core audience and landing examples

| Audience | Trigger | Human language | Try-it example |
|---|---|---|---|
| Students / course participants | After AI drafts an assignment answer | “Did the draft cover the rubric?” | Four fictional course checklist bullets vs AI outline |
| General work / freelancers | Before sending a response to a brief | “Did we address every part of the request?” | Payment receipt, cancellation and webhook items in fictional work order |
| Software builders | After a coding assistant says “done” | “What does the completion message *not* demonstrate?” | AI claims testing; code is still unverified |
| Researchers / writers | Before relying on AI-generated summary | “Did the summary acknowledge the important instructions and conditions?” | A public guidance page with conditions and examples |

No real student assessment, client contract or financial/health record should be submitted to the shared beta without a proper privacy basis.

## Truth-in-advertising phrases

**Safe:**
- “Free open-source checker for potential omissions in AI answers.”
- “Compare your original checklist with the answer, then review source-linked findings.”
- “The web checker runs pasted comparisons locally in your browser.”
- “An optional ChatGPT/Claude custom MCP beta can prepare source-backed multi-page claim reviews.”
- “Missing AI checks quote positions and reference accounting, not whether the AI’s interpretation is correct.”

**Do not say:**
- “AI errors solved”, “never miss a requirement”, “verified correct”, “100% accurate”, “guaranteed WCAG compliant”.
- “Official ChatGPT/Claude plugin” (custom MCP integration is not a verified directory listing).
- “Private and encrypted end to end” or “we store nothing” as absolute claims; the hosting/privacy review is incomplete.
- “Independently benchmarked” (the author seed has not had two independent reviewers).
- “Verifies that developers shipped what they promised” (no source-code verification).

## Ready-to-adapt public posts

### Post A — casual LinkedIn / personal network

> AI can produce a convincing answer while leaving part of the original brief unclear. I built Missing AI to make that second check easier: paste the instructions and the AI response, then review potential gaps against the source lines. The web checker is free and open source. It is an early beta and it does not prove implementation or semantic correctness. If you try the fictional example, what would you change?  
> Try: https://abdulkadirkhoujja.github.io/missing-ai/  
> Source: https://github.com/AbdulkadirKhoujja/missing-ai

### Post B — short social

> Did AI address every part of the brief? Missing AI gives you a second look at the requirements and the answer. Free web checker, no account, open source. Early beta: findings need your judgment. https://abdulkadirkhoujja.github.io/missing-ai/

### Post C — open-source developer appeal

> Missing AI is a small MIT-licensed Node/JS project: a local browser-based requirement checker and an optional MCP evidence-validation workflow for ChatGPT and Claude. It verifies quote offsets and source-ref accounting—not semantic truth. I'm looking for contributors interested in extraction accuracy, accessibility, SSRF safety, documentation and independently adjudicated evaluations. Reproduce tests with Node 22 + npm test. https://github.com/AbdulkadirKhoujja/missing-ai

### Community post approach

Start with a useful personal demonstration and ask for one narrow critique. Do **not** mass-post the same message. On Reddit, follow each community's promotional rules; some allow open-source posts only in specific threads. Prefer helpful replies and a public GitHub issue for feedback.

For Hacker News: official Show HN guidance expects something people can **actually try**, minimal login friction and a founder present to discuss it; do not solicit votes or post a mere landing page. The founder should write any HN post **in their own words**, after checking current HN rules (including restrictions on AI-generated promotional posts); these drafts are **not intended to be pasted into HN**.

## Four-week low-cost rollout

### Week 1 — preparation and actual beta use
- Verify GitHub Pages displays the new copy, privacy page, real example and keyboard/mobile flow.
- Configure repository description, URL and relevant GitHub topics **manually in Settings** if the integration cannot edit repo metadata. Suggested topics: \`open-source\`, \`ai-tools\`, \`mcp\`, \`javascript\`, \`requirements\`, \`accessibility\`.
- Enable private vulnerability reporting and a reliable maintainer security contact.
- Invite 5–10 consenting people to use **fictional or public-source** cases; record feedback manually via GitHub Issues, without copying personal/private prompts.

### Week 2 — teach through examples
- Publish one short walkthrough using the built-in synthetic payment-receipt example; demonstrate both a genuine contradiction and a false alarm from paraphrased wording.
- Share a plain-language FAQ: browser local vs remote connector, what a false alarm looks like, and how to inspect the original source.
- Improve confusing UI based on observed feedback. Do not pay to boost the website while privacy gates remain open.

### Week 3 — developer collaboration
- Open 3–5 well-scoped, tested issues (docs, accessibility, negative examples, error handling, source extraction).
- Invite review through appropriate public open-source forums; use the repository's contribution guide.
- Run the blind semantic benchmark with two independent human assessors, then host runs. Publish limitations and disagreement examples, not headline accuracy claims.

### Week 4 — evaluate usefulness, not vanity
- Review manually: how many genuinely separate users tried it voluntarily (only if consented and measured), what fraction of feedback cases were actionable, top false alarms, top missed obligations, number of meaningful pull requests.
- Decide whether the web checker is ready for wider community discovery. Keep hosted MCP a controlled beta until [launch gates](../LAUNCH_GATES.md) are genuinely closed.
- Any extension to Product Hunt, newsletters or wide MCP directories needs current policy review and a live privacy/security/UX acceptance.

## Minimal, privacy-respecting feedback register

Use a manually maintained aggregate note rather than adding third-party trackers:

| Date | Channel | Voluntary trials (self-reported) | Useful findings (self-reported) | False alarms reported | Reproducible issues | Follow-up |
|---|---|---:|---:|---:|---:|---|
| Not yet measured | — | — | — | — | — | Obtain consent and initial feedback |

Do not invent reach, traffic, conversion or signup counts. GitHub stars and post impressions are not usage quality metrics. Avoid exposing screenshots of real user prompts unless explicit permission and full redaction.

## Launch stop conditions

Stop broad outreach or remote-beta invitations on any privacy leakage, exploitable public URL retrieval, unhandled abuse, inaccurate claim of independent verification, or accessibility blocker. A successful GitHub CI run does not override these stop conditions.

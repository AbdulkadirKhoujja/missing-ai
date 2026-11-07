# Missing AI — controlled first-user utility pilot

**Draft protocol · 29 October 2026 · OPEN documentation proposal, not an active study or broad launch.** This is a small, voluntary test of whether the free browser checker helps people notice something useful. No participants have been recruited, no feedback has been collected, and there are no verified adoption, retention or real-world accuracy results.

## Goal and stop boundary

Answer a narrow question: **Can a first-time user compare an original checklist with an AI answer, understand a potential gap, and decide the next action without mistaking a textual match for proof?**

Use the [free browser checker](https://abdulkadirkhoujja.github.io/missing-ai/) first. It runs pasted-text lexical-v1 comparisons locally; loading a public URL calls a separate beta fetch service. The custom ChatGPT/Claude MCP path is a **separate controlled beta**, not required or proposed for this trial. There is **no bulk promotion**, login, analytics installation, monitoring integration or hosted-service change in this document.

Invite at most **five to eight volunteers** across study, general work and software use cases for short, individual sessions. This count is a practical pilot size, **not** a statistical sample or power calculation. Ask for explicit consent to participate and to record **aggregate non-identifying counts** before the session. Participation and sharing any report are optional; participants can withdraw without explanation.

**Privacy:** Use only the synthetic fixtures below or other rights-cleared, non-sensitive examples. Do not ask people to paste real client briefs, student submissions, private contracts, health/financial information, account credentials, contact details or personal chat histories into the tool, issues or study notes. Do not record raw prompts, URLs from participants, IPs, screen recordings, private communications, identities or device fingerprints. Do not publish any free-text feedback without permission and redaction. No data-collection endpoint is provided by this protocol.

## Three tasks (fictional and deliberately diagnostic)

### Task A — obvious unfinished work

**Original requirements**

```text
- Verify Stripe webhook signatures.
- Allow booking cancellations.
- Provide payment receipts.
```

**AI answer**

```text
Stripe events are checked using the signing secret. Customers can withdraw bookings from their dashboard. Payment receipts have not been implemented.
```

Ask: *Which requirement needs follow-up? Which items are only claimed?* The receipts line explicitly denies implementation. The first two claims have not been tested against code. **Expect a possible lexical false alarm** where “withdraw” paraphrases “cancel”; do not pre-label the browser's output as semantic truth.

### Task B — overconfident completion claim

**Original requirements**

```text
- Include accessible keyboard navigation.
- Publish the accessibility statement.
- Test the payment flow with a failed transaction.
```

**AI answer**

```text
The website looks polished on mobile and the payment form is complete. Everything is ready for release.
```

Ask: *Which specific obligations can the answer actually evidence?* This answer gives broad claims, but it does not give the requested detailed evidence. The checker may miss an issue or flag extra lines; the participant should compare source text, not trust its labels.

### Task C — one public URL and a linked requirement

Use a **selected publicly readable page with explicit licence and stable content** chosen by the maintainer before a session; start with the [GOV.UK accessibility overview](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction), without copying its whole text into a public issue.

Ask the user to load the URL, inspect the source text and links, then compare a **fictional** answer: `We ran automated accessibility checks; we have not arranged disabled-user testing.` Ask what remains uncertain and whether following a second linked guidance page would matter. **Do not claim the browser automatically evaluates linked pages**: selecting additional pages and semantic grouping belong to the separate controlled-beta MCP flow. If the URL importer fails, log only an error category (not the user's URL or response body).

## Session instructions for the human facilitator

1. Open the public checker on an ordinary browser; verify the current release label is **lexical-v1**. State that it suggests possible omissions and does **not** verify implementations, truth or regulatory compliance.
2. Let the volunteer complete Task A and Task B using the fictional text. Ask them to identify one helpful finding and one false alarm, uncertainty or unproven claim. Avoid telling them the expected answer first.
3. Optionally run Task C with the preapproved public page. Observe whether URL import, line references, and the difference between current page and linked page are understood. Do not invite private URLs.
4. Ask four neutral questions: “Which finding changed your next step?”, “Which finding felt wrong or unclear?”, “Could you tell what was only a claim rather than tested?”, and “Would you use this with a non-sensitive brief again? Why?”
5. Record **only agreed aggregate counts** below; if a volunteer declines, do not capture their session. Escalate an apparent security/privacy defect through a verified private reporting path, **never a public issue containing exploit or secret details**.

## Anonymous tally template (keep locally until reviewed)

```text
Protocol revision:
Public site commit or observed release label:
Session date (day only):
Volunteers invited / agreed / completed (counts only):
Task A completed without help / attempted:
Task B completed without help / attempted:
Task C completed without help / attempted:
Participants who correctly separated AI claims from tested implementation / asked:
Participants who identified a real answer omission after source review / asked:
Participants who identified a paraphrase false alarm / asked:
Participants who could explain that linked pages are not automatically reviewed / asked:
Participants reporting at least one useful next action / asked:
Participants reporting they might reuse it / asked:
Confusing UI categories (counts only, no raw private input):
Observed browser/accessibility errors by generic category (counts only):
Unknown / unmeasured:
```

A “real answer omission” here means **a requirement apparently absent from the supplied fictional answer under human review**, not independently proven failure of live software. Keep the denominator explicit, including skipped tasks and unanswered questions. Do **not** convert five voluntary sessions into a product accuracy percentage, customer count or statistical confidence claim. Report contradictory and negative outcomes as well as helpful ones.

## Decision rule after the pilot

- **Proceed with local-checker UX improvements** if people can find at least one actionable issue but are confused by wording/false alarms; file one safe synthetic reproduction per issue and keep the current accuracy caveat.
- **Revise the demonstration/education first** if users repeatedly treat “likely mentioned” as proof, misunderstand a linked page, or cannot locate the source line. Do not solve misinterpretation through marketing promises.
- **Stop expansion** if private content was accidentally exposed, an unsafe URL was requested, or there is an unresolved security/privacy concern. Do not store incident details in the public repository.
- **No remote-MCP broad launch decision** follows from this pilot. That still requires separate domain isolation, abuse controls, privacy/retention review, secure vulnerability reporting, accessibility checks and the independent semantic adjudication gate in [LAUNCH_GATES](../LAUNCH_GATES.md).

## Publishing results and inviting contributions

After consent and maintainer review, share only the aggregate tally, honest denominators, a dated release/commit, and synthetic reproductions with non-sensitive details. A GitHub issue may contain **fictional** minimal test inputs; public issues are not private feedback forms. This pilot does not replace the [two independent reviewer benchmark protocol](../../benchmark/semantic-v1/README.md), and volunteer reactions are not adjudicated semantic ground truth.

See [OPEN_SOURCE_BOUNDARIES](../OPEN_SOURCE_BOUNDARIES.md) and the [general-user launch kit](LAUNCH_KIT.md). No outreach post, deployment, automated follow-up, telemetry or user-data collection is authorized by merely merging this document.

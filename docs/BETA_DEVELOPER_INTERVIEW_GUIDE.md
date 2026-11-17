# Invite-only beta: developer interview guide

**Status: a proposed script for the maintainer to use or change. No interview has been run with it, and it reports no findings.** It supports step 6 of the owner-approved beta scope on roadmap [#86](https://github.com/AbdulkadirKhoujja/missing-ai/issues/86): collect workflow-specific feedback from a small group of consenting, experienced developers who try the ChatGPT and Claude custom MCP connection.

The maintainer recruits and invites participants personally. Nothing in this guide is an invitation template, and no automated tool should contact anyone.

## What the interview is for

One decision: **what is the smallest change that would make this useful in the participant's real work, or is it not useful to them at all?**

It is not a sales call, a satisfaction survey or a benchmark. A clear "I would not use this, because…" is a good result.

Each question below is tied to something the project does not yet know:

| Open question | Why it is open |
|---|---|
| Do developers meet the problem (an AI answer silently drops or contradicts a requirement) often enough to want a check? | The benefits listed in [the launch kit](marketing/LAUNCH_KIT.md) are hypotheses, not observed outcomes |
| Can a developer connect the custom MCP service in ChatGPT and in Claude without help? | "Live client connects, lists tools and completes a review" is **Not verified** for both in the [readiness matrix](TWO_PROVIDER_BETA_READINESS.md) |
| Are the findings right on the participant's own material? | Extraction has known misses ([#45](https://github.com/AbdulkadirKhoujja/missing-ai/issues/45), [#54](https://github.com/AbdulkadirKhoujja/missing-ai/issues/54)); the service checks quotations, not meaning |
| Is locally kept, attributable agent memory something they would rely on? | The memory work in [#73](https://github.com/AbdulkadirKhoujja/missing-ai/issues/73) is a local demonstration with no authentication or hosted storage |
| Which integration should come next, if any? | Providers beyond ChatGPT and Claude are deliberately deferred until there is evidence of demand |

## Before the session

1. **Send the participant this, in your own words, and get a clear yes:**
   - what you will ask about (how they use AI assistants at work, and their attempt to use the beta);
   - how long it takes (30 minutes);
   - whether you would like to record or only take notes, and that they may decline either;
   - that notes are kept privately, are not published, and that nothing they say will be quoted publicly without a separate, specific yes;
   - that they can stop at any time and can ask later for their notes to be deleted.
2. **Ask them to use only non-confidential material.** The beta service has no authentication and is not suitable for employer code, customer data or personal data. A public specification, an open-source issue or an invented brief is enough.
3. **Say plainly what it is.** A custom MCP connection in controlled beta, not a directory-listed or approved plugin, and not a verifier of code or facts.
4. Do not offer payment, features or timelines in exchange for taking part unless the maintainer has decided to.

## The session (30 minutes)

Ask about what they did, not what they would do. "Tell me about the last time…" gives better evidence than "Would you ever…". Do not explain or defend the product while they are talking; note the confusion and move on.

### 1. Their work today (5 minutes)

- Which AI assistants or coding agents do you use for work, and for what?
- Tell me about the last time an assistant said a task was done and it was not. What was missing? How did you find out?
- What did that cost you: minutes, a review round, a bug in production?
- What do you do now to catch it? (Re-read the brief, ask "are you sure?", tests, a checklist, nothing.)

If they cannot recall a single instance, record that as the finding and shorten the rest.

### 2. Getting connected (10 minutes, observed if possible)

Ask them to share their screen and connect in whichever product they use first, then the other one if time allows. Say nothing unless they are stuck for more than two minutes.

- Which product and plan are you on? (Record whether the option to add a custom connector is offered to them at all.)
- Record: time from start to tools listed; every point where they hesitated or searched for help; the exact text of any error or confirmation prompt; whether the product asked for approval before each tool call.
- If it does not connect, stop trying after ten minutes. That is a result. Offer the local walkthrough instead (`node examples/two-provider-mcp-walkthrough.mjs`, Node 22 or later, no account), and say that it is a scripted local run, not the live product.

### 3. One real check (8 minutes)

Ask them to check an AI answer against a non-confidential source of their own choosing.

- Before you look at the result: what do you expect it to flag?
- For each finding: is it right? Would you have caught it anyway?
- What did it miss that you can see? What did it flag that is not a real gap?
- Was the quoted evidence enough to trust or dismiss a finding without re-reading the source?
- Did ChatGPT and Claude give you the same findings? If not, which did you believe and why?

### 4. Memory and privacy (4 minutes)

- Would you want an assistant to recall earlier decisions or corrections from your own project history? Tell me about a time that would have helped.
- Where would that history have to live for you to allow it: your machine only, your company's systems, a hosted service?
- What would you need to see before trusting a recalled item: the source, the date, who wrote it, whether it was later corrected?
- What must it never remember, and how would you expect to remove something?

### 5. Close (3 minutes)

- Would you use this again next week, as it is? If not, what is the one thing that would change that?
- Where would it have to live to fit how you work: chat, editor, pull request, CI, somewhere else?
- Is there anyone you would not want this used by, or anything about it that worries you?
- May I contact you again when something you asked for changes?

Do not ask what they would pay. It is too early for the answer to mean anything.

## Recording what you heard

Write notes within an hour, in the private research archive, not in this repository. Keep what was **observed** (what they did, the exact error, the minutes it took) apart from what was **said** (opinions, predictions) and apart from **your interpretation**.

A minimal private note has: date; a participant code instead of a name; role and years of experience in broad terms; products and plans used; connected in ChatGPT (yes / no / not tried) and in Claude (yes / no / not tried), with minutes taken; findings they judged right, wrong and missed, as counts; the single most important blocker in their words; whether they would use it again; follow-up permission.

## What may go into public issues

- **Yes:** a reproducible defect on non-confidential or invented input; a documentation gap; a count across sessions once there are enough that no individual is identifiable (for example "3 of 8 could not find the connector setting").
- **Only with a separate, specific yes from the participant:** a direct quotation, and then without name, employer or anything else that identifies them.
- **Never:** names, employers, profile links, contact details, recordings, raw notes, participant source material, or anything said about a third party.

A security or privacy weakness found in a session is not filed as a public issue. Follow [SECURITY.md](../SECURITY.md).

## Reading the results honestly

- Five to twenty conversations can show that a problem exists and where setup breaks. They cannot give adoption rates, accuracy figures or market size. Report counts, not percentages.
- People invited personally by the maintainer are likely to be kind. Weight what they did over what they said, and a stated "I would use this" below an unprompted return visit.
- "Could not connect" and "did not have the problem" are different findings. Keep them apart.
- Write down the answers that argue against building something as carefully as the ones that argue for it.
- Interview notes are research input. They are not evidence that a feature works, that the beta is ready or that anyone has adopted it.

## After the round

Bring at most three ranked changes to the roadmap issue, each stated as: what was observed, in how many sessions, the smallest change that would address it, and how the next round would show whether it worked.

# Missing AI — self-guided early-beta usability check

**Public invitation material · fictional exercises only · no data upload or recording required.**

Try the [free local browser checker](https://abdulkadirkhoujja.github.io/missing-ai/) and see whether it helps you catch things AI answers leave unclear. This is an **optional small pilot**, not a validated accuracy study or a claim of accessibility conformance.

## Before you begin

- No account needed. Paste only the *fictional* source and answer below. The browser comparison runs locally for pasted text.
- Do **not** submit real client requirements, private chat transcripts, student work, identity details, financial/health information or credentials. Do not try to upload private URLs. The URL importer uses a separate beta service and is **not** needed for these exercises.
- Try without looking at the expectations at the end. Any finding is a **candidate**, not proof that a software feature is implemented or missing.
- You can stop at any time. There is no automatic tracking, survey endpoint, participant identifier or obligation to send feedback.

## Exercise 1: the confident-looking delivery

**Original brief**
```text
- Verify Stripe webhook signatures.
- Allow booking cancellations.
- Provide payment receipts.
```

**AI answer**
```text
Stripe events are checked using the signing secret. Customers can withdraw bookings from their dashboard. Payment receipts have not been implemented.
```

Paste the brief and answer separately into the checker. Without accepting its labels blindly, identify which line contradicts the brief, whether "withdraw" could paraphrase "cancel", and which claims still need actual source-code or behavioural verification.

## Exercise 2: missing specifics

**Original brief**
```text
- Make form controls usable with keyboard navigation.
- Publish an accessibility statement before public beta.
- Test a failed payment and record the observed outcome.
```

**AI answer**
```text
The website looks polished and responsive. The payment form is ready for customers. Accessibility is a priority.
```

Identify which *specific* obligations the answer addresses with evidence, which are absent or vague, and which remain unknown without inspecting the actual service. Do not interpret the word "ready" as an acceptance test.

## Exercise 3: false alarms and uncertainty

**Original brief**
```text
- Allow customers to cancel a reservation.
- Preserve leading zeros in exported identifiers.
- Provide a support contact on each receipt.
```

**AI answer**
```text
Users can withdraw reservations from their dashboard. The CSV export retains identifiers like 00123 as text. Payment receipts have not been created.
```

Try to spot a paraphrase (withdraw/cancel), a detailed claim that still needs verification (CSV IDs), and an implication about receipts/contact information. Ask yourself whether the checker makes the distinction clear.

## Four private reflection questions

1. Did the checker help you notice a real gap in the fictional answer?
2. Did it produce a false alarm, and could you explain why?
3. Could you tell that matching the source requirement is **not** the same as verifying implementation?
4. Would you find this useful for another non-sensitive checklist, and what was confusing?

Only after completing the exercises, compare your interpretations with the source lines. The receipt denial in exercise 1 is explicit; "withdraw a reservation" in 1 and 3 plausibly expresses cancellation; actual webhook, CSV, accessibility and other implementations remain unverified. A wording-based tool may misclassify some of these.

## Optional, safe feedback

If you want to help improve the open-source project, you may open a new public GitHub issue describing **one generic confusing behaviour** and a fictional example only. Please **do not post your raw real-world prompts, personal information, completed assessment responses or screenshots containing confidential text**. No contributor is required to use their real identity or disclose why they used AI.

For an invited *facilitated* study, the maintainer must first approve the [controlled pilot protocol](FIRST_USER_UTILITY_PILOT.md), obtain participation consent and record only **aggregate, non-identifying counts**. There is no live recruitment or participant data associated with this file.

**What is not measured here:** independent semantic accuracy, paid-user conversion, retention, representative population effects or performance in private real-world tasks. For those claims, evidence and separate review are required.

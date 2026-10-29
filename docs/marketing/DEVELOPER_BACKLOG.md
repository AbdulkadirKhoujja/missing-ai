# Developer onboarding — concrete first contribution backlog

This is a **suggested maintainer triage list**, not an assignment of any contributor or a claim that the following issues are already open. Open/approve individual issues with the maintainer as needed.

## Beginner-friendly, no production access

1. **Clearer empty source errors.** Reproduce confusing browser state when source text is empty; add a copy-specific error and DOM smoke. Do not alter checker semantics.
2. **Accessible results keyboard flow.** Test the checker with keyboard alone and at least one screen reader. Improve focus announcement after a check; record exact manual test setup rather than claim WCAG compliance.
3. **Source example gallery.** Add 2–3 fictional, permission-safe examples for assignment and project briefs. All must demonstrate at least one real omission and one deliberate paraphrase false alarm; keep examples clearly synthetic.
4. **Report copy format.** Offer plain text/Markdown alongside JSON from the web checker, preserving source lines and uncertainty.
5. **Documentation screenshots.** Capture the current public site in a local/sandbox environment with no private data and contribute onboarding screenshots with accessibility descriptions.

## Intermediate, measured accuracy work

6. **Guide-context extraction.** Write tests showing why advice in a “you may need to pay” list should not become mandatory bullet requirements; retain real obligations in unrelated lists.
7. **Compound vs subset tests.** Add negative fixtures showing “audit and fix issues” is not equivalent to “get audit”, without removing existing source citations.
8. **Conditional applicability.** Preserve mobile-app and Service Standard context when source pages have lists introduced by a condition; report uncertainties rather than impose all items universally.
9. **Cross-source paraphrase false alarms.** Add source-backed synthetic answer cases with exact quote offsets and explain scoring; never label the author seeds independently adjudicated.

## Security-sensitive — require maintainer review

10. **Public URL safety:** strengthen DNS/rebinding, redirects, HTTP response limits or malicious HTML handling while keeping the existing SSRF tests green.
11. **Remote MCP abuse and privacy:** propose authenticated pilot or edge limiting with a threat model; never change private Orchestryn deployment or Caddy from an outside PR.
12. **Release packaging:** create a portable, independent self-hosted Docker Compose sample that does not contain personal hostnames, private IPs or operator-only release scripts.

For every proposed change: expected user impact, reproduction/acceptance tests, no secret data, and a clear claim about what is **not** independently verified. See [CONTRIBUTING](../../CONTRIBUTING.md).

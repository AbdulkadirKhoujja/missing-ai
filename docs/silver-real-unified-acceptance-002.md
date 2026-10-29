# Silver multi-source acceptance — consolidated GOV.UK accessibility review

**Date:** 29 October 2026  
**Result type:** Host-authored, evidence-checked evaluation using real public government guidance and a deliberately **synthetic** AI answer. This does **not** assess a real website's compliance.

## Sources and traceability

- **S01:** [GOV.UK — Making your service accessible: an introduction](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) — 38 extracted candidates, 29 discovered **unreviewed** links.
- **S02:** [GOV.UK — Testing for accessibility](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) — 10 extracted candidates, 29 discovered **unreviewed** links.

All line numbers in the table refer to the **readable text extracted by Missing AI**, not the HTML document's source-code line numbers. No other discovered linked page was evaluated in this exercise.

## Test answer (synthetic, not a genuine website's status)

> We built the service to WCAG 2.2 AA and checked it with screen readers, speech recognition software and screen magnifiers. Disabled people participated in our user research. Our accessibility statement will be published at public beta and linked from every page. We run automated and manual accessibility tests. We have not commissioned an independent accessibility audit before public beta. We have not budgeted for accessibility work.

## Summary

| Measure | Result |
|---|---:|
| Original source candidate refs | 48 |
| Distinct host-proposed groups | 43 |
| Duplicate candidate refs consolidated | 5 |
| Context/example groups excluded from actionable list | 7 |
| Actionable groups | 36 |
| Answer claims coverage | 6 |
| Explicitly contradicted | 3 |
| Not clearly mentioned | 14 |
| Cannot determine from answer | 13 |

**Interpretation:** The duplicate equivalences and obligation-strength categories were proposed by the reviewer, not verified by Missing AI's bundle validator. The exact quotations and positions below were checked against the full synthetic answer independently in this acceptance recording, but **not by this chat's still-cached `validate_bundle` tool**. The operator's live Silver smoke did verify `prepare_bundle` and `validate_bundle` server-side using real GOV.UK pages and a separate synthetic duplicate example.

## Priority findings

1. **Pre-public-beta accessibility audit — contradicted.** [S01:R19](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction), [S01:R23](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction); the linked testing guide adds a separate **audit and fix issues** criterion at [S02:R10](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility). The answer explicitly states no audit was commissioned, at answer characters **312–391**. The linked criterion additionally requires addressing discovered problems; do not collapse that compound obligation into the narrower audit-only group.
2. **Accessibility budgeting — contradicted.** [S01:R08](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction), extracted-text line 55. The answer explicitly denies budgeting, at characters **392–436**. Source strength here is treated as official guidance/recommendation, not an independently determined law.
3. **Testing disabled and older people — not clearly demonstrated.** [S02:R03](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility). The answer claims disabled people participated in research, not that testing was completed with older users.
4. **Browsers and devices — not clearly mentioned.** [S02:R08](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility). The answer names assistive technologies, but not browser/device compatibility.
5. **Post-launch testing and accessibility-statement content — unclear.** [S02:R05](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) and [S01:R29](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction), [S01:R30](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction), [S01:R31](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction). A promise to publish a statement is not proof that it describes accessibility limitations and remediation.

## All 43 proposed groups

The status means **what the answer claims**. “Claimed covered” never proves implementation. For concise tables, `M` = source-stated mandatory, `R` = recommended, `C` = conditional, `X` = context-only, `U` = uncertain. These are interpretations of guidance wording, **not legal determinations**.

| Group | Candidate obligation / topic | Source refs (extracted-text lines) | Strength | Answer assessment |
|---|---|---|---|---|
| G001 | WCAG 2.2 AA standard | [S01:R03](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L21; [S01:R25](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L134; [S02:R01](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L11 | M | Claimed covered |
| G002 | Support commonly used assistive technologies | [S01:R04](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L23; [S01:R24](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L132; [S02:R09](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L87 | M | Claimed covered |
| G003 | Obtain an accessibility audit before public beta | [S01:R19](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L116; [S01:R23](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L130 | M | Contradicted |
| G004 | Accessible service for everyone | [S01:R01](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L11 | M | Cannot determine |
| G005 | Consider users' access needs before design | [S01:R02](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L13 | R | Not clearly mentioned |
| G006 | Disabled-user research participation | [S01:R05](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L25 | M | Claimed covered |
| G007 | Publish a meaningful accessibility statement at public beta | [S01:R06](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L27 | M | Cannot determine |
| G008 | Avoid excluding people from the service | [S01:R07](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L49 | R | Cannot determine |
| G009 | Budget for accessibility work | [S01:R08](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L55 | R | Contradicted |
| G010 | Training and specialist costs as examples | [S01:R09](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L57 | X | Cannot determine |
| G011 | Accessibility responsibilities for managers | [S01:R10](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L69 | R | Not clearly mentioned |
| G012 | Research with disabled assistive-technology users | [S01:R11](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L75 | R | Cannot determine |
| G013 | Recruitment agency as one possible expense | [S01:R12](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L79 | X | Cannot determine |
| G014 | Participant expenses and support examples | [S01:R13](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L81 | X | Cannot determine |
| G015 | Explore different impairments during discovery | [S01:R14](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L87 | R | Not clearly mentioned |
| G016 | Participate in the accessibility community | [S01:R15](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L98 | R | Not clearly mentioned |
| G017 | Apply accessibility design principles during alpha | [S01:R16](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L102 | R | Cannot determine |
| G018 | Plan and source an accessibility audit during alpha | [S01:R17](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L104 | R | Cannot determine |
| G019 | Begin accessibility testing in beta | [S01:R18](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L114 | R | Claimed covered |
| G020 | Draft and publish the statement at public beta | [S01:R20](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L118 | M | Cannot determine |
| G021 | Testing-section heading | [S01:R21](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L120 | X | Cannot determine |
| G022 | Check available accessibility-testing tools | [S01:R22](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L124 | R | Not clearly mentioned |
| G023 | Audit results as input to statement drafting | [S01:R26](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L136 | X | Cannot determine |
| G024 | Accessibility-statement section heading | [S01:R27](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L142 | X | Cannot determine |
| G025 | Draft accessibility statement after receiving audit results | [S01:R28](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L144 | R | Cannot determine |
| G026 | Statement must describe how accessible the service is | [S01:R29](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L148 | M | Not clearly mentioned |
| G027 | Statement must disclose accessibility issues | [S01:R30](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L150 | M | Not clearly mentioned |
| G028 | Statement must describe planned fixes | [S01:R31](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L152 | M | Not clearly mentioned |
| G029 | Make accessibility statement easy to find from every page | [S01:R32](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L156 | R | Claimed covered |
| G030 | Mobile-app statement placement alternatives | [S01:R33](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L158 | C | Cannot determine |
| G031 | Review new features and continue disabled-user research | [S01:R34](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L170 | R | Not clearly mentioned |
| G032 | Review statement annually and after relevant changes | [S01:R35](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L174 | R | Not clearly mentioned |
| G033 | Make nondigital parts of the service accessible | [S01:R36](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L178 | R | Not clearly mentioned |
| G034 | Provide accessible contact options where applicable | [S01:R37](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L180 | C | Cannot determine |
| G035 | Offer alternative formats for physical letters if used | [S01:R38](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) L182 | C | Cannot determine |
| G036 | Assistive technologies under Service Standard | [S02:R02](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L17 | C | Claimed covered |
| G037 | Test with disabled and older users | [S02:R03](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L20 | C | Not clearly mentioned |
| G038 | Run accessibility tests regularly throughout development | [S02:R04](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L26 | R | Cannot determine |
| G039 | Test new features after public beta | [S02:R05](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L40 | R | Not clearly mentioned |
| G040 | Prototype accessibility and colour-contrast advice | [S02:R06](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L42 | X | Cannot determine |
| G041 | Perform recurring automated and manual code testing | [S02:R07](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L48 | R | Cannot determine |
| G042 | Support common browsers and devices | [S02:R08](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L85 | M | Not clearly mentioned |
| G043 | Audit and resolve issues before public beta | [S02:R10](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) L100 | M | Contradicted |

## Exact answer evidence supporting positive and contradictory assessments

- **G001 — WCAG 2.2 AA standard:** “We built the service to WCAG 2.2 AA and checked it with screen readers, speech recognition software and screen magnifiers.” (answer 0–122). The AI answer claims relevant behaviour, without independent implementation evidence.
- **G002 — Support commonly used assistive technologies:** “We built the service to WCAG 2.2 AA and checked it with screen readers, speech recognition software and screen magnifiers.” (answer 0–122). The AI answer claims relevant behaviour, without independent implementation evidence.
- **G003 — Obtain an accessibility audit before public beta:** “We have not commissioned an independent accessibility audit before public beta.” (answer 312–391). The AI answer explicitly states the expected action was not completed; no live implementation was inspected.
- **G006 — Disabled-user research participation:** “Disabled people participated in our user research.” (answer 123–173). The AI answer claims relevant behaviour, without independent implementation evidence.
- **G009 — Budget for accessibility work:** “We have not budgeted for accessibility work.” (answer 392–436). The AI answer explicitly states the expected action was not completed; no live implementation was inspected.
- **G019 — Begin accessibility testing in beta:** “We run automated and manual accessibility tests.” (answer 263–311). The AI answer claims relevant behaviour, without independent implementation evidence.
- **G029 — Make accessibility statement easy to find from every page:** “Our accessibility statement will be published at public beta and linked from every page.” (answer 174–262). The AI answer claims relevant behaviour, without independent implementation evidence.
- **G036 — Assistive technologies under Service Standard:** “We built the service to WCAG 2.2 AA and checked it with screen readers, speech recognition software and screen magnifiers.” (answer 0–122). The answer reports testing with assistive technologies, but the Service Standard applicability is conditional and functionality remains unverified.
- **G043 — Audit and resolve issues before public beta:** “We have not commissioned an independent accessibility audit before public beta.” (answer 312–391). The answer explicitly acknowledges the missing pre-beta audit; it gives no audit findings to verify remediation.

## Qualification and remaining limitations

- The primary source includes some examples and broad recommendations; this report explicitly labels them rather than implying 48 mandatory legal requirements.
- The following conservative host-proposed collapses account for **5** candidate refs: WCAG 2.2 AA (S01:R03, S01:R25, S02:R01), assistive-technology support (S01:R04, S01:R24, S02:R09), and the narrower pre-beta accessibility audit instruction (S01:R19, S01:R23). Similar-looking **compound** and **conditional** requirements remain separate.
- No source-code inspection, automated browser testing, independent accessibility audit, human gold-label adjudication or real compliance determination was performed.
- Full extracted source text was returned by the connected `prepare_review` tools, and original source URL/line identifiers were checked. The currently cached ChatGPT tool set exposes four prior tools; the new Silver bundle tools were accepted by the operator's live HTTP/MCP smoke, but not directly invoked from this chat.
- This is a reproducible **case-study artifact**, not a statistically representative claim about omission-detection accuracy.

# Real-source acceptance 001 — public GOV.UK accessibility guidance

**Test date:** 29 October 2026. **Provenance:** actual publicly accessible government guidance, with a **deliberately synthetic AI answer** written for this test. This does not represent an audit of a real website or certification of WCAG compliance.

## Sources

1. [Making your service accessible: an introduction](https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction) — primary.
2. [Testing for accessibility](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) — relevant linked guidance.

The original Code Institute Milestone 4 learner-specific rubric URL is not publicly available for this acceptance. The learner's LMS requires login and the assignment PDF is a local file. GOV.UK is used as a **public proxy with a genuine normative page and linked requirements**, not misrepresented as the Code Institute rubric.

## Starting point: tested against live Indigo before this fix

Using the installed Missing AI `fetch_source` and `prepare_review({source_url, ai_output})` tools:

| Page | Public fetch | Extracted 'requirements' | What failed |
|---|---|---:|---|
| Primary guide | Success, 10,312 readable characters | **69** | Contains explanatory context, navigation links, related guide titles and publication-history entries |
| Linked testing guide | Success, 4,962 readable characters | **31** | Includes non-requirement lists, resource titles, context and footer links |

The source title of the testing guide existed in the primary text, but the existing source output exposed **no actual anchor URLs**. Passing the source URL did not automatically include the linked guide's additional testing obligations.

## Genuine obligations manually identified for evaluation

The primary page includes requirements or guidance concerning WCAG 2.2 AA, assistive technology support, disabled participants in user research, an accessibility statement during public beta, budgeting for accessibility, and an accessibility audit before public beta.

The related testing page adds more specific material concerning both manual and automated testing, disabled and older users, and fixing audit findings before public beta. Requirements must retain phase and conditional context; not all advice is legally mandatory for every website.

## Deliberately synthetic AI answer (NOT a real product status)

> We built the service to WCAG 2.2 AA and checked it with screen readers, speech recognition software and screen magnifiers. Disabled people participated in our user research. Our accessibility statement will be published at public beta and linked from every page. We run automated and manual accessibility tests. We have not commissioned an independent accessibility audit before public beta. We have not budgeted for accessibility work.

**Expected human interpretation**: answer *claims* coverage for WCAG/assistive technologies/research/statement/testing, while explicitly indicating audit and budget gaps. Some additional linked-guide obligations (testing older users and resolving discovered audit issues) are not established by this answer. No underlying website, code or actual compliance has been verified.

## Candidate change and acceptance gates

- A separate conservative review extractor that avoids treating page links, incidental bullet lists, resource directories and publication histories as mandatory requirements.
- Preserve source line provenance and group options introduced by `either` or `one of` as alternatives rather than treating every option as mandatory.
- Discover actual HTTPS links to related guidance, bound to 40 relevant unreviewed links and reject unsafe/private/non-HTTPS targets. **Do not automatically fetch links in the backend**; host AI may selectively call `fetch_source` on relevant links from the user-directed task, then `prepare_review`/`validate_review` them individually.
- Keep older lexical-v1 checker and website behaviour unchanged.
- Preserve honest distinction: quote provenance can be verified, but not the host AI's interpretation or implementation correctness.

## Current status

**PR tests** cover synthetic structural cases and preservation of exact evidence validation. Live main/related GOV.UK extraction is **still pending** for the new implementation until a separately staged release is tested. No improved extraction count or semantic accuracy can be claimed before that run.

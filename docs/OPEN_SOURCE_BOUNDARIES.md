# Missing AI — open-source disclosure and contribution boundaries

**Policy version 1.0 · 29 October 2026 · Maintainer-governed.** This policy applies before every public GitHub issue, pull request, release, benchmark, bug report, demonstration, social post, or external contribution. A public GitHub repository is **not** a safe place to stage secrets while awaiting approval: history and forks can preserve disclosures. Stop **before the first public write** if uncertain.

## Release classes

| Class | Examples | Handling |
|---|---|---|
| **OPEN — public by default after normal review** | Generic product design, reproducible synthetic examples, high-level roadmap, ordinary documentation, generic accessibility improvements, non-sensitive web UI tests, source-backed educational content | Draft PR; review provenance, licences, false claims, privacy and CI; release when reviewed |
| **REVIEW — owner/security decision before public disclosure** | Core checker/semantic grouping code, MCP tool schemas, web fetcher and SSRF safeguards, prompts with unknown rights, external service integration, dependency/CI changes, cryptographic/auth controls, telemetry, retention, data exports, API response details, benchmark labels/scoring, real-world test reports, host configuration patterns, vulnerability-adjacent tests | Do **not** send sensitive details to public PR first. Produce a sanitized change proposal or private report, assess threat/privacy/compatibility, require a documented owner review and independent tests. Only then choose a public subset and publish it |
| **CLOSED — never publish here** | API keys, passwords, SSH keys, cookies, authentication tokens, customer/user or employee data, unconsented prompts, real client specifications, private repositories, raw request/server logs, privileged network topology, internal IPs or live host access instructions, private Orchestryn runtime architecture/deployments, unpublished exploitation steps, active security incidents, proprietary or licensed material without distribution rights | Keep out of public GitHub, GitHub issues/Actions artifacts, demos, AI-host prompts and marketing. Use an approved private channel; if exposed, follow incident containment and credential rotation before any sanitized disclosure |

**Default for uncertain material is CLOSED until scoped**, then REVIEW. **Publicly observable** does not automatically mean safe to amplify or copy. Legal publication rights and privacy rights are distinct from technical access.

## Who can do what?

- **Everyone (including anonymous users):** view and fork MIT-licensed published code, try the local wording checker using permitted non-sensitive inputs, open non-sensitive issues, submit pull requests from their own forks. External developers do **not** receive production credentials, privileged server access, host network information, real client files or authority to approve releases.
- **Contributors:** propose generic code/tests and public-source examples with clear provenance. They may not move data between public and private repositories, send production telemetry, run live security scans against Missing AI or third parties, or deploy to the hosted MCP. A public PR is not proof of acceptance.
- **Maintainer (human):** decides disclosure class and release, reviews exceptions and security impact, independently validates claims before approving a higher-risk publication. Green CI **alone cannot authorize** a REVIEW disclosure.
- **ChatGPT/Codex/Claude agents:** can read authorized public material, draft low-risk changes on public branches and run safe synthetic tests. They must never publish CLOSED inputs, invent benchmarks, bypass approvals or grant themselves credentials. Unknown classification means stop disclosure and request maintainer review. A repeated daily automation does not enlarge permissions.
- **Orchestryn:** may aid only through explicitly available/approved tools; it remains a private project and is not required to run Missing AI. Its credentials, logs, worker instructions, internal endpoints, network and client work remain CLOSED.

## Security decision for every proposed change

1. **Source and ownership:** is it original/MIT-compatible or licensed to publish? Has personal/client data been anonymized with consent or replaced by synthetic data? Raw real prompts require explicit permission; prefer synthetic.
2. **Blast radius:** does it affect authentication, SSRF/fetch, networking, MCP, logging, telemetry, dependency execution, HTML escaping or deployed infrastructure? If yes, label REVIEW, with a separate threat model. Never put an unpatched exploit into public issue comments.
3. **What can an outsider learn?** Check the diff, commit history, screenshots, Actions logs, artifacts, error messages, URLs and generated docs. Remove live coordinates, identifiers and sensitive contextual details **before** any public write.
4. **Evidence:** link to exact safe source, reproducible commit and CI. Use correct denominators, note uncertainty, and don't confuse quoted claims with implementation verification.
5. **Public suitability:** avoid overselling semantic reliability, accessibility conformance, official ChatGPT/Claude endorsements, security assurances, rankings and user growth. Review what the product actually supports.
6. **Decision record:** OPEN/REVIEW/CLOSED, reason, who approved, actual tests, publication destinations and rollback considerations. A decision may change when the context changes.

## Release procedure

- **OPEN:** one scoped PR, owner review, tests pass, documentation updated. Daily agents can propose but should not autonomously merge to main.
- **REVIEW:** first prepare a private redacted decision; owner approval + security/privacy/compatibility assessment, CI plus independent check; publish sanitized implementation only after the decision. Branch protection and CODEOWNERS are recommended but **not enforced by files alone**—maintainer must configure required GitHub approvals in repository Settings.
- **CLOSED:** never add to repository. Keep operational/deployment secrets outside the open-source repo; rotate compromised credentials and follow a separate private incident process.
- **Existing public material:** a policy file does not retroactively sanitize repository history, including previous deployment instructions. Maintain an inventory of historical risk, plan a safe cleanup and do not assume deleting a file removes it from forks/history. Prioritise moving production-specific instructions out of public source without revealing additional data.

## Safe publication of benchmarks

Public benchmark pages may show **exactly reproducible, author-labeled synthetic results**, with source fixture version, engine identifier, case counts, commit SHA and limitations. They must be headed **“Synthetic fixture — not independently adjudicated”** and clearly differentiate production lexical-v1 from an experimental candidate. **Do not** call a synthetic 100% score a real-world reliability rate. **Never** publish private user prompts or human-reviewer identities/notes without rights and consent.

Independent semantic-accuracy numbers are blocked until [the adjudication protocol](../benchmark/semantic-v1/README.md) has been completed with two independent reviewers and documented disagreement resolutions. The host model being evaluated does not adjudicate its own ground truth. No unreviewed automated benchmark change can override the gate.

## Escalation and private reporting

For suspected secrets, vulnerable URLs or exploit details: **STOP public writes**. Read [SECURITY.md](../SECURITY.md). If no real private vulnerability reporting channel exists, that is an open launch blocker; do not paste the information into a public ticket. Report only a sanitized high-level blocker until an approved channel is available.

This policy governs new disclosures and does not guarantee that existing published code is secure. It is reviewed at least monthly and whenever the product's data flows, hosting or licensing change.

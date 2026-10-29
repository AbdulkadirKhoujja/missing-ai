# Security policy — Missing AI

## Supported scope

This project is an **early public beta**, not a security-audited SaaS. The main branch and current controlled beta receive security attention; older Blue/Green/Amber/Indigo/Violet containers are **rollback snapshots**, not separately maintained releases. No security SLA or guaranteed response time is offered.

## Privately report a vulnerability

**Do not file exploitable details in a public issue.** If GitHub's *Private vulnerability reporting* option is enabled, use the repository's **Security → Report a vulnerability** flow. If that option is unavailable, check the maintainer's GitHub profile for an explicitly offered private contact method; if no private channel exists, **do not disclose secrets or working exploits publicly**. The maintainer must enable a reliable private reporting channel before wider launch.

For ordinary bugs and non-sensitive concerns, use [GitHub Issues](https://github.com/AbdulkadirKhoujja/missing-ai/issues/new/choose).

Useful responsible reports: affected commit SHA, isolated non-destructive reproduction, severity, expected vs actual access controls and suggested mitigation. Do not include real user source text, bearer tokens, SSH keys, private infrastructure configuration or server IPs in public issues.

## Trust boundaries and known constraints

- The website's **pasted-text checker runs locally**; public URL imports go through a separate server.
- Remote MCP sends source text and AI output to the configured endpoint; it is **unauthenticated controlled beta** and must not be treated as a safe place for confidential work.
- The URL fetcher checks public HTTPS URLs, rejects local/private ranges, pins DNS responses, revalidates redirects and limits response sizes. These reduce SSRF exposure but are **not proof against all URL or DNS attacks**.
- In-process per-IP request limits are basic and can be bypassed by distributed users; this is **not a public traffic protection plan**.
- Untrusted webpages and AI answers must never be executed as instructions. Host AI classifications and source-quote offsets are not semantic assurance.
- Hosting provider logs, operational controls and retention have not received an independent security/privacy assessment.
- Caddy and Docker beta deployments are operator-specific. Never connect Missing AI containers to the private Orchestryn runtime, secrets, Docker network or databases.

## Pre-public launch requirements

See [launch gates](docs/LAUNCH_GATES.md). Before broadly marketing the remote connector, establish a real private security contact, origin separation, rate limiting and monitoring, a documented data-handling assessment and non-destructive adversarial tests. Website-only introductory outreach does not imply those gates are complete.

# Missing AI release and public marketing gates

**Baseline 29 Oct 2026.** This list separates what can be described truthfully today from claims and activities requiring additional evidence. It does not block sharing the public open-source repository or offering the existing local web checker as an **early beta**.

| Gate | Current evidence | Status | Owner action |
|---|---|---|---|
| MIT public repository, reproducible local tests | MIT licence and GitHub CI | Met | Keep clean contribution guidance and CI |
| Usable no-login browser demo | GitHub Pages static lexical checker | Beta only | Manual mobile/keyboard smoke and basic accessibility review |
| Multi-source custom MCP technical integration | Silver two-source acceptance, ChatGPT/Claude tool invocations reported | Technical acceptance | Preserve six-tool compatibility; get privacy/security review |
| Independent semantic accuracy | 35 scenarios, 17 pairs, author-proposed labels only | **Open** | Two independent blinded adjudicators; new domain holdouts; transparent metrics |
| Site privacy disclosures | Pasted local check and remote URL import described | **Incomplete** | Legal/privacy review of actual infrastructure/logging and data flows |
| Remote MCP abuse controls | In-process limits, HTTPS, SSRF and CORS checks | **Insufficient** | Edge limits, authenticated pilot or access policy, monitoring, incident playbook |
| Security disclosure | SECURiTY.md guidance, no verified private reporting contact | **Incomplete** | Enable/verify GitHub private vulnerability reporting |
| Domain/host isolation | Beta route shares a domain with private infrastructure | **Incomplete for broad launch** | Separate public hostname and operational policies, never expose private Orchestryn |
| Accessibility | Keyboard semantics partly present, no independent audit | **Open** | Keyboard/AT/device evaluation, remediate, publish honest statement |
| Open source maintainer process | CONTRIBUTING, templates, issues, tests | Ready for contributions | Review incoming PRs and use reproducible examples |
| Marketing proof | Live demo and truthful examples | Beta-ready | Collect consented user feedback and measured retention/utility data |

## Safe now: free, low-key early-beta discovery

You may link to the [website](https://abdulkadirkhoujja.github.io/missing-ai/), explain the local checker, share the [MIT source](https://github.com/AbdulkadirKhoujja/missing-ai), invite bug reports and developer contributions, and show **synthetic** demos. Use an honest label such as *"early beta; heuristic suggestions; check the original source."* Do not infer that anyone has endorsed the project, or that its checker is accurate for any percentage of real use cases.

## Not ready: wide remote-MCP promotion

Do not call the hosted MCP a privacy-certified, production-grade or independently accurate service. Do not ask unvetted users to paste confidential contracts, private client specifications, health or financial data. Do not list it as an officially approved ChatGPT/Claude plugin; it is a custom connector. Do not use paid acquisition or high-volume public traffic invitations while the shared-infrastructure, abuse, monitoring and data review gates remain incomplete.

## Practical controlled launch decision

A human maintainer should check each open item with real evidence and record the date/approval. A technical smoke test alone is not that approval. If launch must proceed earlier, limit scope to the local web checker and small voluntary non-sensitive public-source trials; make privacy caveats visible at the point of use.

## Rollback/incident process

Unexpected error spike, abuse, private-address fetch concerns, leaked source text, privacy complaint or authentication bypass allegation: stop new promotions, preserve minimal metadata without copying user data, inspect the isolated Missing AI service, and restore the last known-good version using an **environment-specific reviewed rollback**, never by modifying private Orchestryn services. Revalidate incident resolution before resuming.

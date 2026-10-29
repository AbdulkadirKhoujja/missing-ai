# Missing AI — developer discovery and enforcement checklist

**Checked 29 October 2026.** The source is public, MIT licensed, and its contributor policies, local Node 22 quickstart and issue templates are available. A contributor should be able to run `npm test` without production credentials.

## Completed by project tooling

- [x] Public [contribution guide](../CONTRIBUTING.md), [developer handoff](DEVELOPER_HANDOFF.md) and [OPEN / REVIEW / CLOSED publication boundaries](OPEN_SOURCE_BOUNDARIES.md).
- [x] Starter issues are now discoverable with real GitHub labels: [#31 accessible keyboard results](https://github.com/AbdulkadirKhoujja/missing-ai/issues/31) and [#33 Markdown export](https://github.com/AbdulkadirKhoujja/missing-ai/issues/33) as `good first issue`; [#32 source extraction](https://github.com/AbdulkadirKhoujja/missing-ai/issues/32) as `help wanted`.
- [x] Homepage directs potential contributors to labelled first issues and the repository.
- [x] CI covers the source, public website assets, MCP contracts and synthetic benchmark publication.
- [x] `.github/CODEOWNERS` names the maintainer responsible for reviewing changes in production-sensitive code.

## Still requires GitHub repository administrator action

A connected GitHub integration has **no repository-administration write**. At the time of review, the public repository has no configured `homepage` or `topics`, and the public GitHub rulesets query returned `[]`. The branch-protection details API returned 403 for this integration. **Do not claim these settings are enabled until the owner sees them in Settings.**

1. Open [repository About](https://github.com/AbdulkadirKhoujja/missing-ai) and select **Edit** beside About. Set:
   - Description: `Free, open-source checker for potentially missed requirements in AI answers. Web checker + ChatGPT/Claude MCP beta.`
   - Website: `https://abdulkadirkhoujja.github.io/missing-ai/`
   - Topics, if GitHub offers these and they are available: `open-source`, `ai-tools`, `mcp`, `javascript`, `requirements`, `ai-assistants`.
2. Open **Settings → Rules → Rulesets** or **Branches** as supported by your GitHub plan. Require pull requests and passing repository tests on `main`, block force-push and deletion, and require an independent maintainer review and CODEOWNER approval for relevant paths. Avoid broad bypass permissions.
3. Open **Settings → Security → Code security** (wording may vary). Enable and test **private vulnerability reporting**. Do not ask researchers to file exploits publicly.
4. Review contributor write access, Actions/GITHUB_TOKEN scopes and allowed workflows. Use the [owner tracking issue #40](https://github.com/AbdulkadirKhoujja/missing-ai/issues/40) for the approval record (without exposing confidential security findings).

**Enforcement warning:** `CODEOWNERS` by itself is **documentation**, not protected-branch enforcement. A public workflow with passing tests is not a substitute for human review and disclosure decisions.

## Claim boundary

Do not advertise an “accurate AI verifier.” The free browser tool is wording-based; synthetic fixture results have not been independently adjudicated. The custom MCP beta validates source-ref accounting and exact quote positions, not real implementation or semantic correctness.

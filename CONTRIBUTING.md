# Contributing to Missing AI

Thanks for helping people spot omitted requirements. Missing AI is early-stage; **accuracy, evidence provenance, privacy and clarity** matter more than ambitious feature counts.

## Start here

1. Read [README.md](README.md), [developer handoff](docs/DEVELOPER_HANDOFF.md) and [project boundaries](docs/LAUNCH_GATES.md). Look for a small, scoped issue, or file one with a reproducible example.
2. Fork the repo; use Node **22+**. Run `npm test`. No npm install is needed for the core tests (the project has no runtime dependencies).
3. Make a focused branch. Add tests first for extraction/coverage changes, especially **paraphrases, false alarms, conditional rules, source offsets and security regressions**.
4. Run `npm test`, `npm run benchmark:challenge` and `npm run benchmark:candidate:challenge` if the checker is affected. Record results honestly; a passing synthetic benchmark is not proof of semantic accuracy.
5. Open a PR using our template. Include the problem, changes, test evidence, privacy/security implications, UI screenshots if needed and a list of **what remains unverified**.

## Where contributions belong

- `shared/checker.mjs`: stable lexical-v1 implementation; changes must retain the web checker contract.
- `shared/review-extraction.mjs`: source candidate extraction; test real-page-like lists, headings and footers.
- `shared/bundle-review.mjs`: deterministic reference and quote checks. Never label semantic grouping as independently verified.
- `server/source.mjs`: public URL ingestion; safety-critical. Require adversarial tests for redirects, DNS rebinding, private addresses, size and timeouts.
- `site/`: public website. Keep root mirror assets in sync, and test keyboard navigation/mobile layout.
- `benchmark/semantic-v1/`: provisional evaluation; **do not change gold to favour your model**. Separate independently reviewed labels from author seeds.

## PR acceptance

PRs must preserve exact provenance, meaningful limitations, no unsafe default network calls, the existing MCP tool names (or a documented backward-compatible migration), and CI green. The maintainers may ask for a smaller PR, review, or additional tests. Do not force-push over others' work or claim ownership of unaccepted issues.

**Good first contributions:** correct outdated documentation, add accessible UI labels or focus states, author small synthetic edge cases with expected limitations, improve source extraction without suppressing legitimate requirements, or add reproducible cross-platform installation instructions. File/claim an issue before large work to avoid duplicate effort.

## Reporting problems and safety

Use [issue templates](.github/ISSUE_TEMPLATE) for public bugs, UX problems and proposed features. Never include private client briefs, user identifiers, credentials or pasted sensitive responses in tickets. For vulnerabilities, read [SECURITY.md](SECURITY.md), not a public issue. Respect [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Contributions are made under the repository's existing [MIT License](LICENSE). No Contributor License Agreement is required at present; if one is ever proposed it requires an explicit documented change.

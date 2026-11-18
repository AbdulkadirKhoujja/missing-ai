# Verifying exact-commit CI and synthetic benchmark receipts

**Scope:** Read-only, public GitHub evidence for Missing AI. This is an **OPEN** documentation procedure, not a CI, scoring, deployment, or benchmark change. Related: #71, #59, #18.

## 1. Pin the commit and query *all* Actions events

Start with the actual main commit SHA; don't assume a branch tip or PR ref is equivalent to the tested commit.

```sh
REPO=AbdulkadirKhoujja/missing-ai
SHA=986199302f3abb0adeaed0ed7e39389132fbc24e
gh api "repos/$REPO/actions/runs?head_sha=$SHA&per_page=100" \
  --jq '.workflow_runs[] | [.id, .head_sha, .event, .status, .conclusion, .html_url] | @tsv'
```

Record the observation time in UTC and check the returned `head_sha` against the exact SHA for **every** run. A query limited to PR-associated runs is insufficient: main `push`, `schedule`, and deployment workflows can appear separately. Follow pagination if the response has more matches than a page. A combined commit-status response with zero status entries is **not** a query of all Actions workflow runs.

For each relevant run, record its workflow name, GitHub URL, run ID, event (`push`, `pull_request`, `schedule`, etc.), created/completed times, exact head SHA, status and conclusion. Never substitute a successful historical run for a different SHA or assume that a successful scheduled benchmark proves a particular PR head passed tests.

## 2. Classify the evidence without overstating it

| Result | Evidence-based meaning |
| --- | --- |
| **PASS** | An applicable run at the requested exact SHA is `completed` with conclusion `success`. Identify *which* workflow passed. |
| **FAIL** | An applicable run at the exact SHA is `completed` with conclusion `failure`. Name that run; do not infer failure of unrelated workflows. |
| **NO MATCH** | The fully paginated Actions listing was successfully read for the exact SHA, with no applicable run. This does **not** mean a test failed. |
| **UNVERIFIED** | The listing could not be read reliably (API/auth/rate limit/network error, incomplete pagination, inaccessible logs), or exact-run/required-job details cannot be established. |

Pending, queued, in-progress, skipped, cancelled and timed-out runs must be reported explicitly, not silently converted to PASS or FAIL. For a PR, check the exact PR head independently from main. A green workflow confirms the checks it actually ran, **not** the accuracy of AI judgments or the safety of production deployment.

## 3. Inspect the synthetic benchmark artifact before citing a metric

For a completed, exact-SHA `Daily public synthetic benchmark` run, inspect its jobs, summary and artifact list:

```sh
RUN_ID=41867552485
gh api "repos/$REPO/actions/runs/$RUN_ID/jobs?per_page=100" \
  --jq '.jobs[] | [.name, .status, .conclusion] | @tsv'
gh api "repos/$REPO/actions/runs/$RUN_ID/artifacts?per_page=100" \
  --jq '.artifacts[] | [.name, .expired, .size_in_bytes] | @tsv'
```

The current scheduled workflow uploads a `synthetic-benchmark-${{ github.run_id }}` artifact, intended to contain `summary.md` and `synthetic-results.json`, with a 30-day retention window. If available, download and inspect the actual files, including fixture or engine versions and denominators, before quoting numbers. Missing/expired artifacts or inaccessible job summaries mean **metrics unverified**, even when the workflow conclusion is success.

Report the published **lexical-v1** baseline and challenge separately from the experimental candidate. Only show a score with its exact numerator, denominator, engine, fixture version, SHA, run URL and observed UTC timestamp. Label all self-authored fixture figures **“Author-synthetic; not independently adjudicated.”** Do not publish independent semantic accuracy claims until the separate human adjudication gate is met.

## 4. Reproducible negative-case documentation regression

Synthetic example: a commit's combined-status endpoint returns `statuses: []` and a PR-associated workflow query returns `workflow_runs: []`. A separate, correctly paginated Actions run query by exact `head_sha` returns one `schedule` run, `completed/success`.

**Correct:** “The scheduled synthetic benchmark completed successfully at this SHA; the two narrow queries alone were not decisive. Other workflow coverage and benchmark numbers require their own receipts.”

**Incorrect:** “CI failed” or “no workflow ran” because the two narrow endpoints were empty. Also incorrect: “Detection accuracy is proven” merely because an Actions workflow succeeded.

## 5. Observed public example (4 November 2026)

The exact main SHA `986199302f3abb0adeaed0ed7e39389132fbc24e` had the following publicly identifiable completed successful runs:

| Scope | Run |
| --- | --- |
| Main push test/Pages workflow (2 Nov) | [41509272442](https://github.com/AbdulkadirKhoujja/missing-ai/actions/runs/41509272442) |
| Scheduled synthetic benchmark (3 Nov) | [41674002343](https://github.com/AbdulkadirKhoujja/missing-ai/actions/runs/41674002343) |
| Scheduled synthetic benchmark (4 Nov) | [41867552485](https://github.com/AbdulkadirKhoujja/missing-ai/actions/runs/41867552485) |

These run conclusions were checked against GitHub Actions metadata; **artifact contents, metric denominators, and independent semantic ground truth were not verified in this example**. No production release or model-quality assertion follows from this observation.

**Release boundary:** Documentation-only proposal; normal maintainer review and PR CI still required. Do not change workflow permissions, benchmark scoring, labels or production systems as part of this procedure.

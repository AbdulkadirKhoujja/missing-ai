# Agent-memory developer quickstart — local synthetic proof

**Status:** Demonstration of existing private-history functionality, not a new memory API or live hosted service. Related: [agent-memory MVP #73](https://github.com/AbdulkadirKhoujja/missing-ai/issues/73) and [remote opt-in import #65](https://github.com/AbdulkadirKhoujja/missing-ai/issues/65).

## Run locally (Node 22+, no credentials)

```sh
node scripts/agent-memory-demo.mjs
node --test tests/agent-memory-demo.test.mjs
node scripts/agent-memory-local-boundaries.mjs
node --test tests/agent-memory-local-boundaries.test.mjs
```

The example creates a temporary owner-local folder, records **one synthetic, intentionally supplied** event using `private-history/record-event.mjs`, starts a new reader object over the saved file, retrieves it through `missing_ai_search_history`, and checks a proposed repeated-work answer through `missing_ai_review_answer_history`. It asserts that the event has an attributable source ID and that `remote_storage` is false. The test and example remove the temporary directory on exit. Neither calls a third-party endpoint, connects to a provider, reads a real chat export, writes a production history index or creates an account.

An expected JSON receipt has `persisted_event_reloaded: true`, `source_attributed: true`, `source_types: ["agent-events"]` and `verified_implementation: false`. These are **local functional assertions using a synthetic event**, not evidence of accurate factual memory or complete agent integration.

## Local agent-context separation (synthetic only)

The second example records one fictional event per **independently configured local directory**, then opens two new private-history readers. Both readers retrieve their own attributed event and return no unrelated event for the other project's unique query. The test checks both directions and removes the temporary folders. This demonstrates **file separation under an explicitly selected directory**; it does **not** provide tenant identities, access control, confidential cross-process isolation or hosted multi-agent authorization. Another process with the same OS user's filesystem permissions can still read both directories.

This is a safety/regression demonstration of existing tools, **not** a scored retrieval benchmark. It makes no real-user accuracy, privacy certification or semantic recall claim. Proper agent namespaces, authorization and deletion remain separate REVIEW-class requirements in issue #73.

## Next product gates

1. Make explicit opt-in memory write/review, provenance and uncertainty part of a documented, agent-facing API. Keep autonomous/model-triggered writes **disabled** until human/owner-bound consent and authorization are independently verified.
2. Add record-level correction, deletion and clear retention/backup semantics. Current `record-event` is append-only; this demo does **not** silently implement update/delete.
3. Implement real cross-user/agent namespace isolation and tests in a separately reviewed storage/auth design. A folder owned by one local user is **not** a hosted multi-tenant security boundary.
4. Benchmark bounded retrieval with a versioned synthetic source-ID ground truth, measured false recalls, latency and token budget; do not claim independent semantic accuracy.
5. Evaluate one supported, explicitly authorized agent-runtime integration, then ChatGPT/Claude and others. MCP connections do **not** grant automatic access to a provider's full conversation history.

**Security and release:** This PR uses the existing local CLI/MCP interfaces; it does not change storage, cryptography, authentication, service schemas, deployment, telemetry, CI workflows or benchmark labels. These future changes are **REVIEW** under `docs/OPEN_SOURCE_BOUNDARIES.md` and need a separate security/privacy decision. This OPEN-class synthetic example still needs independent CI and normal maintainer review before merging.

# Agent memory: recording a correction (append-only, lexical)

Companion to [the developer quickstart](AGENT_MEMORY_DEVELOPER_QUICKSTART.md). Local, owner-configured history only; see issue #73 for scope.

Events are never edited or removed. To correct an earlier event, append a new one. `missing_ai_review_answer_history` links the two only when the link is attributable:

- **Explicit reference** — the later event's text says `Supersedes <id>`, `Corrects <id>` or `Correction to <id>`, where `<id>` is the exact ID shown in a finding (for example `event:1b2c…`). Works across conversations.
- **Declared correction, unique match** — the later event is in the same conversation, starts with `Correction:` or `Retraction:`, is not itself a "fixed/verified" claim, repeats every matched term of the earlier event, and that earlier event is its only candidate.

In both cases the later event needs a valid date after the earlier one. When a link is found, the earlier finding is reported as `related_history` with `superseded_by` and `supersession_basis`, the later one carries `supersedes`, and it is listed directly above the earlier one; `omitted_findings` says how many matches a `max_results` limit cut off. Shared keywords with "not fixed", a missing or earlier date, an unknown ID, or more than one candidate link nothing, and both records stay as they were.

A link records that one note *declared itself* a correction of another. It does not establish which statement is true, anyone who can append to the local file can write one, and `status` stays `review_required`.

`missing_ai_history_status` also reports `duplicate_ids_ignored`: the number of event lines skipped because their `id` was already used. The first record for an ID is kept; the file is not modified.

## Deleting a record (owner file edit only)

There is no delete command or MCP tool. `record-event.mjs` only appends, and the reader never writes. To remove a record, the owner edits or deletes `agent-events.jsonl` in the folder they configured, with their own editor or shell. `tests/agent-memory-owner-deletion.test.mjs` pins what the reader then does, using fictional records:

- An already-running reader re-checks the file on every tool call. After the line is removed (or the file is replaced or deleted), the record is no longer returned by `missing_ai_search_history` or `missing_ai_review_answer_history`, and `missing_ai_history_status` reports the lower `message_count`.
- A correction that named the removed record's ID is still served as an ordinary record. It carries no `supersedes` link, but its own text still contains the removed ID; delete or edit that line too if the reference itself should go.
- If two lines reused one `id`, removing the first makes the reader serve the second, previously ignored one under the same ID. An ID alone does not show that the text behind it is unchanged.

What this does not cover: no tombstone or deletion receipt is written, so there is no record that something was removed; backups, synced copies, editor swap files and a separately imported `conversations.json` are untouched; and any quote a client or model already received before the edit stays in that conversation. A first-class delete with a receipt, and retention rules, remain REVIEW-class work under issue #73.

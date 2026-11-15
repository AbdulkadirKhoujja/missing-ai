# Agent memory: recording a correction (append-only, lexical)

Companion to [the developer quickstart](AGENT_MEMORY_DEVELOPER_QUICKSTART.md). Local, owner-configured history only; see issue #73 for scope.

Events are never edited or removed. To correct an earlier event, append a new one. `missing_ai_review_answer_history` links the two only when the link is attributable:

- **Explicit reference** — the later event's text says `Supersedes <id>`, `Corrects <id>` or `Correction to <id>`, where `<id>` is the exact ID shown in a finding (for example `event:1b2c…`). Works across conversations.
- **Declared correction, unique match** — the later event is in the same conversation, starts with `Correction:` or `Retraction:`, is not itself a "fixed/verified" claim, repeats every matched term of the earlier event, and that earlier event is its only candidate.

In both cases the later event needs a valid date after the earlier one. When a link is found, the earlier finding is reported as `related_history` with `superseded_by` and `supersession_basis`, the later one carries `supersedes`, and it is listed directly above the earlier one; `omitted_findings` says how many matches a `max_results` limit cut off. Shared keywords with "not fixed", a missing or earlier date, an unknown ID, or more than one candidate link nothing, and both records stay as they were.

A link records that one note *declared itself* a correction of another. It does not establish which statement is true, anyone who can append to the local file can write one, and `status` stays `review_required`.

`missing_ai_history_status` also reports `duplicate_ids_ignored`: the number of event lines skipped because their `id` was already used. The first record for an ID is kept; the file is not modified.

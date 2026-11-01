# Conversation history and context continuity — local preview (review required)

This is an **opt-in local browser preview**, not a live MCP account-integration feature. `site/history.html` reads a user-selected ChatGPT `conversations.json` file, extracts the active conversation branch's user/assistant text messages, and searches those messages when the user pastes a new AI response. Original text stays in browser memory unless a user explicitly saves an encrypted IndexedDB copy. This feature sends no imported conversation to the Missing AI API, MCP endpoint, GitHub or Orchestryn.

## Product contract

- **Input:** User-chosen ChatGPT `conversations.json` (JSON array, not ZIP), or user-entered notes. No direct ChatGPT or Claude history retrieval permission is implied. Don't scrape providers, use undocumented APIs, or import data without rights.
- **Limits:** 25 MB selected JSON file, max 5,000 conversations, 20,000 text messages, 12 million imported characters; each text message truncated at 3,000 characters. Use the active `current_node` branch only. Ignore attachments, tool/system messages and alternate branches. Missing branches are counted and reported.
- **Review:** Token-overlap retrieval of earlier excerpts; phrase-based candidate flags for repeated access requests or work previously claimed complete. Quote the original text, conversation title, speaker and available date. These records are evidence of statements, **not independent verification**. Results may miss semantic matches and create false positives. Verify whether an issue regressed or permissions were revoked.
- **Persistence:** None by default. A user may explicitly encrypt their current selection with a 12+-character passphrase. Web Crypto PBKDF2-SHA256 (310k iterations), AES-256-GCM, fresh random salt and nonce; only ciphertext in browser IndexedDB, no passphrase or recovery service. A browser reload clears plaintext in memory unless the user unlocks a stored copy. Browser deletion does not guarantee forensic secure erase from device backups.
- **No** accounts, server syncing, automatic history imports, telemetry or background monitoring. The history page's CSP `connect-src 'none'` blocks JavaScript-initiated network requests. Static site assets still load from the site origin.

## Privacy and limitations

Chat histories may contain passwords, identities, private client documents or sensitive personal data. Review exports before selecting them; obtain permission where needed; for sensitive work, use a self-hosted copy on controlled infrastructure. The unaudited browser page is **not** a certified personal-data vault. Extensions, compromised browser/OS and supply-chain compromises may access decrypted in-memory content. Weak passphrases weaken encrypted-at-rest protection. IndexedDB data is origin-scoped, may be removed by the browser, and is not a transferable backup.

The current **six stateless MCP tools and unauthenticated Silver beta are intentionally unchanged**. Do not add private history ingestion or persistence to them. Future host integrations require provider-supported access permissions, per-user authentication and isolation, data retention/deletion controls, consent, security/privacy review and evaluated accuracy; no provider automatically shares full conversation history with custom MCP tools.

## Verification and review gate

Run `npm test` (Node 22+) and manually test import, excerpts, save/unlock/delete, keyboard access and responsive layouts over HTTPS. Negative cases should include branched histories, incomplete exports, untrusted content, stale permissions, unresolved work and corrupted ciphertext. This is a **REVIEW-class** change under `docs/OPEN_SOURCE_BOUNDARIES.md`: do not merge/deploy before a security/privacy assessment, maintainer review, CI and browser acceptance. Synthetic tests do not establish semantic accuracy.

# Checker result announcements — manual accessibility review

**Status:** proposed OPEN-class accessibility improvement; manual browser and assistive-technology checks are **not yet performed**. Passing automated tests do not establish WCAG conformance.

## Safe sample

Use fictional, non-sensitive source instructions such as:

```text
- Verify signed payment webhooks.
- Include a cancellation flow.
- Provide a support contact.
```

AI answer: `The cancellation flow is available.`

## Review steps

1. On the proposed branch's static site, use **Tab** to reach **Find what AI missed**. Activate with **Enter**, then repeat with **Space**. Keyboard focus should remain on that button; no forced jump or focus trap should occur.
2. With NVDA + Firefox on Windows or VoiceOver + Safari on macOS, listen for a **single concise status announcement** naming the counts. Use the screen-reader region/landmark navigation to inspect the separate **Gap report** region and individual findings. The long report must not be announced in full automatically.
3. After activation, use **Tab** to reach **Copy report as JSON**, activate it, and check feedback and focus behaviour. Clipboard permissions may vary by browser.
4. With a pointer or touch, run a check and verify the updated report is scrolled into view as expected. Enable **reduced motion** at the operating-system level and confirm the scroll is immediate instead of animated.
5. Submit invalid or excessive fictional input to exercise the error state. Verify the **Check not completed** status is announced without losing focus.
6. Re-run with 0, 1 and multiple review candidates. Confirm meaningful count wording, no duplicate announcements, readable zoom, and no unexpected keyboard traps. Test on a mobile screen reader where available.

## Automated coverage and limits

`tests/result-announcement.test.mjs` exercises DOM-like event handlers for keyboard, pointer, reduced-motion and error flows, and checks the root/deployed site mirrors. It is **not** a browser accessibility audit: real assistive-technology announcements and touch behaviour still require manual review.

**Release gate:** maintainer review, green CI and practical assistive-technology testing before merging. No remote MCP, private infrastructure, telemetry or stored user data changes.

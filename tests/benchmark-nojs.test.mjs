import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("benchmark page has a readable no-JavaScript fallback with the release JSON link", () => {
  const html=readFileSync(new URL("../site/benchmarks/index.html", import.meta.url), "utf8");
  const fallback=html.match(/<noscript>([\\s\\S]*?)<\\/noscript>/i);
  assert.ok(fallback, "the benchmark table needs a no-JavaScript alternative");
  assert.match(fallback[1], /interactive benchmark table requires JavaScript/i);
  assert.match(fallback[1], /href="\\.\\/synthetic-results\\.json"/);
  assert.match(html, /id="benchmark-status" role="status" aria-live="polite"/);
  assert.match(html, /<table class="benchmark-table"><caption>/);
});

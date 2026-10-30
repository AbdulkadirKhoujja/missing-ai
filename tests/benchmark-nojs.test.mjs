import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("benchmark page has a readable no-JavaScript fallback with the release JSON link", () => {
  const html=readFileSync(new URL("../site/benchmarks/index.html", import.meta.url), "utf8");
  const fallback=html.match(new RegExp("<noscript>(.*?)</noscript>", "is"));
  assert.ok(fallback, "the benchmark table needs a no-JavaScript alternative");
  assert.match(fallback[1], /interactive benchmark table requires JavaScript/i);
  assert.ok(fallback[1].includes('href="./synthetic-results.json"'));
  assert.ok(html.includes('id="benchmark-status" role="status" aria-live="polite"'));
  assert.ok(html.includes('<table class="benchmark-table"><caption>'));
});

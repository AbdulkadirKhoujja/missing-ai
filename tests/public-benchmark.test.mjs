import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {buildPublicBenchmark,renderSummary} from "../scripts/publish-public-benchmark.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sha="1".repeat(40);
test("public synthetic report is calculated from four actual test configurations",()=>{
 const r=buildPublicBenchmark({sha,timestamp:"2026-10-29T09:00:00.000Z"});
 assert.equal(r.release_commit,sha);
 assert.equal(r.production_engine,"lexical-v1");
 assert.equal(r.datasets.length,4);
 assert.equal(r.datasets.filter(x=>x.production).length,2);
 assert.equal(r.datasets.filter(x=>!x.production).length,2);
 assert.deepEqual(r.datasets.map(x=>x.source),["benchmarks/coverage-v1.json","benchmarks/challenge-v1.json","benchmarks/coverage-v1.json","benchmarks/challenge-v1.json"]);
 for(const x of r.datasets){
  assert.ok(x.entry.case_count>0);
  assert.equal(x.entry.case_count,x.entry.labels.covered+x.entry.labels.omitted+x.entry.labels.uncertain);
  const c=x.entry.confusion;
  assert.equal(x.entry.case_count,c.true_positive+c.false_negative+c.false_positive+c.true_negative+c.uncertain_review+c.uncertain_mentioned);
  assert.match(x.entry.author_label_status,/synthetic/i);
  for(const y of Object.values(x.entry.metrics))assert.ok(y===null||(typeof y==="number"&&y>=0&&y<=1));
 }
 assert.match(r.evidence,/NOT INDEPENDENTLY HUMAN ADJUDICATED/);
 assert.match(r.semantic_benchmark_status,/Not independently adjudicated/);
 assert.ok(r.limitations.some(x=>x.includes("not an improvement")));
});
test("public daily summary cannot claim semantic accuracy or deployment of candidate v2",()=>{
 const r=buildPublicBenchmark({sha});
 const s=renderSummary(r);
 assert.match(s,/NOT independently adjudicated accuracy/);
 assert.match(s,/lexical-v1 published checker/);
 assert.match(s,/lexical-v2 EXPERIMENTAL candidate/);
 assert.match(s,/not code correctness, semantic truth, or real-world accuracy/i);
 assert.match(s,/issue\/29/);
 assert.doesNotMatch(s,/100% accurate|independently verified accuracy|lexical-v2 production/i);
});
test("invalid benchmark release revision is rejected",()=>{
 assert.throws(()=>buildPublicBenchmark({sha:"private hostname/endpoint"}),/Invalid commit SHA/);
});
test("risk policy and daily job separate public benchmarking from private work",()=>{
 const policy=read("docs/OPEN_SOURCE_BOUNDARIES.md");
 const ops=read("docs/DAILY_OPERATIONS.md");
 const workflow=read(".github/workflows/daily-public-benchmark.yml");
 for(const word of ["OPEN","REVIEW","CLOSED","Orchestryn","secrets","benchmark"])assert.ok(policy.includes(word));
 assert.match(ops,/no automatic merges to main/i);
 assert.match(ops,/independent.*adjudication/i);
 assert.match(workflow,/cron: '30 08 \* \* \*'/);
 assert.match(workflow,/permissions:\n  contents: read/);
 assert.match(workflow,/actions\/upload-artifact@v4/);
 assert.match(workflow,/npm test/);
 assert.doesNotMatch(workflow,/\bgit push\b|personal_access_token|secrets\./i);
 assert.match(read(".github/workflows/ci-and-pages.yml"),/node scripts\/publish-public-benchmark\.mjs --out _site\/benchmarks/);
});
test("source benchmark page has provenance language and an Actions run link",()=>{
 const page=read("site/benchmarks/index.html");
 assert.match(page,/author-labelled synthetic examples/i);
 assert.match(page,/not completed blind human adjudication/i);
 assert.match(page,/synthetic-results\.json/);
 assert.match(page,/daily-public-benchmark\.yml/);
 assert.match(page,/OPEN_SOURCE_BOUNDARIES\.md/);
});

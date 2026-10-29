import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluate} from "../scripts/evaluate-coverage.mjs";
const benchmark=JSON.parse(readFileSync(new URL("../benchmarks/coverage-v1.json",import.meta.url),"utf8"));
test("benchmark has 60 uniquely identified, diverse authored synthetic cases",()=>{
 assert.equal(benchmark.cases.length,60);
 assert.equal(new Set(benchmark.cases.map(c=>c.id)).size,60);
 assert.equal(new Set(benchmark.cases.map(c=>c.domain)).size,10);
 assert.deepEqual(benchmark.cases.reduce((a,c)=>(a[c.gold]=(a[c.gold]||0)+1,a),{}),{covered:20,omitted:30,uncertain:10});
 for(const c of benchmark.cases){
  assert.ok(c.source_text.startsWith("- ")&&c.source_text.length>12);
  assert.ok(c.ai_output.length>15);
  assert.ok(["exact","paraphrase","omission","negation","ambiguous","lexical_trap"].includes(c.kind));
 }
});
test("benchmark evaluator produces consistent confusion totals and traceable rows",()=>{
 const a=evaluate(),b=evaluate();
 assert.deepEqual(a,b);
 assert.equal(a.n,60);
 assert.equal(a.rows.length,60);
 assert.equal(a.confusion.true_positive+a.confusion.false_negative,30);
 assert.equal(a.confusion.true_negative+a.confusion.false_positive,20);
 assert.equal(a.confusion.uncertain_review+a.confusion.uncertain_mentioned,10);
 assert.equal(a.by_domain.reduce((sum,r)=>sum+r.n,0),60);
 for(const m of Object.values(a.metrics))assert.ok(m===null || (m>=0&&m<=1));
});
test("evaluation separates implementation evidence from answer coverage",()=>{
 assert.equal(benchmark.scope,"answer_coverage_not_implementation_truth");
 assert.match(benchmark.annotation_status,/not_independently_human_adjudicated/);
});

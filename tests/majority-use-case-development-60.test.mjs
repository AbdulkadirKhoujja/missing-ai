import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessDevelopmentSourceCapture} from "../scripts/evaluate-extraction-development.mjs";
const cases=JSON.parse(readFileSync(new URL("../benchmark/use-cases-v1/development-60.json",import.meta.url),"utf8"));
test("sixty distinct source instructions and twelve contextual controls are documented",()=>{
 assert.equal(cases.cases.length,60);
 assert.equal(cases.negative_context_lines.length,12);
 assert.equal(new Set(cases.cases.map(x=>x.source_text)).size,60);
 assert.equal(new Set(cases.cases.map(x=>x.category)).size,6);
});
test("source capture is measured without requiring a misleading perfect score",()=>{
 const result=assessDevelopmentSourceCapture(cases);
 assert.equal(result.positive_examples,60);
 assert.equal(result.contextual_examples,12);
 assert.equal(result.by_category.length,6);
 assert.equal(result.positive_captured+result.positive_misses.length,60);
 assert.equal(result.contextual_without_false_candidates+result.contextual_false_candidate_ids.length,12);
 console.log("SOURCE_CAPTURE_DIAGNOSTIC="+JSON.stringify({
  captured:result.positive_captured,total:result.positive_examples,
  contextual_accepted:result.contextual_without_false_candidates,
  contextual_total:result.contextual_examples,
  by_category:result.by_category
 }));
});

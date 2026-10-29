import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluate} from "../scripts/evaluate-coverage.mjs";
import {checkMissingV2} from "../shared/checker-v2.mjs";
import {checkMissingV3} from "../shared/checker-v3.mjs";
const fixture=p=>JSON.parse(readFileSync(new URL("../benchmarks/"+p,import.meta.url),"utf8"));
const base=fixture("coverage-v1.json"),challenge=fixture("challenge-v1.json");
const report=(fx,checker)=>evaluate(fx.cases,checker,fx);
const shorter=r=>({cases:r.n,fp:r.confusion.false_positive,fn:r.confusion.false_negative,tp:r.confusion.true_positive,
 false_alarm_rate:r.metrics.false_positive_rate,recall:r.metrics.recall,
 flagged_covered:r.rows.filter(x=>x.gold==="covered"&&x.predicted==="review").map(x=>x.id)});
test("v3 remains an experimental checker with a distinct engine name",()=>{
 const x=checkMissingV3("- Must allow customers to cancel bookings.","Users can withdraw reservations from their dashboard.");
 assert.equal(x.engine,"lexical-v3-candidate");
 assert.match(x.limitations,/experimental/i);
});
test("v3 regression gate: fewer false alarms, no extra missed omissions on both development fixtures",()=>{
 const old=[report(base,checkMissingV2),report(challenge,checkMissingV2)];
 const next=[report(base,checkMissingV3),report(challenge,checkMissingV3)];
 console.log("V3_EXPERIMENTAL_COMPARISON "+JSON.stringify({base:{v2:shorter(old[0]),v3:shorter(next[0])},challenge:{v2:shorter(old[1]),v3:shorter(next[1])}}));
 for(let i=0;i<2;i++){
  assert.ok(next[i].confusion.false_positive<=old[i].confusion.false_positive,"candidate worsened covered-case false alarms in "+i);
  assert.ok(next[i].confusion.false_negative<=old[i].confusion.false_negative,"candidate missed extra omissions in "+i);
 }
 assert.ok(next.reduce((n,x)=>n+x.confusion.false_positive,0)<
   old.reduce((n,x)=>n+x.confusion.false_positive,0),"candidate had no measured false-alarm improvement");
});
test("guardrail: clear denials remain review-needed even when words overlap",()=>{
 for(const [source,answer] of [
  ["- Must verify webhook signatures.","The app does not verify webhook signatures."],
  ["- Must reject private IP addresses.","Private IP addresses are still accepted."],
  ["- Must provide a payment receipt.","No receipt is available for any payment."],
  ["- Must not include shellfish in lunch.","The recipe contains shellfish and shrimp."],
  ["- Must prevent duplicate reservations.","Duplicate reservations are not blocked."],
 ]){
  const result=checkMissingV3(source,answer);
  assert.equal(result.findings[0].status,"needs_review",source+" / "+answer);
 }
});
test("guardrail: a claimed internal audit need not be misread as no audit",()=>{
 const r=checkMissingV3("- Must complete an accessibility audit before public beta.",
   "A trained internal specialist completed the accessibility audit before public beta.");
 assert.notEqual(r.findings[0].status,"needs_review");
});
test("guardrail: realistic covered paraphrases should be flagged less aggressively",()=>{
 const cases=[
 ["- Must not include shellfish in the meal.","Ingredients are free of shrimp, prawns, and crustaceans."],
 ["- Must include a source link for each statistic.","Every statistic has a hyperlink to its originating dataset."],
 ["- Must conclude the letter by thanking the recipient.","The closing expresses gratitude to the reader."],
 ["- Must avoid accepting two bookings for one seat.","The database blocks competing reservations against the same capacity allocation."],
 ];
 const outputs=cases.map(([a,b])=>checkMissingV3(a,b).findings[0].status);
 console.log("V3_PARAPHRASE_STATUS "+JSON.stringify(outputs));
 assert.ok(outputs.filter(x=>x!=="needs_review").length>=2,"candidate should handle at least two held-out paraphrases");
});

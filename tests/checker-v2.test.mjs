import test from "node:test";
import assert from "node:assert/strict";
import {checkMissingV2} from "../shared/checker-v2.mjs";
import {evaluate} from "../scripts/evaluate-coverage.mjs";
import {readFileSync} from "node:fs";
const data=JSON.parse(readFileSync(new URL("../benchmarks/coverage-v1.json",import.meta.url),"utf8"));
test("candidate preserves stable three-status API without implying implementation proof",()=>{
 const a=checkMissingV2("- Must verify webhook signatures","Must verify webhook signatures");
 assert.equal(a.summary.requirements,1);
 assert.equal(a.findings[0].status,"text_found");
 assert.equal(a.findings[0].evidence_basis,"answer_text_only");
 assert.match(a.limitations,/cannot establish semantic truth/);
});
test("fixed word-equivalences recognize a booking paraphrase with verbatim evidence",()=>{
 const response="I built a homepage. Transactions and unique constraints reject overlapping reservations for the same workshop.";
 const r=checkMissingV2("- Must stop the same workshop slot being booked twice.",response);
 assert.equal(r.findings[0].status,"likely_mentioned");
 const ev=r.findings[0].evidence;
 assert.ok(ev);
 assert.equal(response.slice(ev.start,ev.end),ev.text);
 assert.match(ev.text,/unique constraints reject overlapping/);
});
test("negative statement near the requested requirement is not accepted as coverage",()=>{
 const r=checkMissingV2("- Must verify webhook signatures before processing payments.","I did not verify webhook signatures before processing payments.");
 assert.equal(r.findings[0].status,"needs_review");
 assert.equal(r.findings[0].assessment,"potential_contradiction");
});
test("unknown broad completion claims are left for review",()=>{
 const r=checkMissingV2("- Must verify Stripe webhook signatures.","Everything is complete and checked.");
 assert.equal(r.findings[0].status,"needs_review");
});
test("candidate can be scored against exactly the same benchmark as baseline",()=>{
 const r=evaluate(data.cases,checkMissingV2);
 assert.equal(r.n,60);
 assert.equal(r.engine,"lexical-v2-candidate");
 assert.equal(r.confusion.true_positive+r.confusion.false_negative,30);
});
test("candidate rejects oversized and missing input",()=>{
 assert.throws(()=>checkMissingV2("","text"),/required/);
 assert.throws(()=>checkMissingV2("- Must verify webhooks","x".repeat(30001)),/Maximum/);
});

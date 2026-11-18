import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {compareRuns,validatePack,validateRun} from "../scripts/compare-extended-reviews.mjs";

const pool=JSON.parse(readFileSync(new URL("../benchmark/extended-v2/blind-cases.json",import.meta.url),"utf8"));
const template=JSON.parse(readFileSync(new URL("../benchmark/extended-v2/reviewer-template.json",import.meta.url),"utf8"));
const makeRun=(role="human_reviewer",name="Reviewer-A")=>({
 schema:"missing-ai-extended-review-v1",role,participant_id:name,
 independent_attestation:true,model:role==="model_host"?"fictional-model-version":undefined,
 judgments:pool.cases.map(c=>({
  case_id:c.id,judgment:"cannot_determine",
  reason:"Synthetic reviewer placeholder for mechanical schema tests only.",evidence:[]
 }))
});
test("160 label-free synthetic cases cover eight domains and forty prompts",()=>{
 const {ids}=validatePack(pool);
 assert.equal(ids.size,160);
 assert.equal(new Set(pool.cases.map(c=>c.domain)).size,8);
 const prompts=new Map();
 for(const c of pool.cases){
  assert.equal(c.source_type,"authored_fictional");
  prompts.set(c.source_text,(prompts.get(c.source_text)||0)+1);
  assert.equal(Object.hasOwn(c,"gold"),false);
  assert.equal(Object.hasOwn(c,"judgment"),false);
 }
 assert.equal(prompts.size,40);
 assert.ok([...prompts.values()].every(n=>n===4));
});
test("public reviewer template is intentionally incomplete and cannot be mistaken for gold",()=>{
 assert.equal(template.judgments.length,pool.cases.length);
 assert.equal(template.independent_attestation,false);
 assert.ok(template.judgments.every(r=>r.judgment===null&&r.evidence.length===0));
 assert.throws(()=>validateRun(pool,template,{role:"human_reviewer"}),/attest/);
});
test("complete independent fictional reviews can be compared without accuracy claims",()=>{
 const left=makeRun(),right=makeRun("human_reviewer","Reviewer-B");
 right.judgments[0].judgment="not_clearly_mentioned";
 const result=compareRuns(pool,left,right,{mode:"reviewers"});
 assert.equal(result.cases,160);
 assert.equal(result.agreement,159);
 assert.equal(result.disagreements,1);
 assert.equal(result.accuracy_claim_allowed,undefined);
 assert.equal(result.human_independence_verified,false);
 assert.equal(result.implementation_verified,false);
 assert.equal(result.disagreement_rows[0].case_id,pool.cases[0].id);
});
test("exact answer quote offsets are required and fabricated evidence fails closed",()=>{
 const run=makeRun();
 const c=pool.cases[0];
 run.judgments[0]={case_id:c.id,judgment:"claimed_covered",reason:"This string is asserted in the answer but has no implementation proof.",evidence:[{quote:c.ai_output,start:0}]};
 assert.doesNotThrow(()=>validateRun(pool,run));
 run.judgments[0].evidence[0].start=1;
 assert.throws(()=>validateRun(pool,run),/exact answer quotation/);
 run.judgments[0].evidence=[{quote:"I personally tested working source code.",start:0}];
 assert.throws(()=>validateRun(pool,run),/exact answer quotation/);
 run.judgments[0].evidence=[];
 assert.throws(()=>validateRun(pool,run),/Evidence required/);
});
test("missing and duplicate case IDs fail closed",()=>{
 const run=makeRun();
 run.judgments.pop();
 assert.throws(()=>validateRun(pool,run),/one judgment/);
 const dup=makeRun();
 dup.judgments[1].case_id=dup.judgments[0].case_id;
 assert.throws(()=>validateRun(pool,dup),/duplicate case ID/);
});
test("host disagreement is reported as disagreement, never gold accuracy",()=>{
 const a=makeRun("model_host","GPT-run"),b=makeRun("model_host","Claude-run");
 a.judgments[3].judgment="not_clearly_mentioned";
 b.judgments[3].judgment="contradicted";
 b.judgments[3].evidence=[{quote:pool.cases[3].ai_output,start:0}];
 const r=compareRuns(pool,a,b,{mode:"hosts"});
 assert.equal(r.disagreements,1);
 assert.equal(r.measurement,"raw_pairwise_label_agreement_not_accuracy");
 assert.equal(r.annotation_status,"NO_ADJUDICATED_GOLD");
 assert.throws(()=>compareRuns(pool,a,a,{mode:"hosts"}),/Two distinct/);
 assert.throws(()=>compareRuns(pool,makeRun(),b,{mode:"hosts"}),/Review requires role/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {scoreSemanticBenchmark} from "../scripts/score-semantic-benchmark.mjs";
const path=fileURLToPath(new URL("../benchmark/semantic-v1/provisional.json",import.meta.url));
const script=fileURLToPath(new URL("../scripts/score-semantic-benchmark.mjs",import.meta.url));
const gold=JSON.parse(readFileSync(path,"utf8"));
function seedFixture(){
 return {schema:"missing-ai-semantic-predictions-v1",host:"Synthetic regression fixture — NOT a real AI host",
  scenario_predictions:gold.scenarios.map(c=>({
   case_id:c.id,judgment:c.proposed.judgment,strength:c.proposed.strength,
   reason:"Fixture reproduces the provisional author seed for scoring unit tests only.",
   evidence:structuredClone(c.proposed.evidence)
  })),
  pair_predictions:gold.pairs.map(p=>({
   pair_id:p.id,equivalent:p.proposed.equivalent,
   reason:"Fixture reproduces the provisional author seed for scoring unit tests only."
  }))};
}
test("dataset provenance and balanced controlled scenarios are present",()=>{
 assert.equal(gold.requirements.length,22);
 assert.equal(gold.scenarios.length,35);
 assert.equal(gold.pairs.length,17);
 assert.deepEqual(Object.keys(gold.provenance.source_urls),["G1","G2"]);
 assert.equal(gold.review.status,"provisional_author_seed");
 assert.deepEqual(gold.review.independent_reviewers,[]);
 assert.ok(gold.scenarios.filter(c=>c.proposed.strength==="context_only").length>=2);
 assert.ok(gold.scenarios.some(c=>c.challenge.includes("compound")));
 assert.ok(gold.pairs.some(p=>p.challenge.includes("compound")));
 assert.ok(gold.scenarios.some(c=>c.answer.includes("internal accessibility audit")));
 assert.ok(gold.scenarios.some(c=>c.answer.includes("older users")));
 assert.ok(gold.requirements.every(r=>r.source_excerpt.length>=12&&r.source_ref.startsWith("S0")));
});
test("seed-derived unit fixture scores perfectly but remains explicitly provisional",()=>{
 const result=scoreSemanticBenchmark(gold,seedFixture());
 assert.equal(result.gold_status,"PROVISIONAL_AUTHOR_SEED_NOT_INDEPENDENTLY_ADJUDICATED");
 assert.equal(result.accuracy_claim_allowed,false);
 assert.equal(result.judgment.exact_accuracy_pct,100);
 assert.equal(result.source_strength.accuracy_pct,100);
 assert.equal(result.omission_detection.fp,0);
 assert.equal(result.omission_detection.fn,0);
 assert.equal(result.duplicate_equivalence.accuracy_pct,100);
 assert.equal(result.source_strength.context_false_alerts,0);
});
test("missing, duplicated and unknown scenario predictions are rejected",()=>{
 const missing=seedFixture();missing.scenario_predictions.pop();
 assert.throws(()=>scoreSemanticBenchmark(gold,missing),/exactly 35/);
 const duplicate=seedFixture();duplicate.scenario_predictions[1].case_id="C001";
 assert.throws(()=>scoreSemanticBenchmark(gold,duplicate),/unknown or duplicate/);
 const unknown=seedFixture();unknown.scenario_predictions[0].case_id="C999";
 assert.throws(()=>scoreSemanticBenchmark(gold,unknown),/unknown or duplicate/);
});
test("missing and duplicate equivalence predictions are rejected",()=>{
 const missing=seedFixture();missing.pair_predictions.pop();
 assert.throws(()=>scoreSemanticBenchmark(gold,missing),/exactly 17/);
 const dup=seedFixture();dup.pair_predictions[1].pair_id="D001";
 assert.throws(()=>scoreSemanticBenchmark(gold,dup),/unknown or duplicate/);
});
test("fabricated answer evidence and invalid offsets are rejected",()=>{
 const fake=seedFixture();
 const positive=fake.scenario_predictions.find(x=>x.judgment==="claimed_covered");
 positive.evidence[0].quote="We inspected all actual source code";
 assert.throws(()=>scoreSemanticBenchmark(gold,fake),/incorrect answer quotation/);
 const shifted=seedFixture();
 shifted.scenario_predictions.find(x=>x.judgment==="contradicted").evidence[0].start+=1;
 assert.throws(()=>scoreSemanticBenchmark(gold,shifted),/incorrect answer quotation/);
 const omitted=seedFixture();
 omitted.scenario_predictions.find(x=>x.judgment==="claimed_covered").evidence=[];
 assert.throws(()=>scoreSemanticBenchmark(gold,omitted),/requires 1-3/);
});
test("false alarms and missed omissions are measured separately",()=>{
 const bad=seedFixture();
 const covered=bad.scenario_predictions.find(x=>x.case_id==="C001");
 covered.judgment="not_clearly_mentioned";covered.evidence=[];
 const missed=bad.scenario_predictions.find(x=>x.case_id==="C002");
 missed.judgment="claimed_covered";missed.evidence=[{quote:gold.scenarios[1].answer,start:0}];
 const report=scoreSemanticBenchmark(gold,bad);
 assert.equal(report.omission_detection.fp,1);
 assert.equal(report.omission_detection.fn,1);
 assert.equal(report.omission_detection.recall_pct<100,true);
 assert.equal(report.omission_detection.false_alarm_rate_pct>0,true);
 assert.equal(report.mismatches.filter(x=>["C001","C002"].includes(x.id)).length,2);
});
test("abstaining on a clearly missing item counts as an undetected gap",()=>{
 const bad=seedFixture();
 const missed=bad.scenario_predictions.find(x=>x.case_id==="C002");
 missed.judgment="cannot_determine";missed.evidence=[];
 const report=scoreSemanticBenchmark(gold,bad);
 assert.equal(report.omission_detection.fn,1);
 assert.ok(report.judgment.abstentions>0);
});
test("context examples misread as obligations produce context false-alert count",()=>{
 const bad=seedFixture();
 const context=bad.scenario_predictions.find(x=>x.case_id==="C034");
 assert.equal(context.strength,"context_only");
 context.strength="mandatory";
 const report=scoreSemanticBenchmark(gold,bad);
 assert.equal(report.source_strength.context_false_alerts,1);
 assert.ok(report.source_strength.accuracy_pct<100);
});
test("non-equivalent grouping produces false merge; equivalent split produces missed merge",()=>{
 const bad=seedFixture();
 const yes=bad.pair_predictions.find(x=>x.pair_id==="D001");
 const no=bad.pair_predictions.find(x=>x.pair_id==="D003");
 assert.equal(yes.equivalent,true);assert.equal(no.equivalent,false);
 yes.equivalent=false;no.equivalent=true;
 const report=scoreSemanticBenchmark(gold,bad);
 assert.equal(report.duplicate_equivalence.fp,1);
 assert.equal(report.duplicate_equivalence.fn,1);
 assert.equal(report.pair_mismatches.length,2);
});
test("adjudication-gated release scoring refuses provisional author gold",()=>{
 assert.throws(()=>scoreSemanticBenchmark(gold,seedFixture(),{requireAdjudicated:true}),/RELEASE BLOCKED/);
});
test("CLI prints provisional status and refuses release mode",()=>{
 const dir=mkdtempSync(join(tmpdir(),"missing-ai-benchmark-"));
 try{
  const file=join(dir,"predictions.json");
  writeFileSync(file,JSON.stringify(seedFixture()));
  const ordinary=spawnSync(process.execPath,[script,"--predictions",file,"--json"],{encoding:"utf8"});
  assert.equal(ordinary.status,0,ordinary.stderr);
  const report=JSON.parse(ordinary.stdout);
  assert.equal(report.accuracy_claim_allowed,false);
  const gated=spawnSync(process.execPath,[script,"--predictions",file,"--require-adjudicated"],{encoding:"utf8"});
  assert.equal(gated.status,2);
  assert.match(gated.stderr,/RELEASE BLOCKED/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

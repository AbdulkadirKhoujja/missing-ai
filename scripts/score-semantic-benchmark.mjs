// Offline semantic benchmark scorer. No AI model, network access or remote services.
// Author-seeded labels are PROVISIONAL until independently adjudicated.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

const CLASS=["claimed_covered","contradicted","not_clearly_mentioned","cannot_determine"];
const STRENGTH=["mandatory","recommended","conditional","context_only","uncertain"];
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const percent=(num,den)=>den?Math.round(10000*num/den)/100:null;
const count=(a,label)=>a.filter(x=>x===label).length;
const fail=msg=>{throw new Error(msg);};
function exactIds(given,expected,key,kind){
 if(!Array.isArray(given)||given.length!==expected.length)fail(kind+" predictions must contain exactly "+expected.length+" entries.");
 const wanted=new Set(expected),seen=new Set();
 for(const x of given){
  if(!object(x)||typeof x[key]!=="string"||!wanted.has(x[key])||seen.has(x[key]))fail(kind+" prediction has unknown or duplicate "+key+": "+String(x?.[key]));
  seen.add(x[key]);
 }
}
function textReason(reason,kind){
 if(typeof reason!=="string"||reason.trim().length<12||reason.length>500)fail(kind+" requires a reason of 12-500 characters.");
}
function inspectEvidence(answer,evidence,kind,required){
 if(!Array.isArray(evidence)||evidence.length>3||(required&&evidence.length===0))fail(kind+" requires "+(required?"1-3":"0-3")+" exact answer quotes.");
 for(const x of evidence){
  if(!object(x)||typeof x.quote!=="string"||x.quote.length<8||x.quote.length>600||
   !Number.isSafeInteger(x.start)||x.start<0||x.start+x.quote.length>answer.length||
   answer.slice(x.start,x.start+x.quote.length)!==x.quote)
   fail(kind+" has an incorrect answer quotation or start offset.");
 }
}
function checkGold(gold){
 if(!object(gold)||gold.schema!=="missing-ai-semantic-benchmark-v1")fail("Unknown benchmark gold schema.");
 if(!Array.isArray(gold.requirements)||!Array.isArray(gold.scenarios)||!Array.isArray(gold.pairs))fail("Gold requires requirements, scenarios and pairs.");
 const reqMap=new Map(gold.requirements.map(x=>[x.id,x]));
 if(reqMap.size!==gold.requirements.length)fail("Duplicate requirement IDs in gold.");
 const caseIds=new Set(),pairIds=new Set();
 for(const c of gold.scenarios){
  if(!reqMap.has(c.requirement_id)||caseIds.has(c.id))fail("Bad scenario requirement/id: "+String(c.id));
  caseIds.add(c.id);
  if(typeof c.answer!=="string"||!c.answer.trim()||!object(c.proposed))fail("Bad gold case "+c.id);
  if(!CLASS.includes(c.proposed.judgment)||!STRENGTH.includes(c.proposed.strength))fail("Invalid proposed gold label in "+c.id);
  inspectEvidence(c.answer,c.proposed.evidence,c.id,["claimed_covered","contradicted"].includes(c.proposed.judgment));
 }
 for(const p of gold.pairs){
  if(pairIds.has(p.id)||!reqMap.has(p.left)||!reqMap.has(p.right)||!object(p.proposed)||typeof p.proposed.equivalent!=="boolean")fail("Bad equivalence pair "+String(p.id));
  pairIds.add(p.id);
 }
 return reqMap;
}
function acceptedGold(gold){
 return gold.review?.status==="adjudicated"&&
  Array.isArray(gold.review.independent_reviewers)&&
  new Set(gold.review.independent_reviewers.map(x=>x.id)).size>=2&&
  gold.review.independent_reviewers.every(x=>typeof x.id==="string"&&x.id.trim()&&typeof x.evidence_uri==="string"&&x.evidence_uri.trim())&&
  gold.scenarios.every(x=>x.review_state==="adjudicated")&&
  gold.pairs.every(x=>x.review_state==="adjudicated");
}
export function scoreSemanticBenchmark(gold,predictions,{requireAdjudicated=false}={}){
 const reqMap=checkGold(gold);
 if(!object(predictions)||predictions.schema!=="missing-ai-semantic-predictions-v1")fail("Unknown prediction schema.");
 if(typeof predictions.host!=="string"||!predictions.host.trim()||predictions.host.length>120)fail("Prediction host required.");
 const accepted=acceptedGold(gold);
 if(requireAdjudicated&&!accepted)fail("RELEASE BLOCKED: two independently documented adjudicators and per-item adjudicated labels are missing. Do not publish benchmark accuracy.");
 exactIds(predictions.scenario_predictions,gold.scenarios.map(x=>x.id),"case_id","Scenario");
 exactIds(predictions.pair_predictions,gold.pairs.map(x=>x.id),"pair_id","Pair");
 const cases=new Map(predictions.scenario_predictions.map(x=>[x.case_id,x]));
 const pairs=new Map(predictions.pair_predictions.map(x=>[x.pair_id,x]));
 const matrix=Object.fromEntries(CLASS.map(j=>[j,Object.fromEntries(CLASS.map(k=>[k,0]))]));
 let correct=0,strengthCorrect=0,contextFalseAlerts=0,abstentions=0;
 let tp=0,fp=0,fn=0,tn=0,eligible=0;
 const mismatches=[];
 for(const goldCase of gold.scenarios){
  const p=cases.get(goldCase.id),kind="Case "+goldCase.id;
  if(!CLASS.includes(p.judgment)||!STRENGTH.includes(p.strength))fail(kind+" has an invalid category.");
  textReason(p.reason,kind);
  inspectEvidence(goldCase.answer,p.evidence,kind,["claimed_covered","contradicted"].includes(p.judgment));
  matrix[goldCase.proposed.judgment][p.judgment]++;
  const ok=p.judgment===goldCase.proposed.judgment,sk=p.strength===goldCase.proposed.strength;
  correct+=Number(ok);strengthCorrect+=Number(sk);
  abstentions+=Number(p.judgment==="cannot_determine");
  if(goldCase.proposed.strength==="context_only"&&p.strength!=="context_only")contextFalseAlerts++;
  if(goldCase.proposed.strength!=="context_only"&&goldCase.proposed.judgment!=="cannot_determine"){
   eligible++;
   const expectedGap=["not_clearly_mentioned","contradicted"].includes(goldCase.proposed.judgment);
   const predictedGap=["not_clearly_mentioned","contradicted"].includes(p.judgment);
   if(expectedGap&&predictedGap)tp++;
   else if(!expectedGap&&predictedGap)fp++;
   else if(expectedGap&&!predictedGap)fn++;
   else tn++;
  }
  if(!ok||!sk)mismatches.push({id:goldCase.id,requirement_id:goldCase.requirement_id,challenge:goldCase.challenge,
   expected_judgment:goldCase.proposed.judgment,actual_judgment:p.judgment,
   expected_strength:goldCase.proposed.strength,actual_strength:p.strength});
 }
 let pairTP=0,pairFP=0,pairFN=0,pairTN=0;
 const pairMismatches=[];
 for(const item of gold.pairs){
  const p=pairs.get(item.id);
  if(typeof p.equivalent!=="boolean")fail("Pair "+item.id+" needs a boolean equivalent.");
  textReason(p.reason,"Pair "+item.id);
  if(item.proposed.equivalent&&p.equivalent)pairTP++;
  else if(!item.proposed.equivalent&&p.equivalent)pairFP++;
  else if(item.proposed.equivalent&&!p.equivalent)pairFN++;
  else pairTN++;
  if(item.proposed.equivalent!==p.equivalent)pairMismatches.push({id:item.id,left:item.left,right:item.right,
    challenge:item.challenge,seed_equivalent:item.proposed.equivalent,predicted_equivalent:p.equivalent});
 }
 const result={
  schema:"missing-ai-semantic-score-v1",host:predictions.host,
  gold_status:accepted?"adjudicated_with_declared_reviewer_evidence":"PROVISIONAL_AUTHOR_SEED_NOT_INDEPENDENTLY_ADJUDICATED",
  accuracy_claim_allowed:accepted,
  gold_review_qualification:"Reviewer evidence metadata is not independently authenticated by the scoring program.",
  totals:{scenarios:gold.scenarios.length,equivalence_pairs:gold.pairs.length,requirements:reqMap.size},
  judgment:{exact_accuracy_pct:percent(correct,gold.scenarios.length),correct,confusion_matrix:matrix,abstentions},
  source_strength:{accuracy_pct:percent(strengthCorrect,gold.scenarios.length),
   correct:strengthCorrect,context_only_cases:gold.scenarios.filter(c=>c.proposed.strength==="context_only").length,
   context_false_alerts:contextFalseAlerts},
  omission_detection:{definition:"True gaps: contradicted or not_clearly_mentioned. Expected cannot_determine and context_only excluded from binary denominator.",
   eligible,tp,fp,fn,tn,precision_pct:percent(tp,tp+fp),recall_pct:percent(tp,tp+fn),
   false_alarm_rate_pct:percent(fp,fp+tn),missed_gap_rate_pct:percent(fn,fn+tp)},
  duplicate_equivalence:{tp:pairTP,fp:pairFP,fn:pairFN,tn:pairTN,
   accuracy_pct:percent(pairTP+pairTN,gold.pairs.length),
   precision_pct:percent(pairTP,pairTP+pairFP),recall_pct:percent(pairTP,pairTP+pairFN)},
  mismatches,pair_mismatches:pairMismatches,
  limitations:["Provisional author labels are not independent gold.","No real code or compliance verification is performed.",
   "Source extracts and synthetic answers evaluate wording and host judgment, not implemented functionality.",
   "Abstention on an expected gap counts as a missed gap in binary recall, while expected ambiguous cases are excluded.",
   "Do not compare host models as statistically superior from this small, nonrandom benchmark."]
 };
 return result;
}
function usage(){
 return "Usage: node scripts/score-semantic-benchmark.mjs --predictions <file.json> [--gold <file.json>] [--json] [--require-adjudicated]";
}
function main(args){
 let goldPath=fileURLToPath(new URL("../benchmark/semantic-v1/provisional.json",import.meta.url));
 let predicted=null,json=false,requireAdjudicated=false;
 for(let i=0;i<args.length;i++){
  const a=args[i];
  if(a==="--gold"&&args[i+1])goldPath=args[++i];
  else if(a==="--predictions"&&args[i+1])predicted=args[++i];
  else if(a==="--json")json=true;
  else if(a==="--require-adjudicated")requireAdjudicated=true;
  else if(a==="--help"){process.stdout.write(usage()+"\n");return;}
  else fail("Unknown or incomplete argument: "+a+"\n"+usage());
 }
 if(!predicted)fail(usage());
 const report=scoreSemanticBenchmark(JSON.parse(readFileSync(resolve(goldPath),"utf8")),JSON.parse(readFileSync(resolve(predicted),"utf8")),{requireAdjudicated});
 if(json)process.stdout.write(JSON.stringify(report,null,2)+"\n");
 else {
  process.stdout.write("Missing AI semantic benchmark — "+report.gold_status+"\n");
  process.stdout.write("Host: "+report.host+" | "+report.totals.scenarios+" cases | "+report.totals.equivalence_pairs+" duplicate pairs\n");
  process.stdout.write("Judgment exact: "+report.judgment.exact_accuracy_pct+"%; source strength: "+report.source_strength.accuracy_pct+"%\n");
  process.stdout.write("Gap precision: "+report.omission_detection.precision_pct+"%; gap recall: "+report.omission_detection.recall_pct+"%; false alarm: "+report.omission_detection.false_alarm_rate_pct+"%\n");
  process.stdout.write("Duplicate precision: "+report.duplicate_equivalence.precision_pct+"%; recall: "+report.duplicate_equivalence.recall_pct+"%\n");
  process.stdout.write("Author gold is PROVISIONAL unless independently adjudicated; no public accuracy claims.\n");
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main(process.argv.slice(2));}catch(e){console.error("SEMANTIC_BENCHMARK_ERROR:",e.message);process.exitCode=2;}
}

// Offline review/host comparison for the synthetic blind development pack.
// Checks schema, complete case coverage and exact quote offsets. No model calls.
// Agreement between hosts is NOT accuracy; reviewer metadata is NOT proof of independence.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const JUDGMENTS=["claimed_covered","contradicted","not_clearly_mentioned","cannot_determine"];
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const fail=message=>{throw new Error(message)};
const byId=a=>new Map(a.map(x=>[x.case_id,x]));

export function validatePack(pack){
 if(!isObject(pack)||pack.schema!=="missing-ai-extended-blind-cases-v1"||!Array.isArray(pack.cases)||pack.cases.length<1)fail("Invalid blind case pack");
 const ids=new Set();
 for(const c of pack.cases){
  if(!isObject(c)||typeof c.id!=="string"||ids.has(c.id)||typeof c.domain!=="string"||!c.domain||
   typeof c.source_text!=="string"||c.source_text.length<10||typeof c.ai_output!=="string"||!c.ai_output.trim())
   fail("Invalid or duplicate case in blind pack: "+String(c?.id));
  for(const key of ["gold","proposed","judgment","expected","variant_type","predicted"])if(Object.hasOwn(c,key))fail("Blind case leaks a proposed label: "+c.id);
  ids.add(c.id);
 }
 return {ids,caseMap:new Map(pack.cases.map(x=>[x.id,x]))};
}

export function validateRun(pack,run,{role}={}){
 const {ids,caseMap}=validatePack(pack);
 if(!isObject(run)||run.schema!=="missing-ai-extended-review-v1"||
  (role&&run.role!==role)||!["human_reviewer","model_host"].includes(run.role)||
  typeof run.participant_id!=="string"||run.participant_id.trim().length<3||run.participant_id.length>100||
  !Array.isArray(run.judgments)||run.judgments.length!==ids.size)
  fail("Review requires role, participant ID and one judgment for each case");
 if(run.role==="human_reviewer"&&run.independent_attestation!==true)
  fail("Human reviewer must explicitly attest independent work; attestation is not independently verified");
 if(run.role==="model_host"&&(!run.model||typeof run.model!=="string"))
  fail("Model-host comparison requires model name/version metadata");
 const seen=new Set();
 for(const row of run.judgments){
  if(!isObject(row)||!ids.has(row.case_id)||seen.has(row.case_id))fail("Missing, unknown or duplicate case ID");
  seen.add(row.case_id);
  if(!JUDGMENTS.includes(row.judgment)||typeof row.reason!=="string"||row.reason.trim().length<12||row.reason.length>800)
   fail("Invalid judgment or insufficient rationale in "+row.case_id);
  if(!Array.isArray(row.evidence)||row.evidence.length>3||
   (["claimed_covered","contradicted"].includes(row.judgment)&&row.evidence.length===0))
   fail("Evidence required for covered/contradicted claims in "+row.case_id);
  const answer=caseMap.get(row.case_id).ai_output;
  for(const e of row.evidence){
   if(!isObject(e)||typeof e.quote!=="string"||e.quote.length<8||e.quote.length>600||
    !Number.isSafeInteger(e.start)||e.start<0||answer.slice(e.start,e.start+e.quote.length)!==e.quote)
    fail("Invalid exact answer quotation or zero-based offset in "+row.case_id);
  }
 }
 return {role:run.role,participant_id:run.participant_id,byCase:byId(run.judgments)};
}

export function compareRuns(pack,left,right,{mode="hosts"}={}){
 const role=mode==="reviewers"?"human_reviewer":mode==="hosts"?"model_host":null;
 if(!role)fail("Mode must be reviewers or hosts");
 const a=validateRun(pack,left,{role}),b=validateRun(pack,right,{role});
 if(a.participant_id===b.participant_id)fail("Two distinct participants/hosts are required");
 const byDomain={},matrix=Object.fromEntries(JUDGMENTS.map(j=>[j,Object.fromEntries(JUDGMENTS.map(k=>[k,0]))]));
 const disagreements=[];
 let agreement=0;
 for(const c of pack.cases){
  const x=a.byCase.get(c.id),y=b.byCase.get(c.id),same=x.judgment===y.judgment;
  const d=byDomain[c.domain]??={cases:0,agreement:0,disagreements:0};
  d.cases++;
  d.agreement+=Number(same);
  d.disagreements+=Number(!same);
  matrix[x.judgment][y.judgment]++;
  agreement+=Number(same);
  if(!same)disagreements.push({case_id:c.id,domain:c.domain,left:x.judgment,right:y.judgment});
 }
 return {
  schema:"missing-ai-extended-comparison-v1",mode,
  measurement:"raw_pairwise_label_agreement_not_accuracy",
  annotation_status:"NO_ADJUDICATED_GOLD",
  human_independence_verified:false,
  implementation_verified:false,
  cases:pack.cases.length,agreement,disagreements:disagreements.length,
  by_domain:byDomain,confusion:matrix,disagreement_rows:disagreements,
  limitations:[
   "A mechanical metadata attestation does not establish that a reviewer is independent.",
   "Two matching host judgments may both be incorrect. This is NOT semantic accuracy.",
   "Author-written related variants share prompts and must not be counted as independent population samples.",
   "No adjudicated ground truth or sealed held-out test is produced by this comparison."
  ]
 };
}

function cli(){
 const args=process.argv.slice(2);
 const opt=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;};
 const poolFile=opt("--pool"),leftFile=opt("--left"),rightFile=opt("--right"),mode=opt("--mode")||"hosts";
 if(!poolFile||!leftFile||!rightFile)fail("Usage: node scripts/compare-extended-reviews.mjs --pool CASES.json --left RUN_A.json --right RUN_B.json --mode reviewers|hosts");
 const load=f=>JSON.parse(readFileSync(resolve(f),"utf8"));
 console.log(JSON.stringify(compareRuns(load(poolFile),load(leftFile),load(rightFile),{mode}),null,2));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))try{cli()}catch(e){console.error(e.message);process.exitCode=1}

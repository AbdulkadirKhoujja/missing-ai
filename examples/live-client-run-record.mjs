// Manual live-client run record for the two-provider beta (format check only).
//
// The readiness matrix in docs/TWO_PROVIDER_BETA_READINESS.md has one row no
// script can fill: "Live client connects, lists tools and completes a
// review". A person has to do that in ChatGPT or Claude and write down what
// they saw. This file gives that note one fixed shape and checks it.
//
//   node examples/live-client-run-record.mjs --blank chatgpt > chatgpt-run.json
//   node examples/live-client-run-record.mjs --blank claude  > claude-run.json
//   (do the run by hand, fill the file in)
//   node examples/live-client-run-record.mjs chatgpt-run.json
//
// Exit status: 0 the record is well formed and every step is "pass";
// 1 the record is malformed, unfinished, or reports a failed step;
// 2 wrong usage or unreadable file.
//
// What this is NOT: it does not open ChatGPT or Claude and cannot tell
// whether the run really happened. It checks that a hand-written record is
// complete, internally consistent and free of obvious private data. A record
// is the observer's statement, not proof.
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {EXPECTED_TOOLS,parseEndpoint} from "./check-mcp-endpoint.mjs";
import {HOST_PROFILES} from "./two-provider-mcp-walkthrough.mjs";

export const RECORD_SCHEMA="missing-ai.live-client-run/v1";
export const CLIENTS=Object.freeze(HOST_PROFILES.map(p=>p.host));
export const STEPS=Object.freeze(["connector_added","tools_listed","review_completed"]);
export const STEP_RESULTS=Object.freeze(["pass","fail","not_run"]);
const TOP_LEVEL=Object.freeze(["schema","client","observed_at","observer_role","client_surface","endpoint","service_commit","synthetic_data_only","steps","tools_seen","evidence_kept","limitations"]);
const MAX_TEXT=500;
const EMAIL=/[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/i;
const UTC_TIMESTAMP=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

// An unfilled record. Every step starts as "not_run", so a blank file can
// never be mistaken for a completed run.
export function blankRunRecord(client){
 if(!CLIENTS.includes(client))throw new Error("Client must be one of: "+CLIENTS.join(", "));
 return {
  schema:RECORD_SCHEMA,
  client,
  observed_at:null,
  observer_role:"",
  client_surface:"",
  endpoint:"",
  service_commit:null,
  synthetic_data_only:false,
  steps:Object.fromEntries(STEPS.map(step=>[step,{result:"not_run",note:""}])),
  tools_seen:[],
  evidence_kept:"",
  limitations:""
 };
}

const isObject=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const isText=value=>typeof value==="string"&&value.trim().length>0;

function collectStrings(value,out=[]){
 if(typeof value==="string")out.push(value);
 else if(Array.isArray(value))value.forEach(v=>collectStrings(v,out));
 else if(isObject(value))Object.values(value).forEach(v=>collectStrings(v,out));
 return out;
}

// Returns {ok, status, errors, summary}. status is "invalid" when the record
// is malformed, otherwise "verified" (all three steps pass), "failed" (any
// step failed) or "incomplete" (a step was not run and none failed).
// The status is derived from the steps; a record cannot declare it.
export function validateRunRecord(record,{now=new Date()}={}){
 const errors=[];
 const fail=message=>{errors.push(message);};
 if(!isObject(record))return {ok:false,status:"invalid",errors:["The record must be a JSON object."],summary:null};

 for(const key of Object.keys(record))if(!TOP_LEVEL.includes(key))fail("Unknown field: "+String(key).slice(0,60)+". A record cannot add its own fields (for example a verdict).");
 for(const key of TOP_LEVEL)if(!(key in record))fail("Missing field: "+key);

 if(record.schema!==RECORD_SCHEMA)fail("schema must be "+RECORD_SCHEMA);
 if(!CLIENTS.includes(record.client))fail("client must be one of: "+CLIENTS.join(", "));

 const steps=isObject(record.steps)?record.steps:{};
 if(!isObject(record.steps))fail("steps must be an object");
 for(const key of Object.keys(steps))if(!STEPS.includes(key))fail("Unknown step: "+String(key).slice(0,60));
 const results={};
 for(const step of STEPS){
  const entry=steps[step];
  if(!isObject(entry)||!STEP_RESULTS.includes(entry.result)||typeof entry.note!=="string"||Object.keys(entry).some(k=>k!=="result"&&k!=="note")){
   fail("steps."+step+" must be {result: pass | fail | not_run, note: text}");
   results[step]=null;
   continue;
  }
  results[step]=entry.result;
  if(entry.result==="fail"&&!isText(entry.note))fail("steps."+step+" failed: say what happened in its note");
 }
 // A later step cannot have been observed without the earlier ones.
 if(results.tools_listed==="pass"&&results.connector_added!=="pass")fail("tools_listed cannot pass unless connector_added passed");
 if(results.review_completed==="pass"&&results.tools_listed!=="pass")fail("review_completed cannot pass unless tools_listed passed");

 const started=STEPS.some(step=>results[step]==="pass"||results[step]==="fail");

 if(record.observed_at===null){
  if(started)fail("observed_at is required once any step has a result");
 }else if(typeof record.observed_at!=="string"||!UTC_TIMESTAMP.test(record.observed_at)||Number.isNaN(Date.parse(record.observed_at))){
  fail("observed_at must be a UTC timestamp such as 2026-11-17T09:30:00Z, or null before the run");
 }else if(Date.parse(record.observed_at)>now.getTime()+5*60*1000){
  fail("observed_at is in the future");
 }

 for(const key of ["observer_role","client_surface","evidence_kept","limitations","endpoint"]){
  if(typeof record[key]!=="string")fail(key+" must be text");
 }
 if(started){
  if(!isText(record.observer_role))fail("observer_role is required (a role such as maintainer, not a name or email)");
  if(!isText(record.client_surface))fail("client_surface is required (for example the app and plan the run used)");
  if(!isText(record.evidence_kept))fail("evidence_kept is required: say what was saved (for example a screenshot) and where, without pasting it here");
  if(record.synthetic_data_only!==true)fail("synthetic_data_only must be true: record only runs that used invented example data");
 }else if(typeof record.synthetic_data_only!=="boolean"){
  fail("synthetic_data_only must be true or false");
 }

 if(isText(record.endpoint)){
  try{
   const endpoint=parseEndpoint(record.endpoint);
   const url=new URL(record.endpoint);
   if(url.search)fail("endpoint must not include a query string");
   if(endpoint.loopback)fail("endpoint is a loopback address: a live ChatGPT or Claude client cannot reach it");
  }catch(error){fail("endpoint: "+String(error?.message||error));}
 }else if(started){
  fail("endpoint is required once any step has a result");
 }

 if(record.service_commit!==null&&!(typeof record.service_commit==="string"&&/^[0-9a-f]{40}$/.test(record.service_commit)))fail("service_commit must be the full 40-character commit the endpoint was running, or null if unknown");

 if(!Array.isArray(record.tools_seen)||record.tools_seen.some(name=>typeof name!=="string")){
  fail("tools_seen must be a list of tool names");
 }else if(results.tools_listed==="pass"){
  const seen=[...record.tools_seen].sort();
  const expected=[...EXPECTED_TOOLS].sort();
  if(new Set(record.tools_seen).size!==record.tools_seen.length||JSON.stringify(seen)!==JSON.stringify(expected))fail("tools_listed passed but tools_seen is not exactly: "+EXPECTED_TOOLS.join(", "));
 }

 for(const text of collectStrings(record)){
  if(text.length>MAX_TEXT){fail("Text longer than "+MAX_TEXT+" characters: keep transcripts and screenshots outside the record");break;}
 }
 if(collectStrings(record).some(text=>EMAIL.test(text)))fail("The record contains an email address: remove personal data");

 const values=STEPS.map(step=>results[step]);
 const status=errors.length?"invalid":values.includes("fail")?"failed":values.every(v=>v==="pass")?"verified":"incomplete";
 return {
  ok:status==="verified",
  status,
  errors,
  summary:errors.length?null:{
   client:record.client,
   observed_at:record.observed_at,
   steps:results,
   service_commit_recorded:record.service_commit!==null
  }
 };
}

export const FORMAT_CHECK_NOTE="Format check of a hand-written record. It does not show that the run happened, that the client's model judged anything correctly, or that the endpoint is secure.";

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [first,second]=process.argv.slice(2);
 if(first==="--blank"){
  try{console.log(JSON.stringify(blankRunRecord(second),null,2));}
  catch(error){console.error(String(error?.message||error));process.exitCode=2;}
 }else if(!first||first.startsWith("--")){
  console.error("Usage: node examples/live-client-run-record.mjs --blank <"+CLIENTS.join("|")+">\n       node examples/live-client-run-record.mjs <record.json>");
  process.exitCode=2;
 }else{
  let record;
  try{record=JSON.parse(readFileSync(first,"utf8"));}
  catch{console.error("Could not read the file as JSON.");process.exitCode=2;}
  if(process.exitCode!==2){
   const result=validateRunRecord(record);
   console.log(JSON.stringify({receipt:"live-client-run-record-check-v1",...result,note:FORMAT_CHECK_NOTE},null,2));
   process.exitCode=result.ok?0:1;
  }
 }
}

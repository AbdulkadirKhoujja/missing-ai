// Manual live-client run record (roadmap #86, developer ergonomics).
// Every record below is invented for the test. None describes a real run:
// no ChatGPT or Claude client was opened, and nothing here is evidence that
// either client connects.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {EXPECTED_TOOLS} from "../examples/check-mcp-endpoint.mjs";
import {blankRunRecord,validateRunRecord,CLIENTS,STEPS,RECORD_SCHEMA,FORMAT_CHECK_NOTE} from "../examples/live-client-run-record.mjs";

const root=fileURLToPath(new URL("..",import.meta.url));
const script="examples/live-client-run-record.mjs";
const NOW=new Date("2026-11-17T12:00:00Z");
const check=record=>validateRunRecord(record,{now:NOW});

// A fully filled, invented record used as the starting point for negatives.
function filled(client="chatgpt",change=()=>{}){
 const record=blankRunRecord(client);
 record.observed_at="2026-11-17T09:30:00Z";
 record.observer_role="maintainer";
 record.client_surface="invented surface for the test";
 record.endpoint="https://mcp.example/mcp";
 record.service_commit="0123456789abcdef0123456789abcdef01234567";
 record.synthetic_data_only=true;
 for(const step of STEPS)record.steps[step]={result:"pass",note:""};
 record.tools_seen=[...EXPECTED_TOOLS];
 record.evidence_kept="invented: screenshot kept outside the repository";
 record.limitations="invented record for a unit test";
 change(record);
 return record;
}
const rejects=(change,pattern)=>{
 const result=check(filled("chatgpt",change));
 assert.equal(result.status,"invalid");
 assert.equal(result.ok,false);
 assert.equal(result.summary,null);
 assert.ok(result.errors.some(e=>pattern.test(e)),JSON.stringify(result.errors));
};

test("a blank record exists for each documented client and is never a pass",()=>{
 assert.deepEqual(CLIENTS,["chatgpt","claude"]);
 for(const client of CLIENTS){
  const blank=blankRunRecord(client);
  assert.equal(blank.schema,RECORD_SCHEMA);
  for(const step of STEPS)assert.equal(blank.steps[step].result,"not_run");
  const result=check(blank);
  assert.deepEqual(result.errors,[]);
  assert.equal(result.status,"incomplete");
  assert.equal(result.ok,false);
 }
 assert.throws(()=>blankRunRecord("gemini"),/chatgpt, claude/);
});

test("only a record with all three steps passed is reported as verified",()=>{
 for(const client of CLIENTS){
  const result=check(filled(client));
  assert.deepEqual(result.errors,[]);
  assert.equal(result.status,"verified");
  assert.equal(result.ok,true);
  assert.deepEqual(result.summary,{client,observed_at:"2026-11-17T09:30:00Z",steps:{connector_added:"pass",tools_listed:"pass",review_completed:"pass"},service_commit_recorded:true});
 }
 const partial=check(filled("claude",r=>{r.steps.review_completed={result:"not_run",note:""};}));
 assert.equal(partial.status,"incomplete");
 assert.equal(partial.ok,false);
 const failed=check(filled("claude",r=>{r.steps.review_completed={result:"fail",note:"the client stopped after listing tools"};}));
 assert.deepEqual(failed.errors,[]);
 assert.equal(failed.status,"failed");
 assert.equal(failed.ok,false);
 const early=check(filled("chatgpt",r=>{r.steps.connector_added={result:"fail",note:"the client refused the URL"};r.steps.tools_listed={result:"not_run",note:""};r.steps.review_completed={result:"not_run",note:""};r.tools_seen=[];}));
 assert.equal(early.status,"failed");
});

test("a record cannot declare its own verdict or add fields",()=>{
 rejects(r=>{r.verdict="verified";},/Unknown field: verdict/);
 rejects(r=>{r.live_chatgpt_client_verified=true;},/Unknown field/);
 rejects(r=>{r.steps.extra={result:"pass",note:""};},/Unknown step/);
 rejects(r=>{r.steps.tools_listed.verified=true;},/steps\.tools_listed/);
 rejects(r=>{delete r.limitations;},/Missing field: limitations/);
 rejects(r=>{r.schema="missing-ai.live-client-run/v2";},/schema must be/);
 rejects(r=>{r.client="gemini";},/client must be/);
 for(const value of [null,[],"text",7])assert.equal(check(value).status,"invalid");
});

test("steps must be consistent with each other",()=>{
 rejects(r=>{r.steps.connector_added={result:"not_run",note:""};},/tools_listed cannot pass/);
 rejects(r=>{r.steps.tools_listed={result:"fail",note:"no tools shown"};},/review_completed cannot pass/);
 rejects(r=>{r.steps.review_completed={result:"fail",note:"  "};},/say what happened/);
 rejects(r=>{r.steps.review_completed={result:"passed",note:""};},/steps\.review_completed must be/);
 rejects(r=>{r.steps.review_completed="pass";},/steps\.review_completed must be/);
 rejects(r=>{r.steps=null;},/steps must be an object/);
});

test("a passed tool listing must name exactly the six tools",()=>{
 rejects(r=>{r.tools_seen=EXPECTED_TOOLS.slice(0,5);},/tools_seen is not exactly/);
 rejects(r=>{r.tools_seen=[...EXPECTED_TOOLS,"delete_everything"];},/tools_seen is not exactly/);
 rejects(r=>{r.tools_seen=[...EXPECTED_TOOLS.slice(0,5),EXPECTED_TOOLS[0]];},/tools_seen is not exactly/);
 rejects(r=>{r.tools_seen="check_missing";},/tools_seen must be a list/);
 const reordered=check(filled("claude",r=>{r.tools_seen=[...EXPECTED_TOOLS].reverse();}));
 assert.equal(reordered.status,"verified");
});

test("a started run needs a time, a public https endpoint and a note of what was kept",()=>{
 rejects(r=>{r.observed_at=null;},/observed_at is required/);
 rejects(r=>{r.observed_at="17 November 2026";},/UTC timestamp/);
 rejects(r=>{r.observed_at="2026-11-17T09:30:00+01:00";},/UTC timestamp/);
 rejects(r=>{r.observed_at="2026-13-45T09:30:00Z";},/UTC timestamp/);
 rejects(r=>{r.observed_at="2026-11-18T09:30:00Z";},/in the future/);
 rejects(r=>{r.endpoint="";},/endpoint is required/);
 rejects(r=>{r.endpoint="http://mcp.example/mcp";},/endpoint: .*https/);
 rejects(r=>{r.endpoint="http://127.0.0.1:8787/mcp";},/loopback/);
 rejects(r=>{r.endpoint="https://user:secret@mcp.example/mcp";},/username or password/);
 rejects(r=>{r.endpoint="https://mcp.example/mcp?token=abc";},/query string/);
 rejects(r=>{r.evidence_kept="";},/evidence_kept is required/);
 rejects(r=>{r.observer_role=" ";},/observer_role is required/);
 rejects(r=>{r.client_surface="";},/client_surface is required/);
 rejects(r=>{r.service_commit="0123abc";},/40-character commit/);
 assert.equal(check(filled("chatgpt",r=>{r.service_commit=null;})).summary.service_commit_recorded,false);
});

test("records with private-looking or oversized content are refused",()=>{
 rejects(r=>{r.synthetic_data_only=false;},/synthetic_data_only must be true/);
 rejects(r=>{r.observer_role="someone@example.org";},/email address/);
 rejects(r=>{r.steps.review_completed.note="sent by a.person@example.org";},/email address/);
 rejects(r=>{r.limitations="x".repeat(501);},/longer than 500/);
 rejects(r=>{r.evidence_kept=42;},/evidence_kept must be text/);
 const failure=check(filled("chatgpt",r=>{r.verdict="x".repeat(5000);}));
 assert.ok(failure.errors.every(e=>e.length<200),"error text does not echo long input");
});

test("the documented commands run as written with the documented exit codes",()=>{
 const doc=readFileSync(root+"docs/TWO_PROVIDER_BETA_READINESS.md","utf8");
 assert.ok(doc.includes("node examples/live-client-run-record.mjs --blank chatgpt > chatgpt-run.json"));
 assert.ok(doc.includes("node examples/live-client-run-record.mjs chatgpt-run.json"));
 for(const step of STEPS)assert.ok(doc.includes("`"+step+"`"),step);
 assert.match(doc,/\| Live client connects, lists tools and completes a review \| Not verified \| Not verified \|/);
 const run=(...args)=>spawnSync(process.execPath,[script,...args],{cwd:root,encoding:"utf8"});
 const dir=mkdtempSync(join(tmpdir(),"live-run-record-"));
 try{
  for(const client of CLIENTS){
   const blank=run("--blank",client);
   assert.equal(blank.status,0);
   assert.deepEqual(JSON.parse(blank.stdout),blankRunRecord(client));
   const file=join(dir,client+"-run.json");
   writeFileSync(file,blank.stdout);
   const unfilled=run(file);
   assert.equal(unfilled.status,1);
   const printed=JSON.parse(unfilled.stdout);
   assert.equal(printed.status,"incomplete");
   assert.equal(printed.note,FORMAT_CHECK_NOTE);
   assert.match(printed.note,/does not show that the run happened/);
  }
  const bad=join(dir,"bad.json");
  writeFileSync(bad,JSON.stringify({...blankRunRecord("claude"),verdict:"verified"}));
  assert.equal(run(bad).status,1);
  const notJson=join(dir,"not.json");
  writeFileSync(notJson,"<html>");
  const unreadable=run(notJson);
  assert.equal(unreadable.status,2);
  assert.equal(unreadable.stdout,"");
  assert.equal(run(join(dir,"absent.json")).status,2);
  assert.equal(run().status,2);
  assert.equal(run("--blank","gemini").status,2);
  assert.equal(run("--help").status,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test("no filled live-run record is stored in the repository",()=>{
 // The matrix row may only change together with a real, reviewed record.
 const listed=spawnSync("git",["ls-files"],{cwd:root,encoding:"utf8"});
 if(listed.status!==0)return;
 const files=listed.stdout.split("\n").filter(f=>f.endsWith(".json"));
 for(const f of files){
  let text="";
  try{text=readFileSync(root+f,"utf8");}catch{continue;}
  assert.equal(text.includes(RECORD_SCHEMA),false,f);
 }
});

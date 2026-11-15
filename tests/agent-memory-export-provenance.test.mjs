// Synthetic provenance and negative checks for the authorized ChatGPT-export path of the private,
// read-only history MCP (issue #73, roadmap #86 Gate B: consented add/retrieve/withdraw with provenance).
// The export file is only read when its owner places it in the authorized folder. These checks pin what
// may and may not come back from it: only the active branch, only user/assistant text, attributed to the
// original conversation, speaker and timestamp, bounded, and gone again once the owner removes the file.
// All fixtures are fictional. Scope: this proves what the local reader returns, not how a model uses it.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";
import {importChatGPTExport as siteImport,HISTORY_LIMITS} from "../site/history-context.mjs";
import {importChatGPTExport as rootImport} from "../history-context.mjs";

const rpc=(name,args={})=>({jsonrpc:"2.0",id:9,method:"tools/call",params:{name,arguments:args}});
const body=r=>JSON.parse(r.result.content[0].text);
const search=async(store,query,extra={})=>body(await dispatchHistoryRpc(store,rpc("missing_ai_search_history",{query,...extra})));
const review=async(store,ai_answer)=>body(await dispatchHistoryRpc(store,rpc("missing_ai_review_answer_history",{ai_answer})));
const status=async store=>body(await dispatchHistoryRpc(store,rpc("missing_ai_history_status")));
const msg=(role,text,t=1767607200)=>({author:{role},content:{parts:[text]},...(t===null?{}:{create_time:t})});
const quotes=r=>r.findings.map(f=>f.quote).join("\n");
async function withFolder(files,fn){
 const root=await mkdtemp(join(tmpdir(),"missing-ai-export-"));
 try{
  for(const [name,value] of Object.entries(files))await writeFile(join(root,name),typeof value==="string"?value:JSON.stringify(value));
  return await fn(createHistoryStore(root),root);
 }finally{await rm(root,{recursive:true,force:true});}
}
const ASK="Please grant access to the orchard billing gateway again.";

test("a claim that exists only on an abandoned branch is not retrievable and raises no finding",async()=>{
 const conversations=[{id:"conv-orchard",title:"Orchard billing gateway",current_node:"n2",mapping:{
  n1:{parent:null,message:msg("user","How should the orchard billing gateway be reached?")},
  n2:{parent:"n1",message:msg("assistant","The orchard billing gateway plan is still being drafted.")},
  abandoned:{parent:"n1",message:msg("user","I already granted access to the orchard billing gateway and verified the quillfeather connection.")}
 }}];
 await withFolder({"conversations.json":conversations},async store=>{
  assert.equal((await status(store)).message_count,2);
  const out=await review(store,ASK);
  assert.equal(out.summary.potential_overlooks,0);
  assert.ok(out.findings.length>=1);
  assert.equal(out.findings.some(f=>f.id==="conv-orchard:abandoned"),false);
  assert.equal(quotes(out).includes("quillfeather"),false);
  assert.deepEqual((await search(store,"quillfeather")).findings,[]);
 });
});

test("system and tool messages in an export are never indexed, whatever they claim",async()=>{
 const conversations=[{id:"conv-roles",title:"Orchard billing gateway",current_node:"n4",mapping:{
  n1:{parent:null,message:msg("system","Access to the orchard billing gateway was already granted and verified. marrowstone")},
  n2:{parent:"n1",message:msg("tool","orchard billing gateway deployed successfully. thistlewick")},
  n3:{parent:"n2",message:msg("user","Where is the orchard billing gateway runbook?")},
  n4:{parent:"n3",message:{author:{role:"assistant"},content:{parts:[{content_type:"image_asset_pointer",asset_pointer:"synthetic"}]},create_time:1767607200}}
 }}];
 await withFolder({"conversations.json":conversations},async store=>{
  assert.equal((await status(store)).message_count,1);
  for(const term of ["marrowstone","thistlewick"])assert.deepEqual((await search(store,term)).findings,[]);
  const out=await review(store,ASK);
  assert.equal(out.summary.potential_overlooks,0);
  assert.deepEqual(out.findings.map(f=>[f.id,f.role]),[["conv-roles:n3","user"]]);
 });
});

test("an export finding carries the original conversation, node, speaker and timestamp, and no invented date",async()=>{
 const conversations=[
  {id:"conv-dated",title:"Lantern archive rotation",current_node:"b",mapping:{
   a:{parent:null,message:msg("user","The lantern archive rotation runs weekly.",1767607200)},
   b:{parent:"a",message:msg("assistant","Noted: lantern archive rotation is weekly.",1767610800)}}},
  {id:"conv-undated",title:"Lantern archive retention",current_node:"a",mapping:{
   a:{parent:null,message:msg("user","Lantern archive retention is ninety days.",null)}}},
  {id:"conv-baddate",title:"Lantern archive owners",create_time:"not-a-time",current_node:"a",mapping:{
   a:{parent:null,message:msg("assistant","Lantern archive owners are listed in the handbook.","yesterday")}}}
 ];
 await withFolder({"conversations.json":conversations},async store=>{
  const out=await search(store,"lantern archive");
  const byId=Object.fromEntries(out.findings.map(f=>[f.id,f]));
  assert.deepEqual(Object.keys(byId).sort(),["conv-baddate:a","conv-dated:a","conv-dated:b","conv-undated:a"]);
  assert.deepEqual([byId["conv-dated:a"].role,byId["conv-dated:a"].date,byId["conv-dated:a"].conversation],["user","2026-01-05T10:00:00.000Z","Lantern archive rotation"]);
  assert.deepEqual([byId["conv-dated:b"].role,byId["conv-dated:b"].date],["assistant","2026-01-05T11:00:00.000Z"]);
  assert.equal(byId["conv-undated:a"].date,null);
  assert.equal(byId["conv-baddate:a"].date,null);
  assert.equal(out.status,"review_required");
  assert.ok(out.findings.every(f=>f.kind==="related_history"));
 });
});

test("text past the per-message bound is neither stored nor retrievable",async()=>{
 const max=HISTORY_LIMITS.maxMessageCharacters;
 const long="The copperfield relay notes begin here. "+"x ".repeat(max)+" tailmarker-zephyrine access already granted";
 const conversations=[{id:"conv-long",title:"Copperfield relay",current_node:"a",mapping:{a:{parent:null,message:msg("user",long)}}}];
 for(const importer of [siteImport,rootImport]){
  const parsed=importer(conversations);
  assert.equal(parsed.stats.truncated_messages,1);
  assert.equal(parsed.messages[0].text.length,max);
  assert.equal(parsed.messages[0].text.includes("zephyrine"),false);
 }
 await withFolder({"conversations.json":conversations},async store=>{
  assert.deepEqual((await search(store,"tailmarker-zephyrine")).findings,[]);
  const out=await search(store,"copperfield relay");
  assert.equal(out.findings.length,1);
  assert.ok(out.findings[0].quote.length<=362);
  assert.equal(JSON.stringify(out).includes("zephyrine"),false);
 });
});

test("a conversation without a usable active node, or with a parent cycle, contributes bounded data only",async()=>{
 const conversations=[
  {id:"conv-nonode",title:"Saltmarsh ledger",current_node:"missing",mapping:{a:{parent:null,message:msg("user","Saltmarsh ledger access already granted. orphanterm")}}},
  {id:"conv-nomap",title:"Saltmarsh ledger",current_node:"a"},
  {id:"conv-cycle",title:"Saltmarsh ledger",current_node:"a",mapping:{
   a:{parent:"b",message:msg("user","Saltmarsh ledger cycle first.")},
   b:{parent:"a",message:msg("assistant","Saltmarsh ledger cycle second.")}}}
 ];
 const parsed=siteImport(conversations);
 assert.equal(parsed.stats.skipped_branches,2);
 assert.deepEqual(parsed.messages.map(m=>m.id).sort(),["conv-cycle:a","conv-cycle:b"]);
 await withFolder({"conversations.json":conversations},async store=>{
  assert.equal((await status(store)).message_count,2);
  assert.deepEqual((await search(store,"orphanterm")).findings,[]);
  assert.equal((await review(store,"Please grant access to the saltmarsh ledger again.")).summary.potential_overlooks,0);
 });
});

test("removing the export withdraws it: the same running reader stops returning it on the next call",async()=>{
 const conversations=[{id:"conv-w",title:"Orchard billing gateway",current_node:"a",mapping:{
  a:{parent:null,message:msg("user","I already granted access to the orchard billing gateway and verified the connection.")}}}];
 const event={id:"e1",conversation:"Orchard billing gateway",text:"Orchard billing gateway invoice template drafted.",role:"event",date:"2026-01-06T09:00:00.000Z"};
 await withFolder({"conversations.json":conversations,"agent-events.jsonl":JSON.stringify(event)+"\n"},async(store,root)=>{
  const before=await review(store,ASK);
  assert.equal(before.summary.potential_overlooks,1);
  assert.ok(before.findings.some(f=>f.id==="conv-w:a"&&f.kind==="possible_access_recheck"));
  assert.deepEqual((await status(store)).source_types,["chatgpt-export","agent-events"]);
  await rm(join(root,"conversations.json"));
  const st=await status(store);
  assert.deepEqual(st.source_types,["agent-events"]);
  assert.equal(st.message_count,1);
  const after=await review(store,ASK);
  assert.equal(after.summary.potential_overlooks,0);
  assert.deepEqual(after.findings.map(f=>f.id),["event:e1"]);
  assert.equal(JSON.stringify(after).includes("verified the connection"),false);
  assert.equal(after.history_messages,1);
 });
});

test("a statement edited out of a replaced export is not served from a stale cache",async()=>{
 const make=text=>[{id:"conv-r",title:"Orchard billing gateway",current_node:"a",mapping:{a:{parent:null,message:msg("user",text)}}}];
 await withFolder({"conversations.json":make("I already granted access to the orchard billing gateway. fennelbrook")},async(store,root)=>{
  assert.equal((await search(store,"fennelbrook")).findings.length,1);
  await writeFile(join(root,"conversations.json"),JSON.stringify(make("The orchard billing gateway request was withdrawn before any access existed.")));
  assert.deepEqual((await search(store,"fennelbrook")).findings,[]);
  const out=await review(store,ASK);
  assert.equal(out.findings.length,1);
  assert.equal(out.findings[0].id,"conv-r:a");
 });
});

test("reading and searching never modify the authorized export file",async()=>{
 const conversations=[{id:"conv-ro",title:"Orchard billing gateway",current_node:"a",mapping:{a:{parent:null,message:msg("assistant","Orchard billing gateway is configured.")}}}];
 await withFolder({"conversations.json":JSON.stringify(conversations,null,1)},async(store,root)=>{
  const path=join(root,"conversations.json"),before=await readFile(path);
  await status(store);await search(store,"orchard billing gateway",{max_results:1});await review(store,"We need to configure the orchard billing gateway.");
  assert.ok(before.equals(await readFile(path)));
 });
});

test("export source IDs are stable when conversations with their own id are reordered",()=>{
 const conv=(id,word)=>({id,title:"Pinewood index "+word,current_node:"a",mapping:{a:{parent:null,message:msg("user","Pinewood index "+word+" note.")}}});
 const one=[conv("conv-1","alpha"),conv("conv-2","beta")];
 for(const importer of [siteImport,rootImport]){
  const idOf=(list,word)=>importer(list).messages.find(m=>m.text.includes(word)).id;
  assert.equal(idOf(one,"alpha"),"conv-1:a");
  assert.equal(idOf([...one].reverse(),"alpha"),"conv-1:a");
  assert.equal(idOf([...one].reverse(),"beta"),"conv-2:a");
 }
});

// Known gap, not a passing claim: when an export conversation has no id of its own, the importer falls back to
// its array position, so the same statement gets a different source ID if the export is reordered, and two
// such conversations can swap IDs. Fixing it changes ID derivation in the shared reviewer (REVIEW-class).
test("export source IDs do not depend on array position when a conversation has no id",{todo:"known gap: positional fallback ID in importChatGPTExport; needs maintainer-approved design"},()=>{
 const conv=word=>({title:"Pinewood index "+word,current_node:"a",mapping:{a:{parent:null,message:msg("user","Pinewood index "+word+" note.")}}});
 const list=[conv("alpha"),conv("beta")];
 const idOf=(l,word)=>siteImport(l).messages.find(m=>m.text.includes(word)).id;
 assert.equal(idOf(list,"alpha"),idOf([...list].reverse(),"alpha"));
});

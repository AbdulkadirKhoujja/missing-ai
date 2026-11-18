import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,mkdir,symlink,rm,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {createHistoryStore,dispatchHistoryRpc,PRIVATE_HISTORY_TOOLS} from "../private-history/context-mcp.mjs";
function fixture(content){
 const msg=(role,text)=>({author:{role},content:{parts:[text]},create_time:1700000000});
 return [{id:"example",title:"Example hosting",current_node:"n2",mapping:{n1:{parent:null,message:msg("user","I already gave access to the staging cloud host and verified connection.")},n2:{parent:"n1",message:msg("assistant",content||"The staging cloud host connection is working.")}}}];
}
const rpc=(name,args={})=>({jsonrpc:"2.0",id:5,method:"tools/call",params:{name,arguments:args}});
function body(r){return JSON.parse(r.result.content[0].text);}
test("private MCP returns read-only capabilities and does not require a public server",async()=>{
 const root=await mkdtemp(join(tmpdir(),"missing-ai-history-"));
 try{
  const store=createHistoryStore(root);
  const init=await dispatchHistoryRpc(store,{jsonrpc:"2.0",id:1,method:"initialize"});
  assert.equal(init.result.serverInfo.name,"missing-ai-private-history");
  const tools=await dispatchHistoryRpc(store,{jsonrpc:"2.0",id:2,method:"tools/list"});
  assert.equal(tools.result.tools.length,3);
  assert.ok(PRIVATE_HISTORY_TOOLS.every(x=>x.annotations.readOnlyHint===true));
  assert.equal((await dispatchHistoryRpc(store,rpc("missing_ai_history_status"))).result.isError,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("authorized export is refreshed automatically on subsequent calls without restart",async()=>{
 const root=await mkdtemp(join(tmpdir(),"missing-ai-history-"));
 try{
  const file=join(root,"conversations.json");await writeFile(file,JSON.stringify(fixture()));
  const store=createHistoryStore(root);
  const args={ai_answer:"Please give access to the staging cloud host again."};
  const first=body(await dispatchHistoryRpc(store,rpc("missing_ai_review_answer_history",args)));
  assert.equal(first.history_messages,2);assert.ok(first.summary.potential_overlooks>=1);
  await writeFile(file,JSON.stringify(fixture("The server remains unavailable.")).replace('Example hosting','Example hosting updated'));
  const second=body(await dispatchHistoryRpc(store,rpc("missing_ai_review_answer_history",args)));
  assert.ok(second.findings.some(x=>x.conversation==="Example hosting updated"));
  assert.equal(second.history_messages,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("opt-in agent event automatically becomes searchable and is source-attributed",async()=>{
 const root=await mkdtemp(join(tmpdir(),"missing-ai-history-"));
 try{
  const store=createHistoryStore(root);
  let status=body(await dispatchHistoryRpc(store,rpc("missing_ai_history_status")));
  assert.equal(status.message_count,0);
  const args={conversation:"Staging scheduler",text:"We have fixed the staging scheduler configuration."};
  const proc=spawnSync(process.execPath,["private-history/record-event.mjs"],{cwd:new URL("..",import.meta.url),env:{...process.env,MISSING_AI_HISTORY_DIR:root},input:JSON.stringify(args),encoding:"utf8"});
  assert.equal(proc.status,0,proc.stderr);
  status=body(await dispatchHistoryRpc(store,rpc("missing_ai_history_status")));
  assert.equal(status.message_count,1);
  const report=body(await dispatchHistoryRpc(store,rpc("missing_ai_review_answer_history",{ai_answer:"We need to fix the staging scheduler configuration."})));
  assert.ok(report.findings.some(x=>x.role==="event"));
  assert.equal(report.summary.potential_overlooks,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("rejects symlinks, oversize tool args and unknown tools",async()=>{
 const root=await mkdtemp(join(tmpdir(),"missing-ai-history-"));
 try{
  const privateFile=join(root,"other.json");await writeFile(privateFile,JSON.stringify(fixture()));
  await symlink(privateFile,join(root,"conversations.json"));
  const store=createHistoryStore(root);
  assert.equal((await dispatchHistoryRpc(store,rpc("missing_ai_history_status"))).result.isError,true);
  await rm(join(root,"conversations.json"));
  const bad=await dispatchHistoryRpc(store,rpc("missing_ai_search_history",{query:"X".repeat(16000)}));
  assert.equal(bad.result.isError,true);
  const unknown=await dispatchHistoryRpc(store,rpc("unknown",{query:"x"}));
  assert.equal(unknown.error.code,-32602);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("stdio protocol returns tools list and private query without exposing data in startup logs",async()=>{
 const root=await mkdtemp(join(tmpdir(),"missing-ai-history-"));
 try{
  await writeFile(join(root,"conversations.json"),JSON.stringify(fixture()));
  const proc=spawnSync(process.execPath,["private-history/context-mcp.mjs"],{cwd:new URL("..",import.meta.url),env:{...process.env,MISSING_AI_HISTORY_DIR:root},input:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"})+"\n",encoding:"utf8",timeout:6000});
  assert.equal(proc.status,0,proc.stderr);
  const answer=JSON.parse(proc.stdout.trim().split("\n")[0]);
  assert.ok(answer.result.tools.some(x=>x.name==="missing_ai_search_history"));
  assert.equal(proc.stderr.includes("staging cloud host"),false);
 }finally{await rm(root,{recursive:true,force:true});}
});

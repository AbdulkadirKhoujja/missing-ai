// Synthetic process-level tests for the local, read-only private-history stdio server (issue #86).
//
// A desktop MCP client (for example a locally configured Claude or ChatGPT desktop connector) starts
// `node private-history/context-mcp.mjs` as a child process and talks to it over stdin/stdout, one
// JSON-RPC message per line. These tests start that real process and pin what it does at the edges of
// its lifecycle: refusing to start, the handshake order, bad lines, and end of input.
//
// Scope: every record here is fictional. These tests record the current behaviour of the process on
// this machine. They are not a run against a live ChatGPT or Claude client and not a claim of MCP
// conformance. The reader source is not changed by this file.
import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

const cwd=new URL("..",import.meta.url);
const MARKER="saltmarsh tide gauge";
const event=(id,text,conversation="Saltmarsh tide gauge")=>({id,role:"note",conversation,date:"2026-02-03T09:00:00.000Z",text});
const call=(id,name,args={})=>({jsonrpc:"2.0",id,method:"tools/call",params:{name,arguments:args}});
const lines=messages=>messages.map(m=>typeof m==="string"?m:JSON.stringify(m)).join("\n")+"\n";

function run(dir,input,extraEnv={}){
 const env={...process.env,...extraEnv};
 if(dir===undefined)delete env.MISSING_AI_HISTORY_DIR;else env.MISSING_AI_HISTORY_DIR=dir;
 const proc=spawnSync(process.execPath,["private-history/context-mcp.mjs"],{cwd,env,input,encoding:"utf8",timeout:10000});
 assert.equal(proc.error,undefined,"process did not finish in time");
 return proc;
}
// Every non-empty stdout line must be one complete JSON-RPC 2.0 message; anything else would corrupt the channel.
function replies(proc){
 return proc.stdout.split("\n").filter(Boolean).map(line=>{
  const parsed=JSON.parse(line);
  assert.equal(parsed.jsonrpc,"2.0");
  return parsed;
 });
}
const byId=(all,id)=>all.find(r=>r.id===id);
const body=reply=>JSON.parse(reply.result.content[0].text);
async function withFolder(events,fn){
 const root=await mkdtemp(join(tmpdir(),"missing-ai-stdio-"));
 try{
  if(events)await writeFile(join(root,"agent-events.jsonl"),events.map(e=>JSON.stringify(e)).join("\n")+"\n");
  return await fn(root);
 }finally{await rm(root,{recursive:true,force:true});}
}

test("the process refuses to start without an explicit absolute folder and keeps stdout empty",()=>{
 const request=lines([{jsonrpc:"2.0",id:1,method:"tools/list"}]);
 for(const dir of [undefined,"","relative/history","./history"]){
  const proc=run(dir,request);
  assert.equal(proc.status,1,"expected a failed start for "+JSON.stringify(dir));
  assert.equal(proc.stdout,"","a failed start must not write to the protocol channel");
  assert.match(proc.stderr,/^Private history MCP startup failed: .*MISSING_AI_HISTORY_DIR.*\n$/);
  assert.equal(proc.stderr.trimEnd().split("\n").length,1);
 }
});

test("a started process writes nothing until asked and exits cleanly when input ends",async()=>{
 await withFolder([event("t1","The "+MARKER+" was recalibrated on Tuesday.")],root=>{
  const proc=run(root,"");
  assert.equal(proc.status,0,proc.stderr);
  assert.equal(proc.signal,null);
  assert.equal(proc.stdout,"");
  assert.equal(proc.stderr,"");
 });
});

test("the handshake a desktop client sends is answered in full, with no reply to the notification",async()=>{
 await withFolder([event("t1","The "+MARKER+" was recalibrated on Tuesday.")],root=>{
  const proc=run(root,lines([
   {jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"synthetic-desktop-client",version:"0.0.0"}}},
   {jsonrpc:"2.0",method:"notifications/initialized"},
   {jsonrpc:"2.0",id:2,method:"ping"},
   {jsonrpc:"2.0",id:3,method:"tools/list"},
   call(4,"missing_ai_history_status"),
   call(5,"missing_ai_search_history",{query:"Where is the "+MARKER+" recalibration recorded?"})
  ]));
  assert.equal(proc.status,0,proc.stderr);
  assert.equal(proc.stderr,"");
  const all=replies(proc);
  assert.deepEqual(all.map(r=>r.id).sort(),[1,2,3,4,5],"one reply per request and none for the notification");
  const init=byId(all,1).result;
  assert.equal(init.protocolVersion,"2025-06-18");
  assert.equal(init.serverInfo.name,"missing-ai-private-history");
  assert.deepEqual(init.capabilities,{tools:{listChanged:false}});
  assert.deepEqual(byId(all,2).result,{});
  const tools=byId(all,3).result.tools;
  assert.deepEqual(tools.map(t=>t.name).sort(),["missing_ai_history_status","missing_ai_review_answer_history","missing_ai_search_history"]);
  for(const tool of tools)assert.equal(tool.annotations.readOnlyHint,true);
  const status=body(byId(all,4));
  assert.equal(status.message_count,1);
  assert.equal(status.remote_storage,false);
  const search=body(byId(all,5));
  assert.equal(search.findings.length,1);
  assert.equal(search.findings[0].kind,"related_history");
  assert.ok(search.findings[0].quote.toLowerCase().includes(MARKER));
 });
});

test("bad lines get a parse error with a null id and the process keeps serving",async()=>{
 await withFolder([event("t1","The "+MARKER+" was recalibrated on Tuesday.")],root=>{
  const secret="PLOVERMARKER";
  const proc=run(root,lines([
   "this is not JSON "+secret,
   "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":",
   "{\"jsonrpc\":\"2.0\",\"id\":8,\"method\":\"tools/list\",\"pad\":\""+"x".repeat(100_001)+"\"}",
   call(9,"missing_ai_history_status")
  ]));
  assert.equal(proc.status,0,proc.stderr);
  assert.equal(proc.stderr,"");
  const all=replies(proc);
  assert.equal(all.length,4);
  const errors=all.filter(r=>r.error);
  assert.equal(errors.length,3);
  for(const reply of errors){
   assert.equal(reply.id,null);
   assert.equal(reply.error.code,-32700);
   assert.equal("result" in reply,false);
  }
  assert.deepEqual(errors.map(r=>r.error.message).sort(),["Invalid JSON","Invalid JSON","Message too large"]);
  assert.equal(proc.stdout.includes(secret),false,"a rejected line must not be echoed back");
  assert.equal(body(byId(all,9)).message_count,1,"the request after the bad lines is still answered");
 });
});

test("valid JSON that is not a JSON-RPC request is refused as an invalid request, not executed",async()=>{
 await withFolder([event("t1","The "+MARKER+" was recalibrated on Tuesday.")],root=>{
  const proc=run(root,lines([
   "null","42","\"tools/list\"","[]",
   {id:11,method:"tools/list"},
   {jsonrpc:"1.0",id:12,method:"tools/list"},
   {jsonrpc:"2.0",id:13,method:7},
   {jsonrpc:"2.0",id:14,method:"resources/list"}
  ]));
  assert.equal(proc.status,0,proc.stderr);
  const all=replies(proc);
  assert.equal(all.length,8);
  assert.equal(all.some(r=>"result" in r),false,"none of these may produce a result");
  assert.equal(all.filter(r=>r.id===null&&r.error.code===-32600).length,4);
  for(const id of [11,12,13])assert.equal(byId(all,id).error.code,-32600);
  assert.equal(byId(all,14).error.code,-32601);
 });
});

test("Windows line endings and a final request without a trailing newline are both answered",async()=>{
 await withFolder([event("t1","The "+MARKER+" was recalibrated on Tuesday.")],root=>{
  const input=JSON.stringify({jsonrpc:"2.0",id:21,method:"ping"})+"\r\n"+
   JSON.stringify(call(22,"missing_ai_history_status"))+"\r\n"+
   JSON.stringify(call(23,"missing_ai_search_history",{query:MARKER+" recalibration"}));
  const proc=run(root,input);
  assert.equal(proc.status,0,proc.stderr);
  assert.equal(proc.stderr,"");
  assert.equal(proc.stdout.includes("\r"),false);
  const all=replies(proc);
  assert.deepEqual(all.map(r=>r.id).sort(),[21,22,23]);
  assert.equal(body(byId(all,22)).message_count,1);
  assert.equal(body(byId(all,23)).findings.length,1,"a lookup still in progress when input ends is completed before exit");
 });
});

test("a folder that does not exist is reported per call, without the path, and the process stays up",async()=>{
 const root=await mkdtemp(join(tmpdir(),"missing-ai-stdio-"));
 const missing=join(root,"not-created-yet");
 try{
  const proc=run(missing,lines([
   {jsonrpc:"2.0",id:31,method:"initialize",params:{}},
   {jsonrpc:"2.0",id:32,method:"tools/list"},
   call(33,"missing_ai_history_status"),
   call(34,"missing_ai_search_history",{query:MARKER}),
   {jsonrpc:"2.0",id:35,method:"ping"}
  ]));
  assert.equal(proc.status,0,proc.stderr);
  assert.equal(proc.stderr,"");
  const all=replies(proc);
  assert.deepEqual(all.map(r=>r.id).sort(),[31,32,33,34,35]);
  assert.equal(byId(all,32).result.tools.length,3,"tool discovery does not depend on the folder");
  for(const id of [33,34]){
   const reply=byId(all,id);
   assert.equal(reply.result.isError,true);
   assert.equal(reply.result.content[0].text,"Configured history folder is unavailable.");
  }
  assert.equal(proc.stdout.includes(root),false,"the configured path must not appear in any reply");
 }finally{await rm(root,{recursive:true,force:true});}
});

test("two processes started on different folders each answer only from their own folder",async()=>{
 await withFolder([event("a1","The "+MARKER+" was recalibrated on Tuesday.")],async first=>{
  await withFolder([event("b1","The heron ridge beacon battery was replaced.","Heron ridge beacon"),event("b2","The heron ridge beacon was repainted.","Heron ridge beacon")],second=>{
   const ask=lines([call(41,"missing_ai_history_status"),call(42,"missing_ai_search_history",{query:MARKER+" recalibrated"}),call(43,"missing_ai_search_history",{query:"heron ridge beacon battery"})]);
   const a=replies(run(first,ask)),b=replies(run(second,ask));
   assert.equal(body(byId(a,41)).message_count,1);
   assert.equal(body(byId(b,41)).message_count,2);
   assert.equal(body(byId(a,42)).findings.length,1);
   assert.equal(body(byId(b,42)).findings.length,0);
   assert.equal(body(byId(a,43)).findings.length,0);
   assert.ok(body(byId(b,43)).findings.length>=1);
   assert.equal(JSON.stringify(a).toLowerCase().includes("heron ridge"),false);
   assert.equal(JSON.stringify(b).toLowerCase().includes(MARKER),false);
  });
 });
});

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {createHandler} from "../server/index.mjs";

async function withServer(run){
 const server=http.createServer(createHandler());
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const url="http://127.0.0.1:"+server.address().port;
  const post=async(path,body)=>{
   const r=await fetch(url+path,{method:"POST",headers:{"content-type":"application/json","accept":"application/json, text/event-stream"},body:JSON.stringify(body)});
   return {status:r.status,json:await r.json()};
  };
  await run(post);
 }finally{
  await new Promise(resolve=>server.close(resolve));
 }
}
const rpc=(id,name,args)=>({jsonrpc:"2.0",id,method:"tools/call",params:{name,arguments:args}});
test("MCP advertises evidence-first tools alongside original two without API-breaking changes",async()=>{
 await withServer(async post=>{
  const tools=(await post("/mcp",{jsonrpc:"2.0",id:1,method:"tools/list"})).json.result.tools;
  assert.deepEqual(tools.map(t=>t.name),["check_missing","fetch_source","prepare_review","validate_review"]);
  const prepared=tools.find(t=>t.name==="prepare_review");
  const validate=tools.find(t=>t.name==="validate_review");
  assert.equal(prepared.inputSchema.required.includes("ai_output"),true);
  assert.deepEqual(validate.inputSchema.required,["source_text","ai_output","assessments"]);
  assert.ok(validate.description.includes("NOT semantic correctness"));
 });
});
test("real MCP handler prepares semantic packet and validates host-model citations",async()=>{
 await withServer(async post=>{
  const source="- Must verify signed webhooks";
  const answer="I use the Stripe signing secret to check incoming events.";
  const prepared=await post("/mcp",rpc(7,"prepare_review",{source_text:source,ai_output:answer}));
  assert.equal(prepared.status,200);
  assert.equal(prepared.json.result.isError,false);
  const packet=prepared.json.result.structuredContent;
  assert.equal(packet.protocol,"evidence-review-v1");
  assert.equal(packet.requirements[0].id,"R01");
  const q=answer;
  const a=[{requirement_id:"R01",judgment:"claimed_covered",reason:"The answer claims that Stripe signing secrets are checked for events.",evidence:[{quote:q,start:0}]}];
  const verified=await post("/mcp",rpc(8,"validate_review",{source_text:source,ai_output:answer,assessments:a}));
  assert.equal(verified.status,200);
  assert.equal(verified.json.result.isError,false);
  assert.equal(verified.json.result.structuredContent.validation.all_supplied_quotes_exact,true);
  assert.equal(verified.json.result.structuredContent.validation.implementation_verified,false);
  const bad=structuredClone(a);bad[0].evidence[0].quote="I verified webhook code with tests.";
  const rejected=await post("/mcp",rpc(9,"validate_review",{source_text:source,ai_output:answer,assessments:bad}));
  assert.equal(rejected.status,200);
  assert.equal(rejected.json.result.isError,true);
  assert.match(rejected.json.result.content[0].text,/not an exact quotation/);
 });
});
test("existing HTTP checker unchanged and public API does not expose a fabricated semantic classifier",async()=>{
 await withServer(async post=>{
  const old=await post("/api/check",{source_text:"- Must verify signed webhooks",ai_output:"Built homepage."});
  assert.equal(old.status,200);
  assert.equal(old.json.report.engine,"lexical-v1");
  assert.equal(old.json.report.summary.needs_review,1);
  const path=await post("/api/semantic",{source_text:"abc",ai_output:"xyz"});
  assert.equal(path.status,404);
 });
});

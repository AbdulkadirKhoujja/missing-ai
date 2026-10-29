import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {createHandler} from "../server/index.mjs";
const sources=[
 {source_text:"- Must verify Stripe webhook signatures.\n- Must provide receipts."},
 {source_text:"- Must check signed Stripe payment events.\n- Should document failed retries."}
];
const answer="Stripe events are checked using the signing secret. Payment receipts have not been implemented.";
const evidence=(quote)=>({quote,start:answer.indexOf(quote)});
const groups=[
 {title:"Stripe payment webhook signature checking",refs:["S01:R01","S02:R01"],obligation:"mandatory",judgment:"claimed_covered",reason:"Both requirements concern signature checking before processing Stripe events.",evidence:[evidence("Stripe events are checked using the signing secret.")]},
 {title:"Issue payment receipts for completed transactions",refs:["S01:R02"],obligation:"mandatory",judgment:"contradicted",reason:"The answer explicitly says payment receipts have not been implemented.",evidence:[evidence("Payment receipts have not been implemented.")]},
 {title:"Document handling of failed payment retries",refs:["S02:R02"],obligation:"recommended",judgment:"not_clearly_mentioned",reason:"The answer contains no information about documenting failed payment retries.",evidence:[]}
];
async function withServer(fn){
 const server=http.createServer(createHandler());
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const base="http://127.0.0.1:"+server.address().port;
  const call=async(name,args)=>{
   const response=await fetch(base+"/mcp",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}})});
   return {code:response.status,result:(await response.json()).result};
  };
  await fn(call);
 }finally{await new Promise(resolve=>server.close(resolve));}
}
test("running MCP server prepares and validates one multi-source report",async()=>{
 await withServer(async call=>{
  const prepared=await call("prepare_bundle",{sources,ai_output:answer});
  assert.equal(prepared.code,200);
  assert.equal(prepared.result.isError,false);
  const p=prepared.result.structuredContent;
  assert.equal(p.totals.candidate_requirements,4);
  assert.deepEqual(p.sources.flatMap(s=>s.requirements.map(r=>r.ref)),["S01:R01","S01:R02","S02:R01","S02:R02"]);
  const validated=await call("validate_bundle",{sources,ai_output:answer,groups});
  assert.equal(validated.code,200);
  assert.equal(validated.result.isError,false);
  const data=validated.result.structuredContent;
  assert.equal(data.summary.groups,3);
  assert.equal(data.summary.duplicate_references_collapsed,1);
  assert.match(data.report_markdown,/Contradicted/);
  assert.equal(data.validation.all_answer_quotes_exact,true);
  assert.equal(data.validation.groupings_independently_verified,false);
 });
});
test("running MCP server refuses incomplete reference set and fabricated evidence",async()=>{
 await withServer(async call=>{
  const incomplete=await call("validate_bundle",{sources,ai_output:answer,groups:groups.slice(0,2)});
  assert.equal(incomplete.result.isError,true);
  assert.match(incomplete.result.content[0].text,/Missing:/);
  const fabricated=structuredClone(groups);
  fabricated[0].evidence[0].quote="Code was personally tested and verified.";
  const bad=await call("validate_bundle",{sources,ai_output:answer,groups:fabricated});
  assert.equal(bad.result.isError,true);
  assert.match(bad.result.content[0].text,/not an exact quotation/);
 });
});
test("bundle rejects unsafe source URLs without contacting them",async()=>{
 await withServer(async call=>{
  const result=await call("prepare_bundle",{sources:[{source_url:"http://127.0.0.1/secrets"}],ai_output:answer});
  assert.equal(result.result.isError,true);
  assert.match(result.result.content[0].text,/public HTTPS|Only public HTTPS|Only standard/);
 });
});

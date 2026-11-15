// Synthetic two-provider contract checks for the stateless MCP service
// (roadmap #86, Gate C). Everything runs against an in-process loopback
// server. Nothing here opens ChatGPT or Claude or contacts the hosted beta:
// a pass shows the server treats both documented browser origins alike, not
// that either live client works.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {HOST_PROFILES,FIXTURE,scriptedHostGroups,createRpc,runHostSession,runWalkthrough,withLocalService} from "../examples/two-provider-mcp-walkthrough.mjs";

const root=fileURLToPath(new URL("..",import.meta.url));
const SIX=["check_missing","fetch_source","prepare_review","validate_review","prepare_bundle","validate_bundle"];
const bundleArgs=groups=>({sources:FIXTURE.sources.map(s=>({source_text:s.source_text})),ai_output:FIXTURE.answer,groups});

test("the two host profiles are exactly the ChatGPT and Claude browser origins",()=>{
 assert.deepEqual(HOST_PROFILES.map(p=>[p.host,p.origin]),[["chatgpt","https://chatgpt.com"],["claude","https://claude.ai"]]);
});

test("both origins complete the same handshake and see the same six tools",async()=>{
 await withLocalService(async url=>{
  const sessions=[];
  for(const profile of HOST_PROFILES)sessions.push(await runHostSession(url,profile));
  for(const s of sessions){
   assert.equal(s.cors_origin_echoed,true,s.host);
   assert.equal(s.protocol_version,"2025-06-18",s.host);
   assert.equal(s.initialized_status,202,s.host);
   assert.deepEqual(s.tool_names,SIX,s.host);
   for(const tool of s.tools){
    assert.equal(tool.inputSchema.type,"object",tool.name);
    assert.ok(Array.isArray(tool.inputSchema.required)&&tool.inputSchema.required.length>0,tool.name);
    for(const key of tool.inputSchema.required)assert.ok(key in tool.inputSchema.properties,tool.name+"."+key);
    assert.ok(tool.description.length>40,tool.name);
   }
  }
  assert.deepEqual(sessions[1].tools,sessions[0].tools);
 });
});

test("the same source-backed review gives both origins identical structured findings",async()=>{
 await withLocalService(async url=>{
  const [a,b]=[await runHostSession(url,HOST_PROFILES[0]),await runHostSession(url,HOST_PROFILES[1])];
  assert.deepEqual(b.prepared,a.prepared);
  assert.deepEqual(b.validated,a.validated);
  assert.deepEqual(a.prepared.sources.flatMap(s=>s.requirements.map(r=>[r.ref,r.line])),[["S01:R01",1],["S01:R02",2],["S02:R01",1],["S02:R02",2]]);
  const s=a.validated.summary;
  assert.deepEqual([s.candidate_requirements,s.groups,s.claimed_covered,s.contradicted,s.not_clearly_mentioned,s.cannot_determine],[4,4,2,1,1,0]);
  assert.match(a.validated.report_markdown,/Payment receipts have not been implemented\./);
  const v=a.validated.validation;
  assert.equal(v.all_source_requirements_accounted_for,true);
  assert.equal(v.all_answer_quotes_exact,true);
  for(const key of ["semantic_classifications_verified","groupings_independently_verified","source_content_independently_refetched","implementation_verified"])assert.equal(v[key],false,key);
 });
});

test("negative cases are refused the same way for both origins",async()=>{
 await withLocalService(async url=>{
  const outcomes=[];
  for(const profile of HOST_PROFILES){
   const rpc=createRpc(url,profile.origin);
   const call=async groups=>(await rpc("tools/call",{name:"validate_bundle",arguments:bundleArgs(groups)})).body.result;
   const fabricated=scriptedHostGroups();
   fabricated[2].evidence[0].quote="Payment receipts are fully implemented.";
   const shifted=scriptedHostGroups();
   shifted[0].evidence[0].start+=1;
   const results=[await call(fabricated),await call(shifted),await call(scriptedHostGroups().slice(0,3)),await call([])];
   for(const r of results){
    assert.equal(r.isError,true,profile.host);
    assert.equal(r.structuredContent,undefined,profile.host);
   }
   assert.match(results[2].content[0].text,/S02:R02/);
   outcomes.push(results.map(r=>r.content[0].text));
  }
  assert.deepEqual(outcomes[1],outcomes[0]);
 });
});

test("an answer that covers nothing yields no covered finding for either origin",async()=>{
 await withLocalService(async url=>{
  const answer="The homepage colours were refreshed.";
  const groups=scriptedHostGroups().map(g=>({...g,judgment:"not_clearly_mentioned",reason:"The answer does not mention this.",evidence:[]}));
  const reports=[];
  for(const profile of HOST_PROFILES){
   const rpc=createRpc(url,profile.origin);
   const r=(await rpc("tools/call",{name:"validate_bundle",arguments:{...bundleArgs(groups),ai_output:answer}})).body.result;
   assert.equal(r.isError,false,profile.host);
   assert.equal(r.structuredContent.summary.claimed_covered,0);
   assert.equal(r.structuredContent.summary.contradicted,0);
   assert.equal(r.structuredContent.summary.not_clearly_mentioned,4);
   reports.push(r.structuredContent);
  }
  assert.deepEqual(reports[1],reports[0]);
 });
});

test("an origin that is not on the allow-list gets no tool data",async()=>{
 await withLocalService(async url=>{
  for(const origin of ["https://chatgpt.com.example","https://claude.ai.example","http://chatgpt.com","null"]){
   const r=await createRpc(url,origin)("tools/list");
   assert.equal(r.status,403,origin);
   assert.equal(r.allow_origin,null,origin);
   assert.equal(r.body.result,undefined,origin);
  }
 });
});

test("browser preflight succeeds for both origins and allows the MCP version header",async()=>{
 await withLocalService(async url=>{
  for(const {origin} of HOST_PROFILES){
   const r=await fetch(url,{method:"OPTIONS",headers:{origin,"access-control-request-method":"POST","access-control-request-headers":"content-type,mcp-protocol-version"}});
   assert.equal(r.status,204,origin);
   assert.equal(r.headers.get("access-control-allow-origin"),origin);
   assert.match(r.headers.get("access-control-allow-headers"),/MCP-Protocol-Version/i);
   assert.match(r.headers.get("access-control-allow-methods"),/POST/);
  }
 });
});

test("the walkthrough receipt reports parity and makes no live-client or accuracy claim",async()=>{
 const receipt=await runWalkthrough();
 assert.deepEqual(receipt.parity,{tool_definitions_identical:true,prepared_packet_identical:true,validated_report_identical:true});
 assert.deepEqual(receipt.hosts.map(h=>h.host),["chatgpt","claude"]);
 assert.equal(receipt.candidate_requirements,4);
 assert.equal(receipt.summary.contradicted,1);
 assert.equal(receipt.live_chatgpt_client_verified,false);
 assert.equal(receipt.live_claude_client_verified,false);
 assert.equal(receipt.hosted_beta_contacted,false);
 assert.equal(receipt.validation.implementation_verified,false);
 assert.match(receipt.host_judgments,/scripted/);
 assert.equal(JSON.stringify(receipt).includes("orchestryn"),false);
});

test("the documented command runs as written and prints the same receipt",()=>{
 const doc=readFileSync(root+"docs/TWO_PROVIDER_BETA_READINESS.md","utf8");
 const command="node examples/two-provider-mcp-walkthrough.mjs";
 assert.ok(doc.includes(command));
 assert.ok(existsSync(root+"examples/two-provider-mcp-walkthrough.mjs"));
 const printed=JSON.parse(execFileSync(process.execPath,["examples/two-provider-mcp-walkthrough.mjs"],{cwd:root,encoding:"utf8"}));
 assert.equal(printed.receipt,"two-provider-mcp-walkthrough-v1");
 assert.equal(printed.parity.validated_report_identical,true);
 for(const name of SIX)assert.ok(doc.includes("`"+name+"`"),name);
 for(const field of ["live_chatgpt_client_verified","live_claude_client_verified"])assert.ok(doc.includes(field),field);
 assert.match(doc,/Not verified/);
});

// Known gaps, recorded honestly. Both touch server/index.mjs (MCP tool
// definitions and request handling), which is REVIEW-class, so neither is
// changed here.
test("known gap: tools declare no MCP annotations (readOnlyHint, openWorldHint)",{todo:"REVIEW-class tool-definition change; needs maintainer approval"},async()=>{
 await withLocalService(async url=>{
  const tools=(await createRpc(url,HOST_PROFILES[0].origin)("tools/list")).body.result.tools;
  for(const tool of tools)assert.equal(typeof tool.annotations?.readOnlyHint,"boolean",tool.name);
 });
});

test("known gap: malformed JSON is answered without a JSON-RPC parse error (-32700)",{todo:"REVIEW-class server change; needs maintainer approval"},async()=>{
 await withLocalService(async url=>{
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json",origin:HOST_PROFILES[1].origin},body:"{not json"});
  const body=await r.json();
  assert.equal(body.jsonrpc,"2.0");
  assert.equal(body.error.code,-32700);
 });
});

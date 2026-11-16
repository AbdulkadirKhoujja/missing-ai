// Endpoint preflight for a self-hosted Missing AI MCP service (synthetic).
//
// Before adding your own deployment as a custom MCP connection in ChatGPT or
// Claude, run the checks a browser-based client depends on and print one JSON
// receipt:
//
//   node examples/check-mcp-endpoint.mjs https://your-host.example/mcp
//   node examples/check-mcp-endpoint.mjs            (in-process loopback demo)
//
// It sends only the invented booking fixture from the two-provider
// walkthrough, and only to the URL you give it. It exits 0 when every check
// passes and 1 otherwise.
//
// What this is NOT: it does not open ChatGPT or Claude, does not call a
// model, and cannot show that either live client connects or behaves
// correctly. A pass means the endpoint answered these scripted requests the
// way the reference service does for both documented browser origins.
import {pathToFileURL} from "node:url";
import {HOST_PROFILES,FIXTURE,scriptedHostGroups,withLocalService} from "./two-provider-mcp-walkthrough.mjs";

export const EXPECTED_TOOLS=Object.freeze(["check_missing","fetch_source","prepare_review","validate_review","prepare_bundle","validate_bundle"]);
export const LOOKALIKE_ORIGIN="https://chatgpt.com.example";
const LOOPBACK=new Set(["127.0.0.1","localhost","[::1]"]);
const DEFAULT_TIMEOUT_MS=10000;

// Accepts https anywhere and plain http only on loopback, so the fixture is
// never sent unencrypted across a network. Credentials in the URL are refused
// so they cannot end up in a pasted receipt.
export function parseEndpoint(input){
 let url;
 try{url=new URL(String(input));}catch{throw new Error("Not a valid URL. Pass the full MCP endpoint, for example https://your-host.example/mcp");}
 if(url.username||url.password)throw new Error("Remove the username or password from the URL.");
 const loopback=LOOPBACK.has(url.hostname);
 if(url.protocol!=="https:"&&!(url.protocol==="http:"&&loopback))throw new Error("Use an https:// endpoint. Plain http:// is accepted only for loopback addresses.");
 url.hash="";
 return {href:url.href,loopback,https:url.protocol==="https:",standard_port:url.protocol==="https:"&&(url.port===""||url.port==="443")};
}

const describe=error=>error?.name==="TimeoutError"?"no response within the time limit":String(error?.cause?.code||error?.cause?.errors?.[0]?.code||error?.message||error).slice(0,160);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

async function send(href,init,timeoutMs){
 const response=await fetch(href,{...init,redirect:"error",signal:AbortSignal.timeout(timeoutMs)});
 const text=await response.text();
 let body=null;
 try{body=text?JSON.parse(text):null;}catch{body=undefined;}
 return {status:response.status,headers:response.headers,body};
}

function rpcFor(href,origin,timeoutMs){
 let id=0;
 return (method,params,{notification=false}={})=>send(href,{method:"POST",headers:{"content-type":"application/json",accept:"application/json, text/event-stream",origin},body:JSON.stringify({jsonrpc:"2.0",method,...(params?{params}:{}),...(notification?{}:{id:++id})})},timeoutMs);
}

// Runs every check for one browser origin. A failed or unreachable step is
// recorded as a failed check; later steps that depend on it are skipped.
async function checkOrigin(href,profile,timeoutMs){
 const checks=[];
 const add=(name,ok,detail)=>{checks.push({host:profile.host,name,ok:Boolean(ok),detail});return Boolean(ok);};
 const attempt=async(name,fn)=>{try{return await fn();}catch(error){add(name,false,describe(error));return null;}};
 const rpc=rpcFor(href,profile.origin,timeoutMs);
 const result={checks,tools:null,prepared:null,validated:null};

 await attempt("cors_preflight",async()=>{
  const r=await send(href,{method:"OPTIONS",headers:{origin:profile.origin,"access-control-request-method":"POST","access-control-request-headers":"content-type,mcp-protocol-version"}},timeoutMs);
  const ok=r.status>=200&&r.status<300&&r.headers.get("access-control-allow-origin")===profile.origin&&/mcp-protocol-version/i.test(r.headers.get("access-control-allow-headers")||"")&&/POST/.test(r.headers.get("access-control-allow-methods")||"");
  add("cors_preflight",ok,ok?"origin echoed; POST and the MCP version header allowed":"status "+r.status+"; the origin, POST or the MCP-Protocol-Version header was not allowed");
 });

 const init=await attempt("initialize",async()=>{
  const r=await rpc("initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"missing-ai-endpoint-preflight-"+profile.host,version:"0"}});
  const version=r.body?.result?.protocolVersion;
  const ok=r.status===200&&typeof version==="string"&&r.headers.get("access-control-allow-origin")===profile.origin;
  add("initialize",ok,ok?"protocol "+version+"; origin echoed":"status "+r.status+"; no protocol version returned or the origin was not echoed");
  return ok;
 });
 if(!init)return result;

 await attempt("initialized_notification",async()=>{
  const r=await rpc("notifications/initialized",undefined,{notification:true});
  add("initialized_notification",r.status===202,"status "+r.status+" (expected 202)");
 });

 const listed=await attempt("tools_list",async()=>{
  const r=await rpc("tools/list");
  const tools=r.body?.result?.tools;
  const names=Array.isArray(tools)?tools.map(t=>t?.name):[];
  const ok=same(names,EXPECTED_TOOLS);
  add("tools_list",ok,ok?"six expected tools":"expected "+EXPECTED_TOOLS.join(", ")+"; got "+(names.length?names.map(String).join(", ").slice(0,200):"none"));
  if(ok)result.tools=tools;
  return ok;
 });
 if(!listed)return result;

 await attempt("synthetic_review",async()=>{
  const call=async(name,args)=>(await rpc("tools/call",{name,arguments:args})).body?.result;
  const prepared=await call("prepare_bundle",{sources:FIXTURE.sources,ai_output:FIXTURE.answer});
  const packet=prepared?.structuredContent;
  if(!packet||prepared.isError)return add("synthetic_review",false,"prepare_bundle did not return a packet");
  const validated=await call("validate_bundle",{sources:packet.sources.map(s=>({source_text:s.source_text})),ai_output:packet.ai_output,groups:scriptedHostGroups(packet.ai_output)});
  const s=validated?.structuredContent?.summary;
  if(!s||validated.isError)return add("synthetic_review",false,"validate_bundle did not return a report");
  const counts=[s.candidate_requirements,s.claimed_covered,s.contradicted,s.not_clearly_mentioned];
  const ok=same(counts,[4,2,1,1]);
  add("synthetic_review",ok,"requirements/covered/contradicted/not mentioned = "+counts.join("/")+" (expected 4/2/1/1)");
  if(ok){result.prepared=packet;result.validated=validated.structuredContent;}
 });

 await attempt("fabricated_quote_refused",async()=>{
  const groups=scriptedHostGroups();
  groups[2].evidence[0].quote="Payment receipts are fully implemented.";
  const r=(await rpc("tools/call",{name:"validate_bundle",arguments:{sources:FIXTURE.sources.map(s=>({source_text:s.source_text})),ai_output:FIXTURE.answer,groups}})).body?.result;
  const ok=r?.isError===true&&r.structuredContent===undefined;
  add("fabricated_quote_refused",ok,ok?"a quotation that is not in the answer was refused":"a quotation that is not in the answer was not refused");
 });
 return result;
}

export async function checkEndpoint(input,{timeoutMs=DEFAULT_TIMEOUT_MS}={}){
 const endpoint=parseEndpoint(input);
 const checks=[
  {host:null,name:"https",ok:endpoint.https||endpoint.loopback,detail:endpoint.https?"https":"plain http on loopback: local testing only, not usable as a connector"},
  {host:null,name:"standard_https_port",ok:endpoint.standard_port||endpoint.loopback,detail:endpoint.standard_port?"port 443":endpoint.loopback?"loopback: not applicable":"non-standard port; Anthropic's custom connector help page says the server must be reachable on port 443"}
 ];
 const perOrigin=[];
 for(const profile of HOST_PROFILES){
  const r=await checkOrigin(endpoint.href,profile,timeoutMs);
  perOrigin.push(r);
  checks.push(...r.checks);
 }
 try{
  const r=await rpcFor(endpoint.href,LOOKALIKE_ORIGIN,timeoutMs)("tools/list");
  const ok=r.status===403&&r.headers.get("access-control-allow-origin")===null&&r.body?.result===undefined;
  checks.push({host:null,name:"lookalike_origin_refused",ok,detail:ok?"a look-alike origin got 403 and no tool data":"a look-alike origin was not refused (status "+r.status+")"});
 }catch(error){checks.push({host:null,name:"lookalike_origin_refused",ok:false,detail:describe(error)});}

 const complete=perOrigin.every(r=>r.tools&&r.prepared&&r.validated);
 const [first,...rest]=perOrigin;
 const parity=complete?{
  tool_definitions_identical:rest.every(r=>same(r.tools,first.tools)),
  prepared_packet_identical:rest.every(r=>same(r.prepared,first.prepared)),
  validated_report_identical:rest.every(r=>same(r.validated,first.validated))
 }:null;
 checks.push({host:null,name:"both_origins_identical",ok:Boolean(parity)&&Object.values(parity).every(Boolean),detail:parity?"compared tool definitions, prepared packet and validated report":"not compared: at least one origin did not complete the review"});

 const failed=checks.filter(c=>!c.ok);
 return {
  receipt:"mcp-endpoint-preflight-v1",
  endpoint:endpoint.loopback?"loopback":endpoint.href,
  all_checks_passed:failed.length===0,
  passed:checks.length-failed.length,
  failed:failed.length,
  checks,
  parity,
  data_sent:"invented booking fixture only",
  host_judgments:"scripted fixture, not produced by a model",
  live_chatgpt_client_verified:false,
  live_claude_client_verified:false,
  note:"Scripted requests from this machine. Not evidence that a ChatGPT or Claude client connects, of semantic accuracy, or of the endpoint's security."
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const target=process.argv[2];
 try{
  const receipt=target?await checkEndpoint(target):await withLocalService(url=>checkEndpoint(url));
  console.log(JSON.stringify(receipt,null,2));
  process.exitCode=receipt.all_checks_passed?0:1;
 }catch(error){
  console.error(String(error?.message||error));
  process.exitCode=2;
 }
}

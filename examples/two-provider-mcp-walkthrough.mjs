// Two-provider MCP walkthrough (synthetic, local only).
//
// Starts the Missing AI service on a loopback port inside this process and
// performs the same source-backed review twice: once sending the browser
// Origin a ChatGPT custom MCP connection uses, once sending the one Claude
// uses. It then prints one JSON receipt comparing the two sessions.
//
//   node examples/two-provider-mcp-walkthrough.mjs
//
// What this is NOT: it does not open ChatGPT or Claude, does not call any
// model and does not contact the hosted beta. The "host judgments" below are
// a fixed script standing in for what a host model would propose. A matching
// receipt shows the server answers both origins identically; it does not show
// that either live client was connected or behaved correctly.
import http from "node:http";
import {pathToFileURL} from "node:url";
import {createHandler} from "../server/index.mjs";

export const HOST_PROFILES=Object.freeze([
 Object.freeze({host:"chatgpt",origin:"https://chatgpt.com"}),
 Object.freeze({host:"claude",origin:"https://claude.ai"})
]);

// Invented booking example. No real customer, product or company data.
export const FIXTURE=Object.freeze({
 sources:Object.freeze([
  Object.freeze({source_text:"- Must verify Stripe webhook signatures before confirming paid bookings.\n- Must let customers cancel bookings."}),
  Object.freeze({source_text:"- Must issue payment receipts for completed payments.\n- Should include a support contact in receipts."})
 ]),
 answer:"Stripe events are checked using the signing secret. Customers can withdraw bookings from their dashboard. Payment receipts have not been implemented."
});

const quote=(answer,text)=>({quote:text,start:answer.indexOf(text)});

// Scripted stand-in for the host model's proposal. One group per requirement.
export function scriptedHostGroups(answer=FIXTURE.answer){
 return [
  {title:"Verify webhook signatures",refs:["S01:R01"],obligation:"mandatory",judgment:"claimed_covered",reason:"The answer says events are checked with the signing secret.",evidence:[quote(answer,"Stripe events are checked using the signing secret.")]},
  {title:"Customer cancellation",refs:["S01:R02"],obligation:"mandatory",judgment:"claimed_covered",reason:"The answer says customers can withdraw bookings.",evidence:[quote(answer,"Customers can withdraw bookings from their dashboard.")]},
  {title:"Issue payment receipts",refs:["S02:R01"],obligation:"mandatory",judgment:"contradicted",reason:"The answer says receipts have not been implemented.",evidence:[quote(answer,"Payment receipts have not been implemented.")]},
  {title:"Support contact in receipts",refs:["S02:R02"],obligation:"recommended",judgment:"not_clearly_mentioned",reason:"The answer does not mention a support contact.",evidence:[]}
 ];
}

export function createRpc(mcpUrl,origin){
 let id=0;
 return async(method,params,{notification=false}={})=>{
  const body={jsonrpc:"2.0",method,...(params?{params}:{}),...(notification?{}:{id:++id})};
  const response=await fetch(mcpUrl,{method:"POST",headers:{"content-type":"application/json",accept:"application/json, text/event-stream",origin},body:JSON.stringify(body)});
  const text=await response.text();
  return {status:response.status,allow_origin:response.headers.get("access-control-allow-origin"),body:text?JSON.parse(text):null};
 };
}

// One complete host session: handshake, discovery, prepare, validate.
export async function runHostSession(mcpUrl,profile,fixture=FIXTURE){
 const rpc=createRpc(mcpUrl,profile.origin);
 const init=await rpc("initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"missing-ai-walkthrough-"+profile.host,version:"0"}});
 const initialized=await rpc("notifications/initialized",undefined,{notification:true});
 const listed=await rpc("tools/list");
 const call=async(name,args)=>(await rpc("tools/call",{name,arguments:args})).body.result;
 const prepared=await call("prepare_bundle",{sources:fixture.sources,ai_output:fixture.answer});
 if(prepared.isError)throw new Error("prepare_bundle failed: "+prepared.content[0].text);
 const packet=prepared.structuredContent;
 const validated=await call("validate_bundle",{
  sources:packet.sources.map(s=>({source_text:s.source_text})),
  ai_output:packet.ai_output,
  groups:scriptedHostGroups(packet.ai_output)
 });
 if(validated.isError)throw new Error("validate_bundle failed: "+validated.content[0].text);
 return {
  host:profile.host,
  origin:profile.origin,
  cors_origin_echoed:init.allow_origin===profile.origin,
  protocol_version:init.body.result.protocolVersion,
  initialized_status:initialized.status,
  tool_names:listed.body.result.tools.map(t=>t.name),
  tools:listed.body.result.tools,
  prepared:packet,
  validated:validated.structuredContent
 };
}

export async function withLocalService(fn){
 const server=http.createServer(createHandler());
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{return await fn("http://127.0.0.1:"+server.address().port+"/mcp");}
 finally{await new Promise(resolve=>server.close(resolve));}
}

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export async function runWalkthrough(){
 return await withLocalService(async mcpUrl=>{
  const sessions=[];
  for(const profile of HOST_PROFILES)sessions.push(await runHostSession(mcpUrl,profile));
  const [first,...rest]=sessions;
  const parity={
   tool_definitions_identical:rest.every(s=>same(s.tools,first.tools)),
   prepared_packet_identical:rest.every(s=>same(s.prepared,first.prepared)),
   validated_report_identical:rest.every(s=>same(s.validated,first.validated))
  };
  return {
   receipt:"two-provider-mcp-walkthrough-v1",
   service:"local loopback, in-process",
   hosts:sessions.map(s=>({host:s.host,origin:s.origin,cors_origin_echoed:s.cors_origin_echoed,protocol_version:s.protocol_version,tool_names:s.tool_names})),
   candidate_requirements:first.prepared.totals.candidate_requirements,
   summary:first.validated.summary,
   validation:first.validated.validation,
   parity,
   host_judgments:"scripted fixture, not produced by a model",
   live_chatgpt_client_verified:false,
   live_claude_client_verified:false,
   hosted_beta_contacted:false,
   note:"Identical local server responses for both origins. Not evidence of live client behaviour, semantic accuracy or real implementation."
  };
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 console.log(JSON.stringify(await runWalkthrough(),null,2));
}

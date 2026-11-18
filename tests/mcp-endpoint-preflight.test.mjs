// Endpoint preflight example (roadmap #86, Gate C developer ergonomics).
// Everything runs against in-process loopback servers; nothing here contacts
// the hosted beta, ChatGPT or Claude. The deliberately broken servers below
// show the preflight reports a failure instead of passing or crashing.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createHandler} from "../server/index.mjs";
import {withLocalService} from "../examples/two-provider-mcp-walkthrough.mjs";
import {checkEndpoint,parseEndpoint,EXPECTED_TOOLS,LOOKALIKE_ORIGIN} from "../examples/check-mcp-endpoint.mjs";

const root=fileURLToPath(new URL("..",import.meta.url));

async function withServer(listener,fn){
 const server=http.createServer(listener);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{return await fn("http://127.0.0.1:"+server.address().port+"/mcp");}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
const named=(receipt,name,host=null)=>receipt.checks.find(c=>c.name===name&&c.host===host);

test("endpoint URLs: https anywhere, plain http only on loopback, no credentials",()=>{
 assert.deepEqual(parseEndpoint("https://mcp.example/mcp"),{href:"https://mcp.example/mcp",loopback:false,https:true,standard_port:true});
 assert.equal(parseEndpoint("https://mcp.example:443/mcp").standard_port,true);
 assert.equal(parseEndpoint("https://mcp.example:8443/mcp").standard_port,false);
 assert.equal(parseEndpoint("http://127.0.0.1:8787/mcp").loopback,true);
 assert.equal(parseEndpoint("https://mcp.example/mcp#frag").href,"https://mcp.example/mcp");
 assert.throws(()=>parseEndpoint("http://mcp.example/mcp"),/https/);
 assert.throws(()=>parseEndpoint("http://127.0.0.1.example/mcp"),/https/);
 assert.throws(()=>parseEndpoint("ftp://127.0.0.1/mcp"),/https/);
 assert.throws(()=>parseEndpoint("https://user:secret@mcp.example/mcp"),/username or password/);
 assert.throws(()=>parseEndpoint("not a url"),/valid URL/);
 assert.throws(()=>parseEndpoint(undefined),/valid URL/);
});

test("the reference service passes every check for both origins",async()=>{
 const receipt=await withLocalService(url=>checkEndpoint(url));
 assert.equal(receipt.receipt,"mcp-endpoint-preflight-v1");
 assert.equal(receipt.all_checks_passed,true);
 assert.equal(receipt.failed,0);
 assert.equal(receipt.passed,receipt.checks.length);
 for(const host of ["chatgpt","claude"])for(const name of ["cors_preflight","initialize","initialized_notification","tools_list","synthetic_review","fabricated_quote_refused"])assert.equal(named(receipt,name,host)?.ok,true,host+" "+name);
 for(const name of ["https","standard_https_port","lookalike_origin_refused","both_origins_identical"])assert.equal(named(receipt,name)?.ok,true,name);
 assert.deepEqual(receipt.parity,{tool_definitions_identical:true,prepared_packet_identical:true,validated_report_identical:true});
 assert.equal(EXPECTED_TOOLS.length,6);
});

test("a pass makes no live-client, accuracy or security claim and names no private system",async()=>{
 const receipt=await withLocalService(url=>checkEndpoint(url));
 assert.equal(receipt.live_chatgpt_client_verified,false);
 assert.equal(receipt.live_claude_client_verified,false);
 assert.match(receipt.host_judgments,/scripted/);
 assert.match(receipt.note,/Not evidence/);
 assert.equal(receipt.endpoint,"loopback");
 assert.equal(/orchestryn/i.test(JSON.stringify(receipt)),false);
 assert.match(named(receipt,"https").detail,/not usable as a connector/);
});

test("an endpoint that refuses the Claude origin fails only the Claude checks",async()=>{
 const handler=createHandler();
 const receipt=await withServer((req,res)=>{
  if(req.headers.origin==="https://claude.ai"){res.writeHead(403,{"content-type":"application/json"});res.end('{"error":"Origin not allowed."}');return;}
  handler(req,res);
 },url=>checkEndpoint(url));
 assert.equal(receipt.all_checks_passed,false);
 assert.equal(named(receipt,"synthetic_review","chatgpt").ok,true);
 assert.equal(named(receipt,"cors_preflight","claude").ok,false);
 assert.equal(named(receipt,"initialize","claude").ok,false);
 assert.equal(named(receipt,"tools_list","claude"),undefined);
 assert.equal(receipt.parity,null);
 assert.equal(named(receipt,"both_origins_identical").ok,false);
});

test("an endpoint that accepts any origin fails the look-alike check",async()=>{
 const handler=createHandler();
 const receipt=await withServer((req,res)=>{
  if(req.headers.origin===LOOKALIKE_ORIGIN)req.headers.origin="https://chatgpt.com";
  handler(req,res);
 },url=>checkEndpoint(url));
 assert.equal(named(receipt,"lookalike_origin_refused").ok,false);
 assert.equal(named(receipt,"both_origins_identical").ok,true);
 assert.equal(receipt.all_checks_passed,false);
 assert.equal(receipt.failed,1);
});

test("an endpoint missing a tool fails discovery and the review is not attempted",async()=>{
 const handler=createHandler();
 const receipt=await withServer((req,res)=>{
  const end=res.end.bind(res);
  res.end=chunk=>{
   if(typeof chunk==="string"&&chunk.includes('"tools":[')){const body=JSON.parse(chunk);body.result.tools=body.result.tools.filter(t=>t.name!=="validate_bundle");return end(JSON.stringify(body));}
   return end(chunk);
  };
  handler(req,res);
 },url=>checkEndpoint(url));
 for(const host of ["chatgpt","claude"]){
  const check=named(receipt,"tools_list",host);
  assert.equal(check.ok,false);
  assert.match(check.detail,/got check_missing, fetch_source, prepare_review, validate_review, prepare_bundle$/);
  assert.equal(named(receipt,"synthetic_review",host),undefined);
 }
 assert.equal(receipt.all_checks_passed,false);
});

test("an unreachable endpoint is reported as failed checks, not thrown",async()=>{
 const port=await withServer(()=>{},url=>new URL(url).port);
 const receipt=await checkEndpoint("http://127.0.0.1:"+port+"/mcp");
 assert.equal(receipt.all_checks_passed,false);
 assert.equal(named(receipt,"initialize","chatgpt").ok,false);
 assert.equal(named(receipt,"lookalike_origin_refused").ok,false);
 assert.equal(receipt.parity,null);
});

test("an endpoint that never answers is reported as a timeout",async()=>{
 const receipt=await withServer(()=>{},url=>checkEndpoint(url,{timeoutMs:150}));
 assert.equal(receipt.all_checks_passed,false);
 assert.match(named(receipt,"initialize","claude").detail,/time limit/);
});

test("a non-JSON answer is a failed check",async()=>{
 const receipt=await withServer((req,res)=>{res.writeHead(200,{"content-type":"text/html","access-control-allow-origin":req.headers.origin||"*"});res.end("<html>welcome</html>");},url=>checkEndpoint(url));
 assert.equal(named(receipt,"initialize","chatgpt").ok,false);
 assert.equal(receipt.all_checks_passed,false);
});

test("the documented commands run as written: exit 0 for the demo, 2 for a refused URL",()=>{
 const doc=readFileSync(root+"docs/TWO_PROVIDER_BETA_READINESS.md","utf8");
 assert.ok(doc.includes("node examples/check-mcp-endpoint.mjs https://your-host.example/mcp"));
 assert.ok(doc.includes("node examples/check-mcp-endpoint.mjs\n"));
 const demo=spawnSync(process.execPath,["examples/check-mcp-endpoint.mjs"],{cwd:root,encoding:"utf8"});
 assert.equal(demo.status,0);
 const printed=JSON.parse(demo.stdout);
 assert.equal(printed.all_checks_passed,true);
 for(const field of ["live_chatgpt_client_verified","live_claude_client_verified"])assert.equal(printed[field],false,field);
 const refused=spawnSync(process.execPath,["examples/check-mcp-endpoint.mjs","http://mcp.example/mcp"],{cwd:root,encoding:"utf8"});
 assert.equal(refused.status,2);
 assert.equal(refused.stdout,"");
 assert.match(refused.stderr,/https/);
});

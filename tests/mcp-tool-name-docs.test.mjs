// Developer-onboarding accuracy checks (roadmap #86): the MCP tool names a
// developer reads in this repository's documentation must be names that one
// of the three MCP servers in this repository actually exposes. Everything is
// synthetic and in-process. A pass shows the docs and the code agree on tool
// NAMES only; it does not show that descriptions, arguments or live hosted
// behaviour match the docs.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {readFileSync,readdirSync} from "node:fs";
import {createHandler} from "../server/index.mjs";
import {PRIVATE_HISTORY_TOOLS} from "../private-history/context-mcp.mjs";
import {MANAGED_TOOLS} from "../managed-beta/mcp.mjs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const docFiles=["README.md","llms.txt",...readdirSync(new URL("../docs/",import.meta.url)).filter(f=>f.endsWith(".md")).map(f=>"docs/"+f)];
const PRIVATE=PRIVATE_HISTORY_TOOLS.map(t=>t.name);
const MANAGED=MANAGED_TOOLS.map(t=>t.name);
// Stateless hosted service names follow verb_object; context servers use a
// missing_ai_ prefix. For context names a leading "/" or "." excludes file
// paths such as an SSH key called missing_ai_import; hosted names are often
// paired as "prepare_review/validate_review", so "/" is allowed there.
const HOSTED_RE=/(?<![\w.-])(?:check|fetch|prepare|validate)_[a-z_]+[a-z]\b/g;
const CONTEXT_RE=/(?<![\w/.-])missing_ai_[a-z_]+[a-z]\b/g;
const names=(text,re)=>[...new Set(text.match(re)||[])].sort();

async function hostedTools(){
 const server=http.createServer(createHandler());
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{
  const url="http://127.0.0.1:"+server.address().port+"/mcp";
  const post=body=>fetch(url,{method:"POST",headers:{accept:"application/json, text/event-stream","content-type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json());
  const init=await post({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18"}});
  const list=await post({jsonrpc:"2.0",id:2,method:"tools/list"});
  return {instructions:init.result.instructions,names:list.result.tools.map(t=>t.name)};
 }finally{server.close();}
}

test("the three tool lists are disjoint, so a documented name identifies one server",async()=>{
 const {names:hosted}=await hostedTools();
 const all=[...hosted,...PRIVATE,...MANAGED];
 assert.equal(new Set(all).size,all.length);
 assert.ok(hosted.length>0&&PRIVATE.length>0&&MANAGED.length>0);
});

test("every MCP tool name cited in README, llms.txt or docs/ exists in code",async()=>{
 const {names:hosted}=await hostedTools();
 const known=new Set([...hosted,...PRIVATE,...MANAGED]);
 const unknown=[];
 for(const file of docFiles){
  const text=read(file);
  for(const n of [...names(text,HOSTED_RE),...names(text,CONTEXT_RE)])if(!known.has(n))unknown.push(file+": "+n);
 }
 assert.deepEqual(unknown,[],"docs cite tool names no server exposes");
});

test("hosted initialize instructions only name tools the hosted server lists",async()=>{
 const {instructions,names:hosted}=await hostedTools();
 const cited=[...names(instructions,HOSTED_RE),...names(instructions,CONTEXT_RE)];
 assert.ok(cited.length>0);
 for(const n of cited)assert.ok(hosted.includes(n),n+" is in instructions but not tools/list");
 // The instructions are the host AI's first guidance; every hosted tool
 // except the low-level fetch_source should be reachable from them.
 for(const n of hosted.filter(n=>n!=="fetch_source"))assert.ok(cited.includes(n),n+" missing from instructions");
});

test("primary hosted docs name every hosted tool and no context tool",async()=>{
 const {names:hosted}=await hostedTools();
 for(const file of ["README.md","docs/DEVELOPER_HANDOFF.md","docs/TWO_PROVIDER_BETA_READINESS.md"]){
  const text=read(file);
  assert.deepEqual(names(text,HOSTED_RE),[...hosted].sort(),file);
 }
});

test("the private context MCP guide names every private-history tool",()=>{
 assert.deepEqual(names(read("docs/PRIVATE_CONTEXT_MCP.md"),CONTEXT_RE),[...PRIVATE].sort());
});

test("the managed context beta guide names the import tool it walks through",()=>{
 const cited=names(read("docs/MANAGED_CONTEXT_BETA.md"),CONTEXT_RE);
 assert.ok(cited.length>0);
 for(const n of cited)assert.ok(MANAGED.includes(n),n);
});

// Known documentation gap, recorded rather than claimed: the managed beta
// guide describes its tools by capability ("read/profile/status/search/list,
// prepare/cancel and audit") but names only missing_ai_prepare_context_import.
test("TODO: the managed context beta guide names every managed tool",{todo:"docs/MANAGED_CONTEXT_BETA.md names 1 of the managed tools by identifier; a tool table is not yet written"},()=>{
 assert.deepEqual(names(read("docs/MANAGED_CONTEXT_BETA.md"),CONTEXT_RE),[...MANAGED].sort());
});

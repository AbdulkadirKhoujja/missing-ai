// Issue #86 (developer onboarding accuracy): the managed context beta guide's
// tool table must match the tools managed-beta/mcp.mjs actually defines,
// including each tool's OAuth scope, read/write effect and conditional exposure.
// Documentation-only check; it does not claim the managed beta is hosted.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import http from "node:http";
import {MANAGED_TOOLS,createManagedMcp} from "../managed-beta/mcp.mjs";

const doc=readFileSync(new URL("../docs/MANAGED_CONTEXT_BETA.md",import.meta.url),"utf8");
const section=doc.split("### Managed MCP tools")[1]?.split(/\n## /)[0]||"";
const rows=section.split("\n").filter(l=>/^`missing_ai_[a-z_]+`\s*\|/.test(l)).map(l=>{
 const [name,scope,effect,exposure]=l.split("|").map(c=>c.trim());
 return {name:name.replace(/`/g,""),scope:scope.replace(/`/g,""),effect,exposure};
});
const byName=new Map(rows.map(r=>[r.name,r]));

test("the guide has a managed tool table with one row per tool",()=>{
 assert.ok(section,"### Managed MCP tools section missing");
 assert.equal(byName.size,rows.length,"duplicate rows");
 assert.deepEqual([...byName.keys()].sort(),MANAGED_TOOLS.map(t=>t.name).sort());
});

test("each documented scope matches the tool's OAuth security scheme",()=>{
 for(const t of MANAGED_TOOLS)assert.equal(byName.get(t.name)?.scope,t.securitySchemes[0].scopes.join(" "),t.name);
});

test("read-only tools are documented as read-only and write tools are not",()=>{
 for(const t of MANAGED_TOOLS){
  const ro=/^Read-only:/.test(byName.get(t.name)?.effect||"");
  assert.equal(ro,t.annotations.readOnlyHint===true,t.name);
 }
});

test("documented exposure matches what tools/list advertises with and without an approval verifier",async()=>{
 // tools/list needs no token, so a stub store and verifier are enough.
 const listed=async verifyApproval=>{
  const handler=createManagedMcp({store:{},verifyToken:async()=>{throw Error("unused");},verifyApproval,issuer:"https://issuer.invalid",resource:"https://resource.invalid"});
  const server=http.createServer(handler);
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  try{
   const res=await fetch(`http://127.0.0.1:${server.address().port}/mcp`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"})});
   return new Set((await res.json()).result.tools.map(t=>t.name));
  }finally{await new Promise(r=>server.close(r));}
 };
 const without=await listed(undefined),withVerifier=await listed(async()=>true);
 for(const r of rows){
  if(r.exposure==="Always listed"){
   assert.ok(without.has(r.name)&&withVerifier.has(r.name),r.name+" documented as always listed");
  }else{
   assert.match(r.exposure,/^Listed only when an independent approval verifier is configured$/,r.name);
   assert.ok(!without.has(r.name)&&withVerifier.has(r.name),r.name+" documented as conditional");
  }
 }
 assert.equal(withVerifier.size,rows.length);
});

test("no destructive or export tool is documented as an MCP tool",()=>{
 assert.ok(MANAGED_TOOLS.every(t=>t.annotations.destructiveHint===false));
 assert.ok(rows.every(r=>!/\b(delete|export|wipe)\b/i.test(r.name)));
 assert.match(section,/no MCP tool for export, deleting notes or wiping/);
});

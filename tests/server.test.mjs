import test from "node:test";import assert from "node:assert/strict";import http from "node:http";import {createHandler,clientId} from "../server/index.mjs";import {validatePublicUrl,htmlToText} from "../server/source.mjs";
test("blocks local and non-HTTPS URL fetches",()=>{for(const u of ["http://example.com","https://127.0.0.1","https://localhost","https://service.local","https://example.com:8443/path","https://user:password@example.com"])assert.throws(()=>validatePublicUrl(u));});
test("accepts ordinary public HTTPS URL",()=>{assert.equal(validatePublicUrl("https://example.com/a#b").href,"https://example.com/a");});
test("extracts main text and removes scripts",()=>{const t=htmlToText("<main><h1>Hello &amp; world</h1><script>bad()</script><li>Must verify webhooks</li></main>");assert.match(t,/Hello & world/);assert.doesNotMatch(t,/bad\(\)/);});
test("MCP tool listing and check via JSON-RPC",async()=>{
 const server=http.createServer(createHandler());await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{const url="http://127.0.0.1:"+server.address().port+"/mcp";
 const post=body=>fetch(url,{method:"POST",headers:{accept:"application/json, text/event-stream","content-type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json());
 const init=await post({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18"}});
 assert.equal(init.result.serverInfo.name,"missing-ai");
 const list=await post({jsonrpc:"2.0",id:2,method:"tools/list"});assert.equal(list.result.tools.length,2);
 const call=await post({jsonrpc:"2.0",id:3,method:"tools/call",params:{name:"check_missing",arguments:{source_text:"- Must verify signed webhooks",ai_output:"Added homepage."}}});
 assert.equal(call.result.structuredContent.summary.needs_review,1);
 }finally{server.close();}
});

test("Caddy-proxied visitors have independent rate-limit identities",()=>{
  assert.equal(clientId({socket:{remoteAddress:"127.0.0.1"},headers:{"x-forwarded-for":"198.51.100.14"}}),"198.51.100.14");
  assert.equal(clientId({socket:{remoteAddress:"::ffff:127.0.0.1"},headers:{"x-forwarded-for":"2001:db8::1"}}),"2001:db8::1");
  assert.equal(clientId({socket:{remoteAddress:"203.0.113.8"},headers:{"x-forwarded-for":"198.51.100.14"}}),"203.0.113.8");
  assert.equal(clientId({socket:{remoteAddress:"127.0.0.1"},headers:{"x-forwarded-for":"invalid header"}}),"127.0.0.1");
});

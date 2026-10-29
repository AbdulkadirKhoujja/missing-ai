import test from "node:test";import assert from "node:assert/strict";import http from "node:http";import {createHandler,clientId} from "../server/index.mjs";import {validatePublicUrl,htmlToText,pinnedIPv4Lookup} from "../server/source.mjs";
test("blocks local and non-HTTPS URL fetches",()=>{for(const u of ["http://example.com","https://127.0.0.1","https://localhost","https://service.local","https://example.com:8443/path","https://user:password@example.com"])assert.throws(()=>validatePublicUrl(u));});
test("accepts ordinary public HTTPS URL",()=>{assert.equal(validatePublicUrl("https://example.com/a#b").href,"https://example.com/a");});
test("extracts main text and removes scripts",()=>{const t=htmlToText("<main><h1>Hello &amp; world</h1><script>bad()</script><li>Must verify webhooks</li></main>");assert.match(t,/Hello & world/);assert.doesNotMatch(t,/bad\(\)/);});
test("MCP tool listing and check via JSON-RPC",async()=>{
 const server=http.createServer(createHandler());await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{const url="http://127.0.0.1:"+server.address().port+"/mcp";
 const post=body=>fetch(url,{method:"POST",headers:{accept:"application/json, text/event-stream","content-type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json());
 const init=await post({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18"}});
 assert.equal(init.result.serverInfo.name,"missing-ai");
 const list=await post({jsonrpc:"2.0",id:2,method:"tools/list"});assert.deepEqual(list.result.tools.map(t=>t.name),["check_missing","fetch_source","prepare_review","validate_review","prepare_bundle","validate_bundle"]);
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

// Node 22 automatic family selection invokes custom lookup with options.all.
// A raw string callback causes ERR_INVALID_IP_ADDRESS: Invalid IP address: undefined.
test("pinned IPv4 resolver handles Node 22 single and all-address lookup modes",async()=>{
 const lookup=pinnedIPv4Lookup("198.51.100.41");
 const one=await new Promise((resolve,reject)=>lookup("untrusted.example",{family:4},(err,address,family)=>err?reject(err):resolve({address,family})));
 assert.deepEqual(one,{address:"198.51.100.41",family:4});
 const all=await new Promise((resolve,reject)=>lookup("untrusted.example",{all:true},(err,addresses)=>err?reject(err):resolve(addresses)));
 assert.deepEqual(all,[{address:"198.51.100.41",family:4}]);
 const noOpts=await new Promise((resolve,reject)=>lookup("untrusted.example",(err,address,family)=>err?reject(err):resolve({address,family})));
 assert.deepEqual(noOpts,one);
 assert.throws(()=>pinnedIPv4Lookup("localhost"),/IPv4/);
});

test("Node 22 HTTP agent connects through DNS-pinned IPv4 with automatic family selection",async()=>{
 const server=http.createServer((_req,res)=>{res.writeHead(200);res.end("pinned");});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const url="http://not-in-real-dns.invalid:"+server.address().port+"/";
  const text=await new Promise((resolve,reject)=>{
   http.get(url,{lookup:pinnedIPv4Lookup("127.0.0.1"),autoSelectFamily:true},res=>{
    let body="";res.setEncoding("utf8");res.on("data",d=>body+=d);res.on("end",()=>resolve(body));
   }).on("error",reject);
  });
  assert.equal(text,"pinned");
 }finally{server.close();}
});

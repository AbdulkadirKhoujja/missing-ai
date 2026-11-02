import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import http from 'node:http';
import {createManagedBeta} from '../managed-beta/mcp.mjs';
import {createVerifier,AuthError} from '../managed-beta/auth.mjs';
import {createStore} from '../managed-beta/store.mjs';
const issuer='https://id.example.test',resource='https://context.example.test',jwksUrl=issuer+'/jwks';
const kp=generateKeyPairSync('rsa',{modulusLength:2048});
const approvalKp=generateKeyPairSync('rsa',{modulusLength:2048});
const approvalIssuer='https://approve.example.test';
const jwk={...kp.publicKey.export({format:'jwk'}),kid:'test-key',use:'sig',alg:'RS256'};
const fakeFetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200,headers:{'content-type':'application/json'}});
const enc=(x)=>Buffer.from(JSON.stringify(x)).toString('base64url');
function token(sub,scope='context:read context:write',overrides={}){
 const now=Math.floor(Date.now()/1000),head=enc({alg:'RS256',kid:'test-key'});
 const body=enc({iss:issuer,aud:resource,sub,scope,iat:now,exp:now+3600,...overrides});
 return `${head}.${body}.${sign('RSA-SHA256',Buffer.from(head+'.'+body),kp.privateKey).toString('base64url')}`;
}
const tenant=sub=>createHash('sha256').update(issuer+'\0'+sub).digest('hex');
function proof(sub,preview_id,overrides={}){const now=Math.floor(Date.now()/1000);const h=enc({alg:'RS256'});const b=enc({iss:approvalIssuer,aud:'missing-ai-managed-approval',tenant:tenant(sub),preview_id,intent:'save_context',iat:now,exp:now+180,...overrides});return `${h}.${b}.${sign('RSA-SHA256',Buffer.from(h+'.'+b),approvalKp.privateKey).toString('base64url')}`;}
const approved=(sub,preview_id)=>({preview_id,approval_proof:proof(sub,preview_id)});
const note=(text='The staging release passed all tests.')=>({conversation:'Example project',text});
function setup(){const {handler,store}=createManagedBeta({issuer,audience:resource,jwksUrl,resource,dbPath:':memory:',encryptionKey:randomBytes(32),fetchImpl:fakeFetch,allowMemory:true,approvalIssuer,approvalPublicKey:approvalKp.publicKey.export({format:'pem',type:'spki'})});return {handler,store};}
async function run(fn){const {handler,store}=setup(),server=http.createServer(handler);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url=`http://127.0.0.1:${server.address().port}`;try{await fn({url,store});}finally{await new Promise(ok=>server.close(ok));store.close();}}
async function call(url,name,args={},jwt=token('alice'),extra={}){
 const r=await fetch(url+'/mcp',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+jwt,...extra},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}})});const data=await r.json();return {status:r.status,body:data,headers:r.headers,value:data.result?.structuredContent,error:data.result?.isError};
}
test('OAuth metadata advertises separate provider and user read/write scopes',()=>run(async({url})=>{
 const r=await fetch(url+'/.well-known/oauth-protected-resource');assert.equal(r.status,200);
 const body=await r.json();assert.equal(body.resource,resource);assert.deepEqual(body.authorization_servers,[issuer]);assert.deepEqual(body.scopes_supported,['context:read','context:write']);
 const list=await fetch(url+'/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});const data=await list.json();assert.equal(data.result.tools.length,9);assert.ok(data.result.tools.every(t=>t.securitySchemes[0].type==='oauth2'));
}));
test('unauthenticated reads challenge and invalid tokens are denied',()=>run(async({url})=>{
 const none=await call(url,'missing_ai_context_status',{},'');assert.equal(none.status,401);assert.match(none.headers.get('www-authenticate'),/oauth-protected-resource/);
 const forged=token('alice').slice(0,-4)+'xxxx';assert.equal((await call(url,'missing_ai_context_status',{},forged)).status,401);
 const expired=token('alice',undefined,{exp:Math.floor(Date.now()/1000)-100});assert.equal((await call(url,'missing_ai_context_status',{},expired)).status,401);
 const wrongAud=token('alice',undefined,{aud:'https://other.example.test'});assert.equal((await call(url,'missing_ai_context_status',{},wrongAud)).status,401);
 const wrongIss=token('alice',undefined,{iss:'https://other.example.test'});assert.equal((await call(url,'missing_ai_context_status',{},wrongIss)).status,401);
}));
test('OAuth scope enforcement separates reader and writer',()=>run(async({url})=>{
 assert.equal((await call(url,'missing_ai_prepare_context_import',{notes:[note()]},token('alice','context:read'))).status,403);
 assert.equal((await call(url,'missing_ai_context_status',{},token('alice','context:write'))).status,403);
 assert.equal((await call(url,'missing_ai_context_status',{},token('alice','context:read'))).status,200);
}));
test('tenant isolation: separate identities cannot list, search, commit or delete others’ notes',()=>run(async({url,store})=>{
 const draft=await call(url,'missing_ai_prepare_context_import',{notes:[note()]});assert.equal(draft.status,200);assert.ok(draft.value.preview_id);
 const steal=await call(url,'missing_ai_save_approved_context',approved('alice',draft.value.preview_id),token('bob'));
 assert.equal(steal.error,true);assert.equal(store.count(tenant('bob')),0);
 const saved=await call(url,'missing_ai_save_approved_context',approved('alice',draft.value.preview_id));assert.equal(saved.value.added,1);
 const list=await call(url,'missing_ai_list_context');assert.equal(list.value.notes.length,1);
 const search=await call(url,'missing_ai_search_context',{query:'staging release'});assert.equal(search.value.findings.length,1);
 const bob=await call(url,'missing_ai_search_context',{query:'staging release'},token('bob'));assert.deepEqual(bob.value.findings,[]);
 const blocked=await call(url,'missing_ai_delete_context',{note_id:list.value.notes[0].id},token('bob'));assert.equal(blocked.value.deleted,false);
 assert.equal((await call(url,'missing_ai_context_status')).value.note_count,1);
}));
test('separate confirm step, one-shot approval, duplicate detection and explicit cancellation',()=>run(async({url})=>{
 const data=await call(url,'missing_ai_prepare_context_import',{notes:[note()]});const id=data.value.preview_id;
 const noConsent=await call(url,'missing_ai_save_approved_context',{preview_id:id,approval_proof:'invalid'});assert.equal(noConsent.error,true);
 assert.equal((await call(url,'missing_ai_context_status')).value.note_count,0);
 assert.equal((await call(url,'missing_ai_save_approved_context',approved('alice',id))).value.added,1);
 assert.equal((await call(url,'missing_ai_save_approved_context',approved('alice',id))).error,true);
 const repeat=await call(url,'missing_ai_prepare_context_import',{notes:[note()]});const committed=await call(url,'missing_ai_save_approved_context',approved('alice',repeat.value.preview_id));assert.equal(committed.value.added,0);assert.equal(committed.value.duplicates,1);
 const newer=await call(url,'missing_ai_prepare_context_import',{notes:[note('Another synthetic item.')]});await call(url,'missing_ai_cancel_context_import',{preview_id:newer.value.preview_id});assert.equal((await call(url,'missing_ai_save_approved_context',approved('alice',newer.value.preview_id))).error,true);
}));
test('delete one and delete all are strictly tenant-scoped',()=>run(async({url,store})=>{
 const add=async(sub,text)=>{const draft=await call(url,'missing_ai_prepare_context_import',{notes:[note(text)]},token(sub));await call(url,'missing_ai_save_approved_context',approved(sub,draft.value.preview_id),token(sub));};
 await add('alice','Synthetic alpha completed.');await add('bob','Synthetic bravo completed.');
 assert.equal(store.count(tenant('alice')),1);assert.equal(store.count(tenant('bob')),1);
 const id=(await call(url,'missing_ai_list_context')).value.notes[0].id;
 assert.equal((await call(url,'missing_ai_delete_context',{note_id:id})).value.deleted,true);
 await add('alice','Synthetic replacement completed.');
 assert.equal((await call(url,'missing_ai_delete_all_context',{confirmation:'WRONG'})).error,true);
 assert.equal((await call(url,'missing_ai_delete_all_context',{confirmation:'DELETE ALL MY MISSING AI CONTEXT'})).value.deleted,1);
 assert.equal(store.count(tenant('alice')),0);assert.equal(store.count(tenant('bob')),1);
}));
test('encrypted store does not persist plaintext note content',()=>{
 const {store}=setup(),t=tenant('alice');const id=store.prepare(t,[{conversation:'Synthetic',text:'Unique confidentiality fixture marker: ZEBRA-87654',role:'note',date:new Date().toISOString()}]);
 assert.equal(store.commit(t,id).added,1);assert.equal(store.list(t)[0].text.includes('ZEBRA-87654'),true);
 assert.equal(store.count(t),1);store.close();
});
test('rejects malformed and oversized inputs, secrets and cross-site Origin',()=>run(async({url})=>{
 const bad=await call(url,'missing_ai_prepare_context_import',{notes:[note('sk-'+'x'.repeat(30))]});assert.equal(bad.error,true);
 const tooLong=await call(url,'missing_ai_prepare_context_import',{notes:[note('x'.repeat(3001))]});assert.equal(tooLong.error,true);
 const cross=await call(url,'missing_ai_context_status',{},token('alice'),{origin:'https://attacker.example.test'});assert.equal(cross.status,403);
 const huge=await fetch(url+'/mcp',{method:'POST',headers:{'content-type':'application/json'},body:'a'.repeat(50*1024)});assert.equal(huge.status,400);
}));
test('never trusts caller-supplied tenant_id in tool arguments',()=>run(async({url})=>{
 const add=await call(url,'missing_ai_prepare_context_import',{notes:[note('Synthetic user A data.')],tenant_id:tenant('bob')});
 assert.equal(add.status,200);const done=await call(url,'missing_ai_save_approved_context',{...approved('alice',add.value.preview_id),tenant_id:tenant('bob')});
 assert.equal(done.value.added,1);
 const bob=await call(url,'missing_ai_context_status',{},token('bob'));assert.equal(bob.value.note_count,0);
}));
test('resource server requires configured HTTPS issuer, audience and JWKS URL',()=>{
 assert.throws(()=>createVerifier({issuer:'http://issuer.test',audience:resource,jwksUrl}),/HTTPS/);
 assert.throws(()=>createStore({key:Buffer.alloc(4),allowMemory:true}),/32-byte/);
 assert.throws(()=>createStore({key:Buffer.alloc(32)}),/persistent/);
});

test('private disk storage encrypts notes and drafts, survives restart and has content-free receipts',async()=>{
 const {mkdtempSync,readFileSync,statSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const folder=mkdtempSync(join(tmpdir(),'missing-ai-managed-disk-'));
 try{
  const key=randomBytes(32),p=join(folder,'notes.sqlite'),t=tenant('alice');
  let store=createStore({path:p,key});const marker='SECRET-FIXTURE-ZEBRA-84125';
  const draft=store.prepare(t,[{conversation:'Private fixture',text:marker,role:'note',date:new Date().toISOString()}]);
  assert.equal(readFileSync(p).includes(Buffer.from(marker)),false);
  const res=store.commit(t,draft);assert.equal(res.added,1);assert.ok(res.receipt);store.close();
  assert.equal((statSync(p).mode&0o077),0);assert.equal(readFileSync(p).includes(Buffer.from(marker)),false);
  store=createStore({path:p,key});assert.equal(store.count(t),1);assert.equal(store.list(t)[0].text,marker);
  assert.equal(store.audit(t).length,1);assert.equal(JSON.stringify(store.audit(t)).includes(marker),false);
  store.close();
  const wrong=createStore({path:p,key:randomBytes(32)});assert.throws(()=>wrong.list(t));wrong.close();
 }finally{rmSync(folder,{recursive:true,force:true});}
});
test('prepared drafts expire without write, and cannot be replayed by other tenants',()=>{
 let tick=1_700_000_000_000;const store=createStore({path:':memory:',allowMemory:true,key:randomBytes(32),now:()=>tick});
 try{const t=tenant('alice'),id=store.prepare(t,[{conversation:'Synthetic',text:'Reviewed note',role:'note',date:new Date(tick).toISOString()}]);
 assert.throws(()=>store.commit(tenant('bob'),id),/not found/);
 tick+=300_001;assert.throws(()=>store.commit(t,id),/expired/);assert.equal(store.count(t),0);
 }finally{store.close();}
});
test('unknown JWT key id cannot trigger unlimited JWKS fetches',async()=>{
 let calls=0;const fetchStub=async()=>{calls++;return fakeFetch();};
 const verifier=createVerifier({issuer,audience:resource,jwksUrl,fetchImpl:fetchStub});
 await verifier('Bearer '+token('alice'));
 for(let i=0;i<5;i++){
  const text=token('alice');const [h,p,s]=text.split('.');const randomKid=enc({alg:'RS256',kid:'unrecognized-'+i});
  await assert.rejects(verifier('Bearer '+`${randomKid}.${p}.${s}`),AuthError);
 }
 assert.equal(calls,1);
});
test('audit receipts are isolated and do not carry source text',()=>run(async({url})=>{
 const prep=await call(url,'missing_ai_prepare_context_import',{notes:[note('Supersecret-SYNTHETIC-TEST-TEXT-99331')]});
 await call(url,'missing_ai_save_approved_context',approved('alice',prep.value.preview_id));
 const audit=await call(url,'missing_ai_context_audit');assert.equal(audit.value.receipts.length,1);
 assert.equal(JSON.stringify(audit.value).includes('99331'),false);
 const other=await call(url,'missing_ai_context_audit',{},token('bob'));assert.deepEqual(other.value.receipts,[]);
}));

test('ChatGPT OAuth tool challenges include both per-tool metadata and a runtime login hint',()=>run(async({url})=>{
 const list=await fetch(url+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
 const tools=(await list.json()).result.tools;
 assert.ok(tools.every(x=>x._meta.securitySchemes?.[0]?.scopes?.length===1));
 const auth=await call(url,'missing_ai_context_status',{},'');
 assert.equal(auth.status,401);assert.equal(auth.body.result.isError,true);
 assert.match(auth.body.result._meta['mcp/www_authenticate'][0],/error="invalid_token"/);
 assert.match(auth.body.result._meta['mcp/www_authenticate'][0],/error_description=/);
}));

test('write tool refuses forged, wrong-account, wrong-draft and expired human approval proofs',()=>run(async({url})=>{
 const draft=(await call(url,'missing_ai_prepare_context_import',{notes:[note('Approved test fixture.')] })).value.preview_id;
 const evil=approved('bob',draft);
 const wrongOwner=await call(url,'missing_ai_save_approved_context',evil);assert.equal(wrongOwner.error,true);
 const wrongDraft=await call(url,'missing_ai_save_approved_context',{preview_id:draft,approval_proof:proof('alice','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')});assert.equal(wrongDraft.error,true);
 const expired=await call(url,'missing_ai_save_approved_context',{preview_id:draft,approval_proof:proof('alice',draft,{exp:Math.floor(Date.now()/1000)-20})});assert.equal(expired.error,true);
 const tampered=approved('alice',draft);tampered.approval_proof=tampered.approval_proof.slice(0,-4)+'0000';
 assert.equal((await call(url,'missing_ai_save_approved_context',tampered)).error,true);
 assert.equal((await call(url,'missing_ai_context_status')).value.note_count,0);
 assert.equal((await call(url,'missing_ai_save_approved_context',approved('alice',draft))).value.added,1);
}));
test('without independent approval signer configured, managed service cannot save approved notes',async()=>{
 const verifier=createVerifier({issuer,audience:resource,jwksUrl,fetchImpl:fakeFetch});
 const store=createStore({path:':memory:',allowMemory:true,key:randomBytes(32)});
 const {createManagedMcp}=await import('../managed-beta/mcp.mjs');
 const server=http.createServer(createManagedMcp({issuer,resource,store,verifyToken:verifier}));
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url=`http://127.0.0.1:${server.address().port}`;
 try{const draft=await call(url,'missing_ai_prepare_context_import',{notes:[note()]});
 assert.equal((await call(url,'missing_ai_save_approved_context',approved('alice',draft.value.preview_id))).error,true);
 assert.equal(store.count(tenant('alice')),0);
 }finally{await new Promise(ok=>server.close(ok));store.close();}
});

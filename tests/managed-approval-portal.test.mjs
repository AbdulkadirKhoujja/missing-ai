import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {generateKeyPairSync,createHash,randomBytes,sign} from 'node:crypto';
import {createApprovalPortal} from '../managed-beta/portal.mjs';
import {createStore} from '../managed-beta/store.mjs';
const issuer='https://login.example.test',authUrl=issuer+'/authorize',tokenUrl=issuer+'/token',jwksUrl=issuer+'/jwks',clientId='test-oidc-client';
const kp=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...kp.publicKey.export({format:'jwk'}),kid:'oidc-demo',use:'sig',alg:'RS256'};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const tenant=sub=>createHash('sha256').update(issuer+'\0'+sub).digest('hex');
let nonce='',challenge='',loginSub='alice',malformedNonce=false;
function idToken(sub=loginSub){const now=Math.floor(Date.now()/1000),h=enc({alg:'RS256',kid:'oidc-demo'});const b=enc({iss:issuer,aud:clientId,sub,nonce:malformedNonce?'not-the-correct-nonce':nonce,iat:now,exp:now+300});return `${h}.${b}.${sign('RSA-SHA256',Buffer.from(h+'.'+b),kp.privateKey).toString('base64url')}`;}
const providerFetch=async(url,options)=>{
 if(url===jwksUrl)return new Response(JSON.stringify({keys:[jwk]}),{status:200});
 if(url===tokenUrl){const f=new URLSearchParams(options.body);assert.equal(f.get('grant_type'),'authorization_code');assert.equal(f.get('client_id'),clientId);
  assert.equal(createHash('sha256').update(f.get('code_verifier')).digest('base64url'),challenge);
  return new Response(JSON.stringify({id_token:idToken()}),{status:200});
 }
 throw Error('Unexpected provider request');
};
async function fixture(fn){const store=createStore({path:':memory:',allowMemory:true,key:randomBytes(32)});let portal;const server=http.createServer((req,res)=>portal(req,res));await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`;
 portal=createApprovalPortal({store,issuer,clientId,authorizationUrl:authUrl,tokenUrl,jwksUrl,redirectUri:base+'/approve/callback',publicOrigin:base,fetchImpl:providerFetch,allowHttpForTests:true});
 try{await fn({base,store});}finally{await new Promise(ok=>server.close(ok));store.close();nonce='';challenge='';loginSub='alice';malformedNonce=false;}
}
function draft(store,sub='alice',text='Synthetic user context.'){return store.prepare(tenant(sub),[{conversation:'Example',text,role:'note',date:new Date().toISOString()}]);}
async function start(base,id){const res=await fetch(base+'/approve/start?draft='+id,{redirect:'manual'});const location=new URL(res.headers.get('location'));nonce=location.searchParams.get('nonce');challenge=location.searchParams.get('code_challenge');return {res,location,state:location.searchParams.get('state'),stateCookie:res.headers.get('set-cookie')?.match(/ma_auth_state=[0-9a-f]+/)?.[0]};}
async function callback(base,startInfo,{state=startInfo.state,cookie=startInfo.stateCookie,iss=issuer}={}){
 return fetch(base+'/approve/callback?code=synthetic-code&state='+encodeURIComponent(state)+'&iss='+encodeURIComponent(iss),{headers:{Cookie:cookie},redirect:'manual'});
}
function extractSession(r){return r.headers.get('set-cookie')?.match(/ma_approve_session=[0-9a-f]+/)?.[0];}
function csrfOf(page){return page.match(/name="csrf" value="([0-9a-f]+)"/)?.[1];}
async function approve(base,session,csrf,origin=base,approved=true){return fetch(base+'/approve/confirm',{method:'POST',headers:{Cookie:session,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,...(approved?{approved:'yes'}:{})}),redirect:'manual'});}

test('OIDC login + exact review + explicit browser approval saves into the same authenticated tenant',()=>fixture(async({base,store})=>{
 const id=draft(store),st=await start(base,id);
 assert.equal(st.res.status,303);assert.equal(st.location.origin,issuer);assert.equal(st.location.searchParams.get('code_challenge_method'),'S256');
 assert.equal(st.location.searchParams.get('response_type'),'code');assert.equal(st.location.searchParams.get('scope'),'openid');
 assert.equal(store.count(tenant('alice')),0);
 const cb=await callback(base,st);assert.equal(cb.status,303);
 const session=extractSession(cb);assert.ok(session);const review=await fetch(base+'/approve/review',{headers:{Cookie:session}});
 assert.equal(review.status,200);const body=await review.text();assert.match(body,/Synthetic user context/);
 const csrf=csrfOf(body);assert.ok(csrf);assert.equal(store.count(tenant('alice')),0);
 const committed=await approve(base,session,csrf);assert.equal(committed.status,200);
 assert.match(await committed.text(),/Imported 1 note/);
 assert.equal(store.count(tenant('alice')),1);
 const replay=await approve(base,session,csrf);assert.equal(replay.status,403);
}));
test('wrong OIDC user cannot view or import another tenant’s draft',()=>fixture(async({base,store})=>{
 const id=draft(store,'alice','Alice only account history'),st=await start(base,id);loginSub='bob';
 const cb=await callback(base,st);assert.equal(cb.status,403);
 assert.doesNotMatch(await cb.text(),/Alice only account history/);
 assert.equal(store.count(tenant('alice')),0);assert.equal(store.count(tenant('bob')),0);
}));
test('state cookie and OAuth issuer identification prevent login substitution',()=>fixture(async({base,store})=>{
 const id=draft(store),st=await start(base,id);
 assert.equal((await callback(base,st,{cookie:'ma_auth_state=forged'})).status,403);
 assert.equal((await callback(base,st,{state:'bad-state'})).status,403);
 assert.equal((await callback(base,st,{iss:'https://imposter.test'})).status,403);
 assert.equal(store.count(tenant('alice')),0);
}));
test('OIDC ID token nonce mismatch blocks sign-in',()=>fixture(async({base,store})=>{
 const st=await start(base,draft(store));malformedNonce=true;
 assert.equal((await callback(base,st)).status,403);
 assert.equal(store.count(tenant('alice')),0);
}));
test('CSRF, missing checkbox and cross-origin POST cannot authorize notes',()=>fixture(async({base,store})=>{
 const st=await start(base,draft(store));const cb=await callback(base,st);const session=extractSession(cb);
 const review=await fetch(base+'/approve/review',{headers:{Cookie:session}}),csrf=csrfOf(await review.text());
 assert.equal((await approve(base,session,'wrong')).status,403);
 assert.equal((await approve(base,session,csrf,'https://attacker.test')).status,403);
 assert.equal((await approve(base,session,csrf,base,false)).status,403);
 assert.equal(store.count(tenant('alice')),0);
 assert.equal((await approve(base,session,csrf)).status,200);
}));
test('untrusted note markup is HTML-escaped and no active script permitted',()=>fixture(async({base,store})=>{
 const st=await start(base,draft(store,'alice','<img src=x onerror=alert(1)> & <script>alert(2)</script>'));
 const cb=await callback(base,st);const r=await fetch(base+'/approve/review',{headers:{Cookie:extractSession(cb)}});
 const text=await r.text();assert.equal(r.status,200);assert.match(text,/&lt;img src=x/);assert.doesNotMatch(text,/<img src=x/);
 assert.match(r.headers.get('content-security-policy'),/default-src 'none'/);
 assert.equal(store.count(tenant('alice')),0);
}));
test('GET/cancel and missing session fail closed',()=>fixture(async({base,store})=>{
 const id=draft(store),st=await start(base,id),cb=await callback(base,st);const session=extractSession(cb);
 assert.equal((await fetch(base+'/approve/review')).status,403);
 assert.equal((await fetch(base+'/approve/confirm',{headers:{Cookie:session}})).status,404);
 const r=await fetch(base+'/approve/review',{headers:{Cookie:session}}),csrf=csrfOf(await r.text());
 const cancel=await fetch(base+'/approve/cancel',{method:'POST',headers:{Cookie:session,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf})});
 assert.equal(cancel.status,200);assert.equal(store.count(tenant('alice')),0);assert.equal(store.preview(tenant('alice'),id),null);
 assert.equal((await approve(base,session,csrf)).status,403);
}));

test('synthetic end-to-end: ChatGPT MCP prepare -> OIDC browser approval -> tenant-specific MCP retrieval',async()=>{
 const {createManagedBeta}=await import('../managed-beta/mcp.mjs');
 const now=Math.floor(Date.now()/1000),resource='https://managed.example.test';
 const access=sub=>{const h=enc({alg:'RS256',kid:'oidc-demo'}),b=enc({iss:issuer,aud:resource,sub,scope:'context:read context:write',iat:now,exp:now+600});return `${h}.${b}.${sign('RSA-SHA256',Buffer.from(h+'.'+b),kp.privateKey).toString('base64url')}`;};
 let portal,managed;const server=http.createServer((req,res)=>String(req.url).startsWith('/approve/')?portal(req,res):managed.handler(req,res));
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`;
 managed=createManagedBeta({issuer,audience:resource,jwksUrl,resource,dbPath:':memory:',encryptionKey:randomBytes(32),fetchImpl:providerFetch,allowMemory:true,approvalBase:base+'/approve/start'});
 portal=createApprovalPortal({store:managed.store,issuer,clientId,authorizationUrl:authUrl,tokenUrl,jwksUrl,redirectUri:base+'/approve/callback',publicOrigin:base,fetchImpl:providerFetch,allowHttpForTests:true});
 const mcp=async(sub,name,args={})=>{const r=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+access(sub)},body:JSON.stringify({jsonrpc:'2.0',id:23,method:'tools/call',params:{name,arguments:args}})});return (await r.json()).result.structuredContent;};
 try{
  const prepare=await mcp('alice','missing_ai_prepare_context_import',{notes:[{conversation:'Synthetic beta trial',text:'We verified the isolated tenant release.'}]});
  assert.equal(prepare.notes.length,1);assert.equal(prepare.approval_url,base+'/approve/start?draft='+prepare.preview_id);
  assert.equal((await mcp('alice','missing_ai_context_status')).note_count,0);
  const st=await start(base,prepare.preview_id),cb=await callback(base,st);
  assert.equal(cb.status,303);const session=extractSession(cb),review=await fetch(base+'/approve/review',{headers:{Cookie:session}});
  const text=await review.text();assert.match(text,/We verified the isolated tenant release/);
  assert.equal((await approve(base,session,csrfOf(text))).status,200);
  assert.equal((await mcp('alice','missing_ai_context_status')).note_count,1);
  assert.equal((await mcp('bob','missing_ai_context_status')).note_count,0);
  assert.equal((await mcp('alice','missing_ai_search_context',{query:'isolated tenant release'})).findings.length,1);
  assert.equal((await mcp('bob','missing_ai_search_context',{query:'isolated tenant release'})).findings.length,0);
  const toolList=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:22,method:'tools/list'})});
  assert.equal((await toolList.json()).result.tools.some(x=>x.name==='missing_ai_save_approved_context'),false);
 }finally{await new Promise(ok=>server.close(ok));managed.store.close();}
});

test('signed-in account portal exports, deletes notes and blocks other accounts',()=>fixture(async({base,store})=>{
 const alice=tenant('alice'),bob=tenant('bob');
 const save=(t,text)=>{const id=store.prepare(t,[{conversation:'Private task',text,role:'note',date:new Date().toISOString()}]);return store.commit(t,id);};
 save(alice,'ALICE-ONLY-REVIEWED-CONTEXT-EXAMPLE');save(bob,'BOB-ONLY-REVIEWED-CONTEXT-EXAMPLE');
 const st=await startAccount(base),cb=await callback(base,st);assert.equal(cb.status,303);assert.equal(cb.headers.get('location'),'/account/manage');
 const session=extractSession(cb);assert.ok(session);
 const page=await fetch(base+'/account/manage',{headers:{Cookie:session}}),html=await page.text();
 assert.equal(page.status,200);assert.match(html,/ALICE-ONLY/);assert.doesNotMatch(html,/BOB-ONLY/);
 const exportResult=await fetch(base+'/account/export',{headers:{Cookie:session}});const exportData=await exportResult.text();
 assert.equal(exportResult.status,200);assert.match(exportData,/ALICE-ONLY/);assert.doesNotMatch(exportData,/BOB-ONLY/);
 assert.match(exportResult.headers.get('content-disposition'),/attachment/);
 const csrf=csrfOf(html),aliceNote=store.list(alice)[0].id;
 const invalid=await fetch(base+'/account/delete',{method:'POST',headers:{Cookie:session,Origin:'https://imposter.test','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,note_id:aliceNote,approved:'yes'})});
 assert.equal(invalid.status,403);assert.equal(store.count(alice),1);
 const wrong=await fetch(base+'/account/delete',{method:'POST',headers:{Cookie:session,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,note_id:store.list(bob)[0].id,approved:'yes'})});
 assert.equal(wrong.status,403);assert.equal(store.count(bob),1);
 const correct=await fetch(base+'/account/delete',{method:'POST',headers:{Cookie:session,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,note_id:aliceNote,approved:'yes'})});
 assert.equal(correct.status,200);assert.equal(store.count(alice),0);assert.equal(store.count(bob),1);
}));
async function startAccount(base){const r=await fetch(base+'/account/start',{redirect:'manual'});const u=new URL(r.headers.get('location'));nonce=u.searchParams.get('nonce');challenge=u.searchParams.get('code_challenge');return {res:r,location:u,state:u.searchParams.get('state'),stateCookie:r.headers.get('set-cookie')?.match(/ma_auth_state=[0-9a-f]+/)?.[0]};}
test('account wipe requires exact typed phrase and browser approval, preserves other tenants',()=>fixture(async({base,store})=>{
 const a=tenant('alice'),b=tenant('bob');
 for(const [who,text] of [[a,'Alice sensitive demo'],[b,'Bob sensitive demo']]){const id=store.prepare(who,[{conversation:'Account',text,role:'note',date:new Date().toISOString()}]);store.commit(who,id);}
 const st=await startAccount(base),cb=await callback(base,st),session=extractSession(cb);
 const view=await fetch(base+'/account/manage',{headers:{Cookie:session}});const csrf=csrfOf(await view.text());
 async function wipe(phrase){return fetch(base+'/account/delete-all',{method:'POST',headers:{Origin:base,Cookie:session,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,approved:'yes',phrase})});}
 assert.equal((await wipe('wrong')).status,403);assert.equal(store.count(a),1);
 assert.equal((await wipe('DELETE ALL MY MISSING AI CONTEXT')).status,200);
 assert.equal(store.count(a),0);assert.equal(store.count(b),1);
 assert.equal((await wipe('DELETE ALL MY MISSING AI CONTEXT')).status,403);
}));
test('unsigned-in account management cannot read or export history',()=>fixture(async({base,store})=>{
 const id=store.prepare(tenant('alice'),[{conversation:'Secret demo',text:'Private demo content',role:'note',date:new Date().toISOString()}]);store.commit(tenant('alice'),id);
 for(const path of ['/account/manage','/account/export']){const r=await fetch(base+path);assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/Private demo content/);}
}));

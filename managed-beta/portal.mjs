// Browser-only approval portal prototype for an existing OAuth/OIDC provider.
// No password collection. End-user approval commits directly to the private tenant store.
// NEVER deploy without a real OIDC provider, HTTPS, independent security review and two-account tests.
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createVerifier} from './auth.mjs';
const MAX_POST=2048,STATE_MS=300_000,SESSION_MS=600_000;
const random=()=>randomBytes(32).toString('hex');
async function limitedResponse(res,max){const rd=res.body?.getReader();if(!rd)throw Error('Missing response');let n=0,parts=[];for(;;){const {done,value}=await rd.read();if(done)break;n+=value.byteLength;if(n>max){await rd.cancel().catch(()=>{});throw Error('Response too large');}parts.push(Buffer.from(value));}return Buffer.concat(parts);}
const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const htmlEscape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cookie(req,key){const raw=String(req.headers.cookie||'');const p=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='));return p?p.slice(key.length+1):'';}
async function formBody(req){let n=0,s='';for await(const chunk of req){n+=chunk.length;if(n>MAX_POST)throw Error('Invalid form');s+=chunk.toString('utf8');}return new URLSearchParams(s);}
const css=`:root{font-family:system-ui,sans-serif;color-scheme:light}body{margin:0;background:#f4f7fa;color:#172234}main{max-width:760px;margin:auto;padding:32px 18px 70px}section{border:1px solid #b4c0d0;padding:22px;background:white;border-radius:12px;margin-top:18px;overflow-wrap:anywhere}.note{border-top:1px solid #d0d9e3;margin-top:12px;padding-top:12px;white-space:pre-wrap;overflow-wrap:anywhere}button{font:inherit;min-height:44px;background:#173b32;color:white;border:0;border-radius:8px;padding:12px 18px;cursor:pointer}.note strong{display:block;margin-bottom:9px}.confirm{display:block;margin:20px 0;font-weight:600}.confirm input{width:20px;height:20px}.caution{color:#6f3b12}a{color:#153d8b}`;
function page(title,body){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)} — Missing AI</title><link href="/approve/styles.css" rel="stylesheet"></head><body><main><h1>${htmlEscape(title)}</h1>${body}</main></body></html>`;}
function errorPage(){return page('Approval unavailable','<p>Unable to complete approval. The link may have expired, been used already, or belongs to another account. Return to ChatGPT and prepare a new import.</p>');}
export function createApprovalPortal({store,issuer,clientId,authorizationUrl,tokenUrl,jwksUrl,redirectUri,publicOrigin,clientSecret,fetchImpl=fetch,clock=()=>Date.now(),allowHttpForTests=false}={}){
 if(!store||!issuer||!clientId||!authorizationUrl||!tokenUrl||!jwksUrl||!redirectUri||!publicOrigin)throw Error('OIDC approval portal configuration incomplete.');
 for(const u of [issuer,authorizationUrl,tokenUrl,jwksUrl,redirectUri,publicOrigin]){
  const p=new URL(u);if((p.protocol!=='https:'&&!allowHttpForTests)||p.username||p.password||p.hash)throw Error('Approval portal requires HTTPS configuration.');
 }
 const base=new URL(publicOrigin),redirect=new URL(redirectUri),auth=new URL(authorizationUrl);
 if(base.origin!==redirect.origin||redirect.pathname!=='/approve/callback')throw Error('OIDC callback must use the configured public portal origin.');
 const verifier=createVerifier({issuer,audience:clientId,jwksUrl,fetchImpl,clock,allowOpaqueAudience:true});
 const states=new Map(),sessions=new Map();
 function cleanup(){for(const [id,v] of states)if(v.expires<=clock())states.delete(id);for(const [id,v] of sessions)if(v.expires<=clock())sessions.delete(id);}
 const secure=allowHttpForTests?'':'; Secure';
 const stateCookie=id=>`ma_auth_state=${id}; HttpOnly; SameSite=Lax${secure}; Path=/; Max-Age=300`;
 const sessionCookie=id=>`ma_approve_session=${id}; HttpOnly; SameSite=Lax${secure}; Path=/; Max-Age=600`;
 const clearState=`ma_auth_state=; HttpOnly; SameSite=Lax${secure}; Path=/; Max-Age=0`;
 const clearSession=`ma_approve_session=; HttpOnly; SameSite=Lax${secure}; Path=/; Max-Age=0`;
 function respond(res,code,body,headers={}){res.writeHead(code,{'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers});res.end(body);}
 const msg=(res,code,title,body)=>respond(res,code,page(title,body),{'Content-Type':'text/html; charset=utf-8'});
 function loginSession(req){const key=cookie(req,'ma_approve_session');const s=sessions.get(key);return s&&s.expires>clock()?{id:key,...s}:null;}
 function reject(res){msg(res,403,'Approval unavailable','<p>Authorization is invalid or expired. Return to ChatGPT and prepare a new import.</p>');}
 return async function handler(req,res){
 try{
  cleanup();const url=new URL(req.url,'http://internal.invalid'),path=url.pathname;
  if(!allowHttpForTests&&req.headers.host!==base.host){reject(res);return;}
  if(path==='/approve/styles.css'&&req.method==='GET'){respond(res,200,css,{'Content-Type':'text/css; charset=utf-8'});return;}
  if((path==='/approve/start'||path==='/account/start')&&req.method==='GET'){
   const kind=path==='/account/start'?'manage':'import';
   const draft=kind==='import'?url.searchParams.get('draft'):null;
   if(kind==='import'&&(!draft||!/^[0-9a-f-]{36}$/.test(draft))){reject(res);return;}
   if(states.size>=300){respond(res,429,'Try again later');return;}
   const state=random(),nonce=random(),pkce=random();states.set(state,{draft,kind,nonce,pkce,expires:clock()+STATE_MS});
   const codeChallenge=createHash('sha256').update(pkce).digest('base64url');
   const target=new URL(auth.href);target.searchParams.set('response_type','code');target.searchParams.set('scope','openid');target.searchParams.set('client_id',clientId);target.searchParams.set('redirect_uri',redirectUri);target.searchParams.set('state',state);target.searchParams.set('nonce',nonce);target.searchParams.set('code_challenge',codeChallenge);target.searchParams.set('code_challenge_method','S256');
   respond(res,303,'',{'Location':target.href,'Set-Cookie':stateCookie(state)});return;
  }
  if(path==='/approve/callback'&&req.method==='GET'){
   const state=url.searchParams.get('state'),code=url.searchParams.get('code');const prepared=states.get(state);
   if(!prepared||!eq(state,cookie(req,'ma_auth_state'))||prepared.expires<=clock()||!code||code.length>1000||url.searchParams.get('iss')!==issuer){reject(res);return;}
   states.delete(state);
   try{
    const args=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri,client_id:clientId,code_verifier:prepared.pkce});
    if(clientSecret)args.set('client_secret',clientSecret);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
    let tokenResponse;
    try{tokenResponse=await fetchImpl(tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:args.toString(),redirect:'error',signal:controller.signal});}finally{clearTimeout(timer);}
    if(!tokenResponse.ok||Number(tokenResponse.headers.get('content-length')||0)>16_384)throw Error('Token exchange failed');
    const raw=await limitedResponse(tokenResponse,16_384);
    const token=JSON.parse(raw.toString('utf8'))?.id_token;
    const principal=await verifier('Bearer '+token,[],{nonce:prepared.nonce});
    if(prepared.kind==='import'&&!store.preview(principal.tenant,prepared.draft))throw Error('Draft expired');
    if(sessions.size>=500)throw Error('Too many pending approval sessions');
    const sid=random(),csrf=random();sessions.set(sid,{tenant:principal.tenant,draft:prepared.draft,kind:prepared.kind,csrf,expires:clock()+SESSION_MS});
    respond(res,303,'',{'Location':prepared.kind==='manage'?'/account/manage':'/approve/review','Set-Cookie':[clearState,sessionCookie(sid)]});return;
   }catch{msg(res,403,'Approval unavailable','<p>Sign-in could not be verified or this draft belongs to another account. Start again in ChatGPT.</p>');return;}
  }
  if(path==='/approve/review'&&req.method==='GET'){
   const s=loginSession(req);if(!s||s.kind!=='import'){reject(res);return;}
   const entries=store.preview(s.tenant,s.draft);if(!entries){reject(res);return;}
   const notes=entries.map(n=>`<article class="note"><strong>${htmlEscape(n.conversation)}</strong><div>${htmlEscape(n.text)}</div></article>`).join('');
   const body=`<p>Only the notes shown below will be saved in your Missing AI account. Review each one. Historical statements are not proof of current state.</p><section><h2>Review ${entries.length} note(s)</h2>${notes}</section><section><form action="/approve/confirm" method="POST"><input type="hidden" name="csrf" value="${htmlEscape(s.csrf)}"><label class="confirm"><input required type="checkbox" name="approved" value="yes"> I reviewed these notes and authorize saving them in my Missing AI account.</label><button type="submit">Save these notes privately</button></form></section>`;
   msg(res,200,'Approve Missing AI context',body);return;
  }
  if(path==='/approve/confirm'&&req.method==='POST'){
   const s=loginSession(req);
   if(!s||s.kind!=='import'||req.headers.origin!==base.origin||!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded')){reject(res);return;}
   try{const form=await formBody(req);if(!eq(form.get('csrf'),s.csrf)||form.get('approved')!=='yes')throw Error('Invalid approval');
    sessions.delete(s.id);const receipt=store.commit(s.tenant,s.draft);
    msg(res,200,'Context saved',`<p>Imported ${receipt.added} note(s); skipped ${receipt.duplicates} duplicate(s). You can return to ChatGPT and search your Missing AI context.</p>`);return;
   }catch{msg(res,403,'Approval unavailable','<p>The import was not completed. Return to ChatGPT and prepare a new import.</p>');return;}
  }
  if(path==='/approve/cancel'&&req.method==='POST'){
   const s=loginSession(req);
   if(!s||s.kind!=='import'||req.headers.origin!==base.origin||!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded')){reject(res);return;}
   try{const form=await formBody(req);if(!eq(form.get('csrf'),s.csrf))throw Error('Invalid CSRF');sessions.delete(s.id);store.cancel(s.tenant,s.draft);msg(res,200,'Import cancelled','<p>No context notes were saved.</p>');return;}
   catch{reject(res);return;}
  }
  if(path==='/account/manage'&&req.method==='GET'){
   const s=loginSession(req);if(!s||s.kind!=='manage'){reject(res);return;}
   const entries=store.list(s.tenant);
   const items=entries.map(n=>`<article class="note"><strong>${htmlEscape(n.conversation)}</strong><div>${htmlEscape(n.text.slice(0,500))}</div><form action="/account/delete" method="POST"><input type="hidden" name="csrf" value="${s.csrf}"><input type="hidden" name="note_id" value="${htmlEscape(n.id)}"><label class="confirm"><input required type="checkbox" name="approved" value="yes"> Delete this note</label><button type="submit">Delete selected note</button></form></article>`).join('');
   const body=`<p>Your approved context is listed below. You can export all notes or permanently delete selected notes. Deleting a note does not delete the AI provider's separate conversation record.</p><section><h2>${entries.length} saved note(s)</h2>${items||'<p>No saved notes in this account.</p>'}</section><section><a href="/account/export">Download my approved notes (unencrypted JSONL)</a><p class="caution">Downloads are not encrypted; protect the file on your device.</p></section><section><h2>Delete all context</h2><form method="POST" action="/account/delete-all"><input type="hidden" name="csrf" value="${s.csrf}"><label for="phrase">To remove all saved notes, type DELETE ALL MY MISSING AI CONTEXT</label><input id="phrase" name="phrase" required><label class="confirm"><input required type="checkbox" name="approved" value="yes"> I understand this removes notes from active Missing AI storage; backup retention may apply.</label><button type="submit">Delete all my context</button></form></section>`;
   msg(res,200,'Manage Missing AI context',body);return;
  }
  if(path==='/account/export'&&req.method==='GET'){
   const s=loginSession(req);if(!s||s.kind!=='manage'){reject(res);return;}
   const records=store.list(s.tenant).map(n=>JSON.stringify({conversation:n.conversation,text:n.text,role:'note',date:n.date}));
   respond(res,200,records.join('\n')+(records.length?'\n':''),{'Content-Type':'application/x-ndjson; charset=utf-8','Content-Disposition':'attachment; filename="missing-ai-approved-context.jsonl"'});return;
  }
  if((path==='/account/delete'||path==='/account/delete-all')&&req.method==='POST'){
   const s=loginSession(req);if(!s||s.kind!=='manage'||req.headers.origin!==base.origin||!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded')){reject(res);return;}
   try{
    const form=await formBody(req);if(!eq(form.get('csrf'),s.csrf)||form.get('approved')!=='yes')throw Error('No consent');
    if(path==='/account/delete'){
     const id=form.get('note_id');if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid note');
     const n=store.delete(s.tenant,id);if(!n)throw Error('Not found');
     msg(res,200,'Note deleted','<p>The selected Missing AI context note has been removed from active storage.</p><p><a href="/account/manage">Return to my notes</a></p>');return;
    }
    if(form.get('phrase')!=='DELETE ALL MY MISSING AI CONTEXT')throw Error('Missing full deletion confirmation');
    const n=store.deleteAll(s.tenant);sessions.delete(s.id);
    msg(res,200,'Context deleted',`<p>Removed ${n} note(s) from active storage and cancelled pending drafts. Encrypted backups, if any, follow the published retention policy.</p>`);return;
   }catch{reject(res);return;}
  }
  respond(res,404,'Not found');
 }catch{if(!res.headersSent){msg(res,500,'Request unavailable','<p>Unable to complete this request. Try signing in again.</p>');}else if(!res.writableEnded)res.end();}
 };
}

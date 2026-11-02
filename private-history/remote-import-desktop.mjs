// Opt-in desktop bridge for a user-owned SSH server. Nothing listens beyond 127.0.0.1.
// No account credentials, context notes or SSH keys go into GitHub or query strings.
import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {lstat} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseContextPack,CONTEXT_LIMITS} from '../site/context-onboarding.mjs';
const BODY_LIMIT=CONTEXT_LIMITS.packBytes+4096, EXPIRY=5*60*1000;
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Missing AI — Private remote import</title><link rel="stylesheet" href="/remote-import.css"></head><body><main><h1>Import to your private Missing AI</h1><p>Notes are reviewed on this device, then securely transferred over your existing SSH connection to your private server. No public upload, model history sync or cloud storage is involved.</p><p class="warn">Use only your own non-sensitive notes. Never paste SSH keys, API tokens or confidential third-party information. The remote connection is configured separately and this page stays on your computer.</p><section><h2>1. Select the context</h2><label for="title">Source or project</label><input id="title" maxlength="160" placeholder="My project handoff"><label for="summary">Reviewed summary</label><textarea id="summary" rows="8" maxlength="15000" placeholder="What was decided, completed and remains open…"></textarea><p>Or choose your approved Missing AI JSONL context pack:</p><input id="pack" type="file" accept=".jsonl,application/x-ndjson,text/plain"><button id="review">Review notes locally</button></section><section><h2>2. Approve each note</h2><p>Select exactly what may be sent to your private server.</p><div id="notes" role="status" aria-live="polite">Nothing reviewed yet.</div><button id="preview" disabled>Check approved notes with my private server</button></section><section><h2>3. Confirm private import</h2><div id="outcome" role="status" aria-live="polite">No remote import prepared.</div><label class="approval"><input id="consent" type="checkbox" disabled> I reviewed the selected notes, have permission to use them, and approve writing these notes to my private history.</label><button id="commit" disabled>Import approved notes</button></section><p class="minor">Your ChatGPT MCP reader remains read-only. A preview expires after five minutes; close this local companion to stop it.</p></main><script type="module" src="/remote-import.js"></script></body></html>`;
const css=`:root{color-scheme:dark;font-family:system-ui,sans-serif}body{margin:0;background:#091422;color:#eef5ff}main{max-width:800px;margin:auto;padding:32px 18px 70px}section{background:#152235;border:1px solid #475c78;border-radius:14px;padding:20px;margin:20px 0}p{line-height:1.65}label{display:block;font-weight:650;margin:16px 0 8px}input:not([type]),textarea{box-sizing:border-box;width:100%;padding:12px;background:#081321;color:#fff;border:1px solid #617997;border-radius:7px;font:inherit}textarea{resize:vertical}button{cursor:pointer;background:#9ee7c3;color:#062016;border:0;border-radius:8px;padding:11px 16px;font:inherit;font-weight:700;min-height:44px;margin:12px 0}button:disabled{opacity:.45;cursor:default}input[type=file]{max-width:100%}.warn{border-left:4px solid #e6c98b;padding:10px 14px;background:#252b35}.entry{border-top:1px solid #4b607b;padding:12px 0;white-space:pre-wrap;overflow-wrap:anywhere}.entry label{display:flex;align-items:start;gap:10px}.entry input,.approval input{width:20px;height:20px;flex:none;margin-top:2px}.approval{display:flex;gap:10px;align-items:start}.minor{color:#b9cde0;font-size:.9em}:focus-visible{outline:3px solid #b4f4d1;outline-offset:3px}`;
const js=`import {makeContextEntries,parseContextPack,serializeContextPack} from '/context-onboarding.mjs';
const el=id=>document.getElementById(id);let token='',entries=[],pending='';
const report=(id,s)=>el(id).textContent=s;
function reset(){pending='';el('consent').checked=false;el('consent').disabled=true;el('commit').disabled=true;el('preview').disabled=true;}
for(const id of ['title','summary'])el(id).addEventListener('input',()=>{reset();entries=[];report('notes','Content changed. Review again.');});
el('pack').addEventListener('change',()=>{reset();entries=[];report('notes','File changed. Review again.');});
el('review').addEventListener('click',async()=>{reset();try{const file=el('pack').files?.[0];if(file&&file.size>2097152)throw Error('File exceeds 2 MB.');entries=file?parseContextPack(await file.text()):makeContextEntries(el('title').value,el('summary').value);const dest=el('notes');dest.replaceChildren();entries.forEach((entry,i)=>{const box=document.createElement('article');box.className='entry';const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.dataset.index=String(i);const heading=document.createElement('strong');heading.textContent=entry.conversation;label.append(check,heading);const text=document.createElement('p');text.textContent=entry.text;box.append(label,text);dest.append(box);check.addEventListener('change',()=>{pending='';el('consent').disabled=true;el('consent').checked=false;el('commit').disabled=true;el('preview').disabled=!selected().length;});});report('outcome','Select notes for a remote preview. No context has been sent.');}catch(e){entries=[];report('notes',e.message);}});
function selected(){return [...el('notes').querySelectorAll('input[type=checkbox]:checked')].map(x=>entries[Number(x.dataset.index)]);}
async function post(path,data){const r=await fetch(path,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Missing-AI-Session':token},body:JSON.stringify(data)});const body=await r.json();if(!r.ok)throw Error(body.error||'Import failed.');return body;}
el('preview').addEventListener('click',async()=>{try{const approved=selected();if(!approved.length)throw Error('Select at least one note.');el('preview').disabled=true;report('outcome','Checking private history over SSH…');const result=await post('/api/preview',{pack:serializeContextPack(approved)});pending=result.local_approval;report('outcome','Private history currently has '+result.existing+' event(s). New: '+result.new+'. Duplicates: '+result.duplicates+'. Review your selected notes again and confirm.');el('consent').disabled=false;}catch(e){report('outcome',e.message);}finally{el('preview').disabled=!selected().length;}});
el('consent').addEventListener('change',()=>{el('commit').disabled=!(pending&&el('consent').checked);});
el('commit').addEventListener('click',async()=>{if(!pending||!el('consent').checked)return;if(!window.confirm('Import ONLY the selected notes shown into your private remote history over SSH?'))return;const approval=pending;reset();report('outcome','Importing via SSH…');try{const out=await post('/api/commit',{local_approval:approval});report('outcome','Import complete: '+out.new+' new note(s); '+out.duplicates+' duplicates skipped. Your private ChatGPT reader can refresh on its next call.');}catch(e){report('outcome',e.message+' Please preview again.');}});
fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(x=>{token=x.token;}).catch(()=>report('outcome','Local session unavailable.'));
`;
function compare(a,b){return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function respond(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function readJson(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>BODY_LIMIT)throw Error('Request exceeds 2 MB.');chunks.push(chunk);}const obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Expected a JSON object.');return obj;}
export function sshRunner({destination,key,command='/usr/local/sbin/missing-ai-private-import',spawnProcess=spawn}={}){
 if(typeof destination!=='string'||!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(destination))throw Error('SSH destination must be a trusted user@host.');
 if(typeof key!=='string'||!isAbsolute(key))throw Error('SSH identity file must have an absolute path.');
 if(command!=='/usr/local/sbin/missing-ai-private-import')throw Error('Remote command must be the reviewed, fixed private import entrypoint.');
 return async request=>{
  const st=await lstat(key);if(!st.isFile()||st.isSymbolicLink())throw Error('SSH key must be a regular local file.');
  return await new Promise((ok,fail)=>{
   let stdout='',total=0,settled=false;
   const args=['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10','-o','ClearAllForwardings=yes','-o','LogLevel=ERROR','-i',key,destination,command];
   const child=spawnProcess('ssh',args,{shell:false,stdio:['pipe','pipe','pipe'],windowsHide:true});
   const timer=setTimeout(()=>{child.kill();finish(Error('Remote import connection timed out.'));},30000);
   function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);if(error)fail(error);else ok(value);}
   child.on('error',()=>finish(Error('SSH could not start.')));
   child.stdout.on('data',chunk=>{total+=chunk.length;if(total>8192){child.kill();finish(Error('Remote response was too large.'));return;}stdout+=chunk.toString('utf8');});
   child.stderr.on('data',()=>{}); // Deliberately never expose stderr or note contents in the UI.
   child.on('close',code=>{if(code!==0){finish(Error('Remote SSH import failed. Check private server setup and SSH access.'));return;}try{const parsed=JSON.parse(stdout.trim());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!['previewed','imported','cancelled'].includes(parsed.status))throw Error();finish(null,parsed);}catch{finish(Error('Remote response is not a valid import receipt.'));}});
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(request));
  });
 };
}
export async function createRemoteDesktopServer({executeRemote,port=0,host='127.0.0.1'}={}){
 if(host!=='127.0.0.1'||typeof executeRemote!=='function')throw Error('Local loopback and an authenticated private transport are required.');
 const session=randomBytes(32).toString('hex');let pending=null,busy=false,previews=0,windowStart=Date.now();
 const server=http.createServer(async(req,res)=>{
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const [k,v] of Object.entries({'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Cross-Origin-Opener-Policy':'same-origin'}))res.setHeader(k,v);
  if(req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!==`127.0.0.1:${server.address().port}`){respond(res,403,{error:'Direct loopback access only.'});return;}
  if(req.method==='GET'){
   const content={'/':[html,'text/html'], '/remote-import.js':[js,'text/javascript'],'/remote-import.css':[css,'text/css'],'/context-onboarding.mjs':[await import('node:fs/promises').then(fs=>fs.readFile(new URL('../site/context-onboarding.mjs',import.meta.url),'utf8')),'text/javascript']};
   if(req.url==='/api/session'){respond(res,200,{token:session});return;}
   const match=content[req.url];if(!match){respond(res,404,{error:'Not found.'});return;}
   res.writeHead(200,{'Content-Type':match[1]+'; charset=utf-8'});res.end(match[0]);return;
  }
  if(req.method!=='POST'||!['/api/preview','/api/commit','/api/cancel'].includes(req.url)){respond(res,404,{error:'Not found.'});return;}
  if(req.headers.origin!==origin||!compare(req.headers['x-missing-ai-session'],session)||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){respond(res,403,{error:'Origin or session rejected.'});return;}
  if(busy){respond(res,409,{error:'Another import is in progress.'});return;}busy=true;
  try{
   const body=await readJson(req);
   if(req.url==='/api/preview'){
    if(Date.now()-windowStart>5*60*1000){windowStart=Date.now();previews=0;}
    if(++previews>20)throw Error('Too many previews; retry after five minutes.');
    const pack=body.pack;parseContextPack(pack);
    if(pending){const previous=pending.remote_id;pending=null;await executeRemote({op:'cancel',approval_id:previous}).catch(()=>{});}
    const remote=await executeRemote({op:'preview',pack});if(remote.status!=='previewed'||typeof remote.approval_id!=='string')throw Error('Remote preview not acknowledged.');
    const local_approval=randomBytes(32).toString('hex');pending={remote_id:remote.approval_id,local_approval,expires:Date.now()+EXPIRY};
    respond(res,200,{existing:remote.existing,new:remote.new,duplicates:remote.duplicates,local_approval});
   }else if(req.url==='/api/commit'){
    if(!pending||Date.now()>pending.expires||!compare(body.local_approval,pending.local_approval)){pending=null;respond(res,409,{error:'Preview expired or already used.'});return;}
    const id=pending.remote_id;pending=null;
    const result=await executeRemote({op:'commit',approval_id:id});if(result.status!=='imported')throw Error('Remote import was not acknowledged.');respond(res,200,{new:result.new,duplicates:result.duplicates});
   }else{
    if(pending){const id=pending.remote_id;pending=null;await executeRemote({op:'cancel',approval_id:id});}
    respond(res,200,{status:'cancelled'});
   }
  }catch(e){respond(res,400,{error:String(e.message||'Import rejected.').slice(0,150)});}finally{busy=false;}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,host,()=>{server.off('error',fail);ok();});});
 return {server,url:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise((ok,fail)=>server.close(e=>e?fail(e):ok()))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const port=process.env.MISSING_AI_REMOTE_DESKTOP_PORT===undefined?0:Number(process.env.MISSING_AI_REMOTE_DESKTOP_PORT);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid local port.');const executeRemote=sshRunner({destination:process.env.MISSING_AI_REMOTE_SSH_DEST,key:process.env.MISSING_AI_REMOTE_SSH_KEY});const {url}=await createRemoteDesktopServer({executeRemote,port});process.stdout.write('PRIVATE_REMOTE_IMPORT_READY '+url+'\nOpen this address on your own computer. Ctrl+C stops the companion.\n');}
 catch(e){process.stderr.write('Remote import companion could not start: '+e.message+'\n');process.exitCode=2;}
}

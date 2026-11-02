// Optional local-only, user-controlled import UI. It is NOT an MCP write tool or hosted API.
// No packages, outbound requests, analytics, or permanent session tokens.
import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdtemp,writeFile,rm,lstat} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeContextEntries,parseContextPack,serializeContextPack,CONTEXT_LIMITS} from '../site/context-onboarding.mjs';
import {importContextPack} from './import-context-pack.mjs';

const BODY_LIMIT=CONTEXT_LIMITS.packBytes+1024;
const SESSION_LIFETIME=5*60*1000;
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Private context import — Missing AI</title><link rel="stylesheet" href="/local-import.css"></head><body><main><h1>Import context privately</h1><p>This page runs on <strong>your device</strong>. Your approved notes go only to the private history directory configured for this local companion. No ChatGPT or Missing AI hosted upload occurs.</p><p class="warning">Import only your own reviewed notes. Do not include passwords, tokens, or third-party confidential data. Imported notes are historical claims, not live proof.</p><section><h2>1. Prepare</h2><label for="title">Conversation or project title</label><input id="title" maxlength="160" placeholder="My project handoff"><label for="summary">Approved handoff or selected conversation excerpt</label><textarea id="summary" maxlength="15000" rows="8" placeholder="Decisions, verified completions, outstanding tasks…"></textarea><p class="minor">Or select a previously downloaded Missing AI context pack (.jsonl).</p><input type="file" id="pack" accept=".jsonl,application/x-ndjson,text/plain"><button id="preview">Preview private import</button></section><section><h2>2. Review and approve</h2><div id="results" role="status" aria-live="polite">No import prepared.</div><label class="approval"><input type="checkbox" id="approve" disabled> I reviewed the exact notes shown, I have permission to import them, and removed sensitive material.</label><button id="commit" disabled>Import approved notes to my private history</button></section><p class="minor">This local companion is optional. The connected ChatGPT history search remains read-only. Close this process when finished; pending previews expire after five minutes.</p></main><script src="/local-import.js" defer></script></body></html>`;
const css=`:root{color-scheme:dark;font-family:system-ui,Arial,sans-serif}body{margin:0;background:#091422;color:#eaf1ff}main{max-width:800px;margin:auto;padding:36px 18px 70px}h1{font-size:clamp(28px,5vw,42px)}h2{font-size:21px}p{line-height:1.65}section{border:1px solid #445b76;border-radius:14px;padding:22px;margin-top:22px;background:#152234}label{display:block;margin:18px 0 8px;font-weight:650}input[type=text],input:not([type]),textarea{box-sizing:border-box;width:100%;font:inherit;color:#fff;background:#081321;border:1px solid #6b809d;border-radius:7px;padding:12px}textarea{resize:vertical}button{background:#9ee7c3;color:#072016;font:inherit;font-weight:700;border:0;border-radius:8px;padding:12px 16px;min-height:44px;cursor:pointer;margin-top:16px}button:disabled{opacity:.5;cursor:default}.warning{padding:12px 16px;border-left:4px solid #e6cd96;background:#252c35}.minor{font-size:.91em;color:#cad5e6}.approval{display:flex;gap:10px;align-items:flex-start}.approval input{width:20px;height:20px;flex:none}.note{white-space:pre-wrap;overflow-wrap:anywhere;border-top:1px solid #536581;padding-top:12px;margin-top:12px}#results{overflow-wrap:anywhere}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #a8eac8;outline-offset:2px}`;
const js=`(()=>{
 const el=id=>document.getElementById(id),result=el('results');
 let requestToken='',pending='',fileText=null;
 const clear=()=>{pending='';el('approve').checked=false;el('approve').disabled=true;el('commit').disabled=true;};
 const msg=s=>{result.replaceChildren();result.textContent=s;};
 for(const id of ['title','summary'])el(id).addEventListener('input',()=>{clear();msg('Content changed. Preview again before importing.');});
 el('pack').addEventListener('change',async()=>{clear();fileText=null;try{const f=el('pack').files?.[0];if(!f)return;if(!f.name.endsWith('.jsonl')||f.size>2097152)throw Error('Choose a Missing AI .jsonl file under 2 MB.');fileText=await f.text();el('title').disabled=true;el('summary').disabled=true;msg('File selected. Preview the exact entries before approving.');}catch(e){msg(e.message);}});
 const post=async(path,payload)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Missing-AI-Session':requestToken},body:JSON.stringify(payload),cache:'no-store'});let b;try{b=await r.json();}catch{throw Error('Local companion returned an invalid response.');}if(!r.ok)throw Error(b.error||'Import rejected.');return b;};
 el('preview').addEventListener('click',async()=>{clear();msg('Checking locally…');try{
  const payload=fileText!==null?{pack:fileText}:{title:el('title').value,summary:el('summary').value};
  const data=await post('/api/preview',payload);pending=data.approval_token;
  result.replaceChildren();const p=document.createElement('p');p.textContent='Current entries: '+data.existing+'. New: '+data.new+'. Duplicates: '+data.duplicates+'.';result.append(p);
  for(const note of data.notes){const n=document.createElement('div');n.className='note';n.textContent=note.conversation+' — reviewed note\\n'+note.text;result.append(n);}
  el('approve').disabled=false;
 }catch(e){msg(e.message);}});
 el('approve').addEventListener('change',()=>{el('commit').disabled=!(pending&&el('approve').checked);});
 el('commit').addEventListener('click',async()=>{if(!pending||!el('approve').checked)return;
  if(!window.confirm('Import exactly the notes shown into your local private history?'))return;
  const token=pending;clear();msg('Importing locally…');
  try{const out=await post('/api/commit',{approval_token:token});msg('Import complete. '+out.new+' new note(s), '+out.duplicates+' duplicate(s) skipped. The read-only history connector can refresh on its next call.');}
  catch(e){msg(e.message);}
 });
 fetch('/api/session',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Local session unavailable.');return r.json();}).then(x=>{requestToken=x.token;}).catch(e=>msg(e.message));
})();`;

async function stageImport(folder,pack,apply){
 const temp=await mkdtemp(join(folder,'.missing-ai-review-'));
 try{const stage=join(temp,'reviewed-notes.jsonl');await writeFile(stage,pack,{mode:0o600,flag:'wx'});return await importContextPack({folder,packPath:stage,apply});}
 finally{await rm(temp,{recursive:true,force:true});}
}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
function errorJson(res,code,detail){json(res,code,{error:detail});}
async function receiveJson(req){
 let len=0;const parts=[];
 for await (const chunk of req){len+=chunk.length;if(len>BODY_LIMIT)throw Error('Payload exceeds 2 MB.');parts.push(chunk);}
 try{const parsed=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed;}
 catch{throw Error('Expected a JSON object.');}
}
function sameToken(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;return timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export async function createLocalImportServer({folder,host='127.0.0.1',port=0}={}){
 if(typeof folder!=='string'||!isAbsolute(folder))throw Error('Set MISSING_AI_HISTORY_DIR to an absolute private folder.');
 if(host!=='127.0.0.1')throw Error('Local importer may only bind to 127.0.0.1.');
 const dir=resolve(folder),stat=await lstat(dir);
 if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||typeof process.getuid==='function'&&process.getuid()!==stat.uid)throw Error('History folder must be owner-private (0700) and owned by this process.');
 let pending=null,busy=false;
 const token=randomBytes(32).toString('hex');
 const server=http.createServer(async(req,res)=>{
  const address=server.address();
  const origin=`http://127.0.0.1:${address.port}`;
  for(const [key,value] of Object.entries({'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Cross-Origin-Opener-Policy':'same-origin'}))res.setHeader(key,value);
  if(req.headers.host!==`127.0.0.1:${address.port}`||req.socket.remoteAddress!=='127.0.0.1'){errorJson(res,403,'Only direct loopback access is permitted.');return;}
  if(req.method==='GET'){
   if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return;}
   if(req.url==='/local-import.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(js);return;}
   if(req.url==='/local-import.css'){res.writeHead(200,{'Content-Type':'text/css; charset=utf-8'});res.end(css);return;}
   if(req.url==='/api/session'){json(res,200,{token});return;}
   errorJson(res,404,'Not found.');return;
  }
  if(req.method!=='POST'||!['/api/preview','/api/commit'].includes(req.url)){errorJson(res,404,'Not found.');return;}
  if(req.headers.origin!==origin||!sameToken(req.headers['x-missing-ai-session'],token)||!/application\/json/i.test(String(req.headers['content-type']||''))){errorJson(res,403,'Origin, session or content type not authorized.');return;}
  if(busy){errorJson(res,409,'An import operation is already running.');return;}
  busy=true;
  try{
   const body=await receiveJson(req);
   if(req.url==='/api/preview'){
    const entries=body.pack!==undefined?parseContextPack(body.pack):makeContextEntries(body.title,body.summary);
    const pack=serializeContextPack(entries);
    const counts=await stageImport(dir,pack,false);
    const approval_token=randomBytes(32).toString('hex');
    pending={approval_token,pack,expires:Date.now()+SESSION_LIFETIME};
    json(res,200,{...counts,notes:entries,approval_token});
   }else{
    if(!pending||Date.now()>pending.expires||!sameToken(body.approval_token,pending.approval_token)){pending=null;errorJson(res,409,'Preview expired or approval token invalid; review again.');return;}
    const pack=pending.pack;pending=null;
    const result=await stageImport(dir,pack,true);
    json(res,200,result);
   }
  }catch(e){errorJson(res,400,String(e.message||'Private import rejected.').slice(0,180));}
  finally{busy=false;}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',()=>{server.off('error',fail);ok();});});
 return {server,url:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const rawPort=process.env.MISSING_AI_LOCAL_IMPORT_PORT;const port=rawPort===undefined?0:Number(rawPort);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid local import port.');const {url}=await createLocalImportServer({folder:process.env.MISSING_AI_HISTORY_DIR,port});process.stdout.write('PRIVATE_ONBOARDING_READY '+url+'\nOpen this local URL on the same device. Ctrl+C to stop.\n');}
 catch(e){process.stderr.write('Local private onboarding unavailable: '+e.message+'\n');process.exitCode=2;}
}

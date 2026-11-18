import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,chmod,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalImportServer} from '../private-history/local-import-server.mjs';
import {makeContextEntries,serializeContextPack} from '../site/context-onboarding.mjs';

async function fixture(fn){
 const root=await mkdtemp(join(tmpdir(),'missing-ai-local-import-'));const folder=join(root,'private');
 await mkdir(folder,{mode:0o700}); await chmod(folder,0o700);
 let svc;try{svc=await createLocalImportServer({folder});await fn({root,folder,...svc});}finally{await svc?.close();await rm(root,{recursive:true,force:true});}
}
async function post(url,path,body,token,origin=url.slice(0,-1)){const r=await fetch(url+path,{method:'POST',headers:{'content-type':'application/json','origin':origin,'x-missing-ai-session':token},body:JSON.stringify(body)});return {code:r.status,result:await r.json(),headers:r.headers};}
const example={title:'Demo onboarding',summary:'The staging demonstration has been completed and verified.'};
test('private onboarding binds strictly to loopback and rejects other bind addresses',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'missing-ai-local-import-'));
 try{await assert.rejects(createLocalImportServer({folder,host:'0.0.0.0'}),/127\.0\.0\.1/);await assert.rejects(createLocalImportServer({folder:'relative'}),/absolute/);}finally{await rm(folder,{recursive:true,force:true});}
});
test('preview is read-only; explicit second approval imports notes once; duplicates skipped',()=>fixture(async({url,folder})=>{
 const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/Import context privately/);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(page.headers.get('access-control-allow-origin'),null);
 const {token}=await (await fetch(url+'api/session')).json();
 const preview=await post(url,'api/preview',example,token);assert.equal(preview.code,200);assert.equal(preview.result.new,1);
 const target=join(folder,'agent-events.jsonl');await assert.rejects(readFile(target,'utf8'),{code:'ENOENT'});
 const saved=await post(url,'api/commit',{approval_token:preview.result.approval_token},token);assert.equal(saved.code,200);assert.equal(saved.result.new,1);
 assert.match(await readFile(target,'utf8'),/staging demonstration/);
 const replay=await post(url,'api/commit',{approval_token:preview.result.approval_token},token);assert.equal(replay.code,409);
 const second=await post(url,'api/preview',example,token);assert.equal(second.code,200);assert.equal(second.result.duplicates,1);
 const done=await post(url,'api/commit',{approval_token:second.result.approval_token},token);assert.equal(done.result.new,0);
 assert.equal((await readFile(target,'utf8')).trim().split('\n').length,1);
}));
test('rejects cross origin requests and forged tokens without writing history',()=>fixture(async({url,folder})=>{
 const {token}=await (await fetch(url+'api/session')).json();
 assert.equal((await post(url,'api/preview',example,token,'https://untrusted.example')).code,403);
 assert.equal((await post(url,'api/preview',example,'bad-token')).code,403);
 const response=await fetch(url+'api/preview',{method:'POST',headers:{origin:url.slice(0,-1),'x-missing-ai-session':token,'content-type':'text/plain'},body:JSON.stringify(example)});
 assert.equal(response.status,403);
 await assert.rejects(readFile(join(folder,'agent-events.jsonl'),'utf8'),{code:'ENOENT'});
}));
test('rejects explicit role spoofing, invalid packs and common credential patterns',()=>fixture(async({url,folder})=>{
 const {token}=await (await fetch(url+'api/session')).json();
 const pack=serializeContextPack(makeContextEntries('Demo','Reviewed handoff.'));
 const record=JSON.parse(pack);
 const x=await post(url,'api/preview',{pack:JSON.stringify({...record,role:'assistant'})+'\n'},token);assert.equal(x.code,400);
 const y=await post(url,'api/preview',{title:'Demo',summary:'sk-'+'a'.repeat(30)},token);assert.equal(y.code,400);
 const z=await post(url,'api/preview',{pack:'{bad\n'},token);assert.equal(z.code,400);
 await assert.rejects(readFile(join(folder,'agent-events.jsonl'),'utf8'),{code:'ENOENT'});
}));
test('refuses world-readable, symlinked, or differently-owned private directories',async()=>{
 const root=await mkdtemp(join(tmpdir(),'missing-ai-local-import-'));
 try{
 const dir=join(root,'history');await mkdir(dir);await chmod(dir,0o755);
 await assert.rejects(createLocalImportServer({folder:dir}),/owner-private/);
 await chmod(dir,0o700);const link=join(root,'history-link');await symlink(dir,link);
 await assert.rejects(createLocalImportServer({folder:link}),/owner-private/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('malformed existing history fails closed and remains unchanged',()=>fixture(async({url,folder})=>{
 const file=join(folder,'agent-events.jsonl');await writeFile(file,'{invalid-history\n',{mode:0o600});
 const {token}=await (await fetch(url+'api/session')).json();
 const out=await post(url,'api/preview',example,token);assert.equal(out.code,400);
 assert.equal(await readFile(file,'utf8'),'{invalid-history\n');
}));

test('rejects DNS-rebinding-style Host header and returns non-executable JS with strict CSP',()=>fixture(async({url})=>{
 const {request}=await import('node:http');
 const bad=await new Promise(resolve=>{const req=request(url,{headers:{Host:'other.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.end();});
 assert.equal(bad,403);
 const response=await fetch(url+'local-import.js');
 assert.equal(response.status,200);
 const js=await response.text();
 assert.match(js,/approval_token/);
 assert.match(response.headers.get('content-security-policy'),/connect-src 'self'/);
 const {Script}=await import('node:vm');
 assert.doesNotThrow(()=>new Script(js));
}));

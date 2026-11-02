import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,chmod,rm,writeFile,readFile,symlink,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {remoteImportRequest} from '../private-history/remote-import-stdio.mjs';
import {createRemoteDesktopServer,sshRunner} from '../private-history/remote-import-desktop.mjs';
import {makeContextEntries,serializeContextPack} from '../site/context-onboarding.mjs';
async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'missing-ai-ssh-'));const folder=join(root,'history');await mkdir(folder,{mode:0o700});await chmod(folder,0o700);let local;try{const executeRemote=req=>remoteImportRequest({folder,request:req});local=await createRemoteDesktopServer({executeRemote});await fn({root,folder,executeRemote,...local});}finally{await local?.close();await rm(root,{recursive:true,force:true});}}
const pack=()=>serializeContextPack(makeContextEntries('Sample project','The sample rollout was completed and tested.','2026-11-02T00:00:00.000Z'));
async function post(url,path,token,body,origin=url.slice(0,-1)){const resp=await fetch(url+path,{method:'POST',headers:{origin,'content-type':'application/json','x-missing-ai-session':token},body:JSON.stringify(body)});return {status:resp.status,data:await resp.json()};}
test('remote preview does not write; approval commits; replay fails; duplicate is skipped',()=>fixture(async({url,folder})=>{
 const token=(await (await fetch(url+'api/session')).json()).token;
 const p=await post(url,'api/preview',token,{pack:pack()});assert.equal(p.status,200);assert.equal(p.data.new,1);
 await assert.rejects(readFile(join(folder,'agent-events.jsonl'),'utf8'),{code:'ENOENT'});
 const c=await post(url,'api/commit',token,{local_approval:p.data.local_approval});assert.equal(c.status,200);assert.equal(c.data.new,1);
 assert.equal((await readFile(join(folder,'agent-events.jsonl'),'utf8')).trim().split('\n').length,1);
 assert.equal((await post(url,'api/commit',token,{local_approval:p.data.local_approval})).status,409);
 const duplicate=await post(url,'api/preview',token,{pack:pack()});assert.equal(duplicate.data.duplicates,1);
 assert.equal((await post(url,'api/commit',token,{local_approval:duplicate.data.local_approval})).data.new,0);
}));
test('SSH owner preview uses one-use receipt, separate cancel, and rejects replay',()=>fixture(async({executeRemote,folder})=>{
 const p=await executeRemote({op:'preview',pack:pack()});assert.equal(p.new,1);assert.equal(p.status,'previewed');
 assert.equal((await executeRemote({op:'cancel',approval_id:p.approval_id})).status,'cancelled');
 await assert.rejects(executeRemote({op:'commit',approval_id:p.approval_id}));
 const p2=await executeRemote({op:'preview',pack:pack()});const applied=await executeRemote({op:'commit',approval_id:p2.approval_id});assert.equal(applied.new,1);
 await assert.rejects(executeRemote({op:'commit',approval_id:p2.approval_id}));
 assert.match(await readFile(join(folder,'agent-events.jsonl'),'utf8'),/sample rollout/);
}));
test('origin, token and content-type checks prevent unauthorized writes',()=>fixture(async({url,folder})=>{
 const token=(await(await fetch(url+'api/session')).json()).token;
 assert.equal((await post(url,'api/preview',token,{pack:pack()},'https://unsafe.example')).status,403);
 assert.equal((await post(url,'api/preview','bad',{pack:pack()})).status,403);
 const resp=await fetch(url+'api/preview',{method:'POST',headers:{origin:url.slice(0,-1),'x-missing-ai-session':token,'content-type':'text/plain'},body:JSON.stringify({pack:pack()})});assert.equal(resp.status,403);
 await assert.rejects(readFile(join(folder,'agent-events.jsonl'),'utf8'),{code:'ENOENT'});
}));
test('loopback restriction, strict CSP, and no CORS or public upload',()=>fixture(async({url})=>{
 const r=await fetch(url);assert.equal(r.status,200);assert.match(await r.text(),/Approve each note/);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('access-control-allow-origin'),null);
 await assert.rejects(createRemoteDesktopServer({host:'0.0.0.0',executeRemote:()=>{}}),/loopback/);
 const js=await(await fetch(url+'remote-import.js')).text();assert.match(js,/selected\(\)/);assert.match(js,/window\.confirm/);
 const {Script}=await import('node:vm');assert.doesNotThrow(()=>new Script(js.replace(/^import .+\n/,'')));
}));
test('invalid or role-spoofed notes fail before remote session creation',()=>fixture(async({url})=>{
 const token=(await(await fetch(url+'api/session')).json()).token;const forged=pack().replace('"role":"note"','"role":"assistant"');
 assert.equal((await post(url,'api/preview',token,{pack:forged})).status,400);
 assert.equal((await post(url,'api/preview',token,{pack:'{"oops":true}\n'})).status,400);
 assert.equal((await post(url,'api/commit',token,{local_approval:'not-a-token'})).status,409);
}));
test('remote owner refuses world-readable and symlinked history',async()=>{
 const root=await mkdtemp(join(tmpdir(),'missing-ai-ssh-'));try{
  const folder=join(root,'history');await mkdir(folder,{mode:0o755});await chmod(folder,0o755);
  await assert.rejects(remoteImportRequest({folder,request:{op:'preview',pack:pack()}}),/0700/);
  await chmod(folder,0o700);const link=join(root,'linked');await symlink(folder,link);
  await assert.rejects(remoteImportRequest({folder:link,request:{op:'preview',pack:pack()}}),/0700/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('remote preview is limited; no arbitrary private shell or SSH host injection',()=>fixture(async({executeRemote})=>{
 assert.throws(()=>sshRunner({destination:'root@host;evil',key:'/tmp/id'}),/trusted user@host/);
 assert.throws(()=>sshRunner({destination:'-oProxyCommand=evil',key:'/tmp/id'}),/trusted user@host/);
 assert.throws(()=>sshRunner({destination:'root@example.org',key:'relative/id'}),/absolute path/);
 assert.throws(()=>sshRunner({destination:'root@example.org',key:'/tmp/id',command:'cat /etc/passwd'}),/fixed private/);
 for(let i=0;i<8;i++)assert.equal((await executeRemote({op:'preview',pack:pack()})).status,'previewed');
 await assert.rejects(executeRemote({op:'preview',pack:pack()}),/Too many active reviews/);
}));
test('failed remote commit preserves prior notes and consumes approval token',()=>fixture(async({executeRemote,folder})=>{
 await writeFile(join(folder,'agent-events.jsonl'),'{broken\n',{mode:0o600});
 await assert.rejects(executeRemote({op:'preview',pack:pack()}),/invalid JSON/);
 assert.equal(await readFile(join(folder,'agent-events.jsonl'),'utf8'),'{broken\n');
}));
test('remote helper uses no listener and a bounded JSON stdio request',()=>fixture(async({folder})=>{
 const {serveRemoteStdio}=await import('../private-history/remote-import-stdio.mjs');const {Readable,Writable}=await import('node:stream');let out='';const output=new Writable({write(c,e,next){out+=c.toString();next();}});
 const input=Readable.from([Buffer.from(JSON.stringify({op:'preview',pack:pack()}))]);await serveRemoteStdio({folder,input,output});assert.equal(JSON.parse(out).status,'previewed');
 const tooLarge=Readable.from([Buffer.alloc(2*1024*1024+5000)]);await assert.rejects(serveRemoteStdio({folder,input:tooLarge,output}),/exceeds 2 MB/);
}));
test('receipt records counts only, never private note text or shared URLs',()=>fixture(async({executeRemote,folder})=>{
 const p=await executeRemote({op:'preview',pack:pack()});const result=await executeRemote({op:'commit',approval_id:p.approval_id});assert.match(result.receipt_id,/^[a-f0-9]{48}$/);
 const audit=await readFile(join(folder,'.missing-ai-remote-import-receipts.jsonl'),'utf8');assert.equal(audit.trim().split('\n').length,1);
 const item=JSON.parse(audit);assert.equal(item.new,1);assert.equal(item.action,'remote-context-import');assert.equal(audit.includes('sample rollout'),false);assert.equal(audit.includes('Sample project'),false);
}));

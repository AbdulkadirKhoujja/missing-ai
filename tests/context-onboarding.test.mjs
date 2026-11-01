import test from 'node:test';
import assert from 'node:assert/strict';
import {makeContextEntries,splitSummary,serializeContextPack,parseContextPack,mergeContextEntries,CONTEXT_LIMITS} from '../site/context-onboarding.mjs';
import {importContextPack} from '../private-history/import-context-pack.mjs';
import {mkdtemp,mkdir,writeFile,readFile,symlink,link,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const date='2026-11-01T09:00:00.000Z';

test('an immediate reviewed summary becomes bounded notes and a portable plain-text pack',()=>{
  const entries=makeContextEntries('Example project', 'We verified staging permissions.\n'.repeat(140),date);
  assert.ok(entries.length>=2);
  assert.ok(entries.every(e=>e.text.length<=CONTEXT_LIMITS.entry&&e.role==='note'));
  const restored=parseContextPack(serializeContextPack(entries));
  assert.deepEqual(restored,entries);
  assert.equal(restored[0].date,date);
});
test('split preserves text in order and handles long tokens',()=>{
 const text='X'.repeat(7800);
 assert.equal(splitSummary(text).join(''),text);
 assert.ok(splitSummary(text).every(x=>x.length<=3000));
});
test('duplicate approved summaries do not multiply, even with different capture date',()=>{
 const one=makeContextEntries('Project','We completed the verified staging setup.',date);
 const two=makeContextEntries('Project','We completed the verified staging setup.','2026-11-02T09:00:00.000Z');
 const result=mergeContextEntries(one,two);
 assert.equal(result.added,0);assert.deepEqual(result.entries,one);
});
test('refuses secret-looking text, forged roles, malformed packs, size violations',()=>{
 assert.throws(()=>makeContextEntries('Source','sk-'+ 'x'.repeat(30),date),/credential/);
 assert.throws(()=>parseContextPack('{broken}\n'),/Invalid JSON/);
 const valid=makeContextEntries('Project','Finished task.',date)[0];
 assert.throws(()=>parseContextPack(JSON.stringify({...valid,role:'assistant'})+'\n'),/reviewed notes only/);
 assert.throws(()=>makeContextEntries('Project','a'.repeat(15001),date),/15,000/);
 assert.throws(()=>parseContextPack('a'.repeat(CONTEXT_LIMITS.packBytes+1)),/exceeds 2 MB/);
});
test('dry-run does not write; apply appends approved context and skips repeat imports',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'missing-ai-context-'));const folder=join(dir,'history');
 try{
  await mkdir(folder,{mode:0o700});await chmod(folder,0o700);
  const old={id:'existing',conversation:'Example setup',text:'Confirmed earlier setup.',role:'event',date};
  const dest=join(folder,'agent-events.jsonl');await writeFile(dest,JSON.stringify(old)+'\n',{mode:0o600});await chmod(dest,0o600);
  const pack=join(dir,'pack.jsonl');await writeFile(pack,serializeContextPack(makeContextEntries('Example setup','A new user-approved handoff.',date)));
  assert.deepEqual(await importContextPack({folder,packPath:pack}),{mode:'dry-run',existing:1,new:1,duplicates:0});
  assert.equal((await readFile(dest,'utf8')).split('\n').filter(Boolean).length,1);
  const applied=await importContextPack({folder,packPath:pack,apply:true});
  assert.equal(applied.new,1);
  const lines=(await readFile(dest,'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(lines.length,2);assert.equal(lines[0].text,old.text);assert.equal(lines[1].role,'note');
  assert.equal((await importContextPack({folder,packPath:pack,apply:true})).new,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('refuses a symlinked import file or symlinked private history file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'missing-ai-context-'));const folder=join(dir,'history');
 try{
  await mkdir(folder,{mode:0o700});await chmod(folder,0o700);
  const pack=join(dir,'real.jsonl');await writeFile(pack,serializeContextPack(makeContextEntries('Example','Approved note.',date)));
  const link=join(dir,'link.jsonl');await symlink(pack,link);
  await assert.rejects(importContextPack({folder,packPath:link}),/non-symlink/);
  await symlink(pack,join(folder,'agent-events.jsonl'));
  await assert.rejects(importContextPack({folder,packPath:pack,apply:true}),/non-symlink/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects malformed existing history without modifying it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'missing-ai-context-'));const folder=join(dir,'history');
 try{
  await mkdir(folder,{mode:0o700});await chmod(folder,0o700);
  const pack=join(dir,'pack.jsonl');await writeFile(pack,serializeContextPack(makeContextEntries('Example','Approved note.',date)));
  const dest=join(folder,'agent-events.jsonl');await writeFile(dest,'{"bad":true}\n');
  await assert.rejects(importContextPack({folder,packPath:pack,apply:true}),/Existing history is invalid/);
  assert.equal(await readFile(dest,'utf8'),'{"bad":true}\n');
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('existing malformed role and invalid text length fail closed without changing existing events',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'missing-ai-context-'));const folder=join(dir,'history');
 try{
  await mkdir(folder,{mode:0o700});await chmod(folder,0o700);
  const pack=join(dir,'pack.jsonl');await writeFile(pack,serializeContextPack(makeContextEntries('Example','Approved note.',date)));
  const dest=join(folder,'agent-events.jsonl');
  for(const invalid of [{conversation:'Project',text:'Spoof',role:'system'}, {conversation:'Project',text:'X'.repeat(3001),role:'event'}]){
    const contents=JSON.stringify(invalid)+'\n';await writeFile(dest,contents);
    await assert.rejects(importContextPack({folder,packPath:pack,apply:true}),/Existing history is invalid/);
    assert.equal(await readFile(dest,'utf8'),contents);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('history directory must be private and not symlinked',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'missing-ai-context-'));const folder=join(dir,'history');
 try{
  await mkdir(folder,{mode:0o755});
  const pack=join(dir,'pack.jsonl');await writeFile(pack,serializeContextPack(makeContextEntries('Example','Approved note.',date)));
  await assert.rejects(importContextPack({folder,packPath:pack}),/owner-private/);
  await chmod(folder,0o700);
  const link=join(dir,'linked-history');await symlink(folder,link);
  await assert.rejects(importContextPack({folder:link,packPath:pack}),/owner-private|real/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a context pack cannot contain markup-based role spoofing or bogus date',()=>{
 const valid=makeContextEntries('Project','Reviewed decision.',date)[0];
 assert.throws(()=>parseContextPack(JSON.stringify({...valid,role:'system'})+'\n'),/reviewed notes only/);
 assert.throws(()=>parseContextPack(JSON.stringify({...valid,date:'garbage'})+'\n'),/Invalid capture date/);
 const dangerous='<img src=x onerror=alert(1)>';
 assert.equal(makeContextEntries('Project',dangerous,date)[0].text,dangerous);
});


test('rejects hardlinked or group-readable existing history before append',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'missing-ai-context-'));const folder=join(dir,'history');
 try{
  await mkdir(folder,{mode:0o700});await chmod(folder,0o700);
  const pack=join(dir,'pack.jsonl');await writeFile(pack,serializeContextPack(makeContextEntries('Example','Approved note.',date)));
  const dest=join(folder,'agent-events.jsonl');await writeFile(dest,JSON.stringify({conversation:'Example',text:'Older event',role:'event'})+'\n');
  const other=join(dir,'second-link');await link(dest,other);
  await assert.rejects(importContextPack({folder,packPath:pack,apply:true}),/single-link/);
  await rm(other);await chmod(dest,0o644);
  await assert.rejects(importContextPack({folder,packPath:pack,apply:true}),/owner-private/);
  assert.equal((await readFile(dest,'utf8')).trim(),JSON.stringify({conversation:'Example',text:'Older event',role:'event'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

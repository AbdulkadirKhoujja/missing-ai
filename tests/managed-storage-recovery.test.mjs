import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,statSync,symlinkSync,chmodSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createStore} from '../managed-beta/store.mjs';
import {snapshotManagedDb} from '../managed-beta/backup.mjs';
const tenant=n=>createHash('sha256').update('https://id.example.test\0'+n).digest('hex');
const note=text=>({conversation:'Synthetic staging account',text,role:'note',date:'2026-11-02T08:00:00.000Z'});
function fixture(fn){const root=mkdtempSync(join(tmpdir(),'missing-ai-storage-'));const dbPath=join(root,'context.sqlite'),backupDir=join(root,'backups');mkdirSync(backupDir,{mode:0o700});const key=randomBytes(32);return Promise.resolve().then(()=>fn({root,dbPath,backupDir,key})).finally(()=>rmSync(root,{recursive:true,force:true}));}
async function seed(dbPath,key){const a=createStore({path:dbPath,key});try{for(const [user,text] of [['alice','PRIVATE-FIXTURE-ABCD-100'],['bob','PRIVATE-FIXTURE-XYZ-200']]){const t=tenant(user);a.commit(t,a.prepare(t,[note(text)]));}}finally{a.close();}}
test('database encrypts content, uses secure deletion and validates its key on startup',()=>fixture(async({dbPath,key})=>{
 await seed(dbPath,key);
 assert.equal(readFileSync(dbPath).includes(Buffer.from('PRIVATE-FIXTURE-ABCD-100')),false);
 const sqlite=new DatabaseSync(dbPath);try{assert.equal(Object.values(sqlite.prepare('PRAGMA integrity_check').get())[0],'ok');}finally{sqlite.close();}
 const right=createStore({path:dbPath,key});try{assert.equal(right.integrityOk(),true);assert.equal(right.list(tenant('alice'))[0].text,'PRIVATE-FIXTURE-ABCD-100');
  assert.deepEqual(right.securityPosture(),{secureDeletion:true,synchronousFull:true});}
 finally{right.close();}
 assert.throws(()=>createStore({path:dbPath,key:randomBytes(32)}),/encryption key does not match/);
 const afterward=createStore({path:dbPath,key});assert.equal(afterward.count(tenant('bob')),1);afterward.close();
}));
test('encrypted staging snapshot is verified, owner-private and restores two separate tenants',()=>fixture(async({dbPath,backupDir,key})=>{
 await seed(dbPath,key);
 const report=await snapshotManagedDb({sourcePath:dbPath,destinationDir:backupDir,key});
 assert.equal(report.verified,true);assert.equal((statSync(join(backupDir,report.name)).mode&0o077),0);
 assert.deepEqual(readdirSync(backupDir),[report.name]);
 const image=readFileSync(join(backupDir,report.name));assert.equal(image.includes(Buffer.from('PRIVATE-FIXTURE-ABCD-100')),false);
 assert.equal(image.includes(Buffer.from('PRIVATE-FIXTURE-XYZ-200')),false);
 const recovered=createStore({path:join(backupDir,report.name),key});
 try{assert.equal(recovered.count(tenant('alice')),1);assert.equal(recovered.count(tenant('bob')),1);assert.equal(recovered.list(tenant('alice'))[0].text,'PRIVATE-FIXTURE-ABCD-100');assert.equal(recovered.list(tenant('bob'))[0].text,'PRIVATE-FIXTURE-XYZ-200');}
 finally{recovered.close();}
}));
test('backup rejects wrong key and leaves no published or incomplete snapshot',()=>fixture(async({dbPath,backupDir,key})=>{
 await seed(dbPath,key);
 await assert.rejects(snapshotManagedDb({sourcePath:dbPath,destinationDir:backupDir,key:randomBytes(32)}),/encryption key/);
 assert.deepEqual(readdirSync(backupDir),[]);
}));
test('backup refuses group-readable, symlinked and co-located snapshot destinations',()=>fixture(async({root,dbPath,backupDir,key})=>{
 await seed(dbPath,key);
 chmodSync(backupDir,0o755);
 await assert.rejects(snapshotManagedDb({sourcePath:dbPath,destinationDir:backupDir,key}),/owner-private/);
 chmodSync(backupDir,0o700);
 const alias=join(root,'backup-alias');symlinkSync(backupDir,alias);
 await assert.rejects(snapshotManagedDb({sourcePath:dbPath,destinationDir:alias,key}),/owner-private/);
 await assert.rejects(snapshotManagedDb({sourcePath:dbPath,destinationDir:root,key}),/separate/);
 assert.deepEqual(readdirSync(backupDir),[]);
}));
test('live delete-all does not retroactively erase retained backups; recovery policy must account for them',()=>fixture(async({dbPath,backupDir,key})=>{
 await seed(dbPath,key);
 const report=await snapshotManagedDb({sourcePath:dbPath,destinationDir:backupDir,key});
 const live=createStore({path:dbPath,key});assert.equal(live.deleteAll(tenant('alice')),1);live.close();
 const current=createStore({path:dbPath,key});assert.equal(current.count(tenant('alice')),0);assert.equal(current.count(tenant('bob')),1);current.close();
 const oldCopy=createStore({path:join(backupDir,report.name),key});assert.equal(oldCopy.count(tenant('alice')),1);oldCopy.close();
}));

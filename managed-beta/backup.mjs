// Offline-only, owner-operated SQLite snapshot for staging and recovery drills.
// Backups retain deleted records until destroyed; never confuse deletion with backup erasure.
import {backup,DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {chmodSync,lstatSync,openSync,closeSync,fsyncSync,renameSync,rmSync,statSync} from 'node:fs';
import {isAbsolute,resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createStore} from './store.mjs';

function ownerPrivateDirectory(path){
 const st=lstatSync(path);
 if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0||
    (typeof process.getuid==='function'&&st.uid!==process.getuid()))
  throw Error('Snapshot directory must be real and owner-private (0700).');
}
function safeSource(path){
 const st=lstatSync(path);
 if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||(st.mode&0o077)!==0||
    (typeof process.getuid==='function'&&st.uid!==process.getuid()))
  throw Error('Snapshot source must be an owner-private single-link database.');
}
function flushFile(path){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
function flushDirectory(path){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
export async function snapshotManagedDb({sourcePath,destinationDir,key}={}){
 if(typeof sourcePath!=='string'||!isAbsolute(sourcePath)||typeof destinationDir!=='string'||!isAbsolute(destinationDir))
   throw Error('Source and snapshot directory paths must be absolute.');
 const src=resolve(sourcePath),dest=resolve(destinationDir);
 if(dest===dirname(src))throw Error('Keep staging snapshots in a separate owner-private directory.');
 ownerPrivateDirectory(dirname(src));ownerPrivateDirectory(dest);safeSource(src);
 // Verify the source encryption key and database integrity before copying any bytes.
 const sourceCheck=createStore({path:src,key});try{if(!sourceCheck.integrityOk())throw Error('Source database integrity failure.');}finally{sourceCheck.close();}
 const name='missing-ai-managed-snapshot-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.sqlite';
 const stage=join(dest,'.incomplete-'+randomUUID()+'.sqlite'),target=join(dest,name);
 let db;
 try{
  db=new DatabaseSync(src);
  const healthy=db.prepare('PRAGMA quick_check').get();
  if(!healthy||Object.values(healthy)[0]!=='ok')throw Error('Source database integrity failure.');
  await backup(db,stage);
  chmodSync(stage,0o600);safeSource(stage);
  const check=createStore({path:stage,key});
  try{if(!check.integrityOk())throw Error('Snapshot integrity failure.');}finally{check.close();}
  flushFile(stage);renameSync(stage,target);flushDirectory(dest);
  return {name,bytes:statSync(target).size,verified:true};
 }catch{
  try{rmSync(stage,{force:true});}catch{}
  throw Error('Managed snapshot failed; no successful backup was published.');
 }finally{db?.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.env.MISSING_AI_MANAGED_SNAPSHOT_REVIEWED!=='1')throw Error('Operator review flag is required.');
  const key=Buffer.from(process.env.MISSING_AI_MANAGED_ENCRYPTION_KEY||'','base64');
  const result=await snapshotManagedDb({sourcePath:process.env.MISSING_AI_MANAGED_DB,destinationDir:process.env.MISSING_AI_MANAGED_BACKUP_DIR,key});
  process.stdout.write('STAGING_SNAPSHOT_VERIFIED name='+result.name+' bytes='+result.bytes+'\n');
 }catch{
  process.stderr.write('Staging snapshot refused: verify private directory, encryption key and operator approval.\n');
  process.exitCode=2;
 }
}

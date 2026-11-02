// SSH stdio transport for owner-managed remote history. No network listener or MCP write tool.
// Run as the owner of MISSING_AI_HISTORY_DIR via an authenticated SSH forced command.
import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,rm,mkdir,readdir,lstat,open,rename,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CONTEXT_LIMITS,parseContextPack,serializeContextPack} from '../site/context-onboarding.mjs';
import {importContextPack} from './import-context-pack.mjs';
const TTL=5*60*1000, MAX_PENDING=8, WIRE_LIMIT=CONTEXT_LIMITS.packBytes+4096;
const token=()=>randomBytes(24).toString('hex');
function checkFolder(path,owner){if(typeof path!=='string'||!isAbsolute(path))throw Error('An absolute history folder is required.');if(typeof process.getuid==='function'&&owner!==process.getuid())throw Error('Private history owner required.');}
async function secureFolder(path){const st=await lstat(path);checkFolder(path,st.uid);if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0)throw Error('History directory must be owner-private (0700).');}
async function pendingFolder(folder){
 const path=join(folder,'.missing-ai-remote-pending');
 await mkdir(path,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 const st=await lstat(path);checkFolder(path,st.uid);
 if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0)throw Error('Pending directory must be owner-private (0700).');
 return path;
}
async function readOwnerFile(path,max=CONTEXT_LIMITS.packBytes+2048){
 const before=await lstat(path);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||(before.mode&0o077)!==0||before.size>max||typeof process.getuid==='function'&&before.uid!==process.getuid())throw Error('Private pending record is unsafe.');
 const fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const stat=await fd.stat();if(stat.dev!==before.dev||stat.ino!==before.ino||stat.size>max)throw Error('Pending record changed.');const buf=Buffer.alloc(stat.size);let n=0;while(n<buf.length){const v=await fd.read(buf,n,buf.length-n,n);if(!v.bytesRead)throw Error('Short pending record.');n+=v.bytesRead;}return buf.toString('utf8');}finally{await fd.close();}
}
async function prunePending(dir){
 const names=await readdir(dir);let pending=0;
 for(const name of names){
  if(!/^p-[a-f0-9]{48}\.json$/.test(name))continue;
  const path=join(dir,name);
  const st=await lstat(path);if(!st.isFile()||st.isSymbolicLink())throw Error('Unsafe pending entry.');
  if(Date.now()-st.mtimeMs>TTL+60_000){await unlink(path);continue;}
  pending++;
 }
 if(pending>=MAX_PENDING)throw Error('Too many active reviews; cancel or allow existing previews to expire.');
}
async function stage(folder,pack,apply){const tmp=await mkdtemp(join(folder,'.remote-import-stage-'));try{const file=join(tmp,'approved.jsonl');await writeFile(file,pack,{mode:0o600,flag:'wx'});return await importContextPack({folder,packPath:file,apply});}finally{await rm(tmp,{recursive:true,force:true});}}
async function auditImport(folder,result){
 const file=join(folder,'.missing-ai-remote-import-receipts.jsonl');
 const receipt={id:token(),date:new Date().toISOString(),action:'remote-context-import',existing:result.existing,new:result.new,duplicates:result.duplicates};
 const fd=await open(file,constants.O_WRONLY|constants.O_APPEND|constants.O_CREAT|constants.O_NOFOLLOW,0o600);
 try{const st=await fd.stat();if(!st.isFile()||st.nlink!==1||(st.mode&0o077)!==0||st.size>1024*1024||typeof process.getuid==='function'&&st.uid!==process.getuid())throw Error('Audit receipt file is unsafe or full.');await fd.writeFile(JSON.stringify(receipt)+'\n');await fd.sync();}
 finally{await fd.close();}
 return receipt.id;
}
async function claim(dir,id){
 if(typeof id!=='string'||!/^[a-f0-9]{48}$/.test(id))throw Error('Invalid approval identifier.');
 const src=join(dir,`p-${id}.json`),dst=join(dir,`c-${id}.json`);
 const source=await lstat(src);if(!source.isFile()||source.isSymbolicLink())throw Error('Approval is unavailable.');
 // Unique-name claim prevents replay across independent SSH sessions. Refuse an existing claim.
 try{await lstat(dst);throw Error('Approval already claimed.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await rename(src,dst);return dst;
}
export async function remoteImportRequest({folder,request}){
 await secureFolder(folder);
 if(!request||typeof request!=='object'||Array.isArray(request))throw Error('Invalid import request.');
 const dir=await pendingFolder(folder);
 if(request.op==='preview'){
  if(typeof request.pack!=='string')throw Error('Reviewed context pack required.');
  const pack=serializeContextPack(parseContextPack(request.pack));
  await prunePending(dir);
  const counts=await stage(folder,pack,false);
  const id=token(),expires=Date.now()+TTL;
  await writeFile(join(dir,`p-${id}.json`),JSON.stringify({pack,expires})+'\n',{mode:0o600,flag:'wx'});
  return {status:'previewed',approval_id:id,expires_at:new Date(expires).toISOString(),...counts};
 }
 if(request.op==='cancel'){
  if(typeof request.approval_id!=='string'||!/^[a-f0-9]{48}$/.test(request.approval_id))throw Error('Invalid approval identifier.');
  const path=join(dir,`p-${request.approval_id}.json`);await unlink(path).catch(e=>{if(e.code!=='ENOENT')throw e;});return {status:'cancelled'};
 }
 if(request.op==='commit'){
  const file=await claim(dir,request.approval_id);
  try{
   const pending=JSON.parse(await readOwnerFile(file));
   if(!Number.isFinite(pending.expires)||Date.now()>pending.expires)throw Error('Approval expired. Review again.');
   const pack=serializeContextPack(parseContextPack(pending.pack));
   const lock=join(folder,'.missing-ai-remote-import.lock');
   let fd;
   try{
    fd=await open(lock,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   }catch(e){if(e.code==='EEXIST')throw Error('An import is already in progress; retry with a new preview.');throw e;}
   try{const r=await stage(folder,pack,true);const receipt_id=await auditImport(folder,r);return {status:'imported',...r,receipt_id};}
   finally{await fd.close();await unlink(lock);}
  }finally{await unlink(file).catch(()=>{});}
 }
 throw Error('Unsupported import operation.');
}
export async function serveRemoteStdio({folder,input=process.stdin,output=process.stdout}){
 let total=0;const chunks=[];
 for await(const chunk of input){total+=chunk.length;if(total>WIRE_LIMIT)throw Error('Request exceeds 2 MB.');chunks.push(chunk);}
 const request=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 const result=await remoteImportRequest({folder,request});output.write(JSON.stringify(result)+'\n');return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{await serveRemoteStdio({folder:process.env.MISSING_AI_HISTORY_DIR});}
 catch{process.stderr.write('Remote private import rejected. Check the reviewed input, expiry, and directory permissions.\n');process.exitCode=2;}
}

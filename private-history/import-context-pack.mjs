// Owner-operated, opt-in import of reviewed local context packs. Not exposed as an MCP tool.
import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {CONTEXT_LIMITS,parseContextPack} from '../site/context-onboarding.mjs';

async function secureRead(path, limit) {
  const before=await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size>limit) throw Error('Source must be a non-symlink regular file within size limits.');
  const fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const stat=await fd.stat();
    if (!stat.isFile() || stat.dev!==before.dev || stat.ino!==before.ino || stat.size>limit) throw Error('Source file changed or exceeds size limits.');
    // Read with a hard ceiling even if the file grows after the initial stat.
    const chunks=[];let total=0;let position=0;
    for(;;){
      const capacity=Math.min(65536,limit+1-total);
      if(capacity<=0)throw Error('Source exceeds size limits.');
      const buffer=Buffer.alloc(capacity);
      const {bytesRead}=await fd.read(buffer,0,capacity,position);
      if(!bytesRead)break;
      total+=bytesRead;position+=bytesRead;
      if(total>limit)throw Error('Source exceeds size limits.');
      chunks.push(buffer.subarray(0,bytesRead));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await fd.close(); }
}
function existingRecords(content) {
  if(!content.trim())return [];
  const lines=content.trimEnd().split('\n');
  if(lines.length>CONTEXT_LIMITS.entries)throw Error('Existing history exceeds 2,000 records.');
  return lines.map((line,i)=>{
    let value;try{value=JSON.parse(line);}catch{throw Error(`Existing history line ${i+1} is invalid JSON. No changes made.`);}
    if(!value || typeof value!=='object' || Array.isArray(value) ||
       typeof value.conversation!=='string' || !value.conversation.trim() || value.conversation.length>160 ||
       typeof value.text!=='string' || !value.text.trim() || value.text.length>3000 ||
       !['user','assistant','note','event'].includes(value.role||'note'))
      throw Error('Existing history is invalid. No changes made.');
    return value;
  });
}
export async function importContextPack({folder,packPath,apply=false}) {
  if(typeof folder!=='string' || !isAbsolute(folder) || typeof packPath!=='string' || !isAbsolute(packPath))throw Error('Use absolute local paths.');
  const root=resolve(folder),pack=resolve(packPath),dest=join(root,'agent-events.jsonl');
  const dir=await lstat(root);
  if(!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o077)!==0)throw Error('History folder must be a real, owner-private directory (mode 0700).');
  if(typeof process.getuid==='function' && dir.uid!==process.getuid())throw Error('Importer must run as the private history directory owner, not a privileged or unrelated account.');
  if(pack===dest)throw Error('Input pack must not be the destination history file.');
  const entries=parseContextPack(await secureRead(pack,CONTEXT_LIMITS.packBytes));
  let existingContent='';
  try { existingContent=await secureRead(dest,CONTEXT_LIMITS.packBytes); }
  catch(e) { if(e.code!=='ENOENT')throw e; }
  if(existingContent && !existingContent.endsWith('\n'))throw Error('Existing history must end with a newline. No changes made.');
  const existing=existingRecords(existingContent);
  const oldStat=await lstat(dest).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(oldStat && (!oldStat.isFile() || oldStat.isSymbolicLink() || oldStat.nlink!==1 || (oldStat.mode & 0o077)!==0 || oldStat.uid!==dir.uid))throw Error('History destination must be a single-link owner-private regular file.');
  const keys=new Set(existing.map(x=>`${x.conversation.trim()}\0${x.text.trim()}`));
  const additions=[];
  for(const e of entries){
    const key=`${e.conversation}\0${e.text}`;
    if(keys.has(key))continue;
    keys.add(key);
    additions.push({id:randomUUID(),...e});
  }
  if(existing.length+additions.length>CONTEXT_LIMITS.entries)throw Error('Import would exceed the 2,000-record limit.');
  const bytes=additions.length?Buffer.from(additions.map(x=>JSON.stringify(x)).join('\n')+'\n','utf8'):Buffer.alloc(0);
  if(Buffer.byteLength(existingContent,'utf8')+bytes.length>CONTEXT_LIMITS.packBytes)throw Error('Import would exceed the private-history 2 MB file limit.');
  if(!apply)return {mode:'dry-run',existing:existing.length,new:additions.length,duplicates:entries.length-additions.length};
  if(!additions.length)return {mode:'applied',existing:existing.length,new:0,duplicates:entries.length};
  // Append-only: preserve existing agent events. Use one destination descriptor and O_NOFOLLOW.
  // Operator must avoid concurrently writing this file while importing.
  const fd=await open(dest,constants.O_WRONLY|constants.O_APPEND|constants.O_CREAT|constants.O_NOFOLLOW,0o600);
  try {
    const stat=await fd.stat();
    if(!stat.isFile() || stat.nlink!==1 || (stat.mode & 0o077)!==0 || stat.uid!==dir.uid || stat.size!==Buffer.byteLength(existingContent,'utf8') || (oldStat && (stat.dev!==oldStat.dev || stat.ino!==oldStat.ino)))throw Error('History file changed or is unsafe. No append attempted.');
    await fd.writeFile(bytes);
    await fd.sync();
  }finally{await fd.close();}
  return {mode:'applied',existing:existing.length,new:additions.length,duplicates:entries.length-additions.length};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  const apply=args.includes('--apply');
  const positional=args.filter(x=>x!=='--apply'&&x!=='--dry-run');
  if(!process.env.MISSING_AI_HISTORY_DIR||positional.length!==1||!isAbsolute(positional[0])||args.some(x=>x.startsWith('--')&&!['--dry-run','--apply'].includes(x))){
    process.stderr.write('Usage: MISSING_AI_HISTORY_DIR=/private/folder node private-history/import-context-pack.mjs /absolute/context-pack.jsonl [--dry-run|--apply]\n');process.exitCode=2;
  }else{
    try{
      const result=await importContextPack({folder:process.env.MISSING_AI_HISTORY_DIR,packPath:positional[0],apply});
      process.stdout.write(`Context import ${result.mode}: existing=${result.existing}, new=${result.new}, duplicates=${result.duplicates}. No context text was printed.\n`);
    }catch(e){process.stderr.write(`Context import rejected: ${e.message}\n`);process.exitCode=2;}
  }
}

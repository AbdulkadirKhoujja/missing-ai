// Encrypted SQLite adapter for a SINGLE-PROCESS technical beta (node:sqlite is experimental in Node 22).
// Never colocate this database with the existing personal private-history connector.
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes,createCipheriv,createDecipheriv,randomUUID} from 'node:crypto';
import {chmodSync,lstatSync} from 'node:fs';
import {dirname,isAbsolute} from 'node:path';

function crypt(key,record){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(JSON.stringify(record),'utf8'),cipher.final()]);return {data,iv,tag:cipher.getAuthTag()};}
function decrypt(key,x){const cipher=createDecipheriv('aes-256-gcm',key,x.iv);cipher.setAuthTag(x.tag);return JSON.parse(Buffer.concat([cipher.update(x.data),cipher.final()]).toString('utf8'));}
function safeTenant(id){if(typeof id!=='string'||!/^[0-9a-f]{64}$/.test(id))throw Error('Invalid tenant context.');}
export function createStore({path=':memory:',key,now=()=>Date.now(),allowMemory=false}={}){
 if(!Buffer.isBuffer(key)||key.length!==32)throw Error('Managed beta requires a 32-byte data-encryption key.');
 if(path===':memory:'&&!allowMemory)throw Error('Managed beta requires persistent encrypted storage.');
 if(path!==':memory:'){
  if(!isAbsolute(path))throw Error('Managed database path must be absolute.');
  const parent=lstatSync(dirname(path));
  if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077)!==0||typeof process.getuid==='function'&&parent.uid!==process.getuid())throw Error('Database must be in an existing user-owned private directory (0700).');
  try{const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||(st.mode&0o077)!==0||typeof process.getuid==='function'&&st.uid!==process.getuid())throw Error('Database must be a single-link owner-private regular file.');}
  catch(e){if(e.code!=='ENOENT')throw e;}
 }
 const db=new DatabaseSync(path);
 if(path!==':memory:')chmodSync(path,0o600);
 db.exec('PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS notes(tenant TEXT NOT NULL,id TEXT NOT NULL,digest TEXT NOT NULL,iv BLOB NOT NULL,tag BLOB NOT NULL,data BLOB NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(tenant,id),UNIQUE(tenant,digest)); CREATE TABLE IF NOT EXISTS drafts(tenant TEXT NOT NULL,id TEXT NOT NULL,iv BLOB NOT NULL,tag BLOB NOT NULL,data BLOB NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(tenant,id)); CREATE INDEX IF NOT EXISTS ix_drafts_expiry ON drafts(expires); CREATE TABLE IF NOT EXISTS audit(tenant TEXT NOT NULL,id TEXT NOT NULL,action TEXT NOT NULL,quantity INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(tenant,id)); CREATE INDEX IF NOT EXISTS ix_audit_tenant_created ON audit(tenant,created)');
 const readNotes=db.prepare('SELECT id,iv,tag,data FROM notes WHERE tenant=? ORDER BY created DESC LIMIT 101');
 const count=db.prepare('SELECT COUNT(*) as n FROM notes WHERE tenant=?');
 const add=db.prepare('INSERT OR IGNORE INTO notes(tenant,id,digest,iv,tag,data,created) VALUES(?,?,?,?,?,?,?)');
 const addDraft=db.prepare('INSERT INTO drafts(tenant,id,iv,tag,data,expires) VALUES(?,?,?,?,?,?)');
 const getDraft=db.prepare('SELECT iv,tag,data,expires FROM drafts WHERE tenant=? AND id=?');
 const delDraft=db.prepare('DELETE FROM drafts WHERE tenant=? AND id=?');
 const expireDrafts=db.prepare('DELETE FROM drafts WHERE expires<?');
 const exists=db.prepare('SELECT 1 AS ok FROM notes WHERE tenant=? AND digest=?');
 const auditAdd=db.prepare('INSERT INTO audit(tenant,id,action,quantity,created) VALUES(?,?,?,?,?)');
 const audits=db.prepare('SELECT id,action,quantity,created FROM audit WHERE tenant=? ORDER BY created DESC LIMIT 30');
 const one=db.prepare('DELETE FROM notes WHERE tenant=? AND id=?');
 const all=db.prepare('DELETE FROM notes WHERE tenant=?');
 const getOne=db.prepare('SELECT iv,tag,data FROM notes WHERE tenant=? AND id=?');
 return {
  count(tenant){safeTenant(tenant);return count.get(tenant).n;},
  list(tenant){safeTenant(tenant);return readNotes.all(tenant).map(r=>({id:r.id,...decrypt(key,r)}));},
  prepare(tenant,entries){safeTenant(tenant);if(entries.length>10)throw Error('Maximum 10 notes per import.');expireDrafts.run(now());const id=randomUUID(),enc=crypt(key,entries);addDraft.run(tenant,id,enc.iv,enc.tag,enc.data,now()+300_000);return id;},
  commit(tenant,id){safeTenant(tenant);if(typeof id!=='string'||!/^[-0-9a-f]{36}$/.test(id))throw Error('Invalid preview.');
   const draft=getDraft.get(tenant,id);if(!draft||draft.expires<=now())throw Error('Preview expired or not found.');
   // Explicit single-process transaction: consume the preview once, and atomically add notes.
   db.exec('BEGIN IMMEDIATE');
   try{
    const pending=getDraft.get(tenant,id);
    if(!pending||pending.expires<=now())throw Error('Preview expired or consumed.');
    const entries=decrypt(key,pending);delDraft.run(tenant,id);
    let added=0,existing=count.get(tenant).n;for(const note of entries){
      const digest=createHash('sha256').update(note.conversation+'\0'+note.text).digest('hex');
      if(exists.get(tenant,digest))continue;
      if(existing>=100)throw Error('Managed beta note limit reached.');
      const enc=crypt(key,note);added+=add.run(tenant,randomUUID(),digest,enc.iv,enc.tag,enc.data,now()).changes;existing+=1;
    }
    const receipt=randomUUID();auditAdd.run(tenant,receipt,'import',added,now());
    db.exec('COMMIT');return {added,duplicates:entries.length-added,total:count.get(tenant).n,receipt};
   }catch(e){db.exec('ROLLBACK');throw e;}
  },
  cancel(tenant,id){safeTenant(tenant);return delDraft.run(tenant,id).changes;},
  audit(tenant){safeTenant(tenant);return audits.all(tenant);},
  delete(tenant,id){safeTenant(tenant);if(typeof id!=='string'||id.length>80)return 0;db.exec('BEGIN IMMEDIATE');try{const n=one.run(tenant,id).changes;if(n)auditAdd.run(tenant,randomUUID(),'delete_one',n,now());db.exec('COMMIT');return n;}catch(e){db.exec('ROLLBACK');throw e;}},
  deleteAll(tenant){safeTenant(tenant);db.exec('BEGIN IMMEDIATE');try{const n=all.run(tenant).changes;db.prepare('DELETE FROM drafts WHERE tenant=?').run(tenant);auditAdd.run(tenant,randomUUID(),'delete_all',n,now());db.exec('COMMIT');return n;}catch(e){db.exec('ROLLBACK');throw e;}},
  peek(tenant,id){safeTenant(tenant);const r=getOne.get(tenant,id);return r?decrypt(key,r):null;},
  close(){db.close();}
 };
}

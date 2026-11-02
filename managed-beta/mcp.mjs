// Disabled-by-default, multi-tenant managed context MCP prototype. Never import user-supplied account IDs.
import http from 'node:http';
import {createVerifier,AuthError} from './auth.mjs';
import {createStore} from './store.mjs';
import {createApprovalVerifier} from './approval.mjs';

const MAX_BODY=48*1024;
const scopes={read:'context:read',write:'context:write'};
const string=(v,max,what)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid '+what+'.');return v.trim();};
function validatedEntries(raw){
 if(!Array.isArray(raw)||raw.length<1||raw.length>10)throw Error('Provide 1 to 10 reviewed notes.');
 return raw.map(x=>{
  if(!x||typeof x!=='object'||Array.isArray(x)||x.role!==undefined&&x.role!=='note')throw Error('Only reviewed notes can be imported.');
  const conversation=string(x.conversation,160,'note title'),text=string(x.text,3000,'note text');
  if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,}/i.test(conversation+' '+text))throw Error('Remove possible credentials before importing.');
  return {conversation,text,role:'note',date:new Date().toISOString()};
 });
}
const inputSchema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const str=(maxLength,description)=>({type:'string',maxLength,description});
const tool=(name,description,inputSchema,scope,readOnlyHint=true,destructiveHint=false)=>({name,description,inputSchema,annotations:{readOnlyHint,destructiveHint},securitySchemes:[{type:'oauth2',scopes:[scope]}],_meta:{securitySchemes:[{type:'oauth2',scopes:[scope]}]}});
export const MANAGED_TOOLS=[
 {...tool('missing_ai_get_profile','Return the authenticated account’s stable, opaque profile identifier for multi-account ChatGPT connections.',inputSchema({}),scopes.read),_meta:{securitySchemes:[{type:'oauth2',scopes:[scopes.read]}],'openai/profile':true}},
 tool('missing_ai_context_status','Return a count of only the authenticated user’s saved context notes.',inputSchema({}),scopes.read),
 tool('missing_ai_search_context','Search only the authenticated user’s approved notes; historical claims are not independently verified.',inputSchema({query:str(2000,'Search terms for earlier notes'),max_results:{type:'integer',minimum:1,maximum:8}},['query']),scopes.read),
 tool('missing_ai_list_context','List titles and IDs of only the authenticated user’s notes.',inputSchema({}),scopes.read),
 tool('missing_ai_context_audit','Read content-free import/deletion receipts for only the authenticated user.',inputSchema({}),scopes.read),
 tool('missing_ai_prepare_context_import','Store a short-lived encrypted draft and return its EXACT notes for user review. Do not call the save tool until the user has explicitly approved the displayed notes. This tool makes no lasting history change.',inputSchema({notes:{type:'array',minItems:1,maxItems:10,items:{type:'object',properties:{conversation:str(160,'Title'),text:str(3000,'Reviewed context')},required:['conversation','text'],additionalProperties:false}}},['notes']),scopes.write,false),
 tool('missing_ai_save_approved_context','Commit a one-use draft ONLY with a short-lived approval proof signed by the separately authenticated user approval portal. The model cannot self-authorize saving. The ChatGPT host must still display write confirmation.',inputSchema({preview_id:str(80,'ID from prepare step'),approval_proof:str(6000,'Signed proof from the independent approval portal')},['preview_id','approval_proof']),scopes.write,false),
 tool('missing_ai_cancel_context_import','Discard an uncommitted draft without saving history.',inputSchema({preview_id:str(80,'Draft ID')},['preview_id']),scopes.write,false),
 tool('missing_ai_delete_context','Permanently remove one of the authenticated user’s notes by ID, with host write confirmation.',inputSchema({note_id:str(80,'Saved note ID')},['note_id']),scopes.write,false,true),
 tool('missing_ai_delete_all_context','Permanently delete ALL the authenticated user’s context and drafts. Requires explicit user confirmation.',inputSchema({confirmation:{type:'string',const:'DELETE ALL MY MISSING AI CONTEXT'}},['confirmation']),scopes.write,false,true)
];
const byName=new Map(MANAGED_TOOLS.map(x=>[x.name,x]));
function words(text){return [...new Set((String(text).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu)||[]).filter(w=>w.length<70))].slice(0,35);}
export function createManagedMcp({store,verifyToken,verifyApproval,issuer,resource,allowedOrigins=[]}={}){
 if(!store||typeof verifyToken!=='function')throw Error('Store and token verifier required.');
 if(!resource?.startsWith('https://')||!issuer?.startsWith('https://'))throw Error('HTTPS resource and issuer required.');
 const origins=new Set(allowedOrigins);
 const rate=new Map();
 function consume(tenant){const now=Date.now();let x=rate.get(tenant);if(!x||now-x.start>=60_000){x={start:now,n:0};rate.set(tenant,x);}x.n++;if(rate.size>10000)for(const [k,v] of rate)if(now-v.start>60_000)rate.delete(k);if(x.n>60)throw new AuthError('Too many requests',429);}
 async function invoke(name,args,authorization){
  const def=byName.get(name);if(!def)throw Error('Unknown tool.');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Invalid tool arguments.');
  const principal=await verifyToken(authorization,def.securitySchemes[0].scopes);consume(principal.tenant);
  const tenant=principal.tenant;
  if(name==='missing_ai_get_profile')return {id:tenant};
  if(name==='missing_ai_context_status')return {note_count:store.count(tenant),source:'managed-approved-notes',limitations:'No automatic ChatGPT history access.'};
  if(name==='missing_ai_list_context')return {notes:store.list(tenant).map(n=>({id:n.id,conversation:n.conversation,date:n.date}))};
  if(name==='missing_ai_context_audit')return {receipts:store.audit(tenant)};
  if(name==='missing_ai_search_context'){
   const query=string(args.query,2000,'search query'),terms=words(query);
   const limit=args.max_results===undefined?5:Number(args.max_results);
   if(!Number.isInteger(limit)||limit<1||limit>8)throw Error('Invalid result limit.');
   const matches=store.list(tenant).map(n=>{const lower=(n.conversation+' '+n.text).toLowerCase();return {...n,score:terms.reduce((s,t)=>s+(lower.includes(t)?1:0),0)};}).filter(n=>n.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
   return {findings:matches.map(n=>({id:n.id,conversation:n.conversation,quote:n.text.slice(0,600),date:n.date,role:'note'})),limitations:'Keyword matches in user-approved notes; verify claims independently.'};
  }
  if(name==='missing_ai_prepare_context_import'){
   const entries=validatedEntries(args.notes),preview_id=store.prepare(tenant,entries);
   return {preview_id,expires_in_seconds:300,notes:entries,warning:'Show each exact note to the user. Saving requires explicit separate confirmation; no history has been changed.'};
  }
  if(name==='missing_ai_save_approved_context'){
   if(typeof verifyApproval!=='function')throw Error('Independent user approval is not configured.');
   const preview_id=string(args.preview_id,80,'preview ID');
   await verifyApproval(args.approval_proof,{tenant,preview_id});
   return store.commit(tenant,preview_id);
  }
  if(name==='missing_ai_cancel_context_import')return {cancelled:store.cancel(tenant,string(args.preview_id,80,'preview ID'))===1};
  if(name==='missing_ai_delete_context')return {deleted:store.delete(tenant,string(args.note_id,80,'note ID'))===1};
  if(name==='missing_ai_delete_all_context'){
   if(args.confirmation!=='DELETE ALL MY MISSING AI CONTEXT')throw Error('Explicit deletion confirmation required.');
   return {deleted:store.deleteAll(tenant)};
  }
  throw Error('Unknown tool.');
 }
 function response(id,result){return {jsonrpc:'2.0',id,result};}
 return async function handler(req,res){
  const path=(req.url||'').split('?')[0];
  function send(status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers});res.end(JSON.stringify(data));}
  if(req.headers.origin&&!origins.has(req.headers.origin)){send(403,{error:'Forbidden'});return;}
  if(path==='/.well-known/oauth-protected-resource'&&req.method==='GET'){
   send(200,{resource,authorization_servers:[issuer],scopes_supported:[scopes.read,scopes.write]});return;
  }
  if(path==='/health'&&req.method==='GET'){send(200,{ok:true,mode:'managed-beta',public_signup:false});return;}
  if(path!=='/mcp'||req.method!=='POST'){send(404,{error:'Not found'});return;}
  let body;
  try{
   let size=0;const chunks=[];for await(const part of req){size+=part.length;if(size>MAX_BODY)throw Error('Request too large.');chunks.push(part);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!body||typeof body!=='object'||Array.isArray(body)||body.jsonrpc!=='2.0'||typeof body.method!=='string')throw Error('Invalid JSON-RPC');
  }catch{send(400,{error:'Invalid or oversized request.'});return;}
  if(body.id===undefined||body.id===null){res.writeHead(202);res.end();return;}
  const id=body.id;
  if(body.method==='initialize'){
   send(200,response(id,{protocolVersion:'2025-06-18',serverInfo:{name:'missing-ai-managed-beta',version:'0.1.0'},capabilities:{tools:{listChanged:false}}}));return;
  }
  if(body.method==='ping'){send(200,response(id,{}));return;}
  if(body.method==='tools/list'){send(200,response(id,{tools:MANAGED_TOOLS}));return;}
  if(body.method!=='tools/call'){send(200,{jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});return;}
  const name=body.params?.name,def=byName.get(name);
  if(!def){send(200,{jsonrpc:'2.0',id,error:{code:-32602,message:'Unknown tool'}});return;}
  try{
   const payload=await invoke(name,body.params?.arguments||{},req.headers.authorization);
   send(200,response(id,{content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload,isError:false}));
  }catch(e){
   if(e instanceof AuthError){
    const meta=new URL('/.well-known/oauth-protected-resource',resource).href;
    const challenge=`Bearer resource_metadata="${meta}", scope="${def.securitySchemes[0].scopes.join(' ')}", error="${e.status===403?'insufficient_scope':'invalid_token'}", error_description="Authorization required"`;
    if(e.status===429){send(429,{error:'Rate limited'});return;}
    send(e.status,response(id,{content:[{type:'text',text:'Authentication or authorization required.'}],isError:true,_meta:{'mcp/www_authenticate':[challenge]}}),{'WWW-Authenticate':challenge});return;
   }
   // Never echo submitted text, authorization tokens or database exceptions.
   send(200,response(id,{content:[{type:'text',text:'Request could not be completed. Check note limits, approval and authorization.'}],isError:true}));
  }
 };
}
export function createManagedBeta({issuer,audience,jwksUrl,resource,dbPath,encryptionKey,allowedOrigins=[],fetchImpl,clock,allowMemory=false,approvalPublicKey,approvalIssuer}={}){
 const verifyToken=createVerifier({issuer,audience,jwksUrl,fetchImpl,clock});
 const store=createStore({path:dbPath,key:encryptionKey,allowMemory,now:clock});
 const verifyApproval=approvalPublicKey&&approvalIssuer?createApprovalVerifier({publicKey:approvalPublicKey,issuer:approvalIssuer,now:clock||(()=>Date.now())}):null;
 return {handler:createManagedMcp({store,verifyToken,verifyApproval,issuer,resource,allowedOrigins}),store};
}

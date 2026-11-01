// Private, read-only, stdio MCP companion for *explicitly authorized* local history.
// Never deploy this inside the public beta, expose it on a public port, or log content.
import readline from "node:readline";
import {lstat,readFile} from "node:fs/promises";
import {join,isAbsolute} from "node:path";
import {importChatGPTExport,reviewContext,HISTORY_LIMITS} from "../site/history-context.mjs";

const MAX_EVENTS=2*1024*1024;
function bounded(value,max,name){if(typeof value!=="string"||!value.trim()||value.length>max)throw Error(name+" must be 1–"+max+" characters.");return value.trim();}
function cleanEvent(x,i){if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Invalid event at line "+i+".");
 const role=String(x.role||"note");
 if(!["user","assistant","note","event"].includes(role))throw Error("Invalid event role.");
 const title=bounded(x.conversation,160,"Event conversation");
 const text=bounded(x.text,HISTORY_LIMITS.maxMessageCharacters,"Event text");
 const date=typeof x.date==="string"&&/^\d{4}-\d{2}-\d{2}T/.test(x.date)&&!Number.isNaN(Date.parse(x.date))?x.date:null;
 return {id:"event:"+String(x.id||i).slice(0,140),conversation:title,text,role,date};
}
async function sourceInfo(dir,name,maxBytes){
 const path=join(dir,name);let stat;
 try{stat=await lstat(path);}catch(e){if(e.code==="ENOENT")return null;throw Error("Cannot inspect authorized history source.");}
 if(!stat.isFile()||stat.isSymbolicLink())throw Error("History source must be a regular non-symlink file.");
 if(stat.size>maxBytes)throw Error("History source exceeds its size limit.");
 return {path,signature:[stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs].join(":")};
}
export function createHistoryStore(dir){
 if(typeof dir!=="string"||!isAbsolute(dir))throw Error("Set MISSING_AI_HISTORY_DIR to an explicit absolute folder path.");
 let cache=null,signature=null;
 return {async load(){
  const directory=await lstat(dir).catch(()=>{throw Error("Configured history folder is unavailable.");});
  if(!directory.isDirectory()||directory.isSymbolicLink())throw Error("History folder must be a real directory.");
  const [exportFile,eventFile]=await Promise.all([sourceInfo(dir,"conversations.json",HISTORY_LIMITS.maxFileBytes),sourceInfo(dir,"agent-events.jsonl",MAX_EVENTS)]);
  const next=[exportFile?.signature||"-",eventFile?.signature||"-"].join("|");
  if(next===signature&&cache)return cache;
  let messages=[],sources=[];
  if(exportFile){
   const parsed=JSON.parse(await readFile(exportFile.path,"utf8"));
   messages=importChatGPTExport(parsed).messages;
   sources.push("chatgpt-export");
  }
  if(eventFile){
   const lines=(await readFile(eventFile.path,"utf8")).split("\n").filter(Boolean);
   if(lines.length>2000)throw Error("Authorized event file exceeds 2,000 records.");
   const seen=new Set(messages.map(m=>m.id));
   for(let i=0;i<lines.length;i++){
    const m=cleanEvent(JSON.parse(lines[i]),i+1);
    if(!seen.has(m.id)){messages.push(m);seen.add(m.id);}
   }
   sources.push("agent-events");
  }
  if(messages.length>HISTORY_LIMITS.maxMessages||messages.reduce((n,m)=>n+m.text.length,0)>HISTORY_LIMITS.maxCharacters)throw Error("Combined history exceeds local safety limits.");
  cache={messages,status:{source_types:sources,message_count:messages.length,refresh:"on every tool call when source files change",remote_storage:false}};
  signature=next;
  return cache;
 }};
}
export const PRIVATE_HISTORY_TOOLS=[
 {name:"missing_ai_history_status",description:"Read only local-authorized history source counts. Never reads a ChatGPT account automatically.",annotations:{readOnlyHint:true},inputSchema:{type:"object",properties:{},additionalProperties:false}},
 {name:"missing_ai_search_history",description:"Before repeating a setup request or claiming an earlier issue remains unsolved, search prior authorized ChatGPT export and recorded agent events. Results are unverified historical statements with attributed excerpts. This private tool cannot read chats not in the local authorized files.",annotations:{readOnlyHint:true},inputSchema:{type:"object",properties:{query:{type:"string",maxLength:15000,description:"Current task or question; use relevant project and technical terms."},max_results:{type:"integer",minimum:1,maximum:12}},required:["query"],additionalProperties:false}},
 {name:"missing_ai_review_answer_history",description:"Check a proposed AI response against the authorized local conversation history before sending it. Flags possibly repeated access requests and solved-work regressions, citing prior statements without asserting actual current state. Call before suggesting that the user regrant access or redo setup.",annotations:{readOnlyHint:true},inputSchema:{type:"object",properties:{ai_answer:{type:"string",maxLength:15000},max_results:{type:"integer",minimum:1,maximum:12}},required:["ai_answer"],additionalProperties:false}}
];
export async function dispatchHistoryRpc(store,req){
 if(!req||req.jsonrpc!=="2.0"||typeof req.method!=="string")return {jsonrpc:"2.0",id:req?.id??null,error:{code:-32600,message:"Invalid JSON-RPC request"}};
 if(req.method.startsWith("notifications/"))return null;
 const response={jsonrpc:"2.0",id:req.id??null};
 try{
  if(req.method==="initialize")return {...response,result:{protocolVersion:"2025-06-18",capabilities:{tools:{listChanged:false}},serverInfo:{name:"missing-ai-private-history",version:"0.1.0"}}};
  if(req.method==="ping")return {...response,result:{}};
  if(req.method==="tools/list")return {...response,result:{tools:PRIVATE_HISTORY_TOOLS}};
  if(req.method!=="tools/call")return {...response,error:{code:-32601,message:"Method not found"}};
  const args=req.params?.arguments||{},name=req.params?.name;
  if(!PRIVATE_HISTORY_TOOLS.some(t=>t.name===name)||!args||typeof args!=="object"||Array.isArray(args))return {...response,error:{code:-32602,message:"Unknown tool or invalid arguments"}};
  const {messages,status}=await store.load();
  let result;
  if(name==="missing_ai_history_status")result=status;
  else {
   const input=bounded(name==="missing_ai_search_history"?args.query:args.ai_answer,15000,"Query");
   const limit=args.max_results===undefined?8:Number(args.max_results);
   if(!Number.isInteger(limit)||limit<1||limit>12)throw Error("max_results must be 1–12.");
   result=reviewContext(messages,input,{maxResults:limit});
   if(name==="missing_ai_search_history")result={...result,findings:result.findings.map(f=>({...f,kind:"related_history"})),summary:{potential_overlooks:0,related:result.findings.length}};
  }
  return {...response,result:{content:[{type:"text",text:JSON.stringify(result)}],isError:false}};
 }catch(e){return {...response,result:{content:[{type:"text",text:String(e.message||"Private history lookup failed.").slice(0,300)}],isError:true}};}
}
export function serveStdio(store,input=process.stdin,output=process.stdout){
 const rl=readline.createInterface({input,crlfDelay:Infinity,terminal:false});
 rl.on("line",async line=>{
  if(line.length>100_000){output.write(JSON.stringify({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Message too large"}})+"\n");return;}
  try{const result=await dispatchHistoryRpc(store,JSON.parse(line));if(result)output.write(JSON.stringify(result)+"\n");}
  catch{output.write(JSON.stringify({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Invalid JSON"}})+"\n");}
 });
 return rl;
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 try{serveStdio(createHistoryStore(process.env.MISSING_AI_HISTORY_DIR));}
 catch(e){process.stderr.write("Private history MCP startup failed: "+e.message+"\n");process.exitCode=1;}
}

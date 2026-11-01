// Local-only opt-in append for owned AI agents. Never callable via MCP.
import {open,lstat} from "node:fs/promises";
import {constants} from "node:fs";
import {join,isAbsolute} from "node:path";
import {randomUUID} from "node:crypto";
const dir=process.env.MISSING_AI_HISTORY_DIR;
if(!dir||!isAbsolute(dir)){process.stderr.write("Set MISSING_AI_HISTORY_DIR to an absolute private directory.\n");process.exit(2);}
const st=await lstat(dir).catch(()=>null);
if(!st?.isDirectory()||st.isSymbolicLink()){process.stderr.write("Authorized history directory unavailable or symlinked.\n");process.exit(2);}
let raw="";process.stdin.setEncoding("utf8");
for await(const chunk of process.stdin){raw+=chunk;if(raw.length>8000){process.stderr.write("Event exceeds input bound.\n");process.exit(2);}}
let data;try{data=JSON.parse(raw);}catch{process.stderr.write("Provide one JSON object over stdin.\n");process.exit(2);}
if(!data||typeof data!=="object"||Array.isArray(data)||typeof data.conversation!=="string"||!data.conversation.trim()||data.conversation.length>160||typeof data.text!=="string"||!data.text.trim()||data.text.length>3000){process.stderr.write("Event must include conversation (1-160 chars) and text (1-3000 chars).\n");process.exit(2);}
const record={id:randomUUID(),conversation:data.conversation.trim(),text:data.text.trim(),role:"event",date:new Date().toISOString()};
const file=join(dir,"agent-events.jsonl");
let fd;try{
 fd=await open(file,constants.O_WRONLY|constants.O_APPEND|constants.O_CREAT|constants.O_NOFOLLOW,0o600);
 const info=await fd.stat();if(!info.isFile()||info.size>2*1024*1024-5000)throw Error("Authorized event file is full or invalid.");
 await fd.writeFile(JSON.stringify(record)+"\n",{encoding:"utf8"});
 process.stdout.write("Event recorded in private local history.\n");
}catch(e){process.stderr.write("Local event recording failed.\n");process.exitCode=1;}finally{await fd?.close();}

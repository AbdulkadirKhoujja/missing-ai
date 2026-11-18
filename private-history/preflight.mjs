// Optional agent-pipeline preflight: read an AI draft from stdin, check authorized local history.
// Returns a bounded JSON report. No network, raw input logging, or archive writes.
import {createHistoryStore} from "./context-mcp.mjs";
import {reviewContext} from "../site/history-context.mjs";
const root=process.env.MISSING_AI_HISTORY_DIR;
if(!root){process.stderr.write("Missing authorized MISSING_AI_HISTORY_DIR.\n");process.exit(2);}
let input="";
process.stdin.setEncoding("utf8");
for await(const chunk of process.stdin){input+=chunk;if(input.length>15000){process.stderr.write("Answer exceeds 15,000 characters.\n");process.exit(2);}}
if(!input.trim()){process.stderr.write("Provide an answer draft over stdin.\n");process.exit(2);}
try{
 const store=createHistoryStore(root);
 const {messages}=await store.load();
 const report=reviewContext(messages,input,{maxResults:8});
 process.stdout.write(JSON.stringify(report)+"\n");
 // Exit 3 for flagged candidates so a supervising agent can require a second look.
 // Do not treat this code as proof that the draft is false.
 if(report.summary.potential_overlooks>0)process.exitCode=3;
}catch(e){process.stderr.write("Local history preflight unavailable: "+String(e.message||"unknown error").slice(0,160)+"\n");process.exitCode=2;}

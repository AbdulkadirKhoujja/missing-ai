import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
const cwd=new URL("..",import.meta.url);
const run=(dir,input)=>spawnSync(process.execPath,["private-history/preflight.mjs"],{cwd,env:{...process.env,MISSING_AI_HISTORY_DIR:dir},input,encoding:"utf8"});
test("automatic preflight flags a repeated setup suggestion without declaring it false",async()=>{
 const root=await mkdtemp(join(tmpdir(),"missing-ai-preflight-"));
 try{
 const data=[{id:"demo",title:"Demo hosting project",current_node:"a",mapping:{a:{parent:null,message:{author:{role:"user"},content:{parts:["I already granted access to the demo cloud host."]},create_time:1700000000}}}}];
 await writeFile(join(root,"conversations.json"),JSON.stringify(data));
 const r=run(root,"Please grant access to the demo cloud host again.");
 assert.equal(r.status,3,r.stderr);
 const report=JSON.parse(r.stdout);
 assert.equal(report.summary.potential_overlooks,1);
 assert.equal(report.status,"review_required");
 }finally{await rm(root,{recursive:true,force:true});}
});
test("automatic preflight exits zero on no supported candidate",async()=>{
 const root=await mkdtemp(join(tmpdir(),"missing-ai-preflight-"));
 try{
 const r=run(root,"Here is a general explanation of React component rendering.");
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).summary.potential_overlooks,0);
 }finally{await rm(root,{recursive:true,force:true});}
});

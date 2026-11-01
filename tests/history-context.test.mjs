import test from "node:test";
import assert from "node:assert/strict";
import {importChatGPTExport,reviewContext,addLocalNote} from "../site/history-context.mjs";
import {encryptHistory,decryptHistory} from "../site/history-vault.mjs";
const msg=(role,content,t=1700000000)=>({author:{role},content:{parts:[content]},create_time:t});
const exportJson=[{id:"conv-a",title:"Orchestryn connection",current_node:"n3",mapping:{
 n1:{parent:null,message:msg("user","Please connect to Hetzner")},
 n2:{parent:"n1",message:msg("user","I have already given you access to Hetzner and verified the connection.")},
 n3:{parent:"n2",message:msg("assistant","Confirmed access to Hetzner.")},
 alternate:{parent:"n1",message:msg("assistant","Alternate branch which must not be imported.")}
}}];
test("imports active conversation branch and preserves speaker attribution",()=>{
 const result=importChatGPTExport(exportJson);
 assert.equal(result.messages.length,3);assert.equal(result.messages[1].role,"user");assert.equal(result.messages[1].conversation,"Orchestryn connection");
 assert.equal(result.messages.some(m=>m.text.includes("Alternate branch")),false);
});
test("flags possible repeated access requests with original evidence",()=>{
 const {messages}=importChatGPTExport(exportJson);
 const report=reviewContext(messages,"You need to give me access to Hetzner again before I can continue.");
 assert.ok(report.findings.some(f=>f.kind==="possible_access_recheck"&&f.role==="user"&&f.quote.includes("already given")));
});
test("retrieves history but does not invent a gap for a neutral review",()=>{
 const {messages}=importChatGPTExport(exportJson);
 const report=reviewContext(messages,"Review the current Hetzner connectivity status.");
 assert.equal(report.summary.potential_overlooks,0);assert.ok(report.findings.length>0);
});
test("rejects malformed and oversized inputs",()=>{
 assert.throws(()=>importChatGPTExport({mapping:{}}),/Expected ChatGPT/);
 assert.throws(()=>reviewContext([],"x".repeat(15001)),/15,000/);
});
test("retains untrusted text as data",()=>{
 const notes=addLocalNote([],"Local log","<img src=x onerror=alert(1)>");
 assert.equal(notes[0].text,"<img src=x onerror=alert(1)>");assert.equal(notes[0].role,"note");
});
test("encrypts, unlocks, and rejects an incorrect passphrase",async()=>{
 const original=importChatGPTExport(exportJson).messages;
 const ciphertext=await encryptHistory(original,"a long local test passphrase");
 assert.equal(JSON.stringify(ciphertext).includes("Hetzner"),false);
 assert.deepEqual(await decryptHistory(ciphertext,"a long local test passphrase"),original);
 await assert.rejects(()=>decryptHistory(ciphertext,"the wrong passphrase"),/Could not unlock/);
});
test("does not classify explicit unresolved work as completed",()=>{
 const notes=addLocalNote([],"GitHub scheduler","GitHub connectivity was not fixed and remains unresolved.");
 assert.equal(reviewContext(notes,"We need to fix the GitHub connectivity in the scheduler.").summary.potential_overlooks,0);
});

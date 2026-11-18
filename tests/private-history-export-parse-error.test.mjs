// Synthetic check for the private, read-only history MCP (issue #73): a malformed conversations.json must not
// echo any of its own text back through the tool error. Node's raw JSON.parse message quotes the characters near
// the failure, which would be private history. All fixtures are fictional.
// Scope: this covers the JSON parse step only. Errors raised later by importChatGPTExport are not covered here.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";

const status={jsonrpc:"2.0",id:3,method:"tools/call",params:{name:"missing_ai_history_status",arguments:{}}};
async function exportReply(contents){
 const root=await mkdtemp(join(tmpdir(),"missing-ai-export-parse-"));
 try{
  await writeFile(join(root,"conversations.json"),contents);
  const reply=await dispatchHistoryRpc(createHistoryStore(root),status);
  return {reply,root};
 }finally{await rm(root,{recursive:true,force:true});}
}

test("malformed conversations.json returns a generic error with no file content",async()=>{
 const cases=[
  "PRIVMARK harbor ledger notes, not json at all",
  '[{"title":"Harbor PRIVMARK","mapping":{"a":{"message":PRIVMARK unquoted}}}]',
  '[{"title":"PRIVMARK truncated',
  "{\"title\":\"ok\"}\nPRIVMARK trailing text",
 ];
 for(const contents of cases){
  const {reply,root}=await exportReply(contents);
  assert.equal(reply.jsonrpc,"2.0");
  assert.equal(reply.id,3);
  assert.equal(reply.result.isError,true);
  const text=reply.result.content[0].text;
  assert.equal(text,"conversations.json is not valid JSON.");
  assert.equal(/PRIVMARK|harbor|ledger|title|mapping|unquoted|trailing/i.test(text),false);
  assert.equal(text.includes(root),false);
 }
});

test("a malformed export does not stop later calls once the file is fixed",async()=>{
 const root=await mkdtemp(join(tmpdir(),"missing-ai-export-parse-"));
 try{
  const store=createHistoryStore(root);
  await writeFile(join(root,"conversations.json"),"PRIVMARK not json");
  assert.equal((await dispatchHistoryRpc(store,status)).result.isError,true);
  await writeFile(join(root,"conversations.json"),"[]");
  const ok=await dispatchHistoryRpc(store,status);
  assert.equal(ok.result.isError,false);
  assert.deepEqual(JSON.parse(ok.result.content[0].text).source_types,["chatgpt-export"]);
 }finally{await rm(root,{recursive:true,force:true});}
});

// Reproducible, synthetic-only developer proof for the existing local private-history tools.
// Uses a throwaway folder and the already-shipped opt-in event CLI; no network or accounts.
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {spawnSync} from "node:child_process";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";

const repoRoot=fileURLToPath(new URL("../",import.meta.url));
const request=(name,args={})=>({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}});
function decode(response){
  assert.equal(response?.result?.isError,false,"private MCP returned a bounded error");
  return JSON.parse(response.result.content[0].text);
}
export async function runDemo(){
  const folder=await mkdtemp(join(tmpdir(),"missing-ai-agent-memory-demo-"));
  try{
    const event={
      conversation:"Project Orion release checklist",
      text:"Project Orion staging CI passed and the rollout checklist was verified. This is an agent-recorded claim, not independent proof."
    };
    // The write is explicitly initiated by this local example, NEVER by an MCP model tool.
    const recorded=spawnSync(process.execPath,["private-history/record-event.mjs"],{
      cwd:repoRoot,env:{...process.env,MISSING_AI_HISTORY_DIR:folder},
      input:JSON.stringify(event),encoding:"utf8",timeout:10000
    });
    assert.equal(recorded.status,0,"opt-in local event could not be recorded");

    // Fresh reader instance: reloads the persisted local record, not an in-memory demo array.
    const store=createHistoryStore(folder);
    const status=decode(await dispatchHistoryRpc(store,request("missing_ai_history_status")));
    assert.deepEqual(status.source_types,["agent-events"]);
    assert.equal(status.message_count,1);
    assert.equal(status.remote_storage,false);

    const found=decode(await dispatchHistoryRpc(store,request(
      "missing_ai_search_history",{query:"Project Orion staging CI rollout checklist"}
    )));
    const match=found.findings.find(f=>f.role==="event"&&f.conversation===event.conversation);
    assert.ok(match,"the approved event must be retrieved with source attribution");
    assert.match(match.id,/^event:/);
    assert.match(match.quote,/Project Orion staging CI passed/);

    const review=decode(await dispatchHistoryRpc(store,request(
      "missing_ai_review_answer_history",{
        ai_answer:"We need to redo the Project Orion staging CI rollout checklist from scratch."
      }
    )));
    assert.ok(review.findings.some(f=>f.kind==="possible_repeated_work"),
      "a proposed repeated-work claim should be flagged for review");

    return {
      example:"synthetic-local-agent-memory",
      persisted_event_reloaded:true,
      source_types:status.source_types,
      history_messages:status.message_count,
      source_attributed:true,
      repeated_work_candidates:review.summary.potential_overlooks,
      remote_storage:status.remote_storage,
      verified_implementation:false,
      limitations:"Lexical retrieval of an agent-recorded claim; not independent proof, multi-user memory, remote sync or provider history access."
    };
  }finally{
    await rm(folder,{recursive:true,force:true});
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{process.stdout.write(JSON.stringify(await runDemo())+"\n");}
  catch(error){process.stderr.write("Synthetic agent-memory demo failed.\n");process.exitCode=1;}
}

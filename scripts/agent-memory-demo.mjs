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

    // A genuinely new Node process, rather than another in-process reader,
    // must recover the same event ID from the owner-approved local file.
    const moduleUrl=pathToFileURL(join(repoRoot,"private-history/context-mcp.mjs")).href;
    const coldSource=`import {createHistoryStore,dispatchHistoryRpc} from ${JSON.stringify(moduleUrl)};
const s=createHistoryStore(process.env.MISSING_AI_HISTORY_DIR);
const reply=await dispatchHistoryRpc(s,{jsonrpc:"2.0",id:1,method:"tools/call",
  params:{name:"missing_ai_search_history",arguments:{
    query:"Project Orion staging CI rollout checklist",max_results:5
  }}});
if(reply?.result?.isError)process.exitCode=1;
else process.stdout.write(reply.result.content[0].text);`;
    const cold=spawnSync(process.execPath,["--input-type=module","--eval",coldSource],{
      cwd:repoRoot,env:{...process.env,MISSING_AI_HISTORY_DIR:folder},
      encoding:"utf8",timeout:10000,maxBuffer:128*1024
    });
    assert.equal(cold.status,0,"new agent process could not reload approved local memory");
    const coldResult=JSON.parse(cold.stdout);
    const coldMatch=coldResult.findings.find(f=>f.role==="event"&&f.conversation===event.conversation);
    assert.ok(coldMatch,"new process must retrieve the persisted event");
    assert.equal(coldMatch.id,match.id,"stable event identity must survive a process restart");
    assert.match(coldMatch.quote,/Project Orion staging CI passed/);

    const review=decode(await dispatchHistoryRpc(store,request(
      "missing_ai_review_answer_history",{
        ai_answer:"We need to redo the Project Orion staging CI rollout checklist from scratch."
      }
    )));
    assert.ok(review.findings.some(f=>f.kind==="possible_repeated_work"),
      "a proposed repeated-work claim should be flagged for review");

    // A second explicit local event is appended *after* the reader has
    // already populated its cache. The SAME reader must see it on its next
    // tool call; no service restart, account sync or network is involved.
    const laterEvent={
      conversation:"Beacon delivery review",
      text:"Beacon delivery review notes were explicitly recorded after the first history lookup. This is an attributed agent claim, not verified delivery."
    };
    const later=spawnSync(process.execPath,["private-history/record-event.mjs"],{
      cwd:repoRoot,env:{...process.env,MISSING_AI_HISTORY_DIR:folder},
      input:JSON.stringify(laterEvent),encoding:"utf8",timeout:10000
    });
    assert.equal(later.status,0,"second opted-in memory event could not be recorded");
    const refreshed=decode(await dispatchHistoryRpc(store,request("missing_ai_history_status")));
    assert.equal(refreshed.message_count,2,"already-initialized reader must see the appended event");
    assert.equal(refreshed.remote_storage,false);
    const laterSearch=decode(await dispatchHistoryRpc(store,request(
      "missing_ai_search_history",{query:"Beacon delivery review notes"}
    )));
    const laterMatch=laterSearch.findings.find(f=>f.role==="event"&&f.conversation===laterEvent.conversation);
    assert.ok(laterMatch,"freshly appended event must be discoverable without reinitialization");
    assert.match(laterMatch.id,/^event:/);
    assert.match(laterMatch.quote,/Beacon delivery review notes/);

    return {
      example:"synthetic-local-agent-memory",
      persisted_event_reloaded:true,
      new_process_recall:true,
      source_id_stable_after_restart:true,
      incremental_append_detected:true,
      post_append_history_messages:refreshed.message_count,
      appended_event_source_attributed:true,
      source_types:status.source_types,
      history_messages:status.message_count,
      source_attributed:true,
      repeated_work_candidates:review.summary.potential_overlooks,
      remote_storage:status.remote_storage,
      verified_implementation:false,
      limitations:"Opt-in local file reload and lexical retrieval of attributed agent claims only; not independent proof, authenticated multi-user memory, remote sync or provider history access."
    };
  }finally{
    await rm(folder,{recursive:true,force:true});
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{process.stdout.write(JSON.stringify(await runDemo())+"\n");}
  catch(error){process.stderr.write("Synthetic agent-memory demo failed.\n");process.exitCode=1;}
}

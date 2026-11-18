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
const sourceIds=search=>search.findings.filter(f=>typeof f.id==="string").map(f=>f.id);
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

    const negativeQuery="Quartz nebula ledger identifier absent from this fixture";
    const negativeSearch=decode(await dispatchHistoryRpc(store,request(
      "missing_ai_search_history",{query:negativeQuery}
    )));
    assert.equal(negativeSearch.findings.filter(f=>f.role==="event").length,0,
      "an absent query must not fabricate an event finding");
    assert.deepEqual(sourceIds(negativeSearch),[],
      "an absent query must not fabricate a source ID");

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

    // Refreshing the SAME reader must preserve the original Orion source ID
    // while keeping it distinct from the newly appended Beacon event. This is
    // a local identity check only, not proof of factual accuracy or isolation.
    const postAppendSearch=decode(await dispatchHistoryRpc(store,request(
      "missing_ai_search_history",{query:"Project Orion staging CI rollout checklist"}
    )));
    const postAppendMatch=postAppendSearch.findings.find(
      f=>f.role==="event"&&f.conversation===event.conversation
    );
    assert.ok(postAppendMatch,"the same reader must still retrieve the original Orion event");
    assert.equal(postAppendMatch.id,match.id,
      "the same reader must retain the original Orion source ID after append");
    assert.equal(postAppendMatch.id,coldMatch.id,
      "the post-append Orion source ID must match the fresh-process source ID");
    assert.notEqual(postAppendMatch.id,laterMatch.id,
      "the appended Beacon event must have a distinct source ID");

    const retrievalFixture=[
      {
        query:"Project Orion staging CI rollout checklist",
        expected_source_ids:[match.id],
        actual_source_ids:sourceIds(postAppendSearch)
      },
      {
        query:"Beacon delivery review notes",
        expected_source_ids:[laterMatch.id],
        actual_source_ids:sourceIds(laterSearch)
      },
      {
        query:negativeQuery,
        expected_source_ids:[],
        actual_source_ids:sourceIds(negativeSearch)
      }
    ];
    const positiveFixtures=retrievalFixture.slice(0,2);
    const trueHits=positiveFixtures.reduce((count,fixture)=>count+
      fixture.expected_source_ids.filter(id=>fixture.actual_source_ids.includes(id)).length,0);
    const trueHitDenominator=positiveFixtures.reduce((count,fixture)=>
      count+fixture.expected_source_ids.length,0);
    const negativeFixtures=retrievalFixture.slice(2);
    const falseRecalls=negativeFixtures.reduce((count,fixture)=>
      count+fixture.actual_source_ids.length,0);
    const falseRecallDenominator=negativeFixtures.length;
    assert.equal(trueHits,2,"both positive fixture source IDs must be retrieved");
    assert.equal(trueHitDenominator,2);
    assert.equal(falseRecalls,0,"the negative fixture must have no recalled source IDs");
    assert.equal(falseRecallDenominator,1);

    return {
      example:"synthetic-local-agent-memory",
      persisted_event_reloaded:true,
      new_process_recall:true,
      source_id_stable_after_restart:true,
      incremental_append_detected:true,
      post_append_original_source_identity:{
        pre_append:match.id,
        fresh_process:coldMatch.id,
        same_reader_after_append:postAppendMatch.id,
        appended_beacon:laterMatch.id
      },
      post_append_history_messages:refreshed.message_count,
      appended_event_source_attributed:true,
      retrieval_fixture:retrievalFixture,
      retrieval_metrics:{
        true_hits:trueHits,
        true_hit_denominator:trueHitDenominator,
        false_recalls:falseRecalls,
        false_recall_denominator:falseRecallDenominator
      },
      source_types:status.source_types,
      history_messages:status.message_count,
      source_attributed:true,
      repeated_work_candidates:review.summary.potential_overlooks,
      remote_storage:status.remote_storage,
      verified_implementation:false,
      limitations:"Opt-in local file reload and lexical retrieval of attributed agent claims only; not independent proof or authenticated multi-user memory; source IDs do not prove independent factual accuracy, authenticated user/agent isolation, corrections or deletion; not remote sync or provider history access."
    };
  }finally{
    await rm(folder,{recursive:true,force:true});
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{process.stdout.write(JSON.stringify(await runDemo())+"\n");}
  catch(error){process.stderr.write("Synthetic agent-memory demo failed.\n");process.exitCode=1;}
}

// Synthetic regression spec for stale claims, later corrections and duplicate
// identifiers in owner-local agent events (issue #73: correction/supersession,
// conflict detection, stable identifiers and timestamps).
//
// Passing tests pin what the existing read-only tools already guarantee.
// Tests marked `todo` are EXECUTABLE descriptions of known gaps: they run on
// every CI build, currently fail, and are reported as TODO without failing the
// suite. They are not implemented behaviour and must not be cited as such.
// Fixtures are fictional; no storage, schema, auth or MCP code is changed here.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";

const rpc=(name,args={})=>({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}});
const CONVERSATION="Harbor queue migration";
const claim={
  id:"harbor-claim-001",conversation:CONVERSATION,role:"event",date:"2026-03-01T10:00:00.000Z",
  text:"We have fixed the Harbor queue migration configuration and verified it."
};
const correction={
  id:"harbor-correction-002",conversation:CONVERSATION,role:"event",date:"2026-03-03T10:00:00.000Z",
  text:"Correction: the Harbor queue migration configuration fix was reverted and it is not fixed; the earlier note is outdated."
};
const ANSWER="We need to fix the Harbor queue migration configuration.";
const QUERY="Harbor queue migration configuration";

async function withEvents(records,run){
  const folder=await mkdtemp(join(tmpdir(),"missing-ai-stale-correction-"));
  try{
    await writeFile(join(folder,"agent-events.jsonl"),records.map(r=>JSON.stringify(r)).join("\n")+"\n",{encoding:"utf8",mode:0o600});
    return await run(folder);
  }finally{await rm(folder,{recursive:true,force:true});}
}
async function call(folder,name,args){
  const response=await dispatchHistoryRpc(createHistoryStore(folder),rpc(name,args));
  return {isError:response?.result?.isError,text:response?.result?.content?.[0]?.text};
}
async function ok(folder,name,args){
  const {isError,text}=await call(folder,name,args);
  assert.equal(isError,false,"private-history tool failed");
  return JSON.parse(text);
}

test("a claim and its later correction are both recalled with distinct IDs and their own dates",async()=>{
  await withEvents([claim,correction],async folder=>{
    const found=await ok(folder,"missing_ai_search_history",{query:QUERY});
    assert.equal(found.history_messages,2);
    assert.deepEqual(found.findings.map(f=>f.id).sort(),["event:"+claim.id,"event:"+correction.id].sort(),
      "neither side of the disagreement may be dropped or merged");
    const byId=Object.fromEntries(found.findings.map(f=>[f.id,f]));
    assert.equal(byId["event:"+claim.id].date,claim.date);
    assert.equal(byId["event:"+correction.id].date,correction.date);
    assert.match(byId["event:"+correction.id].quote,/reverted and it is not fixed/);
    assert.match(byId["event:"+claim.id].quote,/fixed the Harbor queue migration/);
    for(const finding of found.findings)assert.equal(finding.kind,"related_history","search never asserts a verdict");
    assert.match(found.limitations,/do not prove past actions/i);
  });
});

test("search lists the newer correction before the older claim when relevance ties",async()=>{
  for(const order of [[claim,correction],[correction,claim]]){
    await withEvents(order,async folder=>{
      const found=await ok(folder,"missing_ai_search_history",{query:QUERY});
      assert.equal(found.findings[0].score,found.findings[1].score,"fixture must be a genuine relevance tie");
      assert.deepEqual(found.findings.map(f=>f.id),["event:"+correction.id,"event:"+claim.id],
        "recency ordering must not depend on file line order");
    });
  }
});

test("answer review returns the correction alongside the older claim at the default limit",async()=>{
  await withEvents([claim,correction],async folder=>{
    const review=await ok(folder,"missing_ai_review_answer_history",{ai_answer:ANSWER});
    const ids=review.findings.map(f=>f.id);
    assert.ok(ids.includes("event:"+correction.id),"the dated correction must be visible to the reviewer");
    assert.ok(ids.includes("event:"+claim.id));
    assert.equal(review.status,"review_required","the tool asks for review rather than asserting current state");
  });
});

test("results for the same files are identical across fresh readers",async()=>{
  await withEvents([claim,correction],async folder=>{
    const first=await ok(folder,"missing_ai_review_answer_history",{ai_answer:ANSWER});
    const second=await ok(folder,"missing_ai_review_answer_history",{ai_answer:ANSWER});
    assert.deepEqual(second,first);
  });
});

// ---- Known gaps (issue #73). Executable, currently failing, reported as TODO. ----

test("KNOWN GAP: an older 'fixed' claim is not counted as an overlook once a later correction exists",{todo:"issue #73 correction/supersession is not implemented"},async()=>{
  await withEvents([claim,correction],async folder=>{
    const review=await ok(folder,"missing_ai_review_answer_history",{ai_answer:ANSWER});
    const stale=review.findings.find(f=>f.id==="event:"+claim.id);
    assert.notEqual(stale?.kind,"possible_repeated_work",
      "redoing work that a later note says was reverted is not repeated work");
    assert.equal(review.summary.potential_overlooks,0);
  });
});

test("KNOWN GAP: a single-result review does not show only the superseded claim",{todo:"issue #73 correction/supersession is not implemented"},async()=>{
  await withEvents([claim,correction],async folder=>{
    const review=await ok(folder,"missing_ai_review_answer_history",{ai_answer:ANSWER,max_results:1});
    assert.equal(review.findings.length,1);
    assert.equal(review.findings[0].id,"event:"+correction.id,
      "with room for one finding, the newer correction must not be hidden behind the stale claim");
  });
});

test("KNOWN GAP: a second record reusing an existing identifier is not silently discarded",{todo:"issue #73 conflict detection for duplicate identifiers is not implemented"},async()=>{
  const reused={...correction,id:claim.id};
  await withEvents([claim,reused],async folder=>{
    const {isError,text}=await call(folder,"missing_ai_history_status");
    const silentlyDropped=isError===false&&JSON.parse(text).message_count===1;
    assert.equal(silentlyDropped,false,
      "two different records sharing one ID must be reported or both kept, never reduced to one without notice");
  });
});

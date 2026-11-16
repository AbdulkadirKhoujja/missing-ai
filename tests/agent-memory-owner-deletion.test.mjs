// Synthetic regression spec for OWNER deletion of local agent events (issue #73,
// roadmap #86 Gate B: memory add / retrieve / correct / delete with provenance).
//
// There is no delete tool: `record-event.mjs` only appends and the MCP reader is
// read-only. The only deletion path today is the owner editing or removing
// `agent-events.jsonl` in the folder they configured. These tests pin what the
// existing reader does after such an edit. They are local functional checks on
// fictional records; they say nothing about copies, backups, or text a client
// already received before the deletion. No storage, schema or MCP code changes.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rename,rm,unlink,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";

const CONVERSATION="Lantern billing export";
const kept={
  id:"lantern-kept-001",conversation:CONVERSATION,role:"event",date:"2026-04-01T09:00:00.000Z",
  text:"The Lantern billing export schedule runs nightly at two."
};
const removed={
  id:"lantern-removed-002",conversation:CONVERSATION,role:"event",date:"2026-04-02T09:00:00.000Z",
  text:"We fixed the Lantern billing export retry and verified it with marker QUILLFENNEL."
};
const correction={
  id:"lantern-correction-003",conversation:CONVERSATION,role:"event",date:"2026-04-03T09:00:00.000Z",
  text:"Supersedes event:lantern-removed-002. The Lantern billing export retry is not fixed."
};
const QUERY="Lantern billing export retry";
const ANSWER="We need to fix the Lantern billing export retry.";
const SECRET=/QUILLFENNEL/;

const eventsPath=folder=>join(folder,"agent-events.jsonl");
const serialise=records=>records.map(r=>JSON.stringify(r)).join("\n")+"\n";
const writeEvents=(folder,records)=>writeFile(eventsPath(folder),serialise(records),{encoding:"utf8",mode:0o600});
async function withFolder(run){
  const folder=await mkdtemp(join(tmpdir(),"missing-ai-owner-deletion-"));
  try{return await run(folder);}finally{await rm(folder,{recursive:true,force:true});}
}
// Returns the raw response text as well, so a test can assert that deleted text
// appears nowhere in what the tool sent, not only that one field is absent.
async function call(store,name,args={}){
  const response=await dispatchHistoryRpc(store,{jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}});
  const raw=response?.result?.content?.[0]?.text;
  assert.equal(response?.result?.isError,false,"private-history tool failed: "+raw);
  return {raw,data:JSON.parse(raw)};
}
const ids=result=>result.data.findings.map(f=>f.id);

test("an already-running reader stops serving a record once the owner removes its line",async()=>{
  await withFolder(async folder=>{
    await writeEvents(folder,[kept,removed]);
    const store=createHistoryStore(folder);

    const before=await call(store,"missing_ai_search_history",{query:QUERY});
    assert.ok(ids(before).includes("event:"+removed.id),"fixture: the record must be served before deletion");
    assert.match(before.raw,SECRET);
    assert.equal((await call(store,"missing_ai_history_status")).data.message_count,2);

    await writeEvents(folder,[kept]);

    const after=await call(store,"missing_ai_search_history",{query:QUERY});
    assert.deepEqual(ids(after),["event:"+kept.id],"only the remaining record may be returned");
    assert.doesNotMatch(after.raw,SECRET,"deleted text must not appear anywhere in the response");
    assert.equal(after.data.history_messages,1);

    const review=await call(store,"missing_ai_review_answer_history",{ai_answer:ANSWER});
    assert.doesNotMatch(review.raw,SECRET);
    assert.equal(review.data.summary.potential_overlooks,0,"a deleted completion claim can no longer be flagged");

    const status=(await call(store,"missing_ai_history_status")).data;
    assert.equal(status.message_count,1);
    assert.equal(status.duplicate_ids_ignored,0);
  });
});

test("replacing the file with a same-length file is also picked up by a running reader",async()=>{
  await withFolder(async folder=>{
    // Same byte length as `removed`, so the change cannot be noticed from file size alone.
    const replacement={...removed,text:removed.text.replace("QUILLFENNEL","REPLACEMENT")};
    assert.equal(serialise([kept,replacement]).length,serialise([kept,removed]).length,"fixture must keep the byte length");
    await writeEvents(folder,[kept,removed]);
    const store=createHistoryStore(folder);
    assert.match((await call(store,"missing_ai_search_history",{query:QUERY})).raw,SECRET);

    const staged=join(folder,"agent-events.jsonl.next");
    await writeFile(staged,serialise([kept,replacement]),{encoding:"utf8",mode:0o600});
    await rename(staged,eventsPath(folder));

    const after=await call(store,"missing_ai_search_history",{query:QUERY});
    assert.doesNotMatch(after.raw,SECRET);
    assert.match(after.raw,/REPLACEMENT/);
    assert.equal(after.data.history_messages,2);
  });
});

test("removing the whole event file leaves an empty, working reader",async()=>{
  await withFolder(async folder=>{
    await writeEvents(folder,[kept,removed]);
    const store=createHistoryStore(folder);
    assert.equal((await call(store,"missing_ai_history_status")).data.message_count,2);

    await unlink(eventsPath(folder));

    const status=(await call(store,"missing_ai_history_status")).data;
    assert.equal(status.message_count,0);
    assert.deepEqual(status.source_types,[],"no source may be reported once its file is gone");
    const after=await call(store,"missing_ai_search_history",{query:QUERY});
    assert.deepEqual(after.data.findings,[]);
    assert.equal(after.data.history_messages,0);
    assert.doesNotMatch(after.raw,SECRET);
  });
});

test("a correction that names a deleted record stays as an ordinary record with no dangling link",async()=>{
  await withFolder(async folder=>{
    await writeEvents(folder,[kept,removed,correction]);
    const store=createHistoryStore(folder);
    const linked=await call(store,"missing_ai_review_answer_history",{ai_answer:ANSWER});
    const old=linked.data.findings.find(f=>f.id==="event:"+removed.id);
    assert.equal(old?.superseded_by,"event:"+correction.id,"fixture: the link must exist before deletion");

    await writeEvents(folder,[kept,correction]);

    const after=await call(store,"missing_ai_review_answer_history",{ai_answer:ANSWER});
    assert.ok(!ids(after).includes("event:"+removed.id));
    assert.doesNotMatch(after.raw,SECRET);
    for(const finding of after.data.findings){
      assert.equal(finding.superseded_by,undefined);
      assert.equal(finding.supersedes,undefined,"a correction must not claim to supersede a record that is no longer in the file");
    }
    assert.equal(after.data.summary.superseded,0);
    const survivor=after.data.findings.find(f=>f.id==="event:"+correction.id);
    assert.ok(survivor,"the correction itself is still the owner's record and is still served");
    // The correction's own text still names the deleted ID. Deleting one line does not scrub
    // references that other records make to it; the owner has to edit those separately.
    assert.match(survivor.quote,/lantern-removed-002/);
    assert.equal(after.data.status,"review_required");
  });
});

test("deleting the first record of a reused ID brings the previously ignored record into service",async()=>{
  await withFolder(async folder=>{
    const shadowed={...removed,date:"2026-04-05T09:00:00.000Z",text:"The Lantern billing export retry was rolled back, marker HOLLOWBRINE."};
    await writeEvents(folder,[removed,shadowed]);
    const store=createHistoryStore(folder);
    const before=await call(store,"missing_ai_search_history",{query:QUERY});
    assert.match(before.raw,SECRET);
    assert.doesNotMatch(before.raw,/HOLLOWBRINE/,"fixture: the second record with the same ID is ignored at first");
    assert.equal((await call(store,"missing_ai_history_status")).data.duplicate_ids_ignored,1);

    await writeEvents(folder,[shadowed]);

    const after=await call(store,"missing_ai_search_history",{query:QUERY});
    assert.doesNotMatch(after.raw,SECRET);
    assert.match(after.raw,/HOLLOWBRINE/,"the same ID now resolves to different text; an ID alone is not proof of unchanged content");
    assert.deepEqual(ids(after),["event:"+removed.id]);
    assert.equal(after.data.findings[0].date,shadowed.date);
    const status=(await call(store,"missing_ai_history_status")).data;
    assert.equal(status.message_count,1);
    assert.equal(status.duplicate_ids_ignored,0);
  });
});

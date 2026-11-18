// Synthetic negative and abstention guards for issue #73 correction/supersession.
//
// Every test here PASSES on main today. They pin the "do not over-infer" side of
// the design under discussion in issue #73: a later note may only ever be treated
// as correcting an earlier one when the link is attributable. Shared keywords plus
// a phrase such as "not fixed" are not such a link. These guards exist so that a
// future supersession change cannot quietly dismiss an older warning.
//
// Nothing here implements supersession, and nothing here claims the tool knows
// which record is true. Fixtures are fictional; no storage, schema, auth or MCP
// code is changed.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";
import {reviewContext as siteReview} from "../site/history-context.mjs";
import {reviewContext as rootReview} from "../history-context.mjs";

const rpc=(name,args={})=>({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}});
const CONVERSATION="Lantern cache rollout";
const ANSWER="We need to fix the Lantern cache rollout configuration.";
const claim={
  id:"lantern-claim-001",conversation:CONVERSATION,role:"event",date:"2026-04-01T09:00:00.000Z",
  text:"We have fixed the Lantern cache rollout configuration and verified it."
};
// Later, same conversation, same keywords, contains "not fixed" — but it is about
// a different thing and never refers to the earlier record.
const unrelatedLater={
  id:"lantern-other-002",conversation:CONVERSATION,role:"event",date:"2026-04-03T09:00:00.000Z",
  text:"Separate topic: the Lantern cache rollout configuration dashboard colour is not fixed yet; cosmetic only."
};
const CLAIM_ID="event:"+claim.id;

async function withEvents(records,run){
  const folder=await mkdtemp(join(tmpdir(),"missing-ai-supersession-guards-"));
  try{
    await writeFile(join(folder,"agent-events.jsonl"),records.map(r=>JSON.stringify(r)).join("\n")+"\n",{encoding:"utf8",mode:0o600});
    return await run(folder);
  }finally{await rm(folder,{recursive:true,force:true});}
}
async function ok(folder,name,args){
  const response=await dispatchHistoryRpc(createHistoryStore(folder),rpc(name,args));
  assert.equal(response?.result?.isError,false,"private-history tool failed");
  return JSON.parse(response.result.content[0].text);
}
const review=(folder,extra={})=>ok(folder,"missing_ai_review_answer_history",{ai_answer:ANSWER,...extra});
function assertClaimStillFlagged(result,why){
  const found=result.findings.find(f=>f.id===CLAIM_ID);
  assert.ok(found,"the earlier claim must stay visible: "+why);
  assert.equal(found.kind,"possible_repeated_work",why);
  assert.equal(result.status,"review_required");
  assert.ok(result.summary.potential_overlooks>=1,why);
}

test("fixture sanity: the lone earlier claim is flagged for review",async()=>{
  await withEvents([claim],async folder=>{
    assertClaimStillFlagged(await review(folder),"baseline");
  });
});

test("a later same-conversation note with shared keywords and 'not fixed' does not dismiss the earlier claim",async()=>{
  for(const order of [[claim,unrelatedLater],[unrelatedLater,claim]]){
    await withEvents(order,async folder=>{
      const result=await review(folder);
      assertClaimStillFlagged(result,"keyword overlap plus a negation is not an attributable correction");
      assert.ok(result.findings.some(f=>f.id==="event:"+unrelatedLater.id),"both records stay visible");
    });
  }
});

test("file line order does not change the review of an ambiguous pair",async()=>{
  const forward=await withEvents([claim,unrelatedLater],folder=>review(folder));
  const reversed=await withEvents([unrelatedLater,claim],folder=>review(folder));
  assert.deepEqual(reversed,forward);
});

test("with room for one finding, an ambiguous later note does not hide the flagged claim",async()=>{
  await withEvents([claim,unrelatedLater],async folder=>{
    const result=await review(folder,{max_results:1});
    assert.equal(result.findings.length,1);
    assert.equal(result.findings[0].id,CLAIM_ID);
    assert.equal(result.findings[0].kind,"possible_repeated_work");
    assert.equal(result.history_messages,2,"the total stays reported so truncation is detectable");
  });
});

test("a reversal note in a different conversation does not dismiss the earlier claim",async()=>{
  const elsewhere={...unrelatedLater,id:"harbor-other-003",conversation:"Harbor billing export",
    text:"Correction: the Lantern cache rollout configuration fix was reverted and it is not fixed."};
  await withEvents([claim,elsewhere],async folder=>{
    assertClaimStillFlagged(await review(folder),"cross-conversation text alone is not provenance");
  });
});

test("a 'correction' with a missing, malformed or earlier date does not dismiss the claim",async()=>{
  const text="Correction: the Lantern cache rollout configuration fix was reverted and it is not fixed.";
  const undated={id:"lantern-undated-004",conversation:CONVERSATION,role:"event",text};
  const malformed={...undated,id:"lantern-malformed-005",date:"9999-99-99T99:99:99Z"};
  const notIso={...undated,id:"lantern-notiso-006",date:"tomorrow, definitely later"};
  const earlier={...undated,id:"lantern-earlier-007",date:"2026-03-01T09:00:00.000Z"};
  for(const other of [undated,malformed,notIso,earlier]){
    await withEvents([claim,other],async folder=>{
      const result=await review(folder);
      assertClaimStillFlagged(result,"no trustworthy later date on "+other.id);
      const shown=result.findings.find(f=>f.id==="event:"+other.id);
      if(other!==earlier)assert.equal(shown?.date,null,"an unparseable date is reported as null, never guessed");
    });
  }
});

test("a note naming a record ID that does not exist does not dismiss the claim",async()=>{
  const forged={id:"lantern-forged-008",conversation:CONVERSATION,role:"event",date:"2026-04-05T09:00:00.000Z",
    text:"Supersedes event:lantern-claim-999. The Lantern cache rollout configuration is not fixed.",
    supersedes_id:"event:lantern-claim-999"};
  await withEvents([claim,forged],async folder=>{
    assertClaimStillFlagged(await review(folder),"a reference to an unknown ID links nothing");
  });
});

test("search never asserts a verdict for an ambiguous pair",async()=>{
  await withEvents([claim,unrelatedLater],async folder=>{
    const found=await ok(folder,"missing_ai_search_history",{query:"Lantern cache rollout configuration"});
    assert.equal(found.findings.length,2);
    for(const finding of found.findings)assert.equal(finding.kind,"related_history");
    assert.equal(found.summary.potential_overlooks,0);
  });
});

test("the site and root reviewer mirrors agree on these fixtures",()=>{
  const history=[claim,unrelatedLater].map(r=>({...r,id:"event:"+r.id}));
  for(const options of [{},{maxResults:1}]){
    assert.deepEqual(rootReview(history,ANSWER,options),siteReview(history,ANSWER,options));
  }
  assertClaimStillFlagged(siteReview(history,ANSWER),"direct reviewer call");
});

test("existing output fields consumers rely on are still present",async()=>{
  await withEvents([claim,unrelatedLater],async folder=>{
    const result=await review(folder);
    for(const key of ["engine","status","history_messages","findings","summary","limitations"])assert.ok(key in result,"missing "+key);
    for(const finding of result.findings){
      for(const key of ["id","conversation","role","date","quote","matched_terms","score","kind"])assert.ok(key in finding,"finding missing "+key);
    }
    assert.match(result.limitations,/do not prove past actions/i);
  });
});

test("reading never rewrites the event file, and status is stable and free of note text when an ID is reused",async()=>{
  const reused={...unrelatedLater,id:claim.id};
  await withEvents([claim,reused],async folder=>{
    const file=join(folder,"agent-events.jsonl");
    const before=await readFile(file);
    const first=await ok(folder,"missing_ai_history_status");
    await review(folder);
    const second=await ok(folder,"missing_ai_history_status");
    assert.deepEqual(second,first,"status must be deterministic across fresh readers");
    const serialised=JSON.stringify(first);
    assert.doesNotMatch(serialised,/Lantern|dashboard|cosmetic/i,"status must not expose record text");
    assert.ok(Number.isInteger(first.message_count)&&first.message_count>=1&&first.message_count<=2);
    assert.ok(before.equals(await readFile(file)),"a read-only tool must leave the file byte-identical");
  });
});

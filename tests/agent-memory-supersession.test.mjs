// Synthetic tests for attributable correction links and duplicate-ID diagnostics
// (issue #73). A link only records that a later note DECLARED itself a correction
// of an earlier one; it never establishes which statement is true, and both
// records always stay visible. Fixtures are fictional.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";
import {reviewContext as siteReview} from "../site/history-context.mjs";
import {reviewContext as rootReview} from "../history-context.mjs";

const rpc=(name,args={})=>({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}});
const CONVERSATION="Orchard ledger sync";
const ANSWER="We need to fix the Orchard ledger sync configuration.";
const claim={id:"orchard-claim-001",conversation:CONVERSATION,role:"event",date:"2026-05-01T08:00:00.000Z",
  text:"We have fixed the Orchard ledger sync configuration and verified it."};
const declared={id:"orchard-correction-002",conversation:CONVERSATION,role:"event",date:"2026-05-03T08:00:00.000Z",
  text:"Correction: the Orchard ledger sync configuration fix was reverted and it is not fixed."};
const CLAIM="event:"+claim.id,DECLARED="event:"+declared.id;
// Shares no search term with ANSWER and lives in another conversation: only the explicit ID links it.
const explicit={id:"pier-note-003",conversation:"Pier weekly notes",role:"event",date:"2026-05-04T08:00:00.000Z",
  text:"Supersedes "+CLAIM+". That change was rolled back on Tuesday."};
const EXPLICIT="event:"+explicit.id;

async function withEvents(records,run){
  const folder=await mkdtemp(join(tmpdir(),"missing-ai-supersession-"));
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
const review=(records,extra={})=>withEvents(records,folder=>ok(folder,"missing_ai_review_answer_history",{ai_answer:ANSWER,...extra}));
const byId=(result,id)=>result.findings.find(f=>f.id===id);
const asHistory=records=>records.map(r=>({...r,id:"event:"+r.id}));

test("a declared, uniquely matched later correction links to the earlier claim and keeps both records",async()=>{
  for(const order of [[claim,declared],[declared,claim]]){
    const result=await review(order);
    const old=byId(result,CLAIM),newer=byId(result,DECLARED);
    assert.ok(old&&newer,"both records stay visible");
    assert.equal(old.kind,"related_history");
    assert.equal(old.superseded_by,DECLARED);
    assert.equal(old.supersession_basis,"declared_correction_unique_match");
    assert.deepEqual(newer.supersedes,[CLAIM]);
    assert.ok(result.findings.indexOf(newer)<result.findings.indexOf(old),"the correction is listed first");
    assert.deepEqual(result.summary,{potential_overlooks:0,related:2,superseded:1});
    assert.equal(result.status,"review_required","a link is never a verdict");
    assert.equal(result.omitted_findings,0);
    assert.match(result.limitations,/does not establish which statement is true/);
    assert.match(old.quote,/fixed the Orchard ledger sync/,"the earlier quote is untouched");
  }
});

test("with room for one finding the linked correction is shown and the truncation is disclosed",async()=>{
  const result=await review([claim,declared],{max_results:1});
  assert.deepEqual(result.findings.map(f=>f.id),[DECLARED]);
  assert.deepEqual(result.findings[0].supersedes,[CLAIM]);
  assert.equal(result.omitted_findings,1);
  assert.equal(result.history_messages,2);
});

test("an explicit record-ID reference links across conversations even without shared keywords",async()=>{
  for(const order of [[claim,explicit],[explicit,claim]]){
    const result=await review(order);
    const old=byId(result,CLAIM),newer=byId(result,EXPLICIT);
    assert.equal(old.superseded_by,EXPLICIT);
    assert.equal(old.supersession_basis,"explicit_reference");
    assert.equal(old.kind,"related_history");
    assert.ok(newer,"the referencing note is surfaced although it shares no search term");
    assert.deepEqual(newer.matched_terms,[]);
    assert.deepEqual(result.findings.map(f=>f.id),[EXPLICIT,CLAIM]);
    const one=await review(order,{max_results:1});
    assert.deepEqual(one.findings.map(f=>f.id),[EXPLICIT]);
    assert.equal(one.omitted_findings,1);
  }
});

test("when several later notes link to one claim, the latest dated one is reported",async()=>{
  const result=await review([explicit,claim,declared]);
  assert.equal(byId(result,CLAIM).superseded_by,EXPLICIT);
  assert.ok(byId(result,DECLARED),"the other correction stays visible");
});

test("an explicit reference with a missing, malformed or earlier date links nothing",async()=>{
  for(const date of [undefined,"9999-99-99T99:99:99Z","2026-04-01T08:00:00.000Z",claim.date]){
    const result=await review([claim,{...explicit,date}]);
    const old=byId(result,CLAIM);
    assert.equal(old.kind,"possible_repeated_work","date "+date);
    assert.equal("superseded_by" in old,false);
    assert.equal(result.summary.potential_overlooks,1);
    assert.equal(result.summary.superseded,0);
  }
});

test("a claim with no usable date is never marked superseded",async()=>{
  const result=await review([{...claim,date:"not a date"},declared,explicit]);
  assert.equal(byId(result,CLAIM).kind,"possible_repeated_work");
  assert.equal(result.summary.superseded,0);
});

test("a declared correction with two candidate claims is ambiguous and links neither",async()=>{
  const second={...claim,id:"orchard-claim-004",date:"2026-05-02T08:00:00.000Z",
    text:"Second pass: the Orchard ledger sync configuration is fixed and working after the retry change."};
  const result=await review([claim,second,declared]);
  for(const id of [CLAIM,"event:"+second.id]){
    assert.equal(byId(result,id).kind,"possible_repeated_work");
    assert.equal("superseded_by" in byId(result,id),false);
  }
  assert.equal(result.summary.potential_overlooks,2);
  assert.ok(byId(result,DECLARED));
  // An explicit ID still resolves the ambiguity for exactly the record it names.
  const resolved=await review([claim,second,declared,explicit]);
  assert.equal(byId(resolved,CLAIM).superseded_by,EXPLICIT);
  assert.equal(byId(resolved,"event:"+second.id).kind,"possible_repeated_work");
});

test("a 'Correction:' note that is itself a completion claim does not dismiss the earlier claim",async()=>{
  const reaffirm={...declared,text:"Correction: the Orchard ledger sync configuration is fixed and verified, with the right owner name."};
  const result=await review([claim,reaffirm]);
  assert.equal(byId(result,CLAIM).kind,"possible_repeated_work");
  assert.equal(result.summary.superseded,0);
});

test("a declared correction that omits one of the claim's matched terms links nothing",async()=>{
  const partial={...declared,text:"Correction: the Orchard ledger export was reverted and it is not fixed."};
  const result=await review([claim,partial]);
  assert.equal(byId(result,CLAIM).kind,"possible_repeated_work");
});

test("search reports the link as provenance without asserting a verdict",async()=>{
  const found=await withEvents([claim,declared],folder=>ok(folder,"missing_ai_search_history",{query:ANSWER}));
  for(const finding of found.findings)assert.equal(finding.kind,"related_history");
  assert.equal(found.summary.potential_overlooks,0);
  assert.equal(byId(found,CLAIM).superseded_by,DECLARED);
});

test("the site and root reviewer mirrors agree, and the input history is not mutated",()=>{
  for(const records of [[claim,declared],[claim,explicit],[explicit,claim,declared]]){
    const history=asHistory(records),snapshot=structuredClone(history);
    for(const options of [{},{maxResults:1}]){
      assert.deepEqual(rootReview(history,ANSWER,options),siteReview(history,ANSWER,options));
    }
    assert.deepEqual(history,snapshot,"records are never rewritten");
  }
});

test("duplicate record IDs are counted, the first record is kept, and nothing is rewritten",async()=>{
  const cases=[
    {records:[claim,declared],count:0,messages:2},
    {records:[claim,{...declared,id:claim.id}],count:1,messages:1},
    {records:[claim,{...declared,id:claim.id},{...explicit,id:claim.id},declared],count:2,messages:2}
  ];
  for(const {records,count,messages} of cases){
    await withEvents(records,async folder=>{
      const file=join(folder,"agent-events.jsonl"),before=await readFile(file);
      const status=await ok(folder,"missing_ai_history_status");
      assert.equal(status.duplicate_ids_ignored,count);
      assert.equal(status.message_count,messages);
      assert.ok(Number.isInteger(status.duplicate_ids_ignored)&&status.duplicate_ids_ignored>=0&&status.duplicate_ids_ignored<=2000);
      assert.deepEqual(await ok(folder,"missing_ai_history_status"),status,"stable across fresh readers");
      assert.doesNotMatch(JSON.stringify(status),/Orchard|reverted|rolled back/i,"no record text in diagnostics");
      for(const key of ["source_types","message_count","refresh","remote_storage"])assert.ok(key in status,"existing field "+key);
      const found=await ok(folder,"missing_ai_search_history",{query:"Orchard ledger sync configuration"});
      assert.match(byId(found,CLAIM).quote,/We have fixed the Orchard ledger sync/,"the first record for an ID is the one kept");
      assert.ok(before.equals(await readFile(file)));
    });
  }
});

test("one reader reports a refreshed duplicate count after the file changes",async()=>{
  await withEvents([claim],async folder=>{
    const store=createHistoryStore(folder);
    const status=async()=>JSON.parse((await dispatchHistoryRpc(store,rpc("missing_ai_history_status"))).result.content[0].text);
    assert.equal((await status()).duplicate_ids_ignored,0);
    await writeFile(join(folder,"agent-events.jsonl"),[claim,{...declared,id:claim.id}].map(r=>JSON.stringify(r)).join("\n")+"\n");
    assert.equal((await status()).duplicate_ids_ignored,1);
  });
});

// Synthetic negative cases for keeping two local agent/user histories apart
// (issue #73: agent/user isolation and privacy; roadmap #86 Gate B).
//
// What separates two histories today is ONLY the folder each reader was
// started with (MISSING_AI_HISTORY_DIR). There are no accounts, no tenant IDs
// and no authentication. These tests pin, on fictional records, that one
// reader never serves, links to, or is influenced by another folder's records,
// and that nothing a tool caller sends can point a reader at another folder.
//
// They are functional checks of the existing read-only reader. They are NOT
// evidence of a security boundary: any process running under the same OS
// account can read both folders directly. No reader, schema or storage change.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,rm,symlink,appendFile,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";

const ALPHA_MARK="VERMILIONQUAY",BETA_MARK="ZIRCONHOLLOW";
const alphaClaim={
  id:"orchid-claim-001",conversation:"Orchid ledger sync",role:"event",date:"2026-05-01T09:00:00.000Z",
  text:"We fixed the Orchid ledger sync timeout and verified it with marker "+ALPHA_MARK+"."
};
const betaNote={
  id:"pelican-note-001",conversation:"Pelican invoice mailer",role:"event",date:"2026-05-01T10:00:00.000Z",
  text:"Pelican invoice mailer templates were reviewed with marker "+BETA_MARK+"."
};
// Lives in Beta's folder but names a record ID that only exists in Alpha's.
const betaForeignCorrection={
  id:"pelican-correction-002",conversation:"Orchid ledger sync",role:"event",date:"2026-05-02T09:00:00.000Z",
  text:"Supersedes event:orchid-claim-001. The Orchid ledger sync timeout is not fixed."
};
const ALPHA_ANSWER="We need to fix the Orchid ledger sync timeout.";

const eventsPath=folder=>join(folder,"agent-events.jsonl");
const serialise=records=>records.map(r=>JSON.stringify(r)).join("\n")+"\n";
const writeEvents=(folder,records)=>writeFile(eventsPath(folder),serialise(records),{encoding:"utf8",mode:0o600});
async function withFolders(run){
  const root=await mkdtemp(join(tmpdir(),"missing-ai-folder-isolation-"));
  try{
    const alpha=join(root,"agent-alpha"),beta=join(root,"agent-beta");
    await Promise.all([mkdir(alpha,{mode:0o700}),mkdir(beta,{mode:0o700})]);
    return await run({root,alpha,beta});
  }finally{await rm(root,{recursive:true,force:true});}
}
// Raw reply text is returned too, so a test can assert that another folder's
// text appears nowhere in what the tool sent, not only in one field.
async function rawCall(store,name,args={}){
  const response=await dispatchHistoryRpc(store,{jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}});
  return {response,raw:JSON.stringify(response)};
}
async function call(store,name,args={}){
  const {response,raw}=await rawCall(store,name,args);
  assert.equal(response?.result?.isError,false,"private-history tool failed: "+raw);
  return {raw,data:JSON.parse(response.result.content[0].text)};
}
const ids=result=>result.data.findings.map(f=>f.id);

test("a correction stored in another folder cannot dismiss or link to this folder's claim",async()=>{
  await withFolders(async({alpha,beta})=>{
    await writeEvents(alpha,[alphaClaim]);
    await writeEvents(beta,[betaNote,betaForeignCorrection]);
    const a=createHistoryStore(alpha),b=createHistoryStore(beta);
    // Load Beta first so any shared state would already hold its correction.
    await call(b,"missing_ai_history_status");

    const review=await call(a,"missing_ai_review_answer_history",{ai_answer:ALPHA_ANSWER});
    assert.deepEqual(ids(review),["event:orchid-claim-001"]);
    const [claim]=review.data.findings;
    assert.notEqual(claim.kind,"related_history","Alpha's claim must still be flagged for review");
    assert.equal(claim.superseded_by,undefined);
    assert.equal(review.data.summary.superseded,0);
    assert.equal(review.data.history_messages,1);
    assert.doesNotMatch(review.raw,/pelican|not fixed/i);

    // In Beta the same note names an ID that does not exist there: no link, no Alpha text.
    const betaReview=await call(b,"missing_ai_review_answer_history",{ai_answer:ALPHA_ANSWER});
    assert.ok(ids(betaReview).every(id=>id.startsWith("event:pelican-")));
    assert.equal(betaReview.data.summary.superseded,0);
    for(const finding of betaReview.data.findings)assert.equal(finding.supersedes,undefined);
    assert.doesNotMatch(betaReview.raw,new RegExp(ALPHA_MARK));
  });
});

test("the same record ID in two folders resolves to each folder's own text, with no duplicate reported",async()=>{
  await withFolders(async({alpha,beta})=>{
    const shared="shared-id-001";
    await writeEvents(alpha,[{...alphaClaim,id:shared}]);
    await writeEvents(beta,[{...betaNote,id:shared}]);
    const a=createHistoryStore(alpha),b=createHistoryStore(beta);
    const [aFound,bFound,aStatus,bStatus]=await Promise.all([
      call(a,"missing_ai_search_history",{query:"Orchid ledger sync timeout"}),
      call(b,"missing_ai_search_history",{query:"Pelican invoice mailer templates"}),
      call(a,"missing_ai_history_status"),
      call(b,"missing_ai_history_status")
    ]);
    assert.deepEqual(ids(aFound),["event:"+shared]);
    assert.deepEqual(ids(bFound),["event:"+shared]);
    assert.match(aFound.data.findings[0].quote,new RegExp(ALPHA_MARK));
    assert.match(bFound.data.findings[0].quote,new RegExp(BETA_MARK));
    assert.doesNotMatch(aFound.raw,new RegExp(BETA_MARK));
    assert.doesNotMatch(bFound.raw,new RegExp(ALPHA_MARK));
    assert.equal(aStatus.data.duplicate_ids_ignored,0);
    assert.equal(bStatus.data.duplicate_ids_ignored,0);
  });
});

test("nothing a tool caller sends can point a reader at another folder",async()=>{
  await withFolders(async({alpha,beta})=>{
    await writeEvents(alpha,[alphaClaim]);
    await writeEvents(beta,[betaNote]);
    const a=createHistoryStore(alpha);
    const redirects=[
      {query:"Pelican invoice mailer templates",dir:beta},
      {query:"Pelican invoice mailer templates",path:eventsPath(beta),folder:beta,history_dir:beta},
      {query:"Pelican invoice mailer templates",MISSING_AI_HISTORY_DIR:beta},
      {query:"Pelican invoice mailer templates "+beta+" "+eventsPath(beta)},
      {query:"../agent-beta/agent-events.jsonl Pelican invoice mailer templates "+BETA_MARK}
    ];
    for(const args of redirects){
      const {raw}=await rawCall(a,"missing_ai_search_history",args);
      assert.doesNotMatch(raw,new RegExp(BETA_MARK),"Beta text served for "+Object.keys(args).join(","));
      assert.doesNotMatch(raw,/pelican-note-001/);
    }
    // A request-level attempt (outside tool arguments) changes nothing either.
    const response=await dispatchHistoryRpc(a,{jsonrpc:"2.0",id:2,method:"tools/call",dir:beta,
      params:{name:"missing_ai_search_history",dir:beta,env:{MISSING_AI_HISTORY_DIR:beta},
        arguments:{query:"Pelican invoice mailer templates"}}});
    assert.doesNotMatch(JSON.stringify(response),new RegExp(BETA_MARK));
    const status=await call(a,"missing_ai_history_status",{dir:beta});
    assert.equal(status.data.message_count,1);
    // The reader still serves its own folder afterwards.
    assert.deepEqual(ids(await call(a,"missing_ai_search_history",{query:"Orchid ledger sync timeout"})),
      ["event:orchid-claim-001"]);
  });
});

test("a symlink to another folder's event file, or to the folder itself, is refused without serving its text",
  {skip:process.platform==="win32"},async()=>{
  await withFolders(async({root,alpha,beta})=>{
    await writeEvents(beta,[betaNote]);
    await symlink(eventsPath(beta),eventsPath(alpha));
    const viaFile=await rawCall(createHistoryStore(alpha),"missing_ai_search_history",{query:"Pelican invoice mailer templates"});
    assert.equal(viaFile.response.result.isError,true);
    assert.doesNotMatch(viaFile.raw,new RegExp(BETA_MARK));
    assert.ok(!viaFile.raw.includes(root),"error text must not disclose a folder path");

    const linked=join(root,"agent-gamma");
    await symlink(beta,linked);
    const viaFolder=await rawCall(createHistoryStore(linked),"missing_ai_history_status");
    assert.equal(viaFolder.response.result.isError,true);
    assert.doesNotMatch(viaFolder.raw,new RegExp(BETA_MARK));
    assert.ok(!viaFolder.raw.includes(root),"error text must not disclose a folder path");
  });
});

test("two readers in one process keep separate state when the other folder changes, breaks or disappears",async()=>{
  await withFolders(async({root,alpha,beta})=>{
    await writeEvents(alpha,[alphaClaim]);
    await writeEvents(beta,[betaNote]);
    const a=createHistoryStore(alpha),b=createHistoryStore(beta);
    const before=await call(a,"missing_ai_search_history",{query:"Orchid ledger sync timeout"});
    assert.equal((await call(b,"missing_ai_history_status")).data.message_count,1);

    // Beta grows: Alpha's count and results do not move.
    await appendFile(eventsPath(beta),serialise([{...betaNote,id:"pelican-note-003",
      text:"Orchid ledger sync timeout was also discussed in Pelican with marker "+BETA_MARK+"."}]));
    assert.equal((await call(b,"missing_ai_history_status")).data.message_count,2);
    assert.equal((await call(a,"missing_ai_history_status")).data.message_count,1);
    const during=await call(a,"missing_ai_search_history",{query:"Orchid ledger sync timeout"});
    assert.deepEqual(during.data,before.data);

    // Beta becomes unreadable: Beta fails closed, Alpha is unaffected.
    await writeFile(eventsPath(beta),"{\"id\":\"broken\",\"conversation\":\n",{encoding:"utf8",mode:0o600});
    const broken=await rawCall(b,"missing_ai_history_status");
    assert.equal(broken.response.result.isError,true);
    assert.doesNotMatch(broken.raw,new RegExp(ALPHA_MARK));
    assert.deepEqual((await call(a,"missing_ai_search_history",{query:"Orchid ledger sync timeout"})).data,before.data);

    // Beta's folder is removed: Beta reports it unavailable without a path; Alpha still works.
    await rm(beta,{recursive:true,force:true});
    const gone=await rawCall(b,"missing_ai_search_history",{query:"Pelican invoice mailer templates"});
    assert.equal(gone.response.result.isError,true);
    assert.doesNotMatch(gone.raw,new RegExp(BETA_MARK),"a removed folder must not be served from cache");
    assert.ok(!gone.raw.includes(root),"error text must not disclose a folder path");
    assert.deepEqual((await call(a,"missing_ai_search_history",{query:"Orchid ledger sync timeout"})).data,before.data);
  });
});

test("replies never disclose where a history folder lives",async()=>{
  await withFolders(async({root,alpha,beta})=>{
    await writeEvents(alpha,[alphaClaim]);
    await writeEvents(beta,[betaNote]);
    const a=createHistoryStore(alpha);
    const replies=[
      await call(a,"missing_ai_history_status"),
      await call(a,"missing_ai_search_history",{query:"Orchid ledger sync timeout"}),
      await call(a,"missing_ai_review_answer_history",{ai_answer:ALPHA_ANSWER}),
      await call(a,"missing_ai_search_history",{query:"absent quartz nebula"})
    ];
    for(const {raw} of replies){
      assert.ok(!raw.includes(root),"reply must not contain the folder path");
      assert.doesNotMatch(raw,/agent-alpha|agent-beta|agent-events\.jsonl/);
    }
    assert.throws(()=>createHistoryStore("agent-alpha"),/absolute folder path/,
      "a relative folder name must be refused rather than resolved against the working directory");
  });
});

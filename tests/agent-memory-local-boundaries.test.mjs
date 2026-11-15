import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";
import {runLocalBoundariesDemo} from "../scripts/agent-memory-local-boundaries.mjs";

const searchRequest={jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"missing_ai_search_history",arguments:{query:"Juniper local checkpoint",max_results:3}}};

function searchBody(response){
  assert.equal(response?.result?.isError,false);
  return JSON.parse(response.result.content[0].text);
}

test("synthetic two-agent local folders retain separate attributed histories",async()=>{
  const result=await runLocalBoundariesDemo();
  assert.equal(result.example,"synthetic-local-folder-boundaries");
  assert.equal(result.folders,2);
  assert.equal(result.events_per_folder,1);
  assert.equal(result.own_source_attribution,true);
  assert.equal(result.source_ids.alpha.unique_phrase,result.source_ids.alpha.shared_checkpoint);
  assert.equal(result.source_ids.beta.unique_phrase,result.source_ids.beta.shared_checkpoint);
  assert.notEqual(result.source_ids.alpha.unique_phrase,result.source_ids.beta.unique_phrase);
  assert.equal(result.unrelated_cross_folder_retrievals,0);
  assert.deepEqual(result.reopened_reader_source_ids,{
    alpha:result.source_ids.alpha.shared_checkpoint,
    beta:result.source_ids.beta.shared_checkpoint
  });
  assert.deepEqual(result.receipt_keys,{
    alpha_reopened_local_reader:"synthetic-local-reader:alpha:reopened",
    beta_reopened_local_reader:"synthetic-local-reader:beta:reopened",
    alpha_stable_folder_source:"synthetic-local-source:alpha",
    beta_stable_folder_source:"synthetic-local-source:beta"
  });
  assert.equal(result.remote_storage,false);
  // OS-owned folders are not authorization or cross-tenant security.
  assert.equal(result.authenticated_tenant_isolation,false);
  assert.match(result.limitation,/not a security boundary between processes running under the same OS account/i);
});

test("cached local reader rejects corrupted JSONL and recovers the same attributed event",async()=>{
  const folder=await mkdtemp(join(tmpdir(),"missing-ai-local-boundary-"));
  const event={id:"juniper-source-001",conversation:"Juniper local checkpoint",role:"event",text:"Juniper local checkpoint is a fictional owner-local recovery marker."};
  const file=join(folder,"agent-events.jsonl");
  try{
    await writeFile(file,JSON.stringify(event)+"\n",{encoding:"utf8",mode:0o600});
    const store=createHistoryStore(folder);

    const first=searchBody(await dispatchHistoryRpc(store,searchRequest));
    assert.equal(first.findings.length,1);
    assert.equal(first.findings[0].id,"event:juniper-source-001");
    assert.equal(first.findings[0].quote,event.text);

    await writeFile(file,JSON.stringify(event)+"\n{malformed-jsonl\n",{encoding:"utf8",mode:0o600});
    const corrupted=await dispatchHistoryRpc(store,searchRequest);
    assert.equal(corrupted?.result?.isError,true);
    assert.notEqual(corrupted?.result?.content?.[0]?.text,"[]");

    await writeFile(file,JSON.stringify(event)+"\n",{encoding:"utf8",mode:0o600});
    const recovered=searchBody(await dispatchHistoryRpc(store,searchRequest));
    assert.equal(recovered.findings.length,1);
    assert.equal(recovered.findings[0].id,"event:juniper-source-001");
    assert.equal(recovered.findings[0].quote,event.text);
  }finally{
    await rm(folder,{recursive:true,force:true});
  }
});

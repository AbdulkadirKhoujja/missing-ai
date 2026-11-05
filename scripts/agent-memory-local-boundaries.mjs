// Synthetic demonstration of separate *local folders* for two agent contexts.
// These folders are NOT security/authenticated multi-tenant namespaces.
import assert from "node:assert/strict";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath,pathToFileURL} from "node:url";
import {createHistoryStore,dispatchHistoryRpc} from "../private-history/context-mcp.mjs";

const repoRoot=fileURLToPath(new URL("../",import.meta.url));
const rpc=(name,args={})=>({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}});
function read(result){
  assert.equal(result?.result?.isError,false,"private-history tool failed");
  return JSON.parse(result.result.content[0].text);
}
function appendSynthetic(dir,event){
  // Explicitly initiated CLI writes; never a model-controlled MCP write tool.
  const result=spawnSync(process.execPath,["private-history/record-event.mjs"],{
    cwd:repoRoot,env:{...process.env,MISSING_AI_HISTORY_DIR:dir},
    input:JSON.stringify(event),encoding:"utf8",timeout:10000
  });
  assert.equal(result.status,0,"synthetic local note recording failed");
}
export async function runLocalBoundariesDemo(){
  const root=await mkdtemp(join(tmpdir(),"missing-ai-agent-boundaries-"));
  try{
    const alpha=join(root,"agent-alpha"),beta=join(root,"agent-beta");
    await Promise.all([mkdir(alpha,{mode:0o700}),mkdir(beta,{mode:0o700})]);
    appendSynthetic(alpha,{
      conversation:"Atlas build cache rotation",
      text:"Atlas build cache rotation plan was reviewed. Agent Alpha recorded this claim; implementation is not independently verified."
    });
    appendSynthetic(beta,{
      conversation:"Beacon customer routing",
      text:"Beacon customer message routing was checked. Agent Beta recorded this claim; implementation is not independently verified."
    });
    // New reader instances intentionally load the persisted file in each
    // independently configured directory; no shared global history store.
    const a=createHistoryStore(alpha),b=createHistoryStore(beta);
    const [aStatus,bStatus]=await Promise.all([
      dispatchHistoryRpc(a,rpc("missing_ai_history_status")),
      dispatchHistoryRpc(b,rpc("missing_ai_history_status"))
    ]);
    for(const result of [aStatus,bStatus]){
      const status=read(result);
      assert.deepEqual(status.source_types,["agent-events"]);
      assert.equal(status.message_count,1);
      assert.equal(status.remote_storage,false);
    }
    const search=(store,query)=>dispatchHistoryRpc(store,rpc(
      "missing_ai_search_history",{query,max_results:5}
    )).then(read);
    const [aOwn,aOther,bOwn,bOther]=await Promise.all([
      search(a,"Atlas build cache rotation"),
      search(a,"Beacon customer message routing"),
      search(b,"Beacon customer message routing"),
      search(b,"Atlas build cache rotation")
    ]);
    assert.equal(aOwn.findings.length,1);
    assert.equal(bOwn.findings.length,1);
    assert.match(aOwn.findings[0].id,/^event:/);
    assert.match(bOwn.findings[0].id,/^event:/);
    assert.match(aOwn.findings[0].quote,/Atlas build cache rotation/);
    assert.match(bOwn.findings[0].quote,/Beacon customer message routing/);
    assert.equal(aOther.findings.length,0,"Alpha must not retrieve the unrelated Beta folder");
    assert.equal(bOther.findings.length,0,"Beta must not retrieve the unrelated Alpha folder");
    return {
      example:"synthetic-local-folder-boundaries",
      folders:2,events_per_folder:1,
      own_source_attribution:true,
      unrelated_cross_folder_retrievals:0,
      remote_storage:false,
      authenticated_tenant_isolation:false,
      limitation:"Separate explicitly configured local folders only; not a security boundary between processes running under the same OS account."
    };
  }finally{
    await rm(root,{recursive:true,force:true});
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{process.stdout.write(JSON.stringify(await runLocalBoundariesDemo())+"\n");}
  catch{process.stderr.write("Synthetic local-folder demo failed.\n");process.exitCode=1;}
}

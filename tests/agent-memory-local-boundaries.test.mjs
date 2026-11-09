import test from "node:test";
import assert from "node:assert/strict";
import {runLocalBoundariesDemo} from "../scripts/agent-memory-local-boundaries.mjs";

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

import test from "node:test";
import assert from "node:assert/strict";
import {runLocalBoundariesDemo} from "../scripts/agent-memory-local-boundaries.mjs";

test("synthetic two-agent local folders retain separate attributed histories",async()=>{
  const result=await runLocalBoundariesDemo();
  assert.equal(result.example,"synthetic-local-folder-boundaries");
  assert.equal(result.folders,2);
  assert.equal(result.events_per_folder,1);
  assert.equal(result.own_source_attribution,true);
  assert.equal(result.unrelated_cross_folder_retrievals,0);
  assert.equal(result.remote_storage,false);
  // OS-owned folders are not authorization or cross-tenant security.
  assert.equal(result.authenticated_tenant_isolation,false);
});

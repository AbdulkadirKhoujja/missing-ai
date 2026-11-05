import test from "node:test";
import assert from "node:assert/strict";
import {runDemo} from "../scripts/agent-memory-demo.mjs";

test("synthetic opt-in agent memory reloads, attributes and checks repeated work",async()=>{
  const report=await runDemo();
  assert.equal(report.example,"synthetic-local-agent-memory");
  assert.equal(report.persisted_event_reloaded,true);
  assert.equal(report.new_process_recall,true);
  assert.equal(report.source_id_stable_after_restart,true);
  assert.equal(report.incremental_append_detected,true);
  assert.equal(report.post_append_history_messages,2);
  assert.equal(report.appended_event_source_attributed,true);
  assert.deepEqual(report.source_types,["agent-events"]);
  assert.equal(report.history_messages,1);
  assert.equal(report.source_attributed,true);
  assert.ok(report.repeated_work_candidates>=1);
  assert.equal(report.remote_storage,false);
  assert.equal(report.verified_implementation,false);
});

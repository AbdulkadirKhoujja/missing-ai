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

test("synthetic memory receipt explicitly disclaims unsupported production guarantees",async()=>{
  const report=await runDemo();
  assert.equal(report.remote_storage,false);
  assert.equal(report.verified_implementation,false);
  assert.match(report.limitations,/opt-in local file reload/i);
  assert.match(report.limitations,/not independent proof/i);
  assert.match(report.limitations,/not.*authenticated multi-user memory/i);
  assert.match(report.limitations,/not.*remote sync/i);
  assert.match(report.limitations,/not.*provider history access/i);
});

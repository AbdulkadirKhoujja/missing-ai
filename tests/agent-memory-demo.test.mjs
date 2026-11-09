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
  assert.equal(report.post_append_original_source_identity.same_reader_after_append,
    report.post_append_original_source_identity.pre_append);
  assert.equal(report.post_append_original_source_identity.same_reader_after_append,
    report.post_append_original_source_identity.fresh_process);
  assert.notEqual(report.post_append_original_source_identity.same_reader_after_append,
    report.post_append_original_source_identity.appended_beacon);
  assert.equal(report.post_append_history_messages,2);
  assert.equal(report.appended_event_source_attributed,true);
  assert.deepEqual(report.retrieval_fixture.map(f=>f.expected_source_ids),[
    [report.post_append_original_source_identity.pre_append],
    [report.post_append_original_source_identity.appended_beacon],
    []
  ]);
  assert.deepEqual(report.retrieval_fixture.map(f=>f.actual_source_ids),[
    [report.post_append_original_source_identity.pre_append],
    [report.post_append_original_source_identity.appended_beacon],
    []
  ]);
  assert.deepEqual(report.retrieval_metrics,{
    true_hits:2,
    true_hit_denominator:2,
    false_recalls:0,
    false_recall_denominator:1
  });
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
  assert.match(report.limitations,/source IDs do not prove independent factual accuracy/i);
  assert.match(report.limitations,/authenticated user\/agent isolation/i);
  assert.match(report.limitations,/corrections or deletion/i);
  assert.match(report.limitations,/not.*remote sync/i);
  assert.match(report.limitations,/not.*provider history access/i);
});

test("synthetic append keeps the original provenance receipt bounded",async()=>{
  const report=await runDemo();
  assert.equal(report.history_messages,1,
    "the pre-append receipt must describe only the first synthetic event");
  assert.equal(report.post_append_history_messages,report.history_messages+1,
    "the appended receipt must add exactly one event");
  assert.equal(report.source_attributed,true);
  assert.equal(report.appended_event_source_attributed,true);
  assert.deepEqual(report.source_types,["agent-events"]);
  assert.equal(report.source_id_stable_after_restart,true,
    "the original event provenance must survive a fresh process");
  const receipt=report.post_append_original_source_identity;
  assert.equal(receipt.same_reader_after_append,receipt.pre_append,
    "the same reader must retain the original Orion source ID after append");
  assert.equal(receipt.same_reader_after_append,receipt.fresh_process,
    "the post-append Orion source ID must match the fresh-process source ID");
  assert.notEqual(receipt.same_reader_after_append,receipt.appended_beacon,
    "Beacon must have a different source ID");
});

test("synthetic absent query has no event finding or fabricated source ID",async()=>{
  const report=await runDemo();
  const negative=report.retrieval_fixture[2];
  assert.match(negative.query,/absent from this fixture/);
  assert.deepEqual(negative.expected_source_ids,[]);
  assert.deepEqual(negative.actual_source_ids,[]);
  assert.equal(report.retrieval_metrics.false_recalls,0);
  assert.equal(report.retrieval_metrics.false_recall_denominator,1);
});

// Issue #18 case types for the evidence-first review protocol
// (prepare_review / validate_review, shared/evidence-review.mjs).
//
// Issue #18 asks for explicit paraphrase, negation, misleading-claim and
// missing-linked-source cases. These synthetic fixtures pin what
// evidence-review-v1 does on main today for each case type. They change no
// product code and are NOT a benchmark: no precision, recall or score is
// claimed. The host AI makes the semantic judgment; Missing AI verifies only
// requirement IDs, bounds and verbatim quote positions. Where that boundary
// means a wrong host judgment would still validate, the test says so
// explicitly as a limitation rather than as desired behaviour.
import test from "node:test";
import assert from "node:assert/strict";
import {prepareEvidenceReview,validateEvidenceReview} from "../shared/evidence-review.mjs";

const reason="Judged from the supplied answer text only; no code was inspected.";
const at=(answer,quote)=>{
 const start=answer.indexOf(quote);
 assert.ok(start>=0,"fixture quote must occur in the answer: "+quote);
 return {quote,start};
};
const assess=(requirement_id,judgment,evidence=[])=>({requirement_id,judgment,reason,evidence});
const neverVerified=(report)=>{
 assert.equal(report.validation.semantic_accuracy_verified,false);
 assert.equal(report.validation.implementation_verified,false);
 for(const f of report.findings){
  assert.equal(f.implementation_verified,false);
  assert.equal(f.semantic_judgment_independently_verified,false);
  assert.equal(f.evidence_type,"answer_text_only");
 }
};

// --- Paraphrase ---------------------------------------------------------
// Issue #18's reproduced baseline: lexical-v1 flagged all three as
// needs_review although the answer addresses each one in other words.
const paraSource="1. Verify Stripe webhook signatures before confirming paid bookings.\n2. Stop the same workshop slot being booked twice.\n3. Allow customers to cancel a reservation.";
const paraAnswer="I validate incoming Stripe events with constructEvent and the signing secret before granting access. Transactions and unique constraints reject overlapping reservations. Users can withdraw their bookings from the dashboard.";

test("paraphrase baseline (current extraction): line 2 'Stop the same workshop slot being booked twice.' is not extracted",()=>{
 // Pins current behaviour, not desired behaviour: "Stop" is not among the
 // review extractor's imperative verbs, so a real obligation from issue #18's
 // own baseline is silently dropped before the host ever judges it. The goal
 // is recorded as a todo below.
 const packet=prepareEvidenceReview(paraSource,paraAnswer);
 assert.deepEqual(packet.requirements.map(r=>[r.id,r.line]),[["R01",1],["R02",3]]);
 assert.ok(!packet.requirements.some(r=>/booked twice/.test(r.text)));
});

test("paraphrase baseline: every numbered obligation, including 'Stop ... booked twice', is extracted",{todo:"known gap (issue #18/#54): review extraction drops the 'Stop ...' list item; fixing shared/review-extraction.mjs is REVIEW-class and needs a maintainer-approved design"},()=>{
 const packet=prepareEvidenceReview(paraSource,paraAnswer);
 assert.deepEqual(packet.requirements.map(r=>r.line),[1,2,3]);
});

test("paraphrase: host-judged coverage validates with verbatim paraphrased quotes and offsets",()=>{
 const quotes=[
  "I validate incoming Stripe events with constructEvent and the signing secret",
  "Users can withdraw their bookings from the dashboard."
 ];
 const report=validateEvidenceReview(paraSource,paraAnswer,quotes.map((q,i)=>assess("R0"+(i+1),"claimed_covered",[at(paraAnswer,q)])));
 assert.deepEqual(report.summary,{requirements:2,claimed_covered:2,contradicted:0,not_clearly_mentioned:0,cannot_determine:0});
 assert.deepEqual(report.findings.map(f=>f.source_line),[1,3]);
 report.findings.forEach((f,i)=>{
  assert.equal(f.evidence[0].quote,quotes[i]);
  assert.equal(paraAnswer.slice(f.evidence[0].start,f.evidence[0].end),quotes[i]);
  assert.equal(f.evidence[0].verified_in_answer,true);
 });
 // Coverage of the answer text is still not implementation proof.
 neverVerified(report);
});

// --- Negation -----------------------------------------------------------
const negSource="- Must verify signed payment webhooks\n- Must allow customers to cancel a reservation";
const negAnswer="Signed payment webhooks are verified before fulfilment. We did not add a way to cancel a reservation.";

test("negation: an explicit refusal is reportable as contradicted with the negating sentence as evidence",()=>{
 const report=validateEvidenceReview(negSource,negAnswer,[
  assess("R01","claimed_covered",[at(negAnswer,"Signed payment webhooks are verified before fulfilment.")]),
  assess("R02","contradicted",[at(negAnswer,"We did not add a way to cancel a reservation.")])
 ]);
 assert.deepEqual(report.summary,{requirements:2,claimed_covered:1,contradicted:1,not_clearly_mentioned:0,cannot_determine:0});
 assert.equal(report.findings[1].judgment,"contradicted");
 assert.equal(report.findings[1].evidence[0].quote,"We did not add a way to cancel a reservation.");
 neverVerified(report);
});

test("negation: a contradiction cannot be asserted without a verbatim quote, and a quote stripped of its negation is rejected",()=>{
 assert.throws(()=>validateEvidenceReview(negSource,negAnswer,[assess("R01","cannot_determine"),assess("R02","contradicted")]),/Verbatim answer evidence is required for contradicted/);
 // Dropping "not" turns the sentence into a coverage claim that the answer never made.
 const flipped="We did add a way to cancel a reservation.";
 assert.ok(!negAnswer.includes(flipped));
 assert.throws(()=>validateEvidenceReview(negSource,negAnswer,[
  assess("R01","cannot_determine"),
  assess("R02","claimed_covered",[{quote:flipped,start:negAnswer.indexOf("We did")}])
 ]),/not an exact quotation/);
});

test("negation (limitation): a host that misreads a negated sentence as coverage still validates, because meaning is not verified",()=>{
 // The quote is exact, so provenance passes; the judgment is wrong. This pins
 // the documented boundary, not desired behaviour: the report must still
 // refuse to call that judgment verified.
 const report=validateEvidenceReview(negSource,negAnswer,[
  assess("R01","cannot_determine"),
  assess("R02","claimed_covered",[at(negAnswer,"We did not add a way to cancel a reservation.")])
 ]);
 assert.equal(report.summary.claimed_covered,1);
 neverVerified(report);
 assert.match(report.limitations,/NOT the host AI's semantic classifications/);
});

// --- Misleading claim ---------------------------------------------------
const misSource="- Must verify signed payment webhooks\n- Must store payment reconciliation records\n- Must issue receipts for completed payments";
const misAnswer="All requirements are fully implemented and tested. Webhook signatures are verified with the signing secret.";

test("misleading claim: a blanket completion statement can be held at cannot_determine while specific evidence is cited elsewhere",()=>{
 const report=validateEvidenceReview(misSource,misAnswer,[
  assess("R01","claimed_covered",[at(misAnswer,"Webhook signatures are verified with the signing secret.")]),
  assess("R02","cannot_determine"),
  assess("R03","cannot_determine")
 ]);
 assert.deepEqual(report.summary,{requirements:3,claimed_covered:1,contradicted:0,not_clearly_mentioned:0,cannot_determine:2});
 assert.deepEqual(report.findings[1].evidence,[]);
 assert.deepEqual(report.findings[2].evidence,[]);
 neverVerified(report);
});

test("misleading claim (limitation): quoting a blanket 'fully implemented' sentence validates as coverage text, never as implementation proof",()=>{
 const blanket="All requirements are fully implemented and tested.";
 const report=validateEvidenceReview(misSource,misAnswer,["R01","R02","R03"].map(id=>assess(id,"claimed_covered",[at(misAnswer,blanket)])));
 assert.equal(report.summary.claimed_covered,3);
 for(const f of report.findings)assert.equal(f.evidence[0].quote,blanket);
 neverVerified(report);
 const packet=prepareEvidenceReview(misSource,misAnswer);
 assert.ok(packet.host_instructions.some(s=>/A claim of completion is not implementation proof/.test(s)));
 assert.ok(packet.host_instructions.some(s=>/cannot_determine for vague assertions/.test(s)));
 assert.equal(packet.evaluation_target,"coverage_claims_in_supplied_answer_not_implementation_truth");
});

// --- Missing linked source ----------------------------------------------
const linkSource="- Must verify signed payment webhooks\n- Must follow the security checklist at https://example.org/checklist";
const linkAnswer="Signed payment webhooks are verified. The security checklist was followed.";

test("missing linked source: linked pages are listed as discovery only and contribute no requirements",()=>{
 const packet=prepareEvidenceReview(linkSource,linkAnswer,{source_url:"https://example.org/requirements",linked_sources:["https://example.org/checklist"]});
 assert.equal(packet.source_url,"https://example.org/requirements");
 assert.deepEqual(packet.linked_sources,["https://example.org/checklist"]);
 assert.match(packet.linked_source_policy,/NOT fetched or evaluated/);
 assert.match(packet.linked_source_policy,/requirements are NOT included/);
 // Only the two lines of the supplied source are requirements; the checklist's
 // own contents are unknown and are not invented.
 assert.deepEqual(packet.requirements.map(r=>r.text),["Must verify signed payment webhooks","Must follow the security checklist at https://example.org/checklist"]);
 assert.ok(packet.host_instructions.some(s=>/missing linked attachments/.test(s)));
});

test("missing linked source: a requirement that depends on an unfetched page validates as cannot_determine with no evidence",()=>{
 const report=validateEvidenceReview(linkSource,linkAnswer,[
  assess("R01","claimed_covered",[at(linkAnswer,"Signed payment webhooks are verified.")]),
  assess("R02","cannot_determine")
 ],{source_url:"https://example.org/requirements"});
 assert.equal(report.source_url,"https://example.org/requirements");
 assert.equal(report.findings[1].judgment,"cannot_determine");
 assert.deepEqual(report.findings[1].evidence,[]);
 assert.equal(report.findings[1].source_line,2);
 neverVerified(report);
});

test("missing linked source: linked_sources is capped at 40 and a non-array value is dropped rather than trusted",()=>{
 const many=Array.from({length:45},(_,i)=>"https://example.org/page-"+i);
 assert.equal(prepareEvidenceReview(linkSource,linkAnswer,{linked_sources:many}).linked_sources.length,40);
 assert.deepEqual(prepareEvidenceReview(linkSource,linkAnswer,{linked_sources:"https://example.org/checklist"}).linked_sources,[]);
 assert.deepEqual(prepareEvidenceReview(linkSource,linkAnswer).linked_sources,[]);
});

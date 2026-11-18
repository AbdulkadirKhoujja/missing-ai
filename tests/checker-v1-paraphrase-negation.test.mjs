// Synthetic paraphrase, negation and omission cases for the deployed lexical-v1 engine
// (shared/checker.mjs, the `check_missing` tool), issue #18.
//
// These tests separate three things:
//   * implemented behaviour that is useful (an omitted requirement is flagged; verbatim text is found),
//   * known limitations pinned as CURRENT behaviour, not as desired behaviour (paraphrases are flagged), and
//   * a known false negative recorded as a node:test `todo` (an explicit negation counts as coverage).
// No source code is changed here. All inputs are invented.
import test from "node:test";
import assert from "node:assert/strict";
import {checkMissing} from "../shared/checker.mjs";

// Issue #18 "reproduced live baseline — 29 Oct 2026", copied verbatim.
const BOOKING_SOURCE=[
  "1. Verify Stripe webhook signatures before confirming paid bookings.",
  "2. Stop the same workshop slot being booked twice.",
  "3. Allow customers to cancel a reservation."
].join("\n");
const BOOKING_PARAPHRASE="I validate incoming Stripe events with constructEvent and the signing secret before granting access. Transactions and unique constraints reject overlapping reservations. Users can withdraw their bookings from the dashboard.";
const statuses=r=>r.findings.map(f=>[f.id,f.status,f.coverage]);

test("issue #18 baseline reproduces exactly: three paraphrased requirements are all flagged needs_review (43%, 0%, 0%)",()=>{
  // Pins a documented false-positive-heavy limitation. If a change improves this, update the
  // expectation together with issue #18 evidence; do not read this test as the desired outcome.
  const r=checkMissing(BOOKING_SOURCE,BOOKING_PARAPHRASE);
  assert.equal(r.engine,"lexical-v1");
  assert.deepEqual(statuses(r),[["R01","needs_review",43],["R02","needs_review",0],["R03","needs_review",0]]);
  assert.deepEqual(r.summary,{requirements:3,text_found:0,likely_mentioned:0,needs_review:3});
});

test("a genuinely omitted requirement is flagged while verbatim and close wording are not",()=>{
  const answer="Verify Stripe webhook signatures before confirming paid bookings. Customers can cancel a reservation from the dashboard.";
  const r=checkMissing(BOOKING_SOURCE,answer);
  assert.deepEqual(statuses(r),[["R01","text_found",100],["R02","needs_review",0],["R03","likely_mentioned",100]]);
  assert.equal(r.summary.text_found+r.summary.likely_mentioned+r.summary.needs_review,r.summary.requirements);
});

test("every lexical-v1 report stays review_required and states that it cannot assess paraphrase or correctness",()=>{
  for(const answer of [BOOKING_PARAPHRASE,BOOKING_SOURCE,"Nothing relevant here at all."]){
    const r=checkMissing(BOOKING_SOURCE,answer);
    assert.equal(r.status,"review_required","a lexical match must never be reported as verified");
    assert.match(r.limitations,/cannot prove an implementation is missing/);
    assert.match(r.limitations,/assess semantic paraphrases reliably/);
    assert.match(r.limitations,/verify correctness/);
  }
});

test("current behaviour: an answer that explicitly says the work was NOT done is still scored as mentioned",()=>{
  // Pinned so the gap is visible and any change to it is deliberate. The todo below states the goal.
  const source="- Must verify webhook signatures before processing payments.";
  assert.deepEqual(statuses(checkMissing(source,"I did not verify webhook signatures before processing payments.")),[["R01","likely_mentioned",100]]);
  assert.deepEqual(statuses(checkMissing(source,"Webhook signature verification before processing payments is not implemented yet.")),[["R01","likely_mentioned",80]]);
});

test("an explicit negation of a requirement is not reported as coverage",{todo:"known false negative in lexical-v1: 'not'/'did not' are stop words, so a refusal shares every keyword. checker-v2 already handles this (tests/checker-v2.test.mjs); changing lexical-v1 is REVIEW-class (shared/) and needs maintainer approval"},()=>{
  const r=checkMissing("- Must verify webhook signatures before processing payments.","I did not verify webhook signatures before processing payments.");
  assert.equal(r.findings[0].status,"needs_review");
});

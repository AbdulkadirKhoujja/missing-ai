import test from "node:test";
import assert from "node:assert/strict";
import {prepareBundleReview,validateBundleReview} from "../shared/bundle-review.mjs";

const sources=[
 {source_url:"https://www.gov.uk/guide-one",source_text:"- Must verify signed payment webhooks.\n- Must issue receipts after payment."},
 {source_url:"https://www.gov.uk/guide-two",source_text:"- Must authenticate the signature of payment events.\n- Should document how failed retries are handled."}
];
const answer="I authenticate Stripe events using the signing secret. Receipts are not generated for completed payments.";
const q1="I authenticate Stripe events using the signing secret.";
const q2="Receipts are not generated for completed payments.";
const groups=[
 {title:"Authenticate payment webhook signatures",refs:["S01:R01","S02:R01"],obligation:"mandatory",judgment:"claimed_covered",reason:"Two sources express the same signature-checking requirement.",evidence:[{quote:q1,start:answer.indexOf(q1)}]},
 {title:"Provide payment receipts after payment",refs:["S01:R02"],obligation:"mandatory",judgment:"contradicted",reason:"The answer expressly says that payment receipts are not generated.",evidence:[{quote:q2,start:answer.indexOf(q2)}]},
 {title:"Document failed retry handling guidance",refs:["S02:R02"],obligation:"recommended",judgment:"not_clearly_mentioned",reason:"The response does not mention documenting failed retry handling.",evidence:[]}
];
test("prepare enumerates source-scoped refs, preserves source and shows unreviewed links",()=>{
 const s=sources.map((x,i)=>({...x,linked_sources:i===0?[{url:"https://www.gov.uk/unread",label:"Related criteria"}]:[]}));
 const packet=prepareBundleReview(s,answer);
 assert.equal(packet.protocol,"bundle-review-v1");
 assert.deepEqual(packet.sources.map(x=>x.source_id),["S01","S02"]);
 assert.deepEqual(packet.sources.flatMap(x=>x.requirements.map(r=>r.ref)),["S01:R01","S01:R02","S02:R01","S02:R02"]);
 assert.equal(packet.sources[0].linked_sources[0].reviewed,false);
 assert.match(packet.host_instructions.join(" "),/NOT reviewed/);
 assert.equal(packet.totals.candidate_requirements,4);
});
test("consolidated report includes only three host-proposed groups but all four source refs",()=>{
 const result=validateBundleReview(sources,answer,groups);
 assert.equal(result.summary.candidate_requirements,4);
 assert.equal(result.summary.groups,3);
 assert.equal(result.summary.duplicate_references_collapsed,1);
 assert.equal(result.summary.claimed_covered,1);
 assert.equal(result.summary.contradicted,1);
 assert.equal(result.summary.not_clearly_mentioned,1);
 assert.equal(result.groups[0].source_references.length,2);
 assert.deepEqual(result.groups[0].source_references.map(r=>r.source_line),[1,1]);
 assert.match(result.report_markdown,/https:\/\/www.gov.uk\/guide-one/);
 assert.match(result.report_markdown,/https:\/\/www.gov.uk\/guide-two/);
 assert.match(result.report_markdown,/line 1/);
 assert.match(result.report_markdown,/answer offsets 0/);
 assert.equal(result.validation.all_source_requirements_accounted_for,true);
 assert.equal(result.validation.source_extraction_completeness_verified,false);
 assert.match(result.limitations,/Missing obligations in original sources may remain undetected/);
 assert.match(result.report_markdown,/Source extraction completeness/);
 assert.equal(result.validation.all_answer_quotes_exact,true);
 assert.equal(result.validation.groupings_independently_verified,false);
 assert.equal(result.validation.implementation_verified,false);
});
test("missing, duplicate, unknown or invalid requirement references fail closed",()=>{
 assert.throws(()=>validateBundleReview(sources,answer,groups.slice(0,2)),/Missing: S02:R02/);
 const double=structuredClone(groups);
 double[1].refs.push("S01:R01");
 assert.throws(()=>validateBundleReview(sources,answer,double),/duplicate requirement ref/);
 const unknown=structuredClone(groups);unknown[2].refs=["S03:R99"];
 assert.throws(()=>validateBundleReview(sources,answer,unknown),/Unknown or duplicate/);
 const repeated=structuredClone(groups);repeated[0].refs=["S01:R01","S01:R01"];
 assert.throws(()=>validateBundleReview(sources,answer,repeated),/distinct requirement refs/);
});
test("forged answer evidence and incorrect offsets fail closed",()=>{
 const fake=structuredClone(groups);
 fake[0].evidence[0].quote="I verified all Stripe code and audited it.";
 assert.throws(()=>validateBundleReview(sources,answer,fake),/not an exact quotation/);
 const wrong=structuredClone(groups);wrong[1].evidence[0].start=0;
 assert.throws(()=>validateBundleReview(sources,answer,wrong),/not an exact quotation/);
 const missing=structuredClone(groups);missing[0].evidence=[];
 assert.throws(()=>validateBundleReview(sources,answer,missing),/requires verbatim evidence/);
});
test("source-strength labels are descriptive not independently verified; context retained but not counted actionable",()=>{
 const contextual=structuredClone(groups);
 contextual[2].obligation="context_only";
 const result=validateBundleReview(sources,answer,contextual);
 assert.equal(result.summary.context_only,1);
 assert.equal(result.summary.actionable_groups,2);
 assert.match(result.report_markdown,/Excluded examples and context \(1\)/);
 assert.match(result.report_markdown,/not legal determinations/);
 const bad=structuredClone(groups);
 bad[1].obligation="legally_binding_verified";
 assert.throws(()=>validateBundleReview(sources,answer,bad),/Invalid obligation/);
});
test("source limits and duplicate URLs are rejected; pasted source permitted",()=>{
 assert.throws(()=>prepareBundleReview([],answer),/1 to 3/);
 assert.throws(()=>prepareBundleReview([...sources,...sources],answer),/1 to 3/);
 assert.throws(()=>prepareBundleReview([sources[0],sources[0]],answer),/Duplicate source URL/);
 assert.throws(()=>prepareBundleReview([{source_text:"- Must do something.",source_url:"http://test.example"}],answer),/HTTPS/);
 assert.throws(()=>prepareBundleReview([{source_text:"x".repeat(15001)}],answer),/15,000/);
 assert.throws(()=>prepareBundleReview([sources[0]],"x".repeat(15001)),/15,000/);
 const pasted=prepareBundleReview([{source_text:"- Must log payment failures."}],answer);
 assert.equal(pasted.sources[0].source_url,null);
});
test("cannot_determine may omit citations, but no implementation result is certified",()=>{
 const uncertain=structuredClone(groups);
 uncertain[0].judgment="cannot_determine";uncertain[0].evidence=[];
 const result=validateBundleReview(sources,answer,uncertain);
 assert.equal(result.validation.implementation_verified,false);
 assert.equal(result.summary.cannot_determine,1);
 assert.equal(result.groups[0].grouping_semantically_verified,false);
});

test("two-source receipt requirement is extracted and cannot be silently omitted from validation",()=>{
 const source1="- Validate webhook signatures before marking paid bookings confirmed.\n- Allow customers to cancel bookings.";
 const source2="- Issue payment receipts for completed payments.\n- Include a support contact in receipts.";
 const inputs=[{source_text:source1},{source_text:source2}];
 const ai="Stripe events are checked using the signing secret. Customers can withdraw bookings from their dashboard. Payment receipts have not been implemented.";
 const packet=prepareBundleReview(inputs,ai);
 assert.equal(packet.totals.candidate_requirements,4);
 assert.deepEqual(packet.sources.flatMap(s=>s.requirements.map(r=>r.ref)),[
  "S01:R01","S01:R02","S02:R01","S02:R02"
 ]);
 assert.equal(packet.sources[1].requirements[0].text,"Issue payment receipts for completed payments.");
 assert.equal(packet.sources[1].requirements[0].line,1);
 const q1="Stripe events are checked using the signing secret.";
 const q2="Customers can withdraw bookings from their dashboard.";
 const q3="Payment receipts have not been implemented.";
 const reviewed=[
  {title:"Signed webhook ordering before paid confirmation",refs:["S01:R01"],obligation:"mandatory",judgment:"cannot_determine",reason:"The answer describes signature checks but not their timing relative to paid confirmation.",evidence:[]},
  {title:"Customers can cancel their bookings",refs:["S01:R02"],obligation:"mandatory",judgment:"claimed_covered",reason:"The answer claims a dashboard withdrawal action.",evidence:[{quote:q2,start:ai.indexOf(q2)}]},
  {title:"Issue receipts after completed payments",refs:["S02:R01"],obligation:"mandatory",judgment:"contradicted",reason:"The answer explicitly denies implemented payment receipts.",evidence:[{quote:q3,start:ai.indexOf(q3)}]},
  {title:"Include customer support contact in receipts",refs:["S02:R02"],obligation:"mandatory",judgment:"not_clearly_mentioned",reason:"The answer does not specify contact information on a receipt.",evidence:[]}
 ];
 assert.throws(()=>validateBundleReview(inputs,ai,reviewed.slice(0,3)),/Missing: S02:R02/);
 const valid=validateBundleReview(inputs,ai,reviewed);
 assert.equal(valid.summary.candidate_requirements,4);
 assert.equal(valid.summary.contradicted,1);
 assert.equal(valid.validation.all_source_requirements_accounted_for,true);
 assert.equal(valid.validation.implementation_verified,false);
 assert.equal(valid.groups[2].evidence[0].start,ai.indexOf(q3));
 assert.match(valid.report_markdown,/Issue receipts after completed payments/);
});

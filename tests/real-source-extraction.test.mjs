import test from "node:test";
import assert from "node:assert/strict";
import {extractReviewRequirements} from "../shared/review-extraction.mjs";
import {extractPublicLinks,htmlToText} from "../server/source.mjs";
import {prepareEvidenceReview,validateEvidenceReview} from "../shared/evidence-review.mjs";

// Synthetic structural analogue of a guidance page, not a GOV.UK reproduction.
const page=[
 "<main><h1>Public accessibility delivery instructions</h1>",
 "<p>To be accepted, digital services must:</p>",
 "<ul><li>meet the current AA accessibility standard</li>",
 "<li>work with widely used screen readers and magnifiers</li>",
 "<li>include people with disabilities in research</li></ul>",
 "<h2>Examples and context</h2><p>Some people are affected by:</p>",
 "<ul><li>outdoor sunlight on a phone</li><li>poor connectivity</li></ul>",
 "<h2>Planning</h2><p>Include accessibility costs in the project budget.</p>",
 "<p>Before launch, you must commission an accessibility audit.</p>",
 "<p>For mobile apps, the accessibility notice should be available from either:</p>",
 "<ul><li>the public website</li><li>the download listing</li><li>within the app</li></ul>",
 "<h2>Further reading</h2><ul><li>Guide to testing for accessibility</li></ul>",
 "<h2>Updates to this page</h2><p>Edited for clarity and moved links.</p>",
 '<a href="/service-manual/helping-people-to-use-your-service/testing-for-accessibility">Testing for accessibility</a>',
 '<a href="https://127.0.0.1/secret">Unsafe private address</a>',
 '<a href="javascript:alert(1)">Run code</a></main>'
].join("\n");
const text=htmlToText(page);

test("directives extracted; incidental bullets and footer omitted",()=>{
 const reqs=extractReviewRequirements(text);
 const combined=reqs.map(x=>x.text).join(" | ");
 assert.equal(reqs.filter(x=>x.text.includes("AA accessibility standard")).length,1);
 assert.match(combined,/screen readers and magnifiers/);
 assert.match(combined,/include people with disabilities/);
 assert.match(combined,/accessibility costs/);
 assert.match(combined,/commission an accessibility audit/);
 assert.doesNotMatch(combined,/sunlight on a phone|poor connectivity|Guide to testing for accessibility|Edited for clarity/);
 assert.equal(reqs.length,6);
 assert.equal(reqs.filter(x=>x.kind==="choice_group").length,1);
 const choice=reqs.find(x=>x.kind==="choice_group");
 assert.ok(choice.text.includes("the download listing")&&choice.text.includes("within the app"));
});
test("links discovered without following or accepting private destinations",()=>{
 const links=extractPublicLinks(page,"https://www.gov.uk/example");
 assert.ok(links.some(x=>x.url==="https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility"));
 assert.ok(links.every(x=>x.url.startsWith("https://")&&!x.url.includes("127.0.0.1")&&x.source==="page_link_unreviewed"));
 assert.ok(links.every(x=>!x.url.startsWith("javascript:")));
});
test("link ranking is bounded and deduplicated",()=>{
 const html="<main>"+Array.from({length:55},(_,i)=>'<a href="/ordinary-'+i+'">Read this document '+i+"</a>").join("")+
 '<a href="/criteria">Assessment criteria and rubric</a><a href="/criteria">Duplicate link</a></main>';
 const links=extractPublicLinks(html,"https://www.gov.uk/test",4);
 assert.equal(links.length,4);
 assert.equal(links[0].label,"Assessment criteria and rubric");
 assert.equal(links.filter(x=>x.url.endsWith("/criteria")).length,1);
});
test("direct requirements survive and host review identifies unreviewed linked documents",()=>{
 const src="- Verify Stripe webhook signatures.\n- Allow booking cancellations.\n- Provide payment receipts.\n\nHow to meet technical requirements";
 const r=extractReviewRequirements(src);
 assert.deepEqual(r.map(x=>x.text),["Verify Stripe webhook signatures.","Allow booking cancellations.","Provide payment receipts."]);
 const output="Stripe events are checked using the signing secret. Customers can withdraw their reservations. No receipts are generated.";
 const packet=prepareEvidenceReview(src,output,{source_url:"https://www.gov.uk/test",linked_sources:[{url:"https://www.gov.uk/criteria",label:"Criteria",source:"page_link_unreviewed"}]});
 assert.equal(packet.requirements.length,3);
 assert.equal(packet.linked_sources.length,1);
 assert.match(packet.linked_source_policy,/NOT fetched or evaluated/);
 const judgments=packet.requirements.map(r=>({
  requirement_id:r.id,judgment:"cannot_determine",
  reason:"This is a deliberately unverified synthetic answer for acceptance testing.",evidence:[]
 }));
 const valid=validateEvidenceReview(src,output,judgments);
 assert.equal(valid.summary.requirements,3);
 assert.equal(valid.validation.implementation_verified,false);
});
test("alternatives stay a single obligation",()=>{
 const src="For mobile, the notice should be available from either:\n- website\n- download page\n- the app\n\n- Ensure account deletion is possible";
 const list=extractReviewRequirements(src);
 assert.equal(list.length,2);
 assert.equal(list[0].kind,"choice_group");
 assert.match(list[0].text,/download page/);
 assert.match(list[0].text,/the app/);
});

test("document-issuance imperatives are extracted without 'must', but issue metadata stays contextual",()=>{
 const src=[
  "- Issue payment receipts for completed payments.",
  "- Issue a refund after cancellation.",
  "- Issue number 42 documents an example incident.",
  "- Issue tracker contains old ticket metadata.",
  "- Must issue training certificates after attendance."
 ].join("\n");
 const reqs=extractReviewRequirements(src);
 assert.deepEqual(reqs.map(x=>[x.text,x.line]),[
  ["Issue payment receipts for completed payments.",1],
  ["Issue a refund after cancellation.",2],
  ["Must issue training certificates after attendance.",5]
 ]);
 const review=prepareEvidenceReview("- Issue payment receipts for completed payments.\n- Include a support contact in receipts.",
  "Payment receipts have not been implemented.");
 assert.deepEqual(review.requirements.map(x=>x.text),[
  "Issue payment receipts for completed payments.",
  "Include a support contact in receipts."
 ]);
});

test("six everyday AI jobs: all twelve previously observed imperative instructions are retained",()=>{
 // Exact synthetic source lines from the live 29-Oct twelve-case smoke (PR #53, issue #54).
 const sources=[
  "- Include the meeting date and location in the invitation.",
  "- Ask the recipient to reply to the email.",
  "- Provide the publication year and source link for the report.",
  "- Distinguish correlation from proven causation in the summary.",
  "- Keep the total itinerary cost below £50.",
  "- Avoid appointments after 18:00.",
  "- Include at least three citations in the essay.",
  "- Explain why interviews are appropriate for the research.",
  "- Assign an owner to every project milestone.",
  "- Explain how out-of-scope requests require approval.",
  "- Issue payment receipts for completed payments.",
  "- Reject webhook events with invalid signatures."
 ];
 for(const [index,source] of sources.entries()){
  const list=extractReviewRequirements(source);
  assert.equal(list.length,1,"smoke case "+(index+1)+": "+source);
  assert.equal(list[0].text,source.slice(2),"source exactness in case "+(index+1));
  assert.equal(list[0].line,1);
 }
 const aggregate=extractReviewRequirements(sources.join("\n"));
 assert.equal(aggregate.length,12);
 assert.deepEqual(aggregate.map(x=>x.line),Array.from({length:12},(_,i)=>i+1));
 const packet=prepareEvidenceReview(sources.join("\n"),
  "This is a synthetic answer with no implementation evidence.");
 assert.equal(packet.requirements.length,12);
 assert.match(packet.limitations,/does not verify code, facts, compliance/i);
});
test("imperative additions do not elevate common nouns, headings, links or examples",()=>{
 const source=[
  "The ask from the sponsor was discussed yesterday.",
  "- The ask involves three background topics.",
  "- Assignments in the sample are fictitious.",
  "- Explanation of the methods follows.",
  "- Issue number 42 records a past bug.",
  "- Issue tracker stores completed tasks.",
  "- Distinguishing criteria are illustrated below.",
  "- Asking questions is encouraged in this introduction.",
  "Examples and context:",
  "- The word 'assign' may appear in a sample sentence.",
  "- Example explaining why someone might use surveys.",
  "Related guides",
  "- Ask the recipient to reply to the email."
 ].join("\n");
 const candidates=extractReviewRequirements(source);
 assert.equal(candidates.length,0,JSON.stringify(candidates));
});
test("added imperative verbs retain legitimate objects without capturing arbitrary short headings",()=>{
 const source=[
  "- Ask your reader for confirmation before sending.",
  "- Distinguish observation from causation.",
  "- Explain the selection criteria with evidence.",
  "- Assign each milestone to a named owner.",
  "- Issue a receipt when payment succeeds.",
  "- Ask:",
  "- Explain:"
 ].join("\n");
 const reqs=extractReviewRequirements(source);
 assert.deepEqual(reqs.map(x=>x.line),[1,2,3,4,5]);
 assert.equal(reqs.length,5);
});

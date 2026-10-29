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

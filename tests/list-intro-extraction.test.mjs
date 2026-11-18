// Mandatory lists whose items are short nouns, and command-style list intros without a modal verb.
// Before this fix "The page must include:\n- a logo\n- a footer" produced NO requirements, so a
// whole obligation list could vanish before validation. Fixtures are synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import {extractReviewRequirements} from "../shared/review-extraction.mjs";
import {prepareEvidenceReview} from "../shared/evidence-review.mjs";
import {prepareBundleReview} from "../shared/bundle-review.mjs";

const texts=src=>extractReviewRequirements(src).map(r=>r.text);

test("short items under a modal list intro are kept and carry the intro as context",()=>{
 const list=extractReviewRequirements("The page must include:\n- a logo\n- a footer");
 assert.deepEqual(list.map(r=>r.text),["The page must include: a logo","The page must include: a footer"]);
 assert.deepEqual(list.map(r=>r.line),[2,3]);
 assert.deepEqual(list.map(r=>r.kind),["list_item","list_item"]);
});

test("longer items under a modal intro keep their existing item-only text",()=>{
 assert.deepEqual(texts("The page must include:\n- a company logo in the header"),["a company logo in the header"]);
});

test("command-style intros without a modal open a mandatory list",()=>{
 assert.deepEqual(texts("Include:\n- a logo\n- a footer"),["Include: a logo","Include: a footer"]);
 assert.deepEqual(texts("Support these browsers:\n- Chrome\n- Firefox"),["Support these browsers: Chrome","Support these browsers: Firefox"]);
 assert.deepEqual(texts("Include all of the following:\n- SSO\n- audit log"),["Include all of the following: SSO","Include all of the following: audit log"]);
});

test("requirements-style headings open a mandatory list",()=>{
 for(const h of ["Requirements:","Acceptance criteria:","Deliverables:","Functional requirements:","Must-haves:"]){
  assert.deepEqual(texts(h+"\n- a logo"),[h+" a logo"],h);
 }
});

test("descriptive verb-noun headings and example lists stay contextual",()=>{
 for(const src of [
  "Use cases:\n- invoicing\n- payroll",
  "Test results:\n- 12 passed\n- 1 failed",
  "Review notes:\n- looks fine",
  "Log entries:\n- service started",
  "Examples:\n- a logo\n- a footer",
  "Features include:\n- dark mode\n- export"
 ])assert.deepEqual(texts(src),[],src);
});

test("a later non-list line ends the mandatory list",()=>{
 assert.deepEqual(texts("Include:\n- a logo\nBackground: the team likes blue.\n- a mascot"),["Include: a logo"]);
});

test("choice intros still group alternatives instead of becoming mandatory items",()=>{
 const list=extractReviewRequirements("You must provide one of:\n- a logo\n- a wordmark");
 assert.deepEqual(list.map(r=>r.kind),["choice_group"]);
});

test("issue #54 commands are extracted identically by prepare_review and prepare_bundle",()=>{
 const src=["- Ask the recipient to reply to the email.","- Distinguish correlation from proven causation in the summary.",
  "- Explain why interviews are appropriate for the research.","- Assign an owner to every project milestone.",
  "- Issue payment receipts for completed payments."].join("\n");
 const review=prepareEvidenceReview(src,"Nothing implemented.");
 const bundle=prepareBundleReview([{source_text:src}],"Nothing implemented.");
 assert.equal(review.requirements.length,5);
 assert.deepEqual(bundle.sources[0].requirements.map(r=>r.text),review.requirements.map(r=>r.text));
 assert.deepEqual(bundle.sources[0].requirements.map(r=>r.line),[1,2,3,4,5]);
});

test("issue #54 adverse uses of the same verbs are not extracted",()=>{
 for(const src of ["- The ask from the client was unclear.","- Explained: how webhooks work","- Assignment 3 is due on Friday.",
  "- Asking price was 200 pounds.","- Issue number 42 documents an example incident."])assert.deepEqual(texts(src),[],src);
});

test("both review packets state that extraction completeness is not independently verified",()=>{
 const review=prepareEvidenceReview("- Include a logo on the page.","x");
 const bundle=prepareBundleReview([{source_text:"- Include a logo on the page."}],"x");
 for(const lim of [review.limitations,bundle.limitations]){
  assert.match(lim,/only the extracted requirement/);
  assert.match(lim,/not independently verified/);
 }
});

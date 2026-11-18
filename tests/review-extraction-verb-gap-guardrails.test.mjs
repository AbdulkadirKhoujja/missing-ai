// Issue #54 / #18: guardrails for any future change to the review extractor's imperative verb list.
// Fixtures are synthetic and invented. This file changes no source code.
//
// What is IMPLEMENTED today: bullets that start with a listed imperative verb, carry a modal
// ("must", "should", ...) or sit under a mandatory list intro are extracted.
// What is a KNOWN GAP (recorded as todo, not claimed): fifteen everyday imperative bullets whose
// leading verb is not in the list are silently dropped, including issue #18's own baseline
// requirement "Stop the same workshop slot being booked twice."
// What is a REGRESSION GUARD (passing today): the same words used as nouns or adjectives must stay
// contextual. The maintainer asked (issue #54) that the verb list not grow without contextual
// negative tests; these negatives are those tests. Fixing the gap is REVIEW-class (shared/).
import test from "node:test";
import assert from "node:assert/strict";
import {extractReviewRequirements} from "../shared/review-extraction.mjs";
import {prepareEvidenceReview} from "../shared/evidence-review.mjs";
import {prepareBundleReview} from "../shared/bundle-review.mjs";

const texts=src=>extractReviewRequirements(src).map(r=>r.text);

const MISSED_COMMANDS=[
 "Stop the same workshop slot being booked twice.",
 "Notify the owner when a payment fails.",
 "Limit each user to three uploads per day.",
 "Add alt text to every image.",
 "List every third-party dependency with its licence.",
 "Describe the rollback plan in the release notes.",
 "Block sign-ups from disposable email domains.",
 "Encrypt backups at rest.",
 "Cite a primary source for each statistic.",
 "Summarise the findings in one paragraph.",
 "Write a test for the empty-cart case.",
 "Set a timeout on every outbound request.",
 "Return a 404 for unknown order IDs.",
 "Show the total price before checkout.",
 "Store passwords only as salted hashes.",
];

// The same leading words used as nouns, adjectives or names. None states an obligation.
const ADVERSE_CONTEXT=[
 "Stop words are removed by the tokenizer.",
 "Notify is the name of our alerting service.",
 "Limit orders filled at the open.",
 "Add-on pricing changed in March.",
 "List prices rose by four percent.",
 "Describe-it cards are used in the language class.",
 "Block 7 houses the library.",
 "Encrypted-at-rest volumes are the default here.",
 "Cited works appear at the end of the chapter.",
 "Summary statistics appear in Appendix B.",
 "Write-ups from the workshop are archived.",
 "Set theory is covered in week two.",
 "Return rates were higher in December.",
 "Show notes are published every Friday.",
 "Store opening hours vary by region.",
];

test("current gap (pinned): fifteen everyday imperative bullets with unlisted verbs are not extracted",()=>{
 for(const line of MISSED_COMMANDS)assert.deepEqual(texts("- "+line),[],line);
 // The gap is the same for both review entry points, so neither can account for these obligations.
 const src=MISSED_COMMANDS.map(l=>"- "+l).join("\n");
 assert.equal(prepareEvidenceReview("- Include a logo on the page.\n"+src,"x").requirements.length,1);
 assert.equal(prepareBundleReview([{source_text:"- Include a logo on the page.\n"+src}],"x").sources[0].requirements.length,1);
});

test("implemented: the same instructions are kept when a modal or a mandatory list intro states the obligation",()=>{
 for(const line of MISSED_COMMANDS){
  const lowered=line[0].toLowerCase()+line.slice(1);
  assert.deepEqual(texts("- You must "+lowered),["You must "+lowered],line);
 }
 const listed=extractReviewRequirements("Requirements:\n"+MISSED_COMMANDS.map(l=>"- "+l).join("\n"));
 assert.deepEqual(listed.map(r=>r.text),MISSED_COMMANDS);
 assert.deepEqual(listed.map(r=>r.line),MISSED_COMMANDS.map((_,i)=>i+2));
});

test("regression guard: the same words used as nouns or adjectives stay contextual",()=>{
 for(const line of ADVERSE_CONTEXT){
  assert.deepEqual(texts("- "+line),[],"bullet: "+line);
  assert.deepEqual(texts(line),[],"prose: "+line);
 }
 const src=ADVERSE_CONTEXT.map(l=>"- "+l).join("\n");
 assert.deepEqual(prepareBundleReview([{source_text:"- Include a logo on the page.\n"+src}],"x").sources[0].requirements.map(r=>r.text),
  ["Include a logo on the page."]);
});

test("regression guard: under a descriptive (non-mandatory) heading the adverse lines stay contextual",()=>{
 assert.deepEqual(texts("Background:\n"+ADVERSE_CONTEXT.map(l=>"- "+l).join("\n")),[]);
});

test.todo("goal (REVIEW-class, needs an approved design): extract the fifteen unlisted imperative bullets while every adverse-context guard above still passes",()=>{
 for(const line of MISSED_COMMANDS)assert.deepEqual(texts("- "+line),[line],line);
 for(const line of ADVERSE_CONTEXT)assert.deepEqual(texts("- "+line),[],line);
});

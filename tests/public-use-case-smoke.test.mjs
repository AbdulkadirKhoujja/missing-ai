// Source integrity tests for previously observed public synthetic MCP responses.
// CI does NOT invoke the live remote MCP; these tests re-check published evidence.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>JSON.parse(readFileSync(new URL("../benchmark/use-cases-v1/"+name,import.meta.url),"utf8"));
const a=read("observed-part-a.json"),b=read("observed-part-b.json"),rows=[...a.rows,...b.rows];
test("twelve completed live-response records cover two cases per chosen category",()=>{
 assert.equal(a.schema,"missing-ai-six-use-case-live-smoke-part-v1");
 assert.equal(b.schema,a.schema);
 assert.equal(a.group,"A");assert.equal(b.group,"B");
 assert.equal(rows.length,12);
 assert.equal(new Set(rows.map(x=>x.id)).size,12);
 assert.deepEqual([...new Set(rows.map(x=>x.category))].sort(),[
  "Advice & planning","Business deliverables","Coding & technical",
  "Education & learning","Research & information","Writing & editing"
 ]);
 const counts=new Map();for(const row of rows){counts.set(row.category,(counts.get(row.category)||0)+1);
  assert.match(row.fixture.source_text,/^-\s+/);
  assert.equal(row.fixture.synthetic_explicit_bullets,1);
  assert.equal(row.prepare.status,"success");
  assert.equal(row.lexical.status,"success");
 }
 assert.ok([...counts.values()].every(x=>x===2));
 assert.equal(a.human_ground_truth,"NONE");assert.equal(b.human_ground_truth,"NONE");
 assert.equal(a.live_mcp_deployment_sha,"NOT_ESTABLISHED");
});
test("published record preserves five missed imperative lines rather than claiming 12 of 12 extracted",()=>{
 const extracted=rows.reduce((n,r)=>n+r.prepare.count,0);
 assert.equal(extracted,7);
 assert.equal(rows.filter(r=>r.prepare.count===0).length,5);
 assert.deepEqual(rows.filter(r=>r.prepare.count===0).map(r=>r.id),["W02","R02","E02","B01","C01"]);
 assert.equal(rows.filter(r=>r.validate.status==="success").length,7);
 assert.equal(rows.filter(r=>r.validate.status==="not_attempted_extraction_incomplete").length,5);
});
test("all stored answer quotes remain verifiable at exact zero-based offsets",()=>{
 let quotes=0;
 for(const row of rows){
  const evidence=row.validate.evidence??[];
  if(row.validate.status==="success"){
   assert.equal(row.validate.validation.all_supplied_quotes_exact,true);
   assert.equal(row.validate.validation.implementation_verified,false);
   assert.equal(row.validate.validation.semantic_accuracy_verified,false);
  }
  for(const e of evidence){
   assert.equal(e.verified_in_answer,true);
   assert.equal(row.fixture.ai_output.slice(e.start,e.end),e.quote);
   assert.equal(e.end-e.start,e.quote.length);
   quotes++;
  }
 }
 assert.equal(quotes,5);
});
test("lexical-v1 flags every case; results are not independent semantic scores",()=>{
 assert.ok(rows.every(r=>r.lexical.findings.length===1&&r.lexical.findings[0].status==="needs_review"));
 const covered=rows.filter(r=>r.author_proposed_judgment==="claimed_covered");
 assert.equal(covered.length,5);
 assert.ok(covered.every(r=>r.lexical.findings[0].status==="needs_review"));
 for(const part of [a,b])assert.ok(part.limitations.some(x=>/not independently|not a representative/i.test(x)));
});

test("draft website shows six categories and twelve inspectable case details without calling them accurate",()=>{
 const page=readFileSync(new URL("../site/benchmarks/index.html",import.meta.url),"utf8");
 const home=readFileSync(new URL("../site/index.html",import.meta.url),"utf8");
 assert.match(page,/id="six-use-case-smoke"/);
 assert.equal((page.match(/<details>/g)||[]).length,12);
 assert.match(page,/Missed source obligation/);
 assert.match(page,/not independently verified errors/);
 assert.match(page,/deployed source revision could not be independently established/);
 assert.match(page,/observed-part-a\.json/);
 assert.match(page,/observed-part-b\.json/);
 for(const word of ["WRITING","RESEARCH","ADVICE","EDUCATION","BUSINESS","CODING"])assert.ok(home.includes(word));
 assert.match(home,/benchmarks\/#six-use-case-smoke/);
});

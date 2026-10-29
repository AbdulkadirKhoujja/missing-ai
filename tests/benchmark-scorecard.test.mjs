import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {renderBenchmark} from "../site/benchmarks/scorecard.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const history=JSON.parse(read("site/benchmarks/history.json"));
const base=JSON.parse(read("benchmarks/history.json"));
test("historical record is release-scoped, reproducible and exactly mirrored",()=>{
 assert.deepEqual(history,base);
 assert.equal(history.schema,"missing-ai-synthetic-release-history-v1");
 assert.equal(history.entries.length,1);
 const old=history.entries[0];
 assert.match(old.release_commit,/^[0-9a-f]{40}$/);
 assert.match(old.source_url,/\/actions\/runs\//);
 assert.match(history.caution,/not independently adjudicated/i);
 assert.equal(old.measurements.length,4);
 assert.deepEqual(old.measurements.map(m=>m.cases),[60,30,60,30]);
 assert.deepEqual(old.measurements.map(m=>m.recall),[.8,1,.9,1]);
 assert.deepEqual(old.measurements.map(m=>m.false_alarm_rate),[.5,1,.2,.8]);
});
test("published page and site build use the release result instead of hardcoded marketing metrics",()=>{
 const page=read("site/benchmarks/index.html"),workflow=read(".github/workflows/ci-and-pages.yml");
 assert.match(page,/id="benchmark-rows"/);
 assert.match(page,/id="history-rows"/);
 assert.match(page,/id="benchmark-status"/);
 assert.match(page,/author-labelled synthetic scenarios/i);
 assert.match(page,/scorecard\.js/);
 assert.doesNotMatch(page,/100% reliable|guaranteed accurate/i);
 assert.match(workflow,/cp site\/benchmarks\/index\.html site\/benchmarks\/scorecard\.js site\/benchmarks\/history\.json _site\/benchmarks\//);
 assert.match(workflow,/node scripts\/publish-public-benchmark\.mjs --out _site\/benchmarks/);
 for(const p of ["scorecard.js","history.json"])assert.equal(read("site/benchmarks/"+p),read("benchmarks/"+p));
});
test("renderer uses textContent-only for untrusted display labels and fails safely for unexpected schema",()=>{
 const source=read("site/benchmarks/scorecard.js");
 assert.doesNotMatch(source,/innerHTML|document\.write/);
 const values=new Map();
 const create=()=>({textContent:"",children:[],appendChild(x){this.children.push(x)},replaceChildren(){this.children=[]}});
 const oldDoc=globalThis.document;
 try{
  globalThis.document={getElementById(id){if(!values.has(id))values.set(id,create());return values.get(id);},
   createElement(){return create()}};
  const fixture={
   schema:"missing-ai-public-synthetic-benchmark-v1",release_commit:"a".repeat(40),
   generated_utc:"2026-10-29T10:23:43Z",
   datasets:Array.from({length:4},(_,i)=>({label:i===0?"<script>alert(1)</script>":"Synthetic "+i,
    production:i<2,entry:{case_count:10,confusion:{true_positive:3,false_positive:2},
     labels:{omitted:4,covered:3},metrics:{recall:.75,false_positive_rate:2/3}}}))
  };
  renderBenchmark(fixture,history);
  assert.equal(values.get("benchmark-rows").children.length,4);
  assert.equal(values.get("benchmark-rows").children[0].children[0].textContent,"<script>alert(1)</script>");
  assert.equal(values.get("history-rows").children.length,4);
  assert.match(values.get("benchmark-stamp").textContent,/author-written/);
  assert.throws(()=>renderBenchmark({schema:"wrong"},history),/Unexpected/);
 }finally{if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;}
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

class FakeElement {
  constructor(tag){this.tag=tag;this.value="";this.textContent="";this.children=[];this.listeners=new Map();this.scrollCalls=[];this.focusCalls=0;}
  addEventListener(type,handler){this.listeners.set(type,handler);}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  scrollIntoView(options){this.scrollCalls.push(options);}
  focus(){this.focusCalls++;}
}

function harness({fail=false,reducedMotion=false}={}){
  const nodes=new Map();
  const document={
    getElementById(id){
      if(id==="example-jump"||id==="copy-mcp-prompt")return null;
      if(!nodes.has(id))nodes.set(id,new FakeElement(id));
      return nodes.get(id);
    },
    createElement(tag){return new FakeElement(tag);}
  };
  const report={
    summary:{needs_review:2,likely_mentioned:1,text_found:1},
    findings:[],
    limitations:"Only wording-based suggestions. Check manually."
  };
  const original=read("site/app.js");
  assert.match(original,/^import \{checkMissing\}/);
  const script=original.replace(/^import \{checkMissing\} from "\.\/shared\/checker\.mjs";\n/,"");
  assert.notEqual(script,original);
  runInNewContext(script,{
    document,
    window:{MISSING_AI_API_BASE:"",matchMedia:()=>({matches:reducedMotion})},
    checkMissing:()=>{if(fail)throw new Error("Synthetic input rejected");return report;},
    navigator:{clipboard:{writeText:async()=>{}}},
    Event:class Event {constructor(type){this.type=type;}}
  });
  return {nodes,report,click:detail=>nodes.get("check-btn").listeners.get("click")({detail})};
}

test("one stable screen-reader status, outside the replaced gap report",()=>{
  for(const path of ["index.html","site/index.html"]){
    const html=read(path);
    assert.match(html,/<p id="result-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"><\/p>/);
    assert.match(html,/<aside class="result-panel" id="results" aria-label="Gap report">/);
    assert.doesNotMatch(html,/<aside[^>]*id="results"[^>]*aria-live=/);
  }
  assert.equal(read("site/index.html"),read("index.html"));
  assert.equal(read("site/app.js"),read("app.js"));
  assert.equal(read("site/styles.css"),read("styles.css"));
  assert.match(read("site/styles.css"),/\.sr-only\{position:absolute;/);
});

test("keyboard activation announces a concise summary without moving focus or scrolling",()=>{
  const {nodes,click}=harness();
  click(0);
  const announcement=nodes.get("result-announcement").textContent;
  assert.match(announcement,/Gap report ready\. 2 need review, 1 likely mentioned, and 1 have exact wording matches/);
  assert.match(announcement,/not verification/);
  assert.equal(nodes.get("results").scrollCalls.length,0);
  assert.ok([...nodes.values()].every(node=>node.focusCalls===0));
});

test("pointer activation scrolls to report and respects reduced motion",()=>{
  const {nodes,click}=harness({reducedMotion:true});
  click(1);
  assert.deepEqual(nodes.get("results").scrollCalls.map(x=>({behavior:x.behavior,block:x.block})),[{behavior:"auto",block:"nearest"}]);
});

test("failed checks are announced and do not steal keyboard focus",()=>{
  const {nodes,click}=harness({fail:true});
  click(0);
  assert.match(nodes.get("result-announcement").textContent,/Check not completed\. Synthetic input rejected/);
  assert.equal(nodes.get("results").scrollCalls.length,0);
  assert.ok([...nodes.values()].every(node=>node.focusCalls===0));
});

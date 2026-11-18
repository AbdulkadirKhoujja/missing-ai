// The local history page must show a declared correction link when the review
// reports one (issue #73). Before this test existed the page rendered a
// superseded claim as an ordinary "Related earlier message" with no sign that a
// later note had corrected it. The page script is loaded here against a minimal
// stand-in for the browser document; no browser, network or storage is used.
// Fixtures are fictional. A link is a declaration only: the page must say that
// it does not establish which statement is true.
import test from "node:test";
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";

function fakeNode(tag){
  return {tag,textContent:"",className:"",children:[],value:"",disabled:false,handlers:{},
    append(...kids){this.children.push(...kids);},
    replaceChildren(...kids){this.children=[...kids];},
    addEventListener(type,fn){this.handlers[type]=fn;}};
}
let loads=0;
async function loadPage(file){
  const byId=new Map();
  globalThis.document={
    getElementById(id){if(!byId.has(id))byId.set(id,fakeNode("#"+id));return byId.get(id);},
    createElement:fakeNode,
  };
  globalThis.location={hostname:"localhost"};
  await import(pathToFileURL(resolve(file)).href+"?load="+(++loads));
  return id=>globalThis.document.getElementById(id);
}
const message=(role,seconds,text,parent)=>({parent,message:{author:{role},create_time:seconds,content:{parts:[text]}}});
function exportFile(conversations){
  const body=JSON.stringify(conversations);
  return {name:"conversations.json",size:body.length,text:async()=>body};
}
const T0=1777622400; // 2026-05-01T08:00:00Z
const CLAIM="We have fixed the Orchard ledger sync configuration and verified it.";
const ANSWER="We need to fix the Orchard ledger sync configuration.";
const orchard=mapping=>({id:"orchard",title:"Orchard ledger sync",current_node:Object.keys(mapping).at(-1),mapping});
async function review(file,conversations){
  const el=await loadPage(file);
  await el("history-file").handlers.change({target:{files:[exportFile(conversations)],value:"x"}});
  assert.match(el("import-status").textContent,/history messages in this session/);
  el("answer-text").value=ANSWER;
  el("review-answer").handlers.click();
  const [heading,,...rest]=el("history-results").children;
  const findings=rest.filter(n=>n.className==="history-finding").map(n=>({
    label:n.children[0].textContent,
    quote:n.children.find(c=>c.tag==="blockquote").textContent,
    correction:n.children.filter(c=>c.className==="history-correction").map(c=>c.textContent),
  }));
  return {heading:heading.textContent,findings};
}

for(const file of ["site/history.js","history.js"]){
  test(file+": a declared correction and the claim it corrects are both shown and labelled",async()=>{
    const {heading,findings}=await review(file,[orchard({
      a:message("assistant",T0,CLAIM),
      b:message("user",T0+172800,"Correction: the Orchard ledger sync configuration fix was reverted and it is not fixed.","a"),
    })]);
    assert.match(heading,/1 with a later declared correction/);
    assert.equal(findings.length,2);
    const [correction,claim]=findings;
    assert.equal(correction.label,"Declared correction of an earlier statement");
    assert.match(correction.quote,/^Correction:/);
    assert.equal(correction.correction.length,1);
    assert.match(correction.correction[0],/correction of 1 earlier statement in your history/);
    assert.equal(claim.label,"Earlier statement with a later declared correction");
    assert.equal(claim.quote,CLAIM,"the earlier claim stays visible, unedited");
    assert.equal(claim.correction.length,1);
    assert.match(claim.correction[0],/same conversation, marked as a correction/);
    for(const f of findings)assert.match(f.correction[0],/does not establish which statement is true/);
  });

  test(file+": a correction that names the record ID is described as such",async()=>{
    const {findings}=await review(file,[
      orchard({a:message("assistant",T0,CLAIM)}),
      {id:"pier",title:"Pier weekly notes",current_node:"n",mapping:{n:message("user",T0+259200,"Supersedes orchard:a. That change was rolled back on Tuesday.")}},
    ]);
    assert.equal(findings.length,2);
    assert.equal(findings[0].label,"Declared correction of an earlier statement");
    assert.equal(findings[1].label,"Earlier statement with a later declared correction");
    assert.match(findings[1].correction[0],/it names this record/);
  });

  test(file+": without a declared correction nothing is labelled as corrected",async()=>{
    const {heading,findings}=await review(file,[orchard({
      a:message("assistant",T0,CLAIM),
      // Shares the keywords and negates the claim, but does not declare itself a correction.
      b:message("user",T0+172800,"The Orchard ledger sync configuration is not fixed on my machine.","a"),
    })]);
    assert.doesNotMatch(heading,/correction/);
    assert.equal(findings.length,2);
    assert.equal(findings[0].label,"Possible repeated work");
    assert.equal(findings[0].quote,CLAIM);
    assert.equal(findings[1].label,"Related earlier message");
    for(const f of findings)assert.deepEqual(f.correction,[]);
  });
}

test("correction notes are written as text, never as markup",async()=>{
  const {readFile}=await import("node:fs/promises");
  const js=await readFile(new URL("../site/history.js",import.meta.url),"utf8");
  assert.doesNotMatch(js,/innerHTML|insertAdjacentHTML|outerHTML/);
});

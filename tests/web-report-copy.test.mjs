import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {checkMissing} from "../shared/checker.mjs";

function browser({rejectCopy=false}={}){
 const nodes=[];
 function element(tag="div"){
  const item={tag,children:[],listeners:{},attributes:{},value:"",textContent:"",
   append(...children){this.children.push(...children)},replaceChildren(){this.children=[]},
   addEventListener(name,fn){this.listeners[name]=fn},setAttribute(name,value){this.attributes[name]=value},
   scrollIntoView(){}};
  Object.defineProperty(item,"innerHTML",{set(){throw new Error("Untrusted HTML must not be inserted")}});
  nodes.push(item);return item;
 }
 const ids=new Map();let copied;
 const document={getElementById(id){if(!ids.has(id))ids.set(id,element());return ids.get(id)},createElement:element};
 const navigator={clipboard:{async writeText(text){if(rejectCopy)throw new Error("denied");copied=text}}};
 const code=readFileSync(new URL("../site/app.js",import.meta.url),"utf8").replace(/^import[^\n]+\n/,"");
 vm.runInNewContext(code,{document,navigator,checkMissing,window:{},Event:class{}});
 return {nodes,ids,check(source,answer){ids.get("source-text").value=source;ids.get("output-text").value=answer;ids.get("check-btn").listeners.click()},copied:()=>copied};
}
const source="- Include a cancellation flow\n- Add a dark mode\n- Export an audit log\n- Display <img src=x onerror=alert(1)> literally";
const answer="Include a cancellation flow. A night theme is available.";

test("text copy preserves lexical findings, source lines and caveats including false alarms",async()=>{
 const ui=browser();ui.check(source,answer);
 const button=ui.nodes.find(n=>n.tag==="button"&&n.textContent==="Copy report as text");
 assert.ok(button,"a labelled text-copy button is offered beside JSON");
 assert.equal(button.type,"button");
 await button.listeners.click();
 const text=ui.copied(),report=checkMissing(source,answer);
 assert.equal(report.findings.length,4);
 for(const finding of report.findings){assert.ok(text.includes(finding.text));assert.ok(text.includes(`Source line ${finding.line}`));assert.ok(text.includes(finding.status))}
 assert.ok(text.includes(report.limitations));
 assert.match(text,/heuristic|overlapping terms/i);
 assert.match(text,/not semantic proof/i);
 assert.ok(report.findings.find(f=>f.text.includes("dark mode")).status==="needs_review");
 assert.ok(report.findings.find(f=>f.text.includes("audit log")).status==="needs_review");
 assert.ok(ui.nodes.some(n=>n.attributes.role==="status"&&n.textContent==="Text report copied."));
 const json=ui.nodes.find(n=>n.textContent==="Copy report as JSON");await json.listeners.click();
 assert.deepEqual(JSON.parse(ui.copied()),report);
});
test("clipboard refusal leaves a readable status and the report available",async()=>{
 const ui=browser({rejectCopy:true});ui.check(source,answer);
 const button=ui.nodes.find(n=>n.textContent==="Copy report as text");assert.ok(button);
 await button.listeners.click();
 assert.equal(ui.copied(),undefined);
 assert.ok(ui.nodes.some(n=>n.attributes.role==="status"&&/permission/.test(n.textContent)));
 assert.ok(ui.nodes.some(n=>n.textContent.includes("audit log")));
});

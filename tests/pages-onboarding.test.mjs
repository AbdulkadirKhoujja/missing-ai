import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const assets=[
 "history.html","history.css","history.js","history-context.mjs","history-vault.mjs",
 "quickstart.html","quickstart.css","quickstart.js","context-onboarding.mjs"
];

test("Pages build explicitly includes every local history and instant-start asset",()=>{
 const workflow=read(".github/workflows/ci-and-pages.yml");
 const copyLines=workflow.split("\n").filter(line=>/^\s*cp\s/.test(line));
 for(const filename of assets){
   const site="site/"+filename;
   assert.ok(existsSync(new URL("../"+site,import.meta.url)),site+" source is missing");
   assert.ok(copyLines.some(line=>line.includes(site)),site+" is missing from Pages copy commands");
 }
});
test("root and site mirror assets stay identical and start links resolve",()=>{
 for(const filename of assets){
   assert.equal(read(filename),read("site/"+filename),filename+" root/site mirror mismatch");
 }
 assert.match(read("site/index.html"),/href="\.\/quickstart\.html"/);
 assert.match(read("site/history.html"),/href="\.\/quickstart\.html"/);
});
test("instant onboarding uses local-only Content Security Policy",()=>{
 const page=read("site/quickstart.html");
 assert.match(page,/connect-src 'none'/);
 assert.match(page,/script-src 'self'/);
 assert.doesNotMatch(read("site/quickstart.js"),/\binnerHTML\s*=/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
test("experimental checker is not imported into public website or MCP server",()=>{
 for(const path of ["../app.js","../site/app.js","../server/index.mjs","../shared/checker.mjs"]){
  assert.doesNotMatch(read(path),/checker-v2/);
 }
});
test("Phase 2 report explicitly rejects promoting candidate on challenge failure",()=>{
 const report=read("../docs/phase2-experiment-001.md");
 assert.match(report,/Do not promote/);
 assert.match(report,/8 \/ 10 \(80%\)/);
 assert.match(report,/not independently adjudicated/);
});

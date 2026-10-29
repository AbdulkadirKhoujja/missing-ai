import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("deployed site assets and root-local demo mirrors are identical",()=>{
 for(const name of ["index.html","app.js","styles.css","config.js","favicon.svg","privacy.html"]){
  assert.ok(existsSync(new URL("../site/"+name,import.meta.url)),name+" missing");
  assert.equal(read("site/"+name),read(name),"site/root drift in "+name);
 }
});
test("GitHub Pages build includes the data handling page",()=>{
 const workflow=read(".github/workflows/ci-and-pages.yml");
 assert.match(workflow,/cp site\/index\.html site\/privacy\.html site\/styles\.css site\/app\.js/);
 assert.match(workflow,/cp shared\/checker\.mjs _site\/shared\/checker\.mjs/);
});
test("website has local checker, candid beta notice, live sample and privacy access",()=>{
 const html=read("site/index.html"),js=read("site/app.js"),css=read("site/styles.css");
 for(const id of ["source-text","output-text","check-btn","example-btn","example-jump","copy-mcp-prompt","copy-prompt-status","results","faq","use-cases"]){
  assert.ok(html.includes('id="'+id+'"'),id+" absent in HTML");
 }
 assert.match(html,/privacy\.html/);
 assert.match(html,/CONTRIBUTING\.md/);
 assert.match(html,/wording-based|wording check|wording overlap/i);
 assert.match(html,/not an officially listed plugin/i);
 assert.match(html,/not.*implementation verification|cannot prove what the code actually does/i);
 assert.match(html,/confidential/i);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(js,/exampleJump\.addEventListener\("click"/);
 assert.match(js,/copyPrompt\.addEventListener\("click"/);
 assert.match(js,/navigator\.clipboard\.writeText\(message\)/);
 assert.match(js,/checkMissing\(source\.value,output\.value\)/);
});
test("policy page describes browser check, remote URL fetch and MCP text transmission",()=>{
 const html=read("site/privacy.html");
 assert.match(html,/text is compared locally by JavaScript/i);
 assert.match(html,/Loading a public URL sends|your selected URL is submitted/i);
 assert.match(html,/MCP requests|MCP tools/i);
 assert.match(html,/logs/i);
 assert.match(html,/no independently audited|no independent privacy audit/i);
 assert.match(html,/private client|confidential/i);
});
test("all community health files and developer handoff documents exist",()=>{
 for(const path of [
  "README.md","LICENSE","CONTRIBUTING.md","CODE_OF_CONDUCT.md","SECURITY.md",
  "ACCESSIBILITY.md","SUPPORT.md","docs/DEVELOPER_HANDOFF.md","docs/LAUNCH_GATES.md",
  "docs/marketing/LAUNCH_KIT.md","docs/marketing/DEVELOPER_BACKLOG.md",
  ".github/ISSUE_TEMPLATE/bug_report.md",".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/ISSUE_TEMPLATE/accuracy_case.md",".github/ISSUE_TEMPLATE/config.yml",
  ".github/PULL_REQUEST_TEMPLATE.md"
 ])assert.ok(existsSync(new URL("../"+path,import.meta.url)),path);
 const readme=read("README.md");
 assert.match(readme,/Node\.js 22\+/);
 assert.match(readme,/prepare_bundle/);
 assert.match(readme,/validate_bundle/);
 assert.match(readme,/lexical-v1/);
 assert.match(readme,/Silver/);
 assert.doesNotMatch(readme,/Caddy currently exposes the corrected Amber/);
 assert.doesNotMatch(readme,/This code is not live until a separate rollout passes/);
 assert.match(readme,/not independently adjudicated/i);
});
test("security and outreach documentation do not advertise remote MCP as a verified product",()=>{
 const launch=read("docs/marketing/LAUNCH_KIT.md");
 const safety=read("docs/LAUNCH_GATES.md");
 assert.match(launch,/controlled beta/i);
 assert.match(launch,/do not say/i);
 assert.match(launch,/do not invent/i);
 assert.match(safety,/independent semantic accuracy/i);
 assert.match(safety,/MCP abuse controls/i);
 assert.match(safety,/domain\/host isolation/i);
 assert.match(read("SECURITY.md"),/Do not file exploitable details/i);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const root=new URL("../",import.meta.url);
const read=async path=>readFile(new URL(path,root),"utf8");
test("conversation preview has restrictive CSP and no browser-initiated external connection",async()=>{
 const html=await read("site/history.html");
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/object-src 'none'/);
 assert.match(html,/script-src 'self'/);
 assert.match(html,/robots\" content=\"noindex,nofollow\"/);
 const js=await read("site/history.js");
 assert.doesNotMatch(js,/\bfetch\s*\(/);
 assert.doesNotMatch(js,/XMLHttpRequest/);
 assert.doesNotMatch(js,/sendBeacon/);
});
test("persistent vault is disabled on shared GitHub Pages origin",async()=>{
 const js=await read("site/history.js");
 assert.match(js,/location\.hostname===\"abdulkadirkhoujja\.github\.io\"/);
 for(const id of ["save-vault","load-vault","delete-vault"])assert.ok(js.includes(id));
 assert.match(js,/sharedPagesOrigin/);
 assert.match(await read("site/privacy.html"),/encrypted saving is disabled/);
});
test("private MCP remains separate from public server tool schema",async()=>{
 const server=await read("server/index.mjs");
 assert.doesNotMatch(server,/missing_ai_search_history|missing_ai_review_answer_history/);
 const companion=await read("private-history/context-mcp.mjs");
 assert.doesNotMatch(companion,/createServer\s*\(|\.listen\s*\(/);
 assert.match(companion,/serveStdio/);
});
test("root mirrors match the deployment source for history and privacy",async()=>{
 for(const file of ["history.html","history.js","history.css","history-context.mjs","history-vault.mjs","privacy.html"]){
  assert.equal(await read(file),await read("site/"+file),"drift in "+file);
 }
});

test("private history source identity is pinned across inspection and read",async()=>{
 const code=await read("private-history/context-mcp.mjs");
 for(const marker of ["constants.O_NOFOLLOW","st.dev!==file.dev","st.ino!==file.ino","maxBytes"])assert.ok(code.includes(marker),marker);
});
test("vault encrypts before storage and does not persist the key or passphrase",async()=>{
 const cryptoCode=await read("site/history-vault.mjs");
 const uiCode=await read("site/history.js");
 for(const marker of ["AES-GCM","PBKDF2","crypto.subtle.encrypt"])assert.ok(cryptoCode.includes(marker),marker);
 assert.ok(uiCode.includes("await encryptHistory(messages,passphrase())"));
 assert.ok(uiCode.includes('dbOperation("readwrite","put",record)'));
 assert.equal(uiCode.includes("localStorage.setItem("),false);
});

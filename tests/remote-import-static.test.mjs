import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('browser and receiver keep private scope and never accept a public host or SSH command from user text',async()=>{
 const browser=await readFile(new URL('private-history/remote-import-desktop.mjs',root),'utf8');
 const server=await readFile(new URL('private-history/remote-import-stdio.mjs',root),'utf8');
 assert.match(browser,/host!=='127\.0\.0\.1'/);
 assert.match(browser,/StrictHostKeyChecking=yes/);
 assert.match(browser,/shell:false/);
 assert.match(browser,/req\.headers\.origin!==origin/);
 assert.match(browser,/selected\(\)/);
 assert.match(server,/constants\.O_NOFOLLOW/);
 assert.match(server,/no network listener/i);
 assert.doesNotMatch(server,/listen\(/);
});

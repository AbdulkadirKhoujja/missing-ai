import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const url=new URL("../deploy/hetzner/upgrade-local.sh",import.meta.url);
const file=new URL("../deploy/hetzner/upgrade-local.sh",import.meta.url);
const script=readFileSync(file,"utf8");
test("upgrade script parses but cannot run without approved SHAs",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",file.pathname]));
 const v=(()=>{try{execFileSync("bash",[file.pathname],{stdio:"pipe"});return 0}catch(e){return e.status}})();
 assert.equal(v,78);
});
test("upgrade scope and rollback are explicit",()=>{
 assert.match(script,/docker image tag missing-ai-api:local/);
 assert.match(script,/docker compose -f "\$compose" up -d --no-deps --no-build --force-recreate api/);
 assert.match(script,/^rollback\(\)/m);
 assert.match(script,/orchestryn_health/);
 assert.match(script,/git -C "\$repo" checkout --detach "\$target"/);
 assert.doesNotMatch(script,/docker compose[\s\S]*\/opt\/orchestryn\/deploy\/compose/);
 assert.doesNotMatch(script,/systemctl (stop|restart|reload)/);
});

test("rollback waits for the old container to become healthy before declaring restoration",()=>{
 assert.match(script,/wait_api\(\) \{/);
 assert.match(script,/for attempt in \$\(seq 1 45\)/);
 assert.match(script,/if docker compose[^\n]*force-recreate api &&\s*wait_api &&\s*orchestryn_health/);
 assert.match(script,/MISSING_AI_PREVIOUS_VERSION_RESTORED_AND_HEALTHY/);
 assert.match(script,/MISSING_AI_API_READINESS_FAILED_LAST_STATE=/);
 assert.match(script,/docker logs --tail 35 missing-ai-api/);
 assert.doesNotMatch(script,/curl --fail --silent --show-error --max-time 10 http:\/\/127\.0\.0\.1:3101\/health >\/dev\/null \|\|/);
});

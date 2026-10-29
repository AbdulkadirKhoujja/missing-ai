import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const path=fileURLToPath(new URL("../deploy/hetzner/caddy-cutover-amber-local.sh",import.meta.url));
const script=readFileSync(path,"utf8");
test("HTTPS Amber cutover script is Bash syntactically valid",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",path]));
});
test("cutover only changes previously inspected Missing AI upstream",()=>{
 for(const required of [
 "live Caddyfile deviates from reviewed Green configuration",
 "reverse_proxy 127.0.0.1:3102 {",
 "reverse_proxy 127.0.0.1:3103 {",
 "reverse_proxy 127.0.0.1:3000",
 "header_up -Cookie",
 "header_up -Authorization",
 "header_up X-Forwarded-For {remote_host}",
 'caddy validate --config "$staged" --adapter caddyfile',
 "MISSING_AI_CUTOVER_ROLLBACK_BEGIN",
 "MISSING_AI_GREEN_ROUTING_RESTORED",
 "ORCHESTRYN_AND_BLUE_GREEN_UNCHANGED_PASS",
 "MISSING_AI_AMBER_PUBLIC_CUTOVER_PASS"
 ])assert.ok(script.includes(required),required);
 assert.doesNotMatch(script,/docker (stop|restart|rm -f)|docker compose|git checkout|systemctl (stop|restart)/);
});
test("live public URL import, MCP fetch and SSRF rejection are mandatory cutover checks",()=>{
 for(const required of [
 "AMBER_PRE_CUTOVER_FETCH_PASS",
 "AMBER_PUBLIC_API_FETCH_PASS",
 "AMBER_PUBLIC_MCP_FETCH_PASS",
 "AMBER_PUBLIC_CHECK_MISSING_PASS",
 "AMBER_PUBLIC_PRIVATE_IP_REJECTION_PASS",
 "AMBER_PUBLIC_CORS_PASS"
 ])assert.ok(script.includes(required),required);
 assert.match(script,/https:\/\/example\.com\//);
 assert.match(script,/https:\/\/127\.0\.0\.1\//);
});

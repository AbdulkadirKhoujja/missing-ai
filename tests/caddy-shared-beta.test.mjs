import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const file=fileURLToPath(new URL("../deploy/hetzner/caddy-shared-beta-local.sh",import.meta.url));
const script=readFileSync(file,"utf8");
const conf=readFileSync(new URL("../deploy/hetzner/Caddyfile.shared-beta.example",import.meta.url),"utf8");
test("shared beta Caddy setup shell syntax",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",file]));
});
test("route strips only Missing AI prefix and preserves Orchestryn",()=>{
 for(const x of ["handle_path /missing-ai/*","reverse_proxy 127.0.0.1:3102","header_up X-Forwarded-For {remote_host}","header_up -Cookie","header_up -Authorization","reverse_proxy 127.0.0.1:3000"]) {
  assert.ok(script.includes(x),x);
  assert.ok(conf.includes(x),x);
 }
 assert.match(conf,/handle\s*\{\s*reverse_proxy 127\.0\.0\.1:3000/);
});
test("script rejects unexpected Caddyfile and rolls back on failed live checks",()=>{
 for(const x of [
 "CADDY_CURRENT_MUST_MATCH",
 "CADDY_BACKUP=$backup",
 "MISSING_AI_CADDY_ROLLBACK_BEGIN",
 "caddy validate --config \"$staged\" --adapter caddyfile",
 "systemctl reload caddy",
 "MISSING_AI_PUBLIC_HTTPS_HEALTH_PASS",
 "MISSING_AI_PUBLIC_API_CHECK_PASS",
 "MISSING_AI_PUBLIC_MCP_PASS",
 "ORCHESTRYN_HTTPS_AND_MCP_UNCHANGED_PASS",
 "MISSING_AI_BROWSER_CORS_PASS"
 ])assert.ok(script.includes(x),x);
 assert.doesNotMatch(script,/docker\s+(stop|restart|rm)|docker compose|git checkout|systemctl\s+(restart|stop)\s+caddy/);
});

test("staged temporary Caddyfile must not be parsed as JSON",()=>{
 assert.ok(script.includes('caddy validate --config "$staged" --adapter caddyfile'));
 assert.ok(!script.includes('caddy validate --config "$staged" >/dev/null'));
});

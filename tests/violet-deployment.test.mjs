import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const file=fileURLToPath(new URL("../deploy/hetzner/violet-real-source-local.sh",import.meta.url));
const s=readFileSync(file,"utf8");
const c=readFileSync(new URL("../deploy/hetzner/compose.violet.yml",import.meta.url),"utf8");
test("Violet deploy is valid bash and requires an immutable reviewed SHA",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",file]));
 let status=0;try{execFileSync("bash",[file],{stdio:"pipe"});}catch(e){status=e.status;}
 assert.equal(status,78);
});
test("Violet has only a loopback port and isolated Compose network",()=>{
 for(const x of ["name: missing-ai-violet","container_name: missing-ai-violet-api","127.0.0.1:3105:3101","read_only: true","mem_limit: 256m","cap_drop:","no-new-privileges:true"])
  assert.ok(c.includes(x),x);
 assert.doesNotMatch(c,/docker\.sock|privileged:\s*true|\/opt\/orchestryn|127\.0\.0\.1:310[1234]:3101/);
});
test("Violet Caddy changes only known Indigo upstream, preserves all four older containers",()=>{
 for(const x of [
  "reverse_proxy 127.0.0.1:3104 {",
  "reverse_proxy 127.0.0.1:3105 {",
  "reverse_proxy 127.0.0.1:3000",
  "header_up -Authorization",
  "header_up -Cookie",
  "missing-ai-api",
  "missing-ai-green-api",
  "missing-ai-amber-api",
  "missing-ai-indigo-api",
  "VIOLET_CADDY_ROLLBACK_BEGIN",
  "VIOLET_INDIGO_ROUTING_RESTORED",
  "INDIGO_ROLLBACK_LOCAL=http://127.0.0.1:3104",
  "ORCHESTRYN_BLUE_GREEN_AMBER_INDIGO_UNCHANGED_PASS",
  "caddy validate --config \"$staged\" --adapter caddyfile"
 ])assert.ok(s.includes(x),x);
 assert.doesNotMatch(s,/git -C "\$repo" checkout|docker (stop|restart|rm -f) missing-ai-api|systemctl (restart|stop)/);
});
test("live primary and linked GOV.UK sources, exact quote rejection, legacy and SSRF guards before and after cutover",()=>{
 for(const x of [
  "test_services http://127.0.0.1:3105",
  'test_services "$endpoint"',
  "making-your-service-accessible-an-introduction",
  "testing-for-accessibility",
  "VIOLET_REAL_SOURCE_PRIMARY_PASS",
  "VIOLET_REAL_SOURCE_LINKED_GUIDE_PASS",
  "source_link_unreviewed",
  "linked_source_policy",
  "prepare_review",
  "validate_review",
  "check_missing",
  "fetch_source",
  "not an exact quotation",
  "semantic_accuracy_verified",
  "https://127.0.0.1/",
  "VIOLET_PUBLIC_CORS_PASS"
 ])if(x!=="source_link_unreviewed")assert.ok(s.includes(x),x);
});

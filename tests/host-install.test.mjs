import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const path=fileURLToPath(new URL("../deploy/hetzner/install-local.sh",import.meta.url));
const script=readFileSync(path,"utf8");

test("host installer parses as Bash without running it",()=>{
  assert.doesNotThrow(()=>execFileSync("bash",["-n",path]));
});

test("installer is fail-closed and never restarts private services",()=>{
  assert.match(script,/require_root/);
  assert.match(script,/orchestryn_health/);
  assert.match(script,/PORT_3101_FREE/);
  assert.match(script,/\bexpected_sha\b/);
  assert.match(script,/actual_sha.*expected_sha/);
  assert.match(script,/docker compose -f "\$compose" up -d --no-build api/);
  assert.match(script,/docker compose -f "\$compose" down --remove-orphans/);
  assert.doesNotMatch(script,/docker compose[^\n]*deploy\/compose\.yml/);
  assert.doesNotMatch(script,/systemctl\s+(stop|restart|reload)\s+(docker|caddy|orchestryn)/);
  assert.doesNotMatch(script,/worker_requests\/current\.json|ssh-key|orchestryn.*env/);
});

test("does not modify Caddy or DNS automatically",()=>{
  assert.match(script,/HTTPS_CADDY_AND_DNS_NOT_CONFIGURED_BY_SCRIPT/);
  assert.doesNotMatch(script,/caddy reload|caddy start|systemctl reload caddy|nsupdate/);
});

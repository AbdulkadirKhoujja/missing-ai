import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const compose=readFileSync(new URL("../deploy/hetzner/compose.missing-ai.yml",import.meta.url),"utf8");
const dockerfile=readFileSync(new URL("../deploy/hetzner/Dockerfile",import.meta.url),"utf8");
const caddy=readFileSync(new URL("../deploy/hetzner/Caddyfile.missing-ai.example",import.meta.url),"utf8");
test("dedicated host port and resource-limited container",()=>{
 assert.match(compose,/127\.0\.0\.1:3101:3101/);
 for(const val of ["read_only: true","mem_limit: 256m","cpus: 0.5","no-new-privileges:true","- ALL"])assert.ok(compose.includes(val));
 assert.doesNotMatch(compose,/privileged:\s*true|network_mode:\s*host|docker\.sock|\/var\/lib\/orchestryn|\.\.\/compose\.yml/);
 assert.match(dockerfile,/USER node/);
 assert.match(dockerfile,/COPY server \.\/server/);
 assert.doesNotMatch(dockerfile,/ORCHESTRYN_|\bUSER root\b/);
});
test("Missing AI receives a separate Caddy host only",()=>{
 assert.match(caddy,/^missing-ai-api\.orchestryn\.com\s*\{/m);
 assert.match(caddy,/reverse_proxy 127\.0\.0\.1:3101/);
 assert.doesNotMatch(caddy,/^api\.orchestryn\.com\s*\{/m);
});

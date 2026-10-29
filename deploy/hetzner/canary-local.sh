#!/usr/bin/env bash
# Isolated, zero-port smoke test of a reviewed Missing AI Git commit.
# Does NOT change the live checkout, Compose project, running image tag, proxy or DNS.
set -Eeuo pipefail
umask 077

target="${1:-}"
repo=/opt/missing-ai
old="92af431428f7035467b088165c96797500a7939b"
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || { echo "Usage: canary-local.sh <exact-reviewed-SHA>" >&2; exit 78; }
test "${EUID}" -eq 0 || { echo "CANARY_REFUSED: run as root" >&2; exit 78; }
for command in docker git mktemp tar curl; do
  command -v "$command" >/dev/null || { echo "CANARY_REFUSED: missing $command" >&2; exit 78; }
done
test -d "$repo/.git" || { echo "CANARY_REFUSED: Missing AI repository absent" >&2; exit 78; }
test "$(git -C "$repo" rev-parse HEAD)" = "$old" || { echo "CANARY_REFUSED: expected original Git SHA" >&2; exit 78; }
test -z "$(git -C "$repo" status --porcelain --untracked-files=no)" ||
  { echo "CANARY_REFUSED: dirty Missing AI checkout" >&2; exit 78; }
test "$(docker inspect missing-ai-api --format '{{index .Config.Labels "com.docker.compose.project"}}')" = "missing-ai" ||
  { echo "CANARY_REFUSED: live container identity changed" >&2; exit 78; }
test "$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = "healthy" ||
  { echo "CANARY_REFUSED: production Missing AI unhealthy" >&2; exit 78; }
curl --fail --silent --show-error --max-time 8 http://127.0.0.1:3101/health >/dev/null ||
  { echo "CANARY_REFUSED: existing Missing AI HTTP unhealthy" >&2; exit 78; }
curl --fail --silent --show-error --max-time 8 http://127.0.0.1:3000/health >/dev/null ||
  { echo "CANARY_REFUSED: Orchestryn control plane unhealthy" >&2; exit 78; }

echo "CANARY_EXISTING_PRODUCTION_HEALTH_PASS"
git -C "$repo" fetch --no-tags origin main
git -C "$repo" cat-file -e "$target^{commit}" ||
  { echo "CANARY_REFUSED: target commit not fetched" >&2; exit 78; }
git -C "$repo" merge-base --is-ancestor "$target" origin/main ||
  { echo "CANARY_REFUSED: target must be reachable from main" >&2; exit 78; }

name="missing-ai-canary-${target:0:12}"
tag="missing-ai-api:canary-${target:0:12}"
if docker container inspect "$name" >/dev/null 2>&1; then
  echo "CANARY_REFUSED: test container name already exists" >&2
  exit 78
fi
if docker image inspect "$tag" >/dev/null 2>&1; then
  echo "CANARY_REFUSED: test image tag already exists" >&2
  exit 78
fi
tmp="$(mktemp -d)"
started=0
cleanup() {
  code=$?
  trap - EXIT
  if [ "$started" = 1 ]; then
    if [ "$code" -ne 0 ]; then
      echo "CANARY_FAILED_LOGS_LAST_30" >&2
      docker logs --tail 30 "$name" >&2 || true
    fi
    docker rm -f "$name" >/dev/null 2>&1 || true
  fi
  if [ -n "${tmp:-}" ] && [ -d "$tmp" ]; then rm -rf -- "$tmp"; fi
  docker image rm "$tag" >/dev/null 2>&1 || true
  exit "$code"
}
trap cleanup EXIT

# Build an immutable archive in a separate temporary directory. No checkout switch.
git -C "$repo" archive --format=tar "$target" | tar -xf - -C "$tmp"
docker build --quiet -t "$tag" -f "$tmp/deploy/hetzner/Dockerfile" "$tmp" >/dev/null
echo "CANARY_ISOLATED_IMAGE_BUILT"

# No published ports, no Docker socket, no shared network, no Orchestryn volumes/secrets.
docker run -d --rm \
  --name "$name" \
  --network none \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --memory 256m --cpus 0.5 --pids-limit 100 \
  --tmpfs /tmp:rw,nosuid,nodev,size=32m \
  "$tag" >/dev/null
started=1

ready=0
for attempt in $(seq 1 45); do
  state="$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || true)"
  if [ "$state" = healthy ]; then ready=1; break; fi
  sleep 2
done
test "$ready" = 1 || { echo "CANARY_HEALTH_TIMEOUT" >&2; exit 1; }

docker exec "$name" node --input-type=module -e '
const base="http://127.0.0.1:3101";
async function req(path,body) {
  const response=await fetch(base+path,{method:"POST",headers:{"content-type":"application/json",accept:"application/json, text/event-stream"},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
const health=await fetch(base+"/health");
const data=await health.json();
if(!health.ok||data.service!=="missing-ai") throw Error("Canary /health failed");
const checked=await req("/api/check",{source_text:"- Must verify signed webhooks",ai_output:"Created a homepage."});
if(checked.status!==200||checked.body.report?.summary?.needs_review!==1)throw Error("Canary /api/check failed");
const init=await req("/mcp",{jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"canary",version:"1"}}});
if(init.status!==200||init.body.result?.serverInfo?.name!=="missing-ai")throw Error("Canary MCP initialize failed");
const tools=await req("/mcp",{jsonrpc:"2.0",id:2,method:"tools/list"});
if(!tools.body.result?.tools?.some(t=>t.name==="check_missing"))throw Error("Canary MCP tool list failed");
const call=await req("/mcp",{jsonrpc:"2.0",id:3,method:"tools/call",params:{name:"check_missing",arguments:{source_text:"- Must verify signed webhooks",ai_output:"Created a homepage."}}});
if(call.body.result?.isError||call.body.result?.structuredContent?.summary?.needs_review!==1)throw Error("Canary MCP call failed");
const refused=await req("/api/fetch",{url:"https://127.0.0.1/"});
if(refused.status!==400)throw Error("Private IP fetch was not rejected");
console.log("CANARY_API_MCP_AND_PRIVATE_IP_TESTS_PASS");
'

# The active production container and its checkout must remain exactly unchanged.
test "$(git -C "$repo" rev-parse HEAD)" = "$old"
test "$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy
curl --fail --silent --show-error --max-time 8 http://127.0.0.1:3101/health >/dev/null
curl --fail --silent --show-error --max-time 8 http://127.0.0.1:3000/health >/dev/null
echo "CANARY_PRODUCTION_UNCHANGED_HEALTHY"
echo "CANARY_ALL_PASS"

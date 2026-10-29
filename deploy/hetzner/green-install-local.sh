#!/usr/bin/env bash
# One-time blue/green launch; leaves all live Missing AI and Orchestryn services unchanged.
# Exact reviewed commit is archived into a separate persistent checkout-free release directory.
set -Eeuo pipefail
umask 077
sha="${1:-}"
repo=/opt/missing-ai
root=/opt/missing-ai-green
old=92af431428f7035467b088165c96797500a7939b
port=3102
fail(){ echo "MISSING_AI_GREEN_REFUSED: $*" >&2; exit 78; }
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail "exact 40-character reviewed SHA required"
test "${EUID}" -eq 0 || fail "host administrator required"
for binary in git docker curl ss tar awk; do command -v "$binary" >/dev/null || fail "missing $binary"; done
docker compose version >/dev/null || fail "Docker Compose unavailable"
test -d "$repo/.git" || fail "existing Missing AI Git checkout absent"
test "$(git -C "$repo" rev-parse HEAD)" = "$old" || fail "existing checkout changed"
test -z "$(git -C "$repo" status --porcelain --untracked-files=no)" || fail "tracked worktree dirty"
test "$(git -C "$repo" remote get-url origin)" = "https://github.com/AbdulkadirKhoujja/missing-ai.git" || fail "repository origin mismatch"
test ! -e "$root" || fail "green deployment directory already exists: inspect, do not overwrite"
test -z "$(docker ps -aq --filter 'name=^/missing-ai-green-api$')" || fail "green container already exists"
test -z "$(docker image ls -q missing-ai-green-api:initial)" || fail "green image tag already exists"
test -z "$(docker network ls -q -f name='^missing-ai-green_missing_ai_green$')" || fail "green network already exists"
ss -H -ltn | awk -v p=":$port" '$4 ~ (p "$") {found=1} END{exit !found}' &&
  fail "port $port occupied" || true
test "$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy ||
  fail "blue production API not healthy"
curl -fsS --max-time 8 http://127.0.0.1:3101/health >/dev/null || fail "blue API not reachable"

orchestryn_health(){
  curl -fsS --max-time 8 http://127.0.0.1:3000/health >/dev/null || return 1
  for service in control-plane chatgpt-lead claude-supervisor runtime-bridge; do
    mapfile -t ids < <(docker ps -q --filter "label=com.docker.compose.service=$service")
    test "${#ids[@]}" -eq 1 || { echo "ORCHESTRYN_SERVICE_COUNT_INVALID=$service" >&2; return 1; }
    test "$(docker inspect "${ids[0]}" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy ||
      { echo "ORCHESTRYN_SERVICE_NOT_HEALTHY=$service" >&2; return 1; }
  done
}
orchestryn_health || fail "Orchestryn is not healthy before green deploy"
available="$(free -m | awk '/^Mem:/ {print $7}')"
test "${available:-0}" -ge 512 || fail "less than 512 MB available RAM"
space="$(df -Pk /opt | awk 'NR==2 {print $4}')"
test "${space:-0}" -ge 2097152 || fail "less than 2 GB free disk"

git -C "$repo" fetch --no-tags origin main
git -C "$repo" cat-file -e "$sha^{commit}" || fail "reviewed SHA not fetched"
git -C "$repo" merge-base --is-ancestor "$sha" origin/main || fail "reviewed SHA not on main"
mkdir -p "$root"
release="$root/$sha"
mkdir -p "$release"
compose="$release/deploy/hetzner/compose.green.yml"
created=0
cleanup_failure(){
  code=$?
  trap - ERR
  if [ "$created" -eq 1 ]; then
    echo "MISSING_AI_GREEN_FAILED_CONTAINER_LOGS_LAST_30" >&2
    docker logs --tail 30 missing-ai-green-api >&2 || true
    docker compose -f "$compose" down --remove-orphans >/dev/null 2>&1 || true
  fi
  echo "MISSING_AI_GREEN_DEPLOY_FAILED=$code" >&2
  # Keep release files for forensics, even on failure.
  exit "$code"
}
trap cleanup_failure ERR
git -C "$repo" archive --format=tar "$sha" | tar -xf - -C "$release"
docker compose -f "$compose" config --quiet
echo "GREEN_BUILD_AND_START_BEGIN"
created=1
docker compose -f "$compose" up -d --build api

healthy=0
for n in $(seq 1 45); do
  status="$(docker inspect missing-ai-green-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || echo absent)"
  if test "$status" = healthy && curl -fsS --max-time 5 http://127.0.0.1:3102/health 2>/dev/null | grep -q '"ok":true'; then
    healthy=1
    break
  fi
  sleep 2
done
test "$healthy" -eq 1 || { echo "GREEN_HEALTH_FAILED_LAST_STATE=$status" >&2; false; }
echo "GREEN_HEALTH_PASS"

curl -fsS --max-time 12 -H 'content-type: application/json' -d '{"source_text":"- Must verify signed webhooks","ai_output":"Created a homepage."}' http://127.0.0.1:3102/api/check | grep -q '"needs_review":1'
curl -fsS --max-time 12 -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"green-smoke","version":"1"}}}' http://127.0.0.1:3102/mcp | grep -q '"name":"missing-ai"'
curl -fsS --max-time 12 -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' http://127.0.0.1:3102/mcp | grep -q '"name":"check_missing"'
code="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -d '{"url":"https://127.0.0.1/"}' http://127.0.0.1:3102/api/fetch)"
test "$code" = 400 || { echo "GREEN_SSRF_REFUSAL_FAILED_HTTP=$code" >&2; false; }
echo "GREEN_API_AND_MCP_PASS"

test "$(git -C "$repo" rev-parse HEAD)" = "$old"
test "$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy
curl -fsS --max-time 8 http://127.0.0.1:3101/health >/dev/null
orchestryn_health
trap - ERR
echo "MISSING_AI_GREEN_DEPLOYED"
echo "GREEN_SHA=$sha"
echo "GREEN_URL_LOCAL=http://127.0.0.1:3102"
echo "BLUE_SHA=$old"
echo "BLUE_HEALTH=PASS"
echo "ORCHESTRYN_POST_DEPLOY_HEALTH=PASS"
echo "CADDY_DNS_UNCHANGED"

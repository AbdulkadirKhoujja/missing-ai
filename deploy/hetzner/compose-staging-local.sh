#!/usr/bin/env bash
# Execute a reviewed commit with the actual Docker Compose production configuration,
# in an isolated STAGING project/loopback port. Never alter the production project.
set -Eeuo pipefail
umask 077

target="${1:-}"
repo=/opt/missing-ai
baseline=92af431428f7035467b088165c96797500a7939b
port=3102
project=missing-ai-staging
name="missing-ai-staging-${target:0:12}"
tag="missing-ai-api:staging-${target:0:12}"
deny(){ echo "MISSING_AI_COMPOSE_STAGING_REFUSED: $*" >&2; exit 78; }
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || deny "supply exact reviewed commit SHA"
test "${EUID}" -eq 0 || deny "run as root"
for c in git docker curl tar mktemp sed ss; do command -v "$c" >/dev/null || deny "missing $c"; done
test -d "$repo/.git" || deny "Missing AI checkout not found"
test "$(git -C "$repo" rev-parse HEAD)" = "$baseline" || deny "production Git checkout changed"
test -z "$(git -C "$repo" status --porcelain --untracked-files=no)" || deny "production tracked checkout dirty"
test "$(git -C "$repo" remote get-url origin)" = "https://github.com/AbdulkadirKhoujja/missing-ai.git" || deny "unexpected origin"
test "$(docker inspect missing-ai-api --format '{{index .Config.Labels "com.docker.compose.project"}}')" = missing-ai || deny "unexpected production identity"
test "$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy || deny "production not healthy"
curl -fsS --max-time 8 http://127.0.0.1:3101/health >/dev/null || deny "production API unavailable"
curl -fsS --max-time 8 http://127.0.0.1:3000/health >/dev/null || deny "Orchestryn unavailable"
for service in control-plane chatgpt-lead claude-supervisor runtime-bridge; do
  mapfile -t ids < <(docker ps -q --filter "label=com.docker.compose.service=$service")
  test "${#ids[@]}" -eq 1 || deny "Orchestryn service count unexpected: $service"
  test "$(docker inspect "${ids[0]}" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy || deny "Orchestryn service unhealthy: $service"
done
if ss -H -ltn | awk -v port="$port" '$4 ~ (":" port "$") {found=1} END{exit !found}'; then deny "staging loopback port occupied"; fi
docker container inspect "$name" >/dev/null 2>&1 && deny "existing staging container" || true
docker image inspect "$tag" >/dev/null 2>&1 && deny "existing staging image tag" || true
docker network inspect "${project}_missing_ai" >/dev/null 2>&1 && deny "existing staging network" || true
echo "COMPOSE_STAGING_PRODUCTION_HEALTH_PRE_PASS"

git -C "$repo" fetch --no-tags origin main
git -C "$repo" cat-file -e "$target^{commit}" || deny "SHA is not fetched"
git -C "$repo" merge-base --is-ancestor "$target" origin/main || deny "SHA is not on origin/main"
tmp="$(mktemp -d)"
compose="$tmp/deploy/hetzner/compose.staging.yml"
cleanup() {
  local code=$?
  trap - EXIT
  set +e
  if [ "$code" -ne 0 ]; then
    echo "COMPOSE_STAGING_FAILURE_EXIT=$code" >&2
    echo "COMPOSE_STAGING_CONTAINER_LOGS_LAST_45" >&2
    docker logs --tail 45 "$name" >&2 || true
    echo "COMPOSE_STAGING_CONTAINER_STATE" >&2
    docker inspect "$name" --format '{{json .State}}' >&2 || true
  fi
  if test -f "$compose"; then
    docker compose -p "$project" -f "$compose" down --remove-orphans --volumes >/dev/null 2>&1 || true
  fi
  docker image rm "$tag" >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
  exit "$code"
}
trap cleanup EXIT

git -C "$repo" archive --format=tar "$target" | tar -xf - -C "$tmp"
cp "$tmp/deploy/hetzner/compose.missing-ai.yml" "$compose"
# Change only project name, service image/container, loopback port and restart.
sed -i \
  -e 's/^name: missing-ai$/name: missing-ai-staging/' \
  -e "s/image: missing-ai-api:local/image: missing-ai-api:staging-${target:0:12}/" \
  -e "s/container_name: missing-ai-api/container_name: $name/" \
  -e 's/127.0.0.1:3101:3101/127.0.0.1:3102:3101/' \
  -e 's/restart: unless-stopped/restart: "no"/' \
  "$compose"

docker compose -p "$project" -f "$compose" config --quiet
docker compose -p "$project" -f "$compose" up -d --build api
echo "COMPOSE_STAGING_CONTAINER_STARTED"

ready=0
for attempt in $(seq 1 45); do
  state="$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || echo absent)"
  if [ "$state" = healthy ] && curl -fsS --max-time 5 "http://127.0.0.1:$port/health" 2>/dev/null | grep -q '"ok":true'; then
    ready=1
    break
  fi
  sleep 2
done
test "$ready" = 1 || { echo "COMPOSE_STAGING_NOT_HEALTHY" >&2; exit 1; }
echo "COMPOSE_STAGING_HEALTH_PASS"

curl -fsS --max-time 12 -H 'content-type: application/json' \
  -d '{"source_text":"- Must verify signed webhooks","ai_output":"Created a homepage."}' \
  "http://127.0.0.1:$port/api/check" | grep -q '"needs_review":1'
echo "COMPOSE_STAGING_API_CHECK_PASS"

curl -fsS --max-time 12 -H 'content-type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"staging","version":"0.1"}}}' \
  "http://127.0.0.1:$port/mcp" | grep -q '"name":"missing-ai"'
curl -fsS --max-time 12 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  "http://127.0.0.1:$port/mcp" | grep -q '"name":"check_missing"'
echo "COMPOSE_STAGING_MCP_PASS"

status="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
  -d '{"url":"https://127.0.0.1/"}' "http://127.0.0.1:$port/api/fetch")"
test "$status" = 400 || { echo "STAGING_PRIVATE_IP_REFUSAL_FAILED_HTTP_$status" >&2; exit 1; }
echo "COMPOSE_STAGING_SSRF_REFUSAL_PASS"

# Prove the test itself did not mutate the old project or supervisor.
test "$(git -C "$repo" rev-parse HEAD)" = "$baseline"
test "$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy
curl -fsS --max-time 8 http://127.0.0.1:3101/health >/dev/null
curl -fsS --max-time 8 http://127.0.0.1:3000/health >/dev/null
echo "COMPOSE_STAGING_PRODUCTION_UNCHANGED_PASS"
echo "COMPOSE_STAGING_ALL_PASS"

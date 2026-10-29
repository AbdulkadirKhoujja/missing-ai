#!/usr/bin/env bash
# Upgrade only the Missing AI sidecar already running on this host.
# Two immutable SHA arguments; previous image retained for rollback.
set -Eeuo pipefail
umask 077
old="${1:-}"
target="${2:-}"
repo=/opt/missing-ai
compose="$repo/deploy/hetzner/compose.missing-ai.yml"
[[ "$old" =~ ^[0-9a-f]{40}$ && "$target" =~ ^[0-9a-f]{40}$ ]] ||
  { echo "Usage: bash upgrade-local.sh <currently deployed SHA> <new reviewed SHA>" >&2; exit 78; }
test "${EUID}" -eq 0 || { echo "Root required." >&2; exit 78; }
test -d "$repo/.git" || exit 78
test "$(git -C "$repo" remote get-url origin)" = "https://github.com/AbdulkadirKhoujja/missing-ai.git" || exit 78
test -z "$(git -C "$repo" status --porcelain --untracked-files=no)" || exit 78
test "$(git -C "$repo" rev-parse HEAD)" = "$old" || { echo "Expected old commit mismatch; refuse upgrade." >&2; exit 78; }
test "$(docker inspect missing-ai-api --format '{{index .Config.Labels "com.docker.compose.project"}}')" = missing-ai ||
  { echo "Refuse to replace an unrecognised container." >&2; exit 78; }
test "$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy ||
  { echo "Current Missing AI container not healthy." >&2; exit 78; }
orchestryn_health() {
  curl --fail --silent --show-error --max-time 8 http://127.0.0.1:3000/health >/dev/null
  for service in control-plane chatgpt-lead claude-supervisor runtime-bridge; do
    mapfile -t ids < <(docker ps -q --filter "label=com.docker.compose.service=$service")
    test "${#ids[@]}" -eq 1 || { echo "Orchestryn service count unexpected: $service" >&2; return 1; }
    test "$(docker inspect "${ids[0]}" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy ||
      { echo "Orchestryn service unhealthy: $service" >&2; return 1; }
  done
}
orchestryn_health
git -C "$repo" fetch origin main --no-tags
git -C "$repo" cat-file -e "$target^{commit}" || { echo "Target SHA unavailable." >&2; exit 78; }
rollback_image="missing-ai-api:rollback-${old:0:12}"
docker image tag missing-ai-api:local "$rollback_image"
rollback() {
  code=$?
  trap - ERR
  echo "MISSING_AI_UPGRADE_ROLLBACK_BEGIN" >&2
  git -C "$repo" checkout --detach "$old" >/dev/null || true
  docker image tag "$rollback_image" missing-ai-api:local || true
  docker compose -f "$compose" up -d --no-deps --no-build --force-recreate api || true
  curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3101/health >/dev/null ||
    echo "MISSING_AI_MANUAL_RECOVERY_REQUIRED" >&2
  exit "$code"
}
trap rollback ERR
git -C "$repo" checkout --detach "$target"
docker compose -f "$compose" config --quiet
docker compose -f "$compose" build api
docker compose -f "$compose" up -d --no-deps --no-build --force-recreate api
healthy=0
for attempt in $(seq 1 30); do
  state="$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || true)"
  if test "$state" = healthy; then healthy=1; break; fi
  sleep 2
done
test "$healthy" = 1
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3101/health | grep -q '"ok":true'
orchestryn_health
trap - ERR
echo "MISSING_AI_LOCAL_UPGRADE_PASS"
echo "OLD_SHA=$old"
echo "NEW_SHA=$target"
echo "MISSING_AI_HEALTH=PASS"
echo "ORCHESTRYN_POST_UPGRADE_HEALTH=PASS"
echo "ROLLBACK_IMAGE=$rollback_image"

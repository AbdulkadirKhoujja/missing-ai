#!/usr/bin/env bash
# Upgrade only the existing Missing AI sidecar. No Orchestryn service mutations.
# Uses two exact SHAs and keeps the previously deployed Docker image for rollback.
set -Eeuo pipefail
umask 077

old="${1:-}"
target="${2:-}"
repo=/opt/missing-ai
compose="$repo/deploy/hetzner/compose.missing-ai.yml"

die() { echo "MISSING_AI_UPGRADE_REFUSED: $*" >&2; exit 78; }

[[ "$old" =~ ^[0-9a-f]{40}$ && "$target" =~ ^[0-9a-f]{40}$ ]] ||
  die "usage: upgrade-local.sh <running SHA> <reviewed target SHA>"
test "${EUID}" -eq 0 || die "root required"
test "$old" != "$target" || die "old and target SHA must differ"
test -d "$repo/.git" || die "Missing AI checkout absent"
test "$(git -C "$repo" remote get-url origin)" = "https://github.com/AbdulkadirKhoujja/missing-ai.git" ||
  die "Unexpected Git origin"
test -z "$(git -C "$repo" status --porcelain --untracked-files=no)" ||
  die "Tracked worktree is not clean"
test "$(git -C "$repo" rev-parse HEAD)" = "$old" ||
  die "Expected currently deployed commit does not match"
test "$(docker inspect missing-ai-api --format '{{index .Config.Labels "com.docker.compose.project"}}')" = missing-ai ||
  die "Unexpected running service identity"
test "$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy ||
  die "Existing Missing AI service is not healthy"

orchestryn_health() {
  curl --fail --silent --show-error --max-time 8 http://127.0.0.1:3000/health >/dev/null || return 1
  for service in control-plane chatgpt-lead claude-supervisor runtime-bridge; do
    mapfile -t ids < <(docker ps -q --filter "label=com.docker.compose.service=$service")
    test "${#ids[@]}" -eq 1 || { echo "ORCHESTRYN_SERVICE_COUNT_UNEXPECTED=$service" >&2; return 1; }
    test "$(docker inspect "${ids[0]}" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy ||
      { echo "ORCHESTRYN_SERVICE_UNHEALTHY=$service" >&2; return 1; }
  done
}

# Docker may report 'started' well before the Node process binds or the Docker
# health check reaches a healthy state. Do NOT probe only once after recreate.
wait_api() {
  local state="" attempt
  for attempt in $(seq 1 45); do
    state="$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || echo absent)"
    if [ "$state" = healthy ] &&
       curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3101/health 2>/dev/null |
           grep -q '"ok":true'; then
      return 0
    fi
    sleep 2
  done
  echo "MISSING_AI_API_READINESS_FAILED_LAST_STATE=$state" >&2
  docker logs --tail 35 missing-ai-api >&2 || true
  return 1
}

orchestryn_health || die "Upwork supervisor services are not healthy before upgrade"
git -C "$repo" fetch --no-tags origin main
git -C "$repo" cat-file -e "$target^{commit}" || die "Target SHA not available"

rollback_image="missing-ai-api:rollback-${old:0:12}"
docker image tag missing-ai-api:local "$rollback_image"
changed=0

rollback() {
  code=$?
  trap - ERR
  set +e
  echo "MISSING_AI_UPGRADE_FAILED_EXIT=$code" >&2
  if [ "$changed" = 1 ]; then
    echo "MISSING_AI_FAILED_CONTAINER_LOGS_LAST_35" >&2
    docker logs --tail 35 missing-ai-api >&2 || true
  fi

  restored_files=1
  git -C "$repo" checkout --detach "$old" >/dev/null || restored_files=0
  docker image tag "$rollback_image" missing-ai-api:local || restored_files=0

  if [ "$changed" = 1 ] && [ "$restored_files" = 1 ]; then
    echo "MISSING_AI_UPGRADE_ROLLBACK_BEGIN" >&2
    if docker compose -f "$compose" up -d --no-deps --no-build --force-recreate api &&
       wait_api &&
       orchestryn_health; then
      echo "MISSING_AI_PREVIOUS_VERSION_RESTORED_AND_HEALTHY" >&2
    else
      echo "MISSING_AI_MANUAL_RECOVERY_REQUIRED" >&2
    fi
  elif [ "$restored_files" = 1 ]; then
    echo "MISSING_AI_PRE_DEPLOY_FAILURE_EXISTING_CONTAINER_UNCHANGED" >&2
  else
    echo "MISSING_AI_MANUAL_RECOVERY_REQUIRED" >&2
  fi
  exit "$code"
}

trap rollback ERR
git -C "$repo" checkout --detach "$target"
docker compose -f "$compose" config --quiet
docker compose -f "$compose" build api
changed=1
docker compose -f "$compose" up -d --no-deps --no-build --force-recreate api
wait_api
orchestryn_health
trap - ERR

echo "MISSING_AI_LOCAL_UPGRADE_PASS"
echo "OLD_SHA=$old"
echo "NEW_SHA=$target"
echo "MISSING_AI_HEALTH=PASS"
echo "ORCHESTRYN_POST_UPGRADE_HEALTH=PASS"
echo "ROLLBACK_IMAGE=$rollback_image"

#!/usr/bin/env bash
# ==============================================================================
# Docker Test Runner for ai_workflow.js
# ==============================================================================
# Builds a temporary Docker image with the project source and runs the Jest
# test suite inside an isolated container.  The container is removed
# automatically after the run.
#
# Usage:
#   bash scripts/run-tests-docker.sh [--e2e] [-- <extra jest args>]
#
# Flags:
#   --e2e          Run e2e / integration tests using jest.integration.config.json
#                  instead of the default jest.config.json
#
# Extra Jest args (after --):
#   --coverage     Collect coverage and mount it to ./coverage/ on the host
#   --testPathPattern=<pattern>
#   --verbose
#
# Examples:
#   bash scripts/run-tests-docker.sh
#   bash scripts/run-tests-docker.sh -- --coverage
#   bash scripts/run-tests-docker.sh -- --testPathPattern=config
#   bash scripts/run-tests-docker.sh --e2e
#   bash scripts/run-tests-docker.sh --e2e -- --verbose
#
# To extract the coverage report to the host, pass --coverage:
#   bash scripts/run-tests-docker.sh -- --coverage
#   # then open: coverage/lcov-report/index.html
#
# Requirements:
#   docker  (Desktop or Engine, daemon must be running)
# ==============================================================================

set -euo pipefail


# ── Colors ────────────────────────────────────────────────────────────────────
# shellcheck source=scripts/colors.sh
source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

info()    { echo -e "${BLUE}ℹ  $*${NC}"; }
success() { echo -e "${GREEN}✓  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $*${NC}"; }
error()   { echo -e "${RED}✗  $*${NC}" >&2; }

# ── Resolve project root ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# ── Parse flags ───────────────────────────────────────────────────────────────
RUN_E2E=false
EXTRA_JEST_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --e2e)
      RUN_E2E=true
      shift
      ;;
    --)
      shift
      EXTRA_JEST_ARGS=("$@")
      break
      ;;
    *)
      error "Unknown argument: $1"
      echo "Usage: bash scripts/run-tests-docker.sh [--e2e] [-- <extra jest args>]"
      exit 1
      ;;
  esac
done

# ── Config ────────────────────────────────────────────────────────────────────
IMAGE_NAME="ai-workflow-test"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"

# Determine the Jest config to use
if [[ "${RUN_E2E}" == "true" ]]; then
  JEST_ARGS=(--runInBand --config jest.integration.config.json)
  SUITE_LABEL="E2E / Integration Tests"
else
  JEST_ARGS=(--runInBand)
  SUITE_LABEL="Full Test Suite"
fi

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ai_workflow.js  ·  Docker Test Run      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""
info "Project root : ${PROJECT_ROOT}"
info "Version      : ${PACKAGE_VERSION}"
info "Node image   : node:20-alpine (Dockerfile.test)"
info "Suite        : ${SUITE_LABEL}"
[[ ${#EXTRA_JEST_ARGS[@]} -gt 0 ]] && info "Extra args   : ${EXTRA_JEST_ARGS[*]}"
echo ""

# ── Pre-flight: docker daemon ─────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  error "docker not found in PATH — please install Docker and try again."
  exit 1
fi

if ! docker info &>/dev/null; then
  error "Docker daemon is not running — please start it and try again."
  exit 1
fi

# ── 1. Build Docker image from Dockerfile.test ───────────────────────────────
info "Step 1/3 — Building Docker image (${IMAGE_NAME}) …"

docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t "${IMAGE_NAME}" \
  -f Dockerfile.test \
  "${PROJECT_ROOT}"

success "Image built: ${IMAGE_NAME}"
echo ""

# ── 2. Run tests inside a disposable container ────────────────────────────────
info "Step 2/3 — Running tests inside Docker container …"
echo ""

# Always run with --runInBand inside Docker.
# This project uses ESM (node --experimental-vm-modules) with forceExit:true.
# When Jest parallel workers shut down, one worker's VM context may be torn down
# while another worker's dynamic imports are still queued, producing:
#   ReferenceError: Cannot access 'X' before initialization (after environment torn down)
# Running serially in a single process eliminates that race entirely.
if [[ ${#EXTRA_JEST_ARGS[@]} -gt 0 ]]; then
  JEST_ARGS+=("${EXTRA_JEST_ARGS[@]}")
fi
CONTAINER_CMD=(npm test -- "${JEST_ARGS[@]}")

# If --coverage was requested, mount the host coverage/ directory so the report
# is available after the container exits.
DOCKER_VOLUME_ARGS=()
for arg in "${EXTRA_JEST_ARGS[@]}"; do
  if [[ "${arg}" == "--coverage" ]]; then
    mkdir -p "${PROJECT_ROOT}/coverage"
    DOCKER_VOLUME_ARGS=(-v "${PROJECT_ROOT}/coverage:/app/coverage")
    break
  fi
done

set +e   # allow non-zero exit so we can report cleanly
docker run \
  --rm \
  --name "${IMAGE_NAME}-run" \
  -e CI=true \
  "${DOCKER_VOLUME_ARGS[@]}" \
  "${IMAGE_NAME}" \
  "${CONTAINER_CMD[@]}"
TEST_EXIT_CODE=$?
set -e

echo ""

# ── 3. Report result ──────────────────────────────────────────────────────────
info "Step 3/3 — Done."
echo ""

if [[ ${TEST_EXIT_CODE} -eq 0 ]]; then
  success "All tests passed inside Docker 🎉"
else
  error "Tests failed (exit code ${TEST_EXIT_CODE})"
fi

echo ""
exit "${TEST_EXIT_CODE}"

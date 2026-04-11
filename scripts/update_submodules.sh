#!/usr/bin/env bash
#
# Repository-local wrapper for scripts/update_submodules.sh.template
#
# Forces PROJECT_ROOT_OVERRIDE to this repository root so the shared template can
# run directly during local maintenance. This repo frequently has tracked
# `.ai_workflow/` updates, so the local wrapper also opts into
# `--allow-dirty-parent` by default.

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PROJECT_ROOT_OVERRIDE="$(cd "${SCRIPT_DIR}/.." && pwd)"

exec bash "${SCRIPT_DIR}/update_submodules.sh.template" --allow-dirty-parent "$@"

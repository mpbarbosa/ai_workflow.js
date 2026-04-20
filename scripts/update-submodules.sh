#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly DEFAULT_BRANCH='main'
readonly COPILOT_TRAILER='Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'

TARGET_BRANCH="$DEFAULT_BRANCH"
UNPUSHED_ACTION=''

print_info() {
  printf 'INFO: %s\n' "$1"
}

print_warn() {
  printf 'WARN: %s\n' "$1" >&2
}

print_error() {
  printf 'ERROR: %s\n' "$1" >&2
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --branch NAME                 Branch to checkout and pull inside each submodule.
                                Defaults to ${DEFAULT_BRANCH}.
  --on-unpushed ACTION          What to do if a submodule has local commits not on
                                origin/\$branch. One of: push, continue, abort.
  -h, --help                    Show this help.
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --branch)
        TARGET_BRANCH="$2"
        shift 2
        ;;
      --on-unpushed)
        UNPUSHED_ACTION="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        print_error "Unknown option: $1"
        usage
        exit 1
        ;;
    esac
  done
}

validate_args() {
  if [[ ! "$TARGET_BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]]; then
    print_error "Invalid branch name: $TARGET_BRANCH"
    exit 1
  fi

  if [[ -n "$UNPUSHED_ACTION" && ! "$UNPUSHED_ACTION" =~ ^(push|continue|abort)$ ]]; then
    print_error "Invalid --on-unpushed action: $UNPUSHED_ACTION"
    exit 1
  fi
}

require_repo() {
  if ! git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    print_error "Not a git repository: $REPO_ROOT"
    exit 1
  fi

  if [[ ! -f "$REPO_ROOT/.gitmodules" ]]; then
    print_error "No .gitmodules file found in $REPO_ROOT"
    exit 1
  fi
}

load_top_level_submodules() {
  mapfile -t TOP_LEVEL_SUBMODULES < <(
    git -C "$REPO_ROOT" config -f "$REPO_ROOT/.gitmodules" --get-regexp '^submodule\..*\.path$' |
      awk '{print $2}'
  )

  if [[ ${#TOP_LEVEL_SUBMODULES[@]} -eq 0 ]]; then
    print_error "No submodules are configured in .gitmodules"
    exit 1
  fi
}

sync_submodule_urls() {
  print_info 'Step 1/6: syncing submodule URLs'
  git -C "$REPO_ROOT" submodule sync --recursive
}

collect_unpushed_commits() {
  local path=''
  local log_output=''

  UNPUSHED_PATHS=()
  declare -gA UNPUSHED_LOGS=()

  for path in "${TOP_LEVEL_SUBMODULES[@]}"; do
    if ! git -C "$REPO_ROOT/$path" rev-parse --git-dir >/dev/null 2>&1; then
      continue
    fi

    log_output="$(git -C "$REPO_ROOT/$path" --no-pager log "origin/${TARGET_BRANCH}..HEAD" --oneline 2>/dev/null || true)"
    if [[ -n "$log_output" ]]; then
      UNPUSHED_PATHS+=("$path")
      UNPUSHED_LOGS["$path"]="$log_output"
    fi
  done
}

prompt_for_unpushed_action() {
  local choice=''

  if [[ -n "$UNPUSHED_ACTION" ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    print_error "Unpushed local submodule commits were found. Re-run with --on-unpushed push|continue|abort."
    exit 1
  fi

  cat <<EOF
Choose how to proceed:
  1. Push first, then continue
  2. Skip push and continue anyway
  3. Abort
EOF

  while true; do
    read -r -p 'Selection [1/2/3]: ' choice
    case "$choice" in
      1)
        UNPUSHED_ACTION='push'
        return
        ;;
      2)
        UNPUSHED_ACTION='continue'
        return
        ;;
      3)
        UNPUSHED_ACTION='abort'
        return
        ;;
      *)
        print_warn 'Please choose 1, 2, or 3.'
        ;;
    esac
  done
}

handle_unpushed_commits() {
  local path=''

  print_info 'Step 2/6: checking for unpushed local submodule commits'
  collect_unpushed_commits

  if [[ ${#UNPUSHED_PATHS[@]} -eq 0 ]]; then
    print_info 'No unpushed local submodule commits found'
    return
  fi

  print_warn 'Found local submodule commits that are ahead of the remote and would be orphaned by update --init'
  for path in "${UNPUSHED_PATHS[@]}"; do
    printf '\n[%s]\n%s\n' "$path" "${UNPUSHED_LOGS[$path]}"
  done
  printf '\n'

  prompt_for_unpushed_action

  case "$UNPUSHED_ACTION" in
    push)
      for path in "${UNPUSHED_PATHS[@]}"; do
        print_info "Pushing ${path} to origin/${TARGET_BRANCH}"
        git -C "$REPO_ROOT/$path" push origin "$TARGET_BRANCH"
      done
      ;;
    continue)
      print_warn 'Continuing without pushing. Any unpushed local commits may become orphaned.'
      ;;
    abort)
      print_warn 'Aborting without changing submodules.'
      exit 1
      ;;
  esac
}

initialize_and_update_submodules() {
  print_info 'Step 3/6: initializing and updating submodule checkouts'
  git -C "$REPO_ROOT" submodule update --init --recursive
}

load_recursive_submodules() {
  mapfile -t RECURSIVE_SUBMODULES < <(
    git -C "$REPO_ROOT" submodule status --recursive |
      awk '{print $2}'
  )
}

pull_latest_submodule_commits() {
  local path=''

  print_info "Step 4/6: checking out ${TARGET_BRANCH} and pulling latest remote commits"
  load_recursive_submodules

  for path in "${RECURSIVE_SUBMODULES[@]}"; do
    git -C "$REPO_ROOT/$path" checkout "$TARGET_BRANCH"
    git -C "$REPO_ROOT/$path" pull origin "$TARGET_BRANCH"
  done
}

show_final_status() {
  print_info 'Step 5/6: final submodule status'
  FINAL_STATUS="$(git -C "$REPO_ROOT" submodule status --recursive)"
  printf '%s\n' "$FINAL_STATUS"
}

find_advanced_top_level_submodules() {
  local path=''
  local line=''

  ADVANCED_TOP_LEVEL_SUBMODULES=()

  for path in "${TOP_LEVEL_SUBMODULES[@]}"; do
    line="$(printf '%s\n' "$FINAL_STATUS" | awk -v submodule_path="$path" '$2 == submodule_path { print; exit }')"
    if [[ "${line:0:1}" == '+' ]]; then
      ADVANCED_TOP_LEVEL_SUBMODULES+=("$path")
    fi
  done
}

build_commit_body() {
  local path=''
  local sha=''
  local subject=''

  if [[ ${#ADVANCED_TOP_LEVEL_SUBMODULES[@]} -eq 1 ]]; then
    path="${ADVANCED_TOP_LEVEL_SUBMODULES[0]}"
    subject="$(git -C "$REPO_ROOT/$path" log -1 --pretty=%s HEAD)"
    printf 'Points to %s' "$subject"
    return
  fi

  for path in "${ADVANCED_TOP_LEVEL_SUBMODULES[@]}"; do
    sha="$(git -C "$REPO_ROOT/$path" rev-parse --short HEAD)"
    subject="$(git -C "$REPO_ROOT/$path" log -1 --pretty=%s HEAD)"
    printf -- '- %s -> %s: %s\n' "$path" "$sha" "$subject"
  done
}

build_commit_title() {
  local path=''
  local sha=''

  if [[ ${#ADVANCED_TOP_LEVEL_SUBMODULES[@]} -eq 1 ]]; then
    path="${ADVANCED_TOP_LEVEL_SUBMODULES[0]}"
    sha="$(git -C "$REPO_ROOT/$path" rev-parse --short HEAD)"
    printf 'chore: update %s submodule to %s' "$path" "$sha"
    return
  fi

  printf 'chore: update submodules'
}

path_is_selected_submodule() {
  local candidate="$1"
  local path=''

  for path in "${ADVANCED_TOP_LEVEL_SUBMODULES[@]}"; do
    if [[ "$candidate" == "$path" ]]; then
      return 0
    fi
  done

  return 1
}

ensure_no_unrelated_staged_changes() {
  local path=''

  mapfile -t STAGED_PATHS < <(git -C "$REPO_ROOT" diff --cached --name-only)

  for path in "${STAGED_PATHS[@]}"; do
    if ! path_is_selected_submodule "$path"; then
      print_error "Refusing to create a commit with unrelated staged changes: $path"
      print_error 'Commit or unstage those changes first, then re-run this script.'
      exit 1
    fi
  done
}

commit_updated_pointers() {
  local commit_title=''
  local commit_body=''

  print_info 'Step 6/6: committing updated submodule pointers when needed'
  find_advanced_top_level_submodules

  if [[ ${#ADVANCED_TOP_LEVEL_SUBMODULES[@]} -eq 0 ]]; then
    print_info 'Parent repository already records the current submodule commits'
    return
  fi

  git -C "$REPO_ROOT" add -- "${ADVANCED_TOP_LEVEL_SUBMODULES[@]}"
  ensure_no_unrelated_staged_changes

  if git -C "$REPO_ROOT" diff --cached --quiet -- "${ADVANCED_TOP_LEVEL_SUBMODULES[@]}"; then
    print_info 'No staged submodule pointer changes detected after git add'
    return
  fi

  commit_title="$(build_commit_title)"
  commit_body="$(build_commit_body)"

  git -C "$REPO_ROOT" commit -m "$commit_title" -m "$commit_body" -m "$COPILOT_TRAILER"
}

main() {
  parse_args "$@"
  validate_args
  require_repo
  load_top_level_submodules
  sync_submodule_urls
  handle_unpushed_commits
  initialize_and_update_submodules
  pull_latest_submodule_commits
  show_final_status
  commit_updated_pointers
}

main "$@"

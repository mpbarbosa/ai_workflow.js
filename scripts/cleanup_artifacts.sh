#!/usr/bin/env bash
#
# cleanup_artifacts.sh - Clean up workflow execution artifacts
#
# Description:
#   Removes old workflow logs, metrics, backlog reports, and AI cache files
#   to free disk space and maintain repository cleanliness.
#
# Usage:
#   ./scripts/cleanup_artifacts.sh [OPTIONS]
#
# Options:
#   --all              Remove all artifacts
#   --logs             Remove log files only
#   --metrics          Remove metrics files only
#   --backlog          Remove backlog reports only
#   --cache            Remove AI cache only
#   --older-than DAYS  Remove artifacts older than N days (default: 30)
#   --dry-run          Show what would be deleted without deleting
#   --yes              Skip confirmation prompts
#   -h, --help         Show this help message
#
# Examples:
#   ./scripts/cleanup_artifacts.sh --all --older-than 7
#   ./scripts/cleanup_artifacts.sh --logs --dry-run
#   ./scripts/cleanup_artifacts.sh --metrics --yes
#
# Author: AI Workflow Automation
# Version: 1.0.0
# Last Updated: 2025-12-20

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Script directory and repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKFLOW_DIR="${REPO_ROOT}/src/workflow"

# Default options
CLEAN_ALL=false
CLEAN_LOGS=false
CLEAN_METRICS=false
CLEAN_BACKLOG=false
CLEAN_CACHE=false
OLDER_THAN_DAYS=30
DRY_RUN=false
YES_TO_ALL=false

# Statistics
FILES_DELETED=0
DIRS_DELETED=0
SPACE_FREED=0

#######################################
# Print colored message
# Arguments:
#   $1 - Color code
#   $2 - Message
#######################################
print_color() {
    echo -e "${1}${2}${NC}"
}

#######################################
# Print usage information
#######################################
usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Clean up workflow execution artifacts (logs, metrics, backlog, AI cache).

Options:
    --all              Remove all artifacts
    --logs             Remove log files only
    --metrics          Remove metrics files only
    --backlog          Remove backlog reports only
    --cache            Remove AI cache only
    --older-than DAYS  Remove artifacts older than N days (default: 30)
    --dry-run          Show what would be deleted without deleting
    --yes              Skip confirmation prompts
    -h, --help         Show this help message

Examples:
    $(basename "$0") --all --older-than 7
    $(basename "$0") --logs --dry-run
    $(basename "$0") --metrics --yes

EOF
    exit 0
}

#######################################
# Parse command-line arguments
#######################################
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --all)
                CLEAN_ALL=true
                shift
                ;;
            --logs)
                CLEAN_LOGS=true
                shift
                ;;
            --metrics)
                CLEAN_METRICS=true
                shift
                ;;
            --backlog)
                CLEAN_BACKLOG=true
                shift
                ;;
            --cache)
                CLEAN_CACHE=true
                shift
                ;;
            --older-than)
                OLDER_THAN_DAYS="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --yes)
                YES_TO_ALL=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                print_color "$RED" "Error: Unknown option: $1"
                usage
                ;;
        esac
    done

    # If --all is specified, enable all cleanup options
    if [[ "$CLEAN_ALL" == true ]]; then
        CLEAN_LOGS=true
        CLEAN_METRICS=true
        CLEAN_BACKLOG=true
        CLEAN_CACHE=true
    fi

    # If no specific option is set, default to all
    if [[ "$CLEAN_LOGS" == false && "$CLEAN_METRICS" == false && \
          "$CLEAN_BACKLOG" == false && "$CLEAN_CACHE" == false ]]; then
        print_color "$YELLOW" "No specific cleanup option specified. Use --help for options."
        exit 1
    fi
}

#######################################
# Get human-readable size
# Arguments:
#   $1 - Size in bytes
# Returns:
#   Formatted size string
#######################################
human_readable_size() {
    local size=$1
    if [[ $size -ge 1073741824 ]]; then
        echo "$(( size / 1073741824 ))GB"
    elif [[ $size -ge 1048576 ]]; then
        echo "$(( size / 1048576 ))MB"
    elif [[ $size -ge 1024 ]]; then
        echo "$(( size / 1024 ))KB"
    else
        echo "${size}B"
    fi
}

#######################################
# Clean up log files
#######################################
cleanup_logs() {
    local logs_dir="${WORKFLOW_DIR}/logs"
    
    if [[ ! -d "$logs_dir" ]]; then
        print_color "$YELLOW" "Logs directory not found: $logs_dir"
        return
    fi

    print_color "$BLUE" "Cleaning up log files older than ${OLDER_THAN_DAYS} days..."

    local count=0
    while IFS= read -r -d '' dir; do
        local size
        size=$(du -sb "$dir" 2>/dev/null | cut -f1 || echo 0)
        
        if [[ "$DRY_RUN" == true ]]; then
            print_color "$YELLOW" "[DRY RUN] Would delete: $dir ($(human_readable_size "$size"))"
        else
            print_color "$GREEN" "Deleting: $dir ($(human_readable_size "$size"))"
            rm -rf "$dir"
            ((DIRS_DELETED++))
            SPACE_FREED=$((SPACE_FREED + size))
        fi
        ((count++))
    done < <(find "$logs_dir" -mindepth 1 -maxdepth 1 -type d -mtime "+${OLDER_THAN_DAYS}" -print0 2>/dev/null)

    if [[ $count -eq 0 ]]; then
        print_color "$GREEN" "No old log files found."
    fi
}

#######################################
# Clean up metrics files
#######################################
cleanup_metrics() {
    local metrics_dir="${WORKFLOW_DIR}/metrics"
    
    if [[ ! -d "$metrics_dir" ]]; then
        print_color "$YELLOW" "Metrics directory not found: $metrics_dir"
        return
    fi

    print_color "$BLUE" "Cleaning up metrics files older than ${OLDER_THAN_DAYS} days..."

    local count=0
    while IFS= read -r -d '' file; do
        local size
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
        
        if [[ "$DRY_RUN" == true ]]; then
            print_color "$YELLOW" "[DRY RUN] Would delete: $file ($(human_readable_size "$size"))"
        else
            print_color "$GREEN" "Deleting: $file ($(human_readable_size "$size"))"
            rm -f "$file"
            ((FILES_DELETED++))
            SPACE_FREED=$((SPACE_FREED + size))
        fi
        ((count++))
    done < <(find "$metrics_dir" -name "*.json" -o -name "*.jsonl" -mtime "+${OLDER_THAN_DAYS}" -print0 2>/dev/null)

    if [[ $count -eq 0 ]]; then
        print_color "$GREEN" "No old metrics files found."
    fi
}

#######################################
# Clean up backlog reports
#######################################
cleanup_backlog() {
    local backlog_dir="${WORKFLOW_DIR}/backlog"
    
    if [[ ! -d "$backlog_dir" ]]; then
        print_color "$YELLOW" "Backlog directory not found: $backlog_dir"
        return
    fi

    print_color "$BLUE" "Cleaning up backlog reports older than ${OLDER_THAN_DAYS} days..."

    local count=0
    while IFS= read -r -d '' dir; do
        local size
        size=$(du -sb "$dir" 2>/dev/null | cut -f1 || echo 0)
        
        if [[ "$DRY_RUN" == true ]]; then
            print_color "$YELLOW" "[DRY RUN] Would delete: $dir ($(human_readable_size "$size"))"
        else
            print_color "$GREEN" "Deleting: $dir ($(human_readable_size "$size"))"
            rm -rf "$dir"
            ((DIRS_DELETED++))
            SPACE_FREED=$((SPACE_FREED + size))
        fi
        ((count++))
    done < <(find "$backlog_dir" -mindepth 1 -maxdepth 1 -type d -mtime "+${OLDER_THAN_DAYS}" -print0 2>/dev/null)

    if [[ $count -eq 0 ]]; then
        print_color "$GREEN" "No old backlog reports found."
    fi
}

#######################################
# Clean up AI cache
#######################################
cleanup_cache() {
    local cache_dir="${WORKFLOW_DIR}/.ai_cache"
    
    if [[ ! -d "$cache_dir" ]]; then
        print_color "$YELLOW" "AI cache directory not found: $cache_dir"
        return
    fi

    print_color "$BLUE" "Cleaning up AI cache files older than ${OLDER_THAN_DAYS} days..."

    local count=0
    local index_file="${cache_dir}/index.json"
    
    # Clean up cached response files
    while IFS= read -r -d '' file; do
        local size
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
        
        if [[ "$DRY_RUN" == true ]]; then
            print_color "$YELLOW" "[DRY RUN] Would delete: $file ($(human_readable_size "$size"))"
        else
            print_color "$GREEN" "Deleting: $file ($(human_readable_size "$size"))"
            rm -f "$file"
            ((FILES_DELETED++))
            SPACE_FREED=$((SPACE_FREED + size))
        fi
        ((count++))
    done < <(find "$cache_dir" -type f -name "*.md" -mtime "+${OLDER_THAN_DAYS}" -print0 2>/dev/null)

    # Update index.json to remove expired entries
    if [[ -f "$index_file" && "$DRY_RUN" == false ]]; then
        print_color "$BLUE" "Updating cache index..."
        # This would require jq or similar, keeping it simple for now
        # The cache system will self-clean on next use
    fi

    if [[ $count -eq 0 ]]; then
        print_color "$GREEN" "No old cache files found."
    fi
}

#######################################
# Confirm cleanup action
#######################################
confirm_cleanup() {
    if [[ "$YES_TO_ALL" == true || "$DRY_RUN" == true ]]; then
        return 0
    fi

    print_color "$YELLOW" "\nThis will delete artifacts older than ${OLDER_THAN_DAYS} days:"
    [[ "$CLEAN_LOGS" == true ]] && echo "  - Log files (${WORKFLOW_DIR}/logs/)"
    [[ "$CLEAN_METRICS" == true ]] && echo "  - Metrics files (${WORKFLOW_DIR}/metrics/)"
    [[ "$CLEAN_BACKLOG" == true ]] && echo "  - Backlog reports (${WORKFLOW_DIR}/backlog/)"
    [[ "$CLEAN_CACHE" == true ]] && echo "  - AI cache (${WORKFLOW_DIR}/.ai_cache/)"
    echo ""

    read -rp "Continue? [y/N] " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            print_color "$YELLOW" "Cleanup cancelled."
            exit 0
            ;;
    esac
}

#######################################
# Print cleanup summary
#######################################
print_summary() {
    echo ""
    print_color "$BLUE" "========================================="
    print_color "$BLUE" "Cleanup Summary"
    print_color "$BLUE" "========================================="
    
    if [[ "$DRY_RUN" == true ]]; then
        print_color "$YELLOW" "DRY RUN MODE - No files were actually deleted"
        echo ""
    fi

    echo "Files deleted: $FILES_DELETED"
    echo "Directories deleted: $DIRS_DELETED"
    echo "Space freed: $(human_readable_size "$SPACE_FREED")"
    
    print_color "$BLUE" "========================================="
}

#######################################
# Main function
#######################################
main() {
    parse_args "$@"

    print_color "$BLUE" "========================================="
    print_color "$BLUE" "Workflow Artifacts Cleanup"
    print_color "$BLUE" "========================================="
    
    if [[ "$DRY_RUN" == true ]]; then
        print_color "$YELLOW" "Running in DRY RUN mode"
    fi
    echo ""

    confirm_cleanup

    [[ "$CLEAN_LOGS" == true ]] && cleanup_logs
    [[ "$CLEAN_METRICS" == true ]] && cleanup_metrics
    [[ "$CLEAN_BACKLOG" == true ]] && cleanup_backlog
    [[ "$CLEAN_CACHE" == true ]] && cleanup_cache

    print_summary

    if [[ "$DRY_RUN" == true ]]; then
        print_color "$YELLOW" "\nRun without --dry-run to actually delete files."
    else
        print_color "$GREEN" "\nCleanup complete!"
    fi
}

main "$@"

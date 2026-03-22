# Cleanup Artifacts Guide

**Version:** 1.8.0
**Last Updated:** 2026-02-08
**Script:** `scripts/cleanup_artifacts.sh`

## Overview

The `cleanup_artifacts.sh` script provides a safe and efficient way to clean up workflow execution artifacts, freeing disk space while maintaining repository cleanliness. It removes old logs, metrics, backlog reports, and AI cache files based on configurable retention policies.

**Key Features:**

- 🗑️ Selective cleanup by artifact type (logs, metrics, backlog, cache)
- 📅 Age-based filtering (remove artifacts older than N days)
- 🔍 Dry-run mode for safe preview before deletion
- 📊 Detailed statistics (files deleted, space freed)
- ⚠️ Safety confirmations with `--yes` override
- 🎨 Colored output for better readability

## Quick Start

**Basic Usage (Interactive):**

```bash
# Clean all artifacts older than 30 days (default)
./scripts/cleanup_artifacts.sh --all

# Preview what would be deleted without actually deleting
./scripts/cleanup_artifacts.sh --all --dry-run

# Clean specific artifact types
./scripts/cleanup_artifacts.sh --logs --metrics
```

**Common Scenarios:**

```bash
# Remove logs older than 7 days (keep recent)
./scripts/cleanup_artifacts.sh --logs --older-than 7

# Clean all artifacts older than 14 days without prompts
./scripts/cleanup_artifacts.sh --all --older-than 14 --yes

# Remove only AI cache to free up space quickly
./scripts/cleanup_artifacts.sh --cache --yes
```

## Command Reference

### Syntax

```bash
./scripts/cleanup_artifacts.sh [OPTIONS]
```

### Options

| Option              | Description                                 | Default |
| ------------------- | ------------------------------------------- | ------- |
| `--all`             | Remove all artifact types                   | -       |
| `--logs`            | Remove log files only                       | -       |
| `--metrics`         | Remove metrics files only                   | -       |
| `--backlog`         | Remove backlog reports only                 | -       |
| `--cache`           | Remove AI cache only                        | -       |
| `--older-than DAYS` | Remove artifacts older than N days          | 30      |
| `--dry-run`         | Show what would be deleted without deleting | false   |
| `--yes`             | Skip confirmation prompts                   | false   |
| `-h, --help`        | Show help message                           | -       |

**Note:** If no specific option is specified, the script will exit with an error. Use `--all` or specify individual artifact types.

## Artifact Types

### 1. Log Files (`--logs`)

**Location:** `src/workflow/logs/`

**Description:** Workflow execution logs containing step-by-step execution details, errors, and debug information.

**Typical Size:** 1-50 MB per workflow run

**Retention Policy:**

- **Development:** Keep 7-14 days
- **Production:** Keep 30-90 days

**Example:**

```bash
# Clean logs older than 14 days
./scripts/cleanup_artifacts.sh --logs --older-than 14
```

### 2. Metrics Files (`--metrics`)

**Location:** `src/workflow/metrics/`

**Description:** Performance metrics, execution times, resource usage, and statistics from workflow runs.

**Typical Size:** 10-100 KB per workflow run

**Retention Policy:**

- **Development:** Keep 14-30 days
- **Production:** Keep 60-180 days (for trend analysis)

**Example:**

```bash
# Clean metrics older than 30 days
./scripts/cleanup_artifacts.sh --metrics --older-than 30
```

### 3. Backlog Reports (`--backlog`)

**Location:** `src/workflow/backlog/`

**Description:** Summary reports of workflow execution, including task completion status, errors, and recommendations.

**Typical Size:** 5-20 KB per workflow run

**Retention Policy:**

- **Development:** Keep 7-14 days
- **Production:** Keep 30-60 days

**Example:**

```bash
# Clean backlog reports older than 21 days
./scripts/cleanup_artifacts.sh --backlog --older-than 21
```

### 4. AI Cache (`--cache`)

**Location:** `src/workflow/cache/`

**Description:** Cached AI responses and prompt results to reduce API calls and improve performance.

**Typical Size:** 100 KB - 10 MB (can grow large over time)

**Retention Policy:**

- **Development:** Keep 7 days (cache invalidates frequently)
- **Production:** Keep 14-30 days

**Example:**

```bash
# Clean AI cache older than 7 days
./scripts/cleanup_artifacts.sh --cache --older-than 7
```

## Usage Examples

### Development Workflow

**Daily Development:**

```bash
# Quick cleanup of recent artifacts during active development
./scripts/cleanup_artifacts.sh --logs --older-than 3 --yes
```

**Weekly Cleanup:**

```bash
# More aggressive cleanup to free space
./scripts/cleanup_artifacts.sh --all --older-than 7 --yes
```

**Before Major Changes:**

```bash
# Clean slate before starting new feature work
./scripts/cleanup_artifacts.sh --all --older-than 1 --dry-run
# Review output, then run without --dry-run if acceptable
./scripts/cleanup_artifacts.sh --all --older-than 1 --yes
```

### Production Workflow

**Monthly Maintenance:**

```bash
# Conservative cleanup preserving historical data
./scripts/cleanup_artifacts.sh --all --older-than 90 --yes
```

**Disk Space Emergency:**

```bash
# Aggressive cleanup to free space immediately
./scripts/cleanup_artifacts.sh --cache --logs --older-than 14 --yes
```

**Pre-Release Cleanup:**

```bash
# Remove development artifacts before release
./scripts/cleanup_artifacts.sh --all --older-than 30 --dry-run
# Review, then execute
./scripts/cleanup_artifacts.sh --all --older-than 30 --yes
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Cleanup Artifacts

on:
  schedule:
    - cron: '0 2 * * 0' # Weekly at 2 AM on Sunday
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Cleanup old artifacts
        run: |
          ./scripts/cleanup_artifacts.sh --all --older-than 30 --yes

      - name: Report cleanup results
        run: |
          echo "Cleanup completed successfully"
```

**GitLab CI Example:**

```yaml
cleanup_artifacts:
  stage: maintenance
  script:
    - ./scripts/cleanup_artifacts.sh --all --older-than 30 --yes
  rules:
    - if: '$CI_PIPELINE_SOURCE == "schedule"'
  only:
    - schedules
```

## Safety Features

### 1. Dry-Run Mode

Always use `--dry-run` first to preview what will be deleted:

```bash
./scripts/cleanup_artifacts.sh --all --older-than 7 --dry-run
```

**Output:**

```
[DRY RUN] Would delete: src/workflow/logs/2026-01-01-workflow.log (2.3 MB)
[DRY RUN] Would delete: src/workflow/metrics/2026-01-01-metrics.json (145 KB)
...
[DRY RUN] Total: 25 files, 15.7 MB would be freed
```

### 2. Confirmation Prompts

Without `--yes`, the script asks for confirmation:

```bash
./scripts/cleanup_artifacts.sh --all --older-than 7
```

**Output:**

```
Found 25 files to delete (15.7 MB total).
Are you sure you want to proceed? [y/N]:
```

### 3. Detailed Logging

The script provides real-time feedback:

```bash
./scripts/cleanup_artifacts.sh --logs --older-than 14
```

**Output:**

```
Cleaning up log files older than 14 days...
✓ Deleted: src/workflow/logs/2026-01-15-workflow.log (2.3 MB)
✓ Deleted: src/workflow/logs/2026-01-16-workflow.log (1.8 MB)
...
Summary: 18 files deleted, 12.4 MB freed
```

## Troubleshooting

### Issue: "Permission denied"

**Symptom:**

```
Error: Permission denied when deleting src/workflow/logs/workflow.log
```

**Solution:**

```bash
# Ensure script is executable
chmod +x scripts/cleanup_artifacts.sh

# Check file ownership
ls -la src/workflow/logs/

# Run with elevated permissions if needed (use cautiously)
sudo ./scripts/cleanup_artifacts.sh --logs --older-than 7
```

### Issue: "Directory not found"

**Symptom:**

```
Logs directory not found: src/workflow/logs
```

**Solution:**
The directory doesn't exist yet (workflow hasn't run). This is normal and safe to ignore.

**Alternative:** Create directory structure manually:

```bash
mkdir -p src/workflow/{logs,metrics,backlog,cache}
```

### Issue: No files deleted despite old artifacts

**Symptom:**

```
Cleaning up log files older than 30 days...
Summary: 0 files deleted, 0 B freed
```

**Solution:**
Check if files are actually older than the threshold:

```bash
# List files with modification dates
find src/workflow/logs -type f -mtime +30 -ls
```

If files exist but aren't deleted:

```bash
# Check find compatibility (some systems need different syntax)
find src/workflow/logs -type f -mtime +30 -print
```

### Issue: Script exits with "No specific cleanup option specified"

**Symptom:**

```
No specific cleanup option specified. Use --help for options.
```

**Solution:**
You must specify at least one cleanup option:

```bash
# Wrong (no options)
./scripts/cleanup_artifacts.sh

# Correct (with option)
./scripts/cleanup_artifacts.sh --all
```

### Issue: Disk space not freed as expected

**Symptom:**
Script reports space freed, but `df -h` shows no change.

**Solution:**
This can happen if:

1. **Open file handles:** Processes still have deleted files open
   ```bash
   # Check for open deleted files
   lsof +L1 | grep workflow
   ```
2. **Filesystem lag:** Some filesystems delay space reclamation
   ```bash
   # Force filesystem sync
   sync
   ```

## Best Practices

### 1. Regular Cleanup Schedule

**Recommended Schedule:**

- **Daily:** Clean cache older than 3 days (during active development)
- **Weekly:** Clean logs and metrics older than 14 days
- **Monthly:** Clean all artifacts older than 90 days

**Cron Example:**

```bash
# Add to crontab (crontab -e)
# Daily cache cleanup at 3 AM
0 3 * * * cd /path/to/ai_workflow.js && ./scripts/cleanup_artifacts.sh --cache --older-than 3 --yes

# Weekly full cleanup at 2 AM on Sunday
0 2 * * 0 cd /path/to/ai_workflow.js && ./scripts/cleanup_artifacts.sh --all --older-than 14 --yes
```

### 2. Retention Policy Guidelines

**Development Environment:**

- Logs: 7-14 days
- Metrics: 14-30 days
- Backlog: 7-14 days
- Cache: 3-7 days

**Production Environment:**

- Logs: 30-90 days (compliance requirements may vary)
- Metrics: 60-180 days (for trend analysis)
- Backlog: 30-60 days
- Cache: 14-30 days

**Archival Before Cleanup:**
If you need long-term retention:

```bash
# Archive before cleanup
tar -czf workflow-artifacts-$(date +%Y-%m-%d).tar.gz src/workflow/
mv workflow-artifacts-*.tar.gz /archive/location/

# Then cleanup
./scripts/cleanup_artifacts.sh --all --older-than 30 --yes
```

### 3. Monitor Disk Usage

**Before Cleanup:**

```bash
# Check current disk usage
du -sh src/workflow/*
```

**After Cleanup:**

```bash
# Verify space freed
du -sh src/workflow/*
df -h
```

### 4. Test in Dry-Run First

Always test with `--dry-run` before production cleanup:

```bash
# Test cleanup policy
./scripts/cleanup_artifacts.sh --all --older-than 30 --dry-run > cleanup-preview.txt

# Review preview
less cleanup-preview.txt

# Execute if acceptable
./scripts/cleanup_artifacts.sh --all --older-than 30 --yes
```

## Integration with Other Tools

### Package.json Scripts

Add convenience commands to `package.json`:

```json
{
  "scripts": {
    "clean": "scripts/cleanup_artifacts.sh --all --older-than 30 --yes",
    "clean:logs": "scripts/cleanup_artifacts.sh --logs --older-than 7 --yes",
    "clean:cache": "scripts/cleanup_artifacts.sh --cache --older-than 3 --yes",
    "clean:preview": "scripts/cleanup_artifacts.sh --all --older-than 30 --dry-run"
  }
}
```

**Usage:**

```bash
npm run clean          # Full cleanup
npm run clean:logs     # Logs only
npm run clean:cache    # Cache only
npm run clean:preview  # Preview mode
```

### Pre-commit Hook

Automatically clean old artifacts before commits:

```bash
# .git/hooks/pre-commit
#!/usr/bin/env bash
./scripts/cleanup_artifacts.sh --cache --older-than 7 --yes > /dev/null 2>&1
```

### Makefile Integration

```makefile
.PHONY: clean clean-logs clean-cache clean-all

clean-logs:
	./scripts/cleanup_artifacts.sh --logs --older-than 7 --yes

clean-cache:
	./scripts/cleanup_artifacts.sh --cache --older-than 3 --yes

clean-all:
	./scripts/cleanup_artifacts.sh --all --older-than 30 --yes

clean: clean-cache clean-logs
```

## Related Documentation

- [Developer Guide](DEVELOPER_GUIDE.md) - Development workflow and tools
- [Validation Scripts](VALIDATION_SCRIPTS.md) - Other utility scripts
- [Testing Guide](TESTING_GUIDE.md) - Test artifact management
- [Project Structure](../architecture/MODULE_STRUCTURE.md) - Workflow directory layout

## FAQ

**Q: What happens if I accidentally delete important artifacts?**
A: Artifacts are execution logs, not source code. They can be regenerated by re-running workflows. If you need historical data, archive artifacts before cleanup.

**Q: Can I recover deleted artifacts?**
A: No, deletion is permanent. Always use `--dry-run` first and consider archiving critical artifacts.

**Q: How much disk space should I expect to free?**
A: Depends on workflow frequency and retention:

- Light usage: 10-50 MB per month
- Moderate usage: 100-500 MB per month
- Heavy usage: 1-5 GB per month

**Q: Does cleanup affect running workflows?**
A: No, the script only targets old artifacts (default: 30+ days). Running workflows write new files that won't be affected.

**Q: Can I customize the artifact directories?**
A: Yes, edit the script's directory paths:

```bash
# Edit scripts/cleanup_artifacts.sh
WORKFLOW_DIR="${REPO_ROOT}/.ai_workflow"  # Custom location
```

**Q: Is cleanup safe for CI/CD environments?**
A: Yes, but use conservative retention policies (e.g., `--older-than 60`) to preserve debugging data for failed builds.

---

**Document Version:** 1.0.0
**Script Version:** 1.0.0
**Last Updated:** 2026-02-08
**Author:** AI Workflow Automation Team

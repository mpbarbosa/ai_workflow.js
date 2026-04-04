## CLI_USAGE_GUIDE

# AI Workflow CLI Usage Guide

## Quick Reference

### Run Workflow on Any Project

```bash
# From within project directory
cd /path/to/project
ai-workflow run

# From anywhere, specifying project path
ai-workflow run --project-root /path/to/project

# With custom workflow directory
ai-workflow run --project-root /path/to/project --workflow-dir .custom_workflow
```

## Command Syntax

### Run Command

```bash
ai-workflow run [options]
```

**Options:**

- `--stage <stage>` - Workflow stage: `quick`, `medium`, or `full` (default: `full`)
- `--auto` - Run in automatic mode without prompts (default: `false`)
- `--dry-run` - Preview execution without making changes (default: `false`)
- `--project-root <path>` - Project root directory (default: current directory)
- `--workflow-dir <path>` - Workflow artifacts directory (default: `.ai_workflow`)

**Global Options:**

- `-v, --verbose` - Enable verbose logging
- `-q, --quiet` - Suppress non-essential output
- `--no-color` - Disable colored output
- `--config <path>` - Path to configuration file (default: `.workflow-config.yaml`)

## Workflow Stages

### Quick Stage (5 steps, ~30 seconds)

Fast validation for quick checks:

- Pre-Analysis (project detection)
- Documentation validation
- Consistency checks
- Configuration validation
- Directory structure

```bash
ai-workflow run --stage quick
```

### Medium Stage (13 steps, ~2-5 minutes)

Includes testing and quality checks:

- Everything from Quick stage
- Documentation optimization
- Script reference validation
- Test review and generation
- Test execution
- Code quality analysis
- Markdown linting

```bash
ai-workflow run --stage medium
```

### Full Stage (20 steps, ~5-15 minutes)

Complete workflow with all features:

- Everything from Medium stage
- Bootstrap documentation
- Dependency analysis
- Context management
- Git finalization
- Prompt engineering
- UX/accessibility analysis
- Version updates
- Workflow summary

```bash
ai-workflow run --stage full
```

## Common Use Cases

### 1. Quick Validation Before Commit

```bash
cd /path/to/project
ai-workflow run --stage quick --auto
```

### 2. Full Validation in CI/CD

```bash
ai-workflow run --project-root /workspace/project --stage full --auto --quiet
```

### 3. Test Changes Without Execution

```bash
ai-workflow run --dry-run --stage medium
```

### 4. Run on Multiple Projects

```bash
# Project 1
ai-workflow run --project-root ~/projects/api --stage quick

# Project 2
ai-workflow run --project-root ~/projects/frontend --stage quick

# Project 3
ai-workflow run --project-root ~/projects/backend --stage full
```

### 5. Custom Workflow Directory

```bash
# Use custom artifact directory
ai-workflow run --workflow-dir .custom_ai_workflow
```

## Other Commands

### Initialize New Project

```bash
# Interactive setup
ai-workflow init --interactive

# With project details
ai-workflow init --project-root /path/to/project --name "My Project" --description "My project description"

# From template
ai-workflow init --template nodejs_api --name "API Project"

# Force overwrite existing config
ai-workflow init --interactive --force
```

### Resume from Checkpoint

```bash
# List available checkpoints
ai-workflow resume --list

# Resume latest
ai-workflow resume --latest --project-root /path/to/project

# Resume specific checkpoint
ai-workflow resume workflow_1771291699863-1771291699864
```

### Check Status

```bash
ai-workflow status --workflow-dir /path/to/project/.ai_workflow
```

### Manage Configuration

```bash
# Show configuration
ai-workflow config show

# Validate configuration
ai-workflow config validate

# Get specific value
ai-workflow config get primary_language

# Set value
ai-workflow config set primary_language javascript
```

### Clean Workflow Artifacts

```bash
# Clean all artifacts
ai-workflow clean --all

# Clean specific types
ai-workflow clean --artifacts
ai-workflow clean --cache
ai-workflow clean --checkpoints

# Clean old files (older than N days)
ai-workflow

---

## CLI_ENHANCEMENT_SUMMARY

# CLI Enhancement - Add --project-root and --workflow-dir Options

**Date:** 2026-02-17
**Status:** ✅ Complete
**Impact:** Major usability improvement

## Summary

Added `--project-root` and `--workflow-dir` options to the `run` command, enabling workflow execution on any project from any location.

## Changes Made

### 1. CLI Command Enhancement

**File:** `src/cli/index.js`

**Added Options:**

```javascript
.option('--project-root <path>', 'Project root directory')
.option('--workflow-dir <path>', 'Workflow directory', '.ai_workflow')
```

**Impact:**

- Users can now run workflows on any project without navigating to its directory
- Custom workflow artifact directories are supported
- Enables batch processing of multiple projects
- Facilitates CI/CD integration

### 2. Usage Examples

**Before (current directory only):**

```bash
cd /path/to/project
ai-workflow run --stage quick
```

**After (from anywhere):**

```bash
# Run on any project
ai-workflow run --project-root /path/to/project --stage quick

# Custom workflow directory
ai-workflow run --project-root /path/to/project --workflow-dir .custom_workflow

# Batch process multiple projects
for project in ~/projects/*/; do
  ai-workflow run --project-root "$project" --stage quick --auto
done
```

### 3. Tests Added

**File:** `test/cli/commands/run.test.js`

**New Tests (5):**

1. ✅ should handle custom project root path
2. ✅ should handle custom workflow directory
3. ✅ should handle both custom project root and workflow dir
4. ✅ should handle relative project root paths
5. ✅ should handle absolute workflow directory paths

**Test Results:**

```
Tests: 15 passed, 15 total (was 10 total)
All tests passing
```

### 4. Documentation Created

**File:** `docs/CLI_USAGE_GUIDE.md`

**Contents:**

- Complete CLI reference
- All command options documented
- Common use cases with examples
- CI/CD integration patterns
- Batch processing examples
- Troubleshooting guide
- Best practices

## Verification

### Help Text

```bash
$ ai-workflow run --help
Usage: ai-workflow run [options]

Run the AI workflow

Options:
  --stage <stage>        Workflow stage (quick, medium, full) (default: "full")
  --auto                 Run in automatic mode without prompts (default: false)
  --dry-run              Preview execution without running (default: false)
  --project-root <path>  Project root directory
  --workflow-dir <path>  Workflow directory (default: ".ai_workflow")
  -h, --help             display help for command
```

### Functional Test

```bash
# From /tmp, run workflow on ai_workflow.js project
$ cd /tmp
$ ai-workflow run --project-root /home/mpb/Documents/GitHub/ai_workflow.js --stage quick --dry-run

✓ Health checks passed
✓ Registered 20 workflow steps
✓ Workflow loaded: AI Workflow Automation v2.0.0
```

## Use Cases Enabled

### 1. CI/CD Integration

```bash
ai-workflow run \
  --project-root $CI_PROJECT_DIR \
  --stage full \
  --auto \
  --quiet
```

### 2. Batch Processing

```bash
for project in ~/projects/*/; do
  ai-workflow run --project-root "$project" --stage quick --auto
done
```

### 3. Pre-commit Hooks

```bash
#!/bin/bash
ai-workflow run --project-root $(git rev-parse --show-toplevel) --stage quick --auto
```

### 4. Multi-Project Validation

```bash
ai-workflow run --project-root ~/api --stage quick
ai-workflow run --project-root ~/frontend --stage quick
ai-workflow run --project-root ~/backend --stage full
```

### 5. Custom Artifact Directories

```bash
# Separate artifacts by environment
ai-workflow run --workflow-dir .ai_workflow_dev
ai-workflow run --workflow-dir .ai_workflow_staging
```

## Benefits

1. **Flexibility**: Run workflows from anywhere on any project
2. **Automation**: Enable scripting and batch processing
3. **CI/CD**: Seamless integration with build pipelines
4. **Organization**: Custom artifact directory per environment
5. **Usability**: No need to navigate to project directory

## Breaking Changes

None. The changes are backward compatible:


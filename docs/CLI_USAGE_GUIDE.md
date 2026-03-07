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
ai-workflow clean --older-than-days 7

# Keep only last N checkpoints
ai-workflow clean --checkpoints --keep-last 3

# Preview without deleting
ai-workflow clean --all --dry-run
```

## Examples by Scenario

### Scenario 1: Daily Development Workflow
```bash
# Morning: Check what changed
ai-workflow status

# Before commit: Quick validation
ai-workflow run --stage quick --auto

# Before push: Full validation
ai-workflow run --stage full
```

### Scenario 2: CI/CD Pipeline
```bash
#!/bin/bash
# In your CI/CD script

# Run workflow
ai-workflow run \
  --project-root $CI_PROJECT_DIR \
  --stage full \
  --auto \
  --quiet

# Check exit code
if [ $? -eq 0 ]; then
  echo "Workflow passed"
else
  echo "Workflow failed"
  exit 1
fi
```

### Scenario 3: Batch Processing Multiple Projects
```bash
#!/bin/bash
# Process all projects in a directory

for project in ~/projects/*/; do
  echo "Processing: $project"
  ai-workflow run \
    --project-root "$project" \
    --stage quick \
    --auto \
    || echo "Failed: $project"
done
```

### Scenario 4: Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run quick validation before commit
ai-workflow run --stage quick --auto --quiet

# Prevent commit if workflow fails
exit $?
```

## Environment Variables

```bash
# Override default config location
export AI_WORKFLOW_CONFIG=/path/to/config.yaml

# Set log level
export AI_WORKFLOW_LOG_LEVEL=debug

# Disable colors
export NO_COLOR=1

# Run with environment
AI_WORKFLOW_CONFIG=custom.yaml ai-workflow run
```

## Exit Codes

- `0` - Workflow completed successfully
- `1` - Workflow failed (errors during execution)
- `2` - Invalid command or options
- `3` - Configuration error

## Output and Artifacts

### Workflow Directory Structure
```
.ai_workflow/
├── backlog/              # Execution reports
│   └── workflow_*.json
├── summaries/            # AI summaries
│   └── workflow_*/
├── logs/                 # Execution logs
│   └── workflow_*.log
├── metrics/              # Performance data
│   └── metrics_*.json
├── checkpoints/          # Resume points
│   └── checkpoint_*.json
└── prompts/              # AI prompts (debugging)
    └── prompt_*.txt
```

### Generated Files
```
.workflow-config.yaml     # Project configuration
.ai_workflow/             # Workflow artifacts
```

## Tips and Best Practices

1. **Start with Quick Stage**: Use `--stage quick` for fast iterations
2. **Use Auto Mode in CI/CD**: Add `--auto` to prevent interactive prompts
3. **Dry Run First**: Test with `--dry-run` before actual execution
4. **Specify Project Root**: Use `--project-root` for clarity in scripts
5. **Resume from Checkpoints**: Long workflows can be resumed if interrupted
6. **Clean Regularly**: Use `ai-workflow clean` to manage artifact size
7. **Check Status**: Run `ai-workflow status` to see recent activity

## Troubleshooting

### Workflow Fails to Start
```bash
# Check configuration
ai-workflow config validate

# Check with verbose logging
ai-workflow run --verbose

# Try with dry-run
ai-workflow run --dry-run
```

### "No configuration found"
```bash
# Initialize configuration
ai-workflow init --project-root /path/to/project
```

### Permission Issues
```bash
# Check workflow directory permissions
ls -la .ai_workflow

# Create directory if missing
mkdir -p .ai_workflow
```

### Resume Not Working
```bash
# List available checkpoints
ai-workflow resume --list

# Check checkpoint file
cat .ai_workflow/checkpoints/checkpoint_*.json
```

## Related Documentation

- [Installation Guide](./getting-started/INSTALLATION.md)
- [Configuration Guide](./guides/CONFIGURATION_GUIDE.md)
- [API Reference](./api/README.md)
- [Developer Guide](./guides/DEVELOPER_GUIDE.md)

---

**Last Updated:** 2026-02-20
**Version:** 1.5.4
**For:** ai_workflow.js v1.5.4+

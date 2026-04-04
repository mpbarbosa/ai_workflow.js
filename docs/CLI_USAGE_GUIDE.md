## CLI_USAGE_GUIDE

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

# Clean old files (older than

---

## CLI_QUICK_REFERENCE

## CLI_QUICK_REFERENCE

# CLI Quick Reference

Quick command reference for ai-workflow CLI.

---

## Commands

### Run Workflow

```bash
ai-workflow run [--stage quick|medium|full] [--auto] [--dry-run]
```

### Resume from Checkpoint

```bash
ai-workflow resume [--list|--latest] [checkpointId]
```

### View Status

```bash
ai-workflow status
```

### Initialize Project

```bash
ai-workflow init [--interactive] [--template <name>] [--force]
```

### Manage Configuration

```bash
ai-workflow config show|validate|get|set [args...]
```

### Clean Artifacts

```bash
ai-workflow clean [--artifacts|--cache|--checkpoints|--all] [--dry-run]
```

---

## Common Patterns

### Quick Start

```bash
ai-workflow init --interactive
ai-workflow run --stage quick
ai-workflow status
```

### Development Workflow

```bash
# During development
ai-workflow run --stage quick --auto

# Before push
ai-workflow run --stage medium

# Weekly check
ai-workflow run
```

### Resume After Error

```bash
ai-workflow resume --list
ai-workflow resume --latest
```

### Configuration Management

```bash
ai-workflow config show
ai-workflow config get project.name
ai-workflow config set project.name "NewName"
ai-workflow config validate
```

### Cleanup

```bash
# Preview
ai-workflow clean --all --dry-run

# Execute
ai-workflow clean --artifacts --cache

# Keep recent checkpoints
ai-workflow clean --checkpoints --keep-last 5
```

---

## Global Options

```bash
-v, --verbose        # Verbose output
-q, --quiet          # Quiet mode
--no-color          # Disable colors
--config <path>     # Custom config file
-h, --help          # Show help
-V, --version       # Show version
```

---

## Templates

Available project templates for `init`:

- `nodejs_api` - Node.js API/Backend
- `react_spa` - React SPA
- `python_app` - Python Application
- `shell_script_automation` - Shell Scripts
- `static_website` - Static Site
- `client_spa` - Vanilla JS SPA
- `configuration_library` - Config Library
- `generic` - Generic Project

---

## Workflow Stages

| Stage  | Steps | Duration  | Use Case          |
| ------ | ----- | --------- | ----------------- |
| quick  | 3     | 1-2 min   | Fast validation   |
| medium | 6     | 5-10 min  | Standard checks   |
| full   | 10    | 15-30 min | Complete workflow |

---

## Exit Codes

- `0` - Success
- `1` - Error or failure

---

## Environment Variables

- `AI_WORKFLOW_CONFIG` - Config file path
- `AI_WORKFLOW_DIR` - Workflow directory
- `NO_COLOR` - Disable colors

---

## Help

```bash
ai-workflow --help           # General help
ai-workflow <command> --help # Command help
```

---

**See Also**: [CLI Usage Guide](CLI_USAGE_GUIDE.md)


---

## CLI_QUICK_REFERENCE

# CLI Quick Reference

Quick command reference for ai-workflow CLI.

---

## Commands

### Run Workflow

```bash
ai-workflow run [--stage quick|medium|full] [--auto] [--dry-run]
```

### Resume from Checkpoint

```bash
ai-workflow resume [--list|--latest] [checkpointId]
```

### View Status

```bash
ai-workflow status
```

### Initialize Project

```bash
ai-workflow init [--interactive] [--template <name>] [--force]
```

### Manage Configuration

```bash
ai-workflow config show|validate|get|set [args...]
```

### Clean Artifacts

```bash
ai-workflow clean [--artifacts|--cache|--checkpoints|--all] [--dry-run]
```

---

## Common Patterns

### Quick Start

```bash
ai-workflow init --interactive
ai-workflow run --stage quick
ai-workflow status
```

### Development Workflow

```bash
# During development
ai-workflow run --stage quick --auto

# Before push
ai-workflow run --stage medium

# Weekly check
ai-workflow run
```

### Resume After Error

```bash
ai-workflow resume --list
ai-workflow resume --latest
```

### Configuration Management

```bash
ai-workflow config show
ai-workflow config get project.name
ai-workflow config set project.name "NewName"
ai-workflow config validate
```

### Cleanup

```bash
# Preview
ai-workflow clean --all --dry-run

# Execute
ai-workflow clean --art

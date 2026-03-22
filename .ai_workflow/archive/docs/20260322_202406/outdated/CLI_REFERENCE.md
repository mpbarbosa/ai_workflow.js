# CLI Reference

**AI Workflow Automation v1.7.3**
**Last Updated:** 2026-02-01
**Audience:** End Users, Developers

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Global Options](#global-options)
- [Commands](#commands)
- [Environment Variables](#environment-variables)
- [Configuration Files](#configuration-files)
- [Exit Codes](#exit-codes)

---

## Overview

AI Workflow Automation provides a command-line interface for executing automated workflows.

### Basic Syntax

```bash
ai-workflow [options] <command> [command-options]
```

---

## Installation

### Local Installation

```bash
# Install dependencies
npm install

# Run from project directory
node src/cli/index.js [command]
```

### Global Installation

```bash
# Install globally (future)
npm install -g ai-workflow

# Run from anywhere
ai-workflow [command]
```

---

## Global Options

Options that apply to all commands.

### `--help, -h`

Display help information.

```bash
# Show general help
ai-workflow --help

# Show command-specific help
ai-workflow run --help
```

### `--version, -v`

Display version information.

```bash
ai-workflow --version
# Output: 1.0.0
```

### `--verbose`

Enable verbose output (debug mode).

```bash
ai-workflow --verbose run workflow.yaml
```

### `--quiet, -q`

Suppress non-error output.

```bash
ai-workflow --quiet run workflow.yaml
```

### `--config, -c`

Specify configuration file path.

```bash
ai-workflow --config=./custom-config.yaml run
```

### `--no-color`

Disable colored output.

```bash
ai-workflow --no-color run workflow.yaml
```

---

## Commands

### `init`

Initialize a new workflow project.

**Syntax:**

```bash
ai-workflow init [options] [project-name]
```

**Options:**

- `--template <name>` - Use template (nodejs, python, react, shell)
- `--force` - Overwrite existing files

**Examples:**

```bash
# Interactive initialization
ai-workflow init

# Initialize with project name
ai-workflow init my-project

# Use template
ai-workflow init --template=nodejs my-api
```

**Output:**

```
✅ Created .workflow-config.yaml
✅ Created .ai_workflow/ directory
✅ Initialized Git submodule .workflow_core/
🎉 Project initialized successfully!
```

---

### `run`

Execute a workflow.

**Syntax:**

```bash
ai-workflow run [options] [workflow-file]
```

**Options:**

- `--step <number>` - Run specific step only
- `--from <number>` - Start from step N
- `--to <number>` - Stop at step N
- `--auto` - Run in automatic mode (no prompts)
- `--dry-run` - Preview without executing
- `--resume <session-id>` - Resume previous session

**Examples:**

```bash
# Run default workflow
ai-workflow run

# Run specific workflow file
ai-workflow run workflows/analysis.yaml

# Run specific step
ai-workflow run --step=3

# Run steps 2-5
ai-workflow run --from=2 --to=5

# Auto mode (no prompts)
ai-workflow run --auto

# Dry run (preview only)
ai-workflow run --dry-run

# Resume session
ai-workflow run --resume=20260101_120000
```

**Output:**

```
🚀 Starting workflow execution...
📋 Loaded configuration from .workflow-config.yaml
✅ Step 1: Initial Analysis [PASSED] (2.3s)
✅ Step 2: File Scan [PASSED] (1.8s)
✅ Step 3: Generate Report [PASSED] (0.5s)
🎉 Workflow completed successfully!
```

---

### `validate`

Validate configuration and workflow files.

**Syntax:**

```bash
ai-workflow validate [options] [file]
```

**Options:**

- `--config` - Validate configuration only
- `--workflow` - Validate workflow only
- `--strict` - Enable strict validation

**Examples:**

```bash
# Validate everything
ai-workflow validate

# Validate configuration only
ai-workflow validate --config

# Validate specific workflow
ai-workflow validate workflows/deploy.yaml

# Strict mode
ai-workflow validate --strict
```

**Output:**

```
✅ Configuration is valid
✅ Workflow definition is valid
✅ Project structure matches project kind
✅ All dependencies are installed
```

---

### `status`

Show workflow status and session information.

**Syntax:**

```bash
ai-workflow status [options] [session-id]
```

**Options:**

- `--verbose` - Show detailed status
- `--json` - Output as JSON

**Examples:**

```bash
# Show current status
ai-workflow status

# Show specific session
ai-workflow status 20260101_120000

# Verbose output
ai-workflow status --verbose

# JSON output
ai-workflow status --json
```

**Output:**

```
📊 Workflow Status
Session ID: 20260101_120000
Status: In Progress
Current Step: 3/10
Duration: 5m 32s
Success Rate: 66.7%

Recent Steps:
✅ Step 1: Initial Analysis (2.3s)
✅ Step 2: File Scan (1.8s)
⏳ Step 3: Generate Report (running...)
```

---

### `list`

List sessions, workflows, or templates.

**Syntax:**

```bash
ai-workflow list <type> [options]
```

**Types:**

- `sessions` - List workflow sessions
- `workflows` - List available workflows
- `templates` - List project templates

**Options:**

- `--recent` - Show only recent items
- `--json` - Output as JSON

**Examples:**

```bash
# List sessions
ai-workflow list sessions

# List workflows
ai-workflow list workflows

# List templates
ai-workflow list templates

# Show recent sessions only
ai-workflow list sessions --recent
```

**Output:**

```
📋 Available Sessions:
1. 20260101_120000 [In Progress] - User Management API
2. 20260101_100000 [Completed] - Documentation Update
3. 20260101_080000 [Failed] - Code Analysis

Total: 3 sessions
```

---

### `clean`

Clean up workflow artifacts.

**Syntax:**

```bash
ai-workflow clean [options]
```

**Options:**

- `--logs` - Clean logs only
- `--cache` - Clean cache only
- `--all` - Clean everything
- `--older-than <days>` - Clean files older than N days
- `--dry-run` - Preview without deleting

**Examples:**

```bash
# Clean all artifacts
ai-workflow clean --all

# Clean logs only
ai-workflow clean --logs

# Clean old files
ai-workflow clean --older-than=7

# Dry run
ai-workflow clean --all --dry-run
```

**Output:**

```
🧹 Cleaning workflow artifacts...
✅ Removed 15 log files (2.3 MB)
✅ Removed 5 cache files (1.1 MB)
✅ Removed 3 old sessions (500 KB)
Total freed: 3.9 MB
```

---

### `metrics`

Display workflow metrics and statistics.

**Syntax:**

```bash
ai-workflow metrics [options] [session-id]
```

**Options:**

- `--format <type>` - Output format (table, json, csv)
- `--export <file>` - Export to file

**Examples:**

```bash
# Show metrics
ai-workflow metrics

# Show metrics for session
ai-workflow metrics 20260101_120000

# Export to JSON
ai-workflow metrics --format=json --export=metrics.json
```

**Output:**

```
📊 Workflow Metrics

Session: 20260101_120000
Duration: 5m 32s
Steps Completed: 8/10 (80%)
Success Rate: 87.5%

Step Timings:
  Step 1: 2.3s (fastest)
  Step 2: 1.8s
  Step 3: 12.5s (slowest)
  ...

Resource Usage:
  Memory: 245 MB (peak)
  CPU: 42% (average)
```

---

### `config`

Manage configuration.

**Syntax:**

```bash
ai-workflow config <action> [key] [value]
```

**Actions:**

- `get <key>` - Get configuration value
- `set <key> <value>` - Set configuration value
- `list` - List all configuration
- `reset` - Reset to defaults

**Examples:**

```bash
# Get configuration value
ai-workflow config get project.name

# Set configuration value
ai-workflow config set workflow.log_level debug

# List all configuration
ai-workflow config list

# Reset configuration
ai-workflow config reset
```

---

## Environment Variables

### `WORKFLOW_CONFIG_PATH`

Path to configuration file.

```bash
export WORKFLOW_CONFIG_PATH=/path/to/config.yaml
ai-workflow run
```

### `WORKFLOW_DEBUG`

Enable debug mode.

```bash
export WORKFLOW_DEBUG=true
ai-workflow run
```

### `WORKFLOW_LOG_LEVEL`

Set log level (debug, info, warn, error).

```bash
export WORKFLOW_LOG_LEVEL=debug
ai-workflow run
```

### `NO_COLOR`

Disable colored output.

```bash
export NO_COLOR=1
ai-workflow run
```

### `NODE_ENV`

Set Node.js environment.

```bash
export NODE_ENV=production
ai-workflow run
```

---

## Configuration Files

### Search Order

AI Workflow searches for configuration in this order:

1. `--config` command-line option
2. `$WORKFLOW_CONFIG_PATH` environment variable
3. `.workflow-config.yaml` in current directory
4. `.workflow-config.yml` in current directory
5. `.workflow_core/config/.workflow-config.yaml.template` (template)

### Example Configuration

```yaml
project:
  name: 'My Project'
  kind: 'nodejs_api'
  version: '1.0.0'

tech_stack:
  primary_language: 'javascript'
  test_command: 'npm test'

structure:
  source_dirs:
    - src
```

---

## Exit Codes

| Code | Description                  |
| ---- | ---------------------------- |
| 0    | Success                      |
| 1    | General error                |
| 2    | Configuration error          |
| 3    | Validation error             |
| 4    | Execution error              |
| 5    | File operation error         |
| 130  | Interrupted by user (Ctrl+C) |

### Usage

```bash
ai-workflow run
echo $?  # Check exit code

# In scripts
if ai-workflow validate; then
  echo "Validation passed"
else
  echo "Validation failed with code $?"
fi
```

---

## Common Workflows

### Initialize and Run

```bash
# Initialize project
ai-workflow init my-project
cd my-project

# Configure
vi .workflow-config.yaml

# Validate
ai-workflow validate

# Run
ai-workflow run
```

### Resume Failed Workflow

```bash
# Check status
ai-workflow status

# Resume from last checkpoint
ai-workflow run --resume=20260101_120000
```

### Clean Up After Testing

```bash
# Dry run to see what will be deleted
ai-workflow clean --all --dry-run

# Clean up
ai-workflow clean --all
```

---

## Additional Resources

- **[User Guide](../guides/USER_GUIDE.md)** - Building workflows
- **[Configuration Guide](../guides/CONFIGURATION_GUIDE.md)** - Configuration reference
- **[Examples](../examples/)** - Example workflows

---

**Last Updated:** 2026-02-01
**Version:** 1.7.3

# CLI Usage Guide

**Version**: 1.0.0  
**Last Updated**: 2026-02-11

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Getting Started](#getting-started)
4. [Commands](#commands)
5. [Global Options](#global-options)
6. [Configuration](#configuration)
7. [Workflow Stages](#workflow-stages)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

The `ai-workflow` CLI is a command-line interface for managing AI-powered workflow automation in software development projects. It provides commands for running workflows, managing configuration, viewing status, and cleaning artifacts.

### Key Features

- **Workflow Execution**: Run complete or partial workflows with stage selection
- **Checkpoint Management**: Resume workflows from interruption points
- **Project Initialization**: Quick setup with interactive wizards and templates
- **Configuration Management**: View, validate, and modify workflow configuration
- **Artifact Cleanup**: Clean old files and free up disk space
- **Progress Indicators**: Real-time feedback with spinners and progress bars
- **Colored Output**: Clear visual feedback with color-coded messages

---

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Install from npm

```bash
npm install -g ai-workflow
```

### Install from Source

```bash
git clone https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js
npm install
npm link
```

### Verify Installation

```bash
ai-workflow --version
ai-workflow --help
```

---

## Getting Started

### Quick Start (5 Minutes)

**1. Initialize a new project:**

```bash
cd /path/to/your/project
ai-workflow init --interactive
```

Follow the wizard prompts to:

- Enter project name
- Select project type (nodejs_api, react_spa, etc.)
- Choose primary language
- Add optional description

**2. Run quick validation:**

```bash
ai-workflow run --stage quick
```

This runs a fast 3-step validation (~1-2 minutes):

- Project detection
- Documentation validation
- Code analysis

**3. Check workflow status:**

```bash
ai-workflow status
```

View checkpoint information and workflow progress.

**4. Run full workflow:**

```bash
ai-workflow run
```

Execute the complete workflow with all steps (~15-30 minutes).

---

## Commands

### `ai-workflow run`

Execute the AI workflow with optional stage selection.

**Synopsis:**

```bash
ai-workflow run [options]
```

**Options:**

- `--stage <stage>` - Workflow stage: quick, medium, or full (default: full)
- `--auto` - Run without interactive prompts (default: false)
- `--dry-run` - Preview execution without running (default: false)
- `--workflow-dir <path>` - Workflow directory (default: .ai_workflow)
- `--project-root <path>` - Project root directory (default: current directory)

**Examples:**

```bash
# Run full workflow
ai-workflow run

# Run quick validation
ai-workflow run --stage quick

# Run in auto mode (no prompts)
ai-workflow run --auto --verbose

# Preview without executing
ai-workflow run --dry-run

# Use custom config file
ai-workflow run --config .my-config.yaml
```

**Stages:**

| Stage  | Steps | Duration  | Use Case                                |
| ------ | ----- | --------- | --------------------------------------- |
| quick  | 3     | 1-2 min   | Fast validation for rapid feedback      |
| medium | 6     | 5-10 min  | Standard workflow with essential checks |
| full   | 10    | 15-30 min | Complete workflow with all steps        |

---

### `ai-workflow resume`

Resume a workflow from a checkpoint.

**Synopsis:**

```bash
ai-workflow resume [checkpointId] [options]
```

**Options:**

- `--list` - List available checkpoints
- `--latest` - Resume from latest checkpoint
- `--workflow-dir <path>` - Workflow directory (default: .ai_workflow)
- `--project-root <path>` - Project root directory

**Examples:**

```bash
# List all checkpoints
ai-workflow resume --list

# Resume from latest checkpoint
ai-workflow resume --latest

# Resume from specific checkpoint
ai-workflow resume wf-20260211-123456

# Resume with verbose output
ai-workflow resume --latest --verbose
```

**Use Cases:**

- **Interrupted Workflow**: Power loss or manual interruption
- **Error Recovery**: Continue after fixing reported issues
- **Iterative Development**: Resume after making code changes

---

### `ai-workflow status`

Show current workflow status and checkpoint information.

**Synopsis:**

```bash
ai-workflow status [options]
```

**Options:**

- `--workflow-dir <path>` - Workflow directory (default: .ai_workflow)

**Examples:**

```bash
# Show status
ai-workflow status

# Show with verbose output
ai-workflow status --verbose
```

**Displays:**

- Latest checkpoint ID and timestamp
- Progress percentage and completed steps
- Failed steps (if any)
- Checkpoint history summary
- Quick action commands

---

### `ai-workflow init`

Initialize workflow in a new project.

**Synopsis:**

```bash
ai-workflow init [options]
```

**Options:**

- `--interactive` - Run configuration wizard (default: false)
- `--template <name>` - Use project template
- `--name <name>` - Project name
- `--description <desc>` - Project description
- `--force` - Overwrite existing configuration
- `--project-root <path>` - Project root directory

**Available Templates:**

- `nodejs_api` - Node.js API/Backend Service
- `react_spa` - React Single Page Application
- `python_app` - Python Application
- `shell_script_automation` - Shell Script Automation
- `static_website` - Static Website (HTML/CSS/JS)
- `client_spa` - Client-side SPA (vanilla JS)
- `configuration_library` - Configuration Library
- `generic` - Generic Project

**Examples:**

```bash
# Interactive wizard
ai-workflow init --interactive

# Use Node.js template
ai-workflow init --template nodejs_api --name my-api

# Use React template
ai-workflow init --template react_spa --name my-app

# Force overwrite existing config
ai-workflow init --force --interactive
```

**What It Does:**

1. Creates `.workflow-config.yaml` with project settings
2. Creates `.ai_workflow/` directory structure:
   - backlog/, summaries/, logs/
   - metrics/, checkpoints/, prompts/
   - ml_models/, .incremental_cache/
3. Validates configuration
4. Displays next steps

---

### `ai-workflow config`

Manage workflow configuration.

**Synopsis:**

```bash
ai-workflow config <action> [args...] [options]
```

**Actions:**

- `show` - Display current configuration
- `validate` - Validate configuration file
- `get <key>` - Get configuration value by key
- `set <key> <value>` - Set configuration value

**Examples:**

```bash
# Show configuration
ai-workflow config show

# Validate configuration
ai-workflow config validate

# Get value (supports dot notation)
ai-workflow config get project.name
ai-workflow config get workflow.stages.quick.enabled

# Set value (with type coercion)
ai-workflow config set project.name "MyProject"
ai-workflow config set validation.testing.min_coverage 80
```

**Configuration Keys:**

| Key                               | Type    | Required | Description             |
| --------------------------------- | ------- | -------- | ----------------------- |
| project.name                      | string  | Yes      | Project name            |
| project.kind                      | string  | Yes      | Project type            |
| project.primary_language          | string  | Yes      | Primary language        |
| workflow.stages.quick.enabled     | boolean | No       | Enable quick stage      |
| validation.documentation.required | boolean | No       | Require docs validation |
| validation.testing.min_coverage   | number  | No       | Minimum test coverage % |

---

### `ai-workflow clean`

Clean workflow artifacts and free disk space.

**Synopsis:**

```bash
ai-workflow clean [options]
```

**Options:**

- `--artifacts` - Clean workflow artifacts
- `--cache` - Clean cache files
- `--checkpoints` - Clean checkpoints
- `--all` - Clean everything
- `--dry-run` - Preview without deleting
- `--workflow-dir <path>` - Workflow directory (default: .ai_workflow)
- `--older-than-days <days>` - Clean files older than N days
- `--keep-last <n>` - Keep last N checkpoints (default: 5)

**Examples:**

```bash
# Preview cleanup (dry run)
ai-workflow clean --all --dry-run

# Clean artifacts and cache
ai-workflow clean --artifacts --cache

# Clean old checkpoints, keep last 5
ai-workflow clean --checkpoints --keep-last 5

# Clean files older than 30 days
ai-workflow clean --all --older-than-days 30

# Clean everything
ai-workflow clean --all
```

**What Gets Cleaned:**

- **Artifacts**: backlog/, summaries/, logs/
- **Cache**: .incremental_cache/, ai_cache/
- **Checkpoints**: Saved workflow states
- **Sessions**: Session data
- **Metrics**: Performance metrics

---

## Global Options

Available for all commands:

| Option            | Description                   | Default               |
| ----------------- | ----------------------------- | --------------------- |
| `-v, --verbose`   | Enable verbose logging        | false                 |
| `-q, --quiet`     | Suppress non-essential output | false                 |
| `--no-color`      | Disable colored output        | false                 |
| `--config <path>` | Path to configuration file    | .workflow-config.yaml |
| `-h, --help`      | Display help for command      | -                     |
| `-V, --version`   | Output version number         | -                     |

**Examples:**

```bash
# Verbose output
ai-workflow run --verbose

# Quiet mode
ai-workflow run --quiet

# No colors (for CI/CD)
ai-workflow run --no-color

# Custom config file
ai-workflow run --config configs/staging.yaml
```

---

## Configuration

### Configuration File

The `.workflow-config.yaml` file contains all workflow settings.

**Example:**

```yaml
project:
  name: 'my-awesome-project'
  kind: 'nodejs_api'
  primary_language: 'javascript'
  description: 'My awesome project'

workflow:
  stages:
    quick:
      enabled: true
      steps:
        - step_00
        - step_01
        - step_02
    medium:
      enabled: true
      steps:
        - step_00
        - step_01
        - step_02
        - step_03
        - step_04
        - step_05
    full:
      enabled: true
      steps:
        - step_00
        - step_01
        - step_02
        - step_03
        - step_04
        - step_05
        - step_06
        - step_07
        - step_08
        - step_0f

validation:
  documentation:
    required: true
    min_coverage: 80
  testing:
    required: true
    min_coverage: 70

quality:
  code_standards: true
  security_checks: true
```

### Environment Variables

- `AI_WORKFLOW_CONFIG` - Override config file path
- `AI_WORKFLOW_DIR` - Override workflow directory
- `NO_COLOR` - Disable colored output

---

## Workflow Stages

### Quick Stage (1-2 minutes)

**Purpose**: Fast validation for rapid feedback

**Steps**:

1. **step_00**: Project detection
2. **step_01**: Documentation validation
3. **step_02**: Code analysis

**Use When**:

- Quick pre-commit checks
- Rapid feedback during development
- CI/CD fast track

---

### Medium Stage (5-10 minutes)

**Purpose**: Standard workflow with essential checks

**Steps**:

1. **step_00**: Project detection
2. **step_01**: Documentation validation
3. **step_02**: Code analysis
4. **step_03**: Test generation
5. **step_04**: Quality checks
6. **step_05**: Dependency analysis

**Use When**:

- Pre-push validation
- Pull request checks
- Daily development workflow

---

### Full Stage (15-30 minutes)

**Purpose**: Complete workflow with all steps

**Steps**:

1. **step_00**: Project detection
2. **step_01**: Documentation validation
3. **step_02**: Code analysis
4. **step_03**: Test generation
5. **step_04**: Quality checks
6. **step_05**: Dependency analysis
7. **step_06**: Git automation
8. **step_07**: Linting
9. **step_08**: Build verification
10. **step_0f**: Artifact commits

**Use When**:

- Release preparation
- Weekly quality checks
- Major milestones

---

## Best Practices

### Development Workflow

1. **Start with Quick**: Use `--stage quick` during active development
2. **Use Medium Pre-Push**: Run medium stage before pushing code
3. **Run Full Weekly**: Execute full workflow once a week
4. **Resume on Errors**: Use `resume --latest` to continue after fixing issues

### Configuration Management

1. **Version Control**: Commit `.workflow-config.yaml` to git
2. **Environment Configs**: Use separate configs for dev/staging/prod
3. **Validate Regularly**: Run `config validate` after manual edits
4. **Use Templates**: Start with appropriate template in `init`

### Cleanup Strategy

1. **Regular Cleanup**: Run `clean --all` weekly
2. **Keep Recent**: Always use `--keep-last` with checkpoints
3. **Dry Run First**: Preview with `--dry-run` before actual cleanup
4. **Age-Based**: Use `--older-than-days` for gradual cleanup

### CI/CD Integration

1. **Use Auto Mode**: Add `--auto` flag for non-interactive execution
2. **Disable Colors**: Use `--no-color` in CI environments
3. **Quick Stage**: Use quick stage for fast feedback
4. **Fail Fast**: Enable verbose mode to capture errors

---

## Troubleshooting

### Common Issues

#### "No configuration file found"

**Solution**: Run `ai-workflow init` to create configuration.

```bash
ai-workflow init --interactive
```

#### "Workflow directory not found"

**Solution**: The `.ai_workflow/` directory is missing. Re-initialize:

```bash
ai-workflow init --force
```

#### "Checkpoint not found"

**Solution**: List available checkpoints:

```bash
ai-workflow resume --list
```

#### "Validation failed"

**Solution**: Check configuration:

```bash
ai-workflow config validate
ai-workflow config show
```

### Debug Mode

Enable verbose output for debugging:

```bash
ai-workflow run --verbose
ai-workflow resume --latest --verbose
ai-workflow status --verbose
```

### Reset Everything

To start fresh:

```bash
# Backup current config
cp .workflow-config.yaml .workflow-config.yaml.bak

# Clean all artifacts
ai-workflow clean --all

# Re-initialize
ai-workflow init --force --interactive
```

---

## Getting Help

### Built-in Help

```bash
# General help
ai-workflow --help

# Command-specific help
ai-workflow run --help
ai-workflow resume --help
ai-workflow config --help
```

### Documentation

- **Usage Guide**: This document
- **API Reference**: `docs/api/README.md`
- **Examples**: `docs/examples/`
- **GitHub**: https://github.com/mpbarbosa/ai_workflow.js

### Support

- **Issues**: https://github.com/mpbarbosa/ai_workflow.js/issues
- **Discussions**: https://github.com/mpbarbosa/ai_workflow.js/discussions

---

**Last Updated**: 2026-02-11  
**Version**: 1.0.0  
**License**: MIT

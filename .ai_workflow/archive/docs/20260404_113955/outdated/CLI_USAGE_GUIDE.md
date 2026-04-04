## CLI_USAGE_GUIDE

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

- Node.js >= 20.0.0
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
ai-workflow res

---

## CLI_USAGE_GUIDE

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

- Node.js >= 20.0.0
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
ai-workflow res

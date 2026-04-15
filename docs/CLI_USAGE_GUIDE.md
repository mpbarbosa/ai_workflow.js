## CLI_USAGE_GUIDE

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

# Clean o

---

## CLI_USAGE_GUIDE

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

# Clean o

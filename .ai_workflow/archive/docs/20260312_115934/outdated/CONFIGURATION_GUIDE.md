# Configuration Guide

**AI Workflow Automation v1.0.0**
**Last Updated:** 2026-02-01
**Audience:** Users setting up workflows

---

## Table of Contents

- [Overview](#overview)
- [Configuration Files](#configuration-files)
- [Project Configuration](#project-configuration)
- [Tech Stack Configuration](#tech-stack-configuration)
- [Directory Structure](#directory-structure)
- [Workflow Options](#workflow-options)
- [AI Helpers](#ai-helpers)
- [Advanced Configuration](#advanced-configuration)
- [Environment Variables](#environment-variables)
- [Configuration Examples](#configuration-examples)

---

## Overview

AI Workflow Automation uses a YAML-based configuration system centered around `.workflow-config.yaml`. This guide explains all configuration options and how to customize workflows for your project.

### Configuration Philosophy

- **Convention over Configuration:** Sensible defaults work out of the box
- **Progressive Disclosure:** Basic config is simple, advanced options available when needed
- **Type Safety:** Configuration is validated at startup
- **Flexibility:** Override any default behavior

---

## Configuration Files

### Primary Configuration

**`.workflow-config.yaml`** - Main project configuration

```yaml
project:
  name: 'My Project'
  type: 'nodejs-application'
  description: 'Project description'
  version: '1.0.0'
  kind: 'nodejs_api'

tech_stack:
  primary_language: 'javascript'
  framework: 'express'
  build_system: 'npm'
  test_framework: 'jest'
  test_command: 'npm test'
  lint_command: 'eslint .'

structure:
  source_dirs:
    - src
  test_dirs:
    - test
  docs_dirs:
    - docs
  config_files:
    - package.json
    - .eslintrc.json
```

### Supporting Configuration

**`.workflow_core/config/project_kinds.yaml`** - Project type definitions (from submodule)

**`.workflow_core/config/ai_helpers.yaml`** - AI helper definitions (from submodule)

**`.workflow_core/config/ai_prompts_project_kinds.yaml`** - Project-specific AI prompts (from submodule)

---

## Project Configuration

### Basic Project Metadata

```yaml
project:
  # Human-readable project name
  name: 'My Application'

  # Project type (hyphenated)
  type: 'nodejs-application'

  # Brief description
  description: 'RESTful API for user management'

  # Semantic version (no 'v' prefix)
  version: '1.0.0'

  # Project kind (underscored) - used for validation
  kind: 'nodejs_api'
```

### Project Kinds

Supported project kinds (from `project_kinds.yaml`):

| Kind                      | Description           | Test Framework     | Coverage Threshold |
| ------------------------- | --------------------- | ------------------ | ------------------ |
| `shell_script_automation` | Bash/shell scripts    | bash_unit/BATS     | 60%                |
| `nodejs_api`              | Node.js backend APIs  | jest/mocha/vitest  | 80%                |
| `client_spa`              | Vanilla JS SPAs       | jest/playwright    | 70%                |
| `react_spa`               | React applications    | jest/vitest + RTL  | 75%                |
| `static_website`          | HTML/CSS/JS sites     | None               | 0%                 |
| `python_app`              | Python applications   | pytest/unittest    | 80%                |
| `configuration_library`   | Template/config repos | validation-scripts | 0%                 |
| `generic`                 | Other project types   | Varies             | 50%                |

**Example: Node.js API Project**

```yaml
project:
  name: 'User API'
  type: 'nodejs-application'
  kind: 'nodejs_api'
  version: '1.0.0'
  description: 'User management REST API'
```

**Example: React SPA Project**

```yaml
project:
  name: 'Dashboard App'
  type: 'react-spa'
  kind: 'react_spa'
  version: '2.1.0'
  description: 'Admin dashboard with React'
```

---

## Tech Stack Configuration

### Language and Framework

```yaml
tech_stack:
  # Primary programming language
  primary_language: 'javascript' # javascript, python, bash, etc.

  # Framework in use
  framework: 'express' # express, react, flask, etc.

  # Secondary languages (optional)
  secondary_languages:
    - typescript
    - html
    - css
```

### Build Configuration

```yaml
tech_stack:
  # Build system / package manager
  build_system: 'npm' # npm, yarn, pnpm, webpack, vite

  # Build command (if applicable)
  build_command: 'npm run build'

  # Build output directory
  build_output: 'dist'
```

### Testing Configuration

```yaml
tech_stack:
  # Test framework
  test_framework: 'jest' # jest, mocha, pytest, bats

  # Command to run tests
  test_command: 'npm test'

  # Test directory
  test_directory: 'test'

  # Test file pattern
  test_file_pattern: '**/*.test.js'

  # Coverage threshold
  coverage_threshold: 80 # Percentage (0-100)
```

### Linting Configuration

```yaml
tech_stack:
  # Linter command
  lint_command: 'eslint .'

  # Linters in use
  linters:
    - eslint
    - prettier
    - stylelint

  # Auto-fix on save
  auto_fix: true
```

### Database Configuration

```yaml
tech_stack:
  # Database systems
  databases:
    - postgresql
    - redis

  # ORM/ODM
  orm: 'sequelize' # sequelize, mongoose, typeorm
```

---

## Directory Structure

### Source Directories

```yaml
structure:
  # Source code directories
  source_dirs:
    - src
    - lib

  # Test directories
  test_dirs:
    - test
    - __tests__

  # Documentation directories
  docs_dirs:
    - docs
    - documentation

  # Configuration files
  config_files:
    - package.json
    - .eslintrc.json
    - .prettierrc
    - tsconfig.json
```

### Artifact Directory

The `.ai_workflow/` directory stores workflow artifacts:

```
.ai_workflow/
├── backlog/              # Workflow summaries and reports
├── summaries/            # AI-generated summaries
├── logs/                 # Execution logs
├── metrics/              # Performance metrics
├── checkpoints/          # Resume points
├── prompts/              # AI prompt logs (optional commit)
├── ml_models/            # ML models (optional commit)
└── .incremental_cache/   # Incremental processing cache
```

**Configuration:**

```yaml
structure:
  # Artifact directory (default: .ai_workflow)
  artifact_dir: '.ai_workflow'

  # Subdirectories
  backlog_dir: 'backlog'
  summaries_dir: 'summaries'
  logs_dir: 'logs'
  metrics_dir: 'metrics'
  checkpoints_dir: 'checkpoints'
  prompts_dir: 'prompts'
  ml_models_dir: 'ml_models'
  cache_dir: '.incremental_cache'
```

### Exclusion Patterns

Exclude third-party files from analysis:

```yaml
structure:
  # Standard exclusions (node_modules, .git, etc.)
  exclude_patterns:
    - 'node_modules/**'
    - 'dist/**'
    - 'build/**'
    - '.git/**'
    - 'coverage/**'
    - '*.log'

  # Custom exclusions
  custom_exclude:
    - 'vendor/**'
    - 'tmp/**'
```

---

## Workflow Options

### Execution Mode

```yaml
workflow:
  # Execution mode: auto or interactive
  mode: 'interactive' # auto | interactive

  # Continue on error
  continue_on_error: false

  # Maximum retries per step
  max_retries: 3

  # Timeout per step (seconds)
  step_timeout: 300
```

### Step Configuration

```yaml
workflow:
  # Enable/disable specific step types
  steps:
    file_operations: true
    git_operations: true
    ai_integration: true
    validation: true
    reporting: true

  # Step-specific options
  step_options:
    file_operations:
      max_file_size: 10485760 # 10MB in bytes
      encoding: 'utf-8'

    git_operations:
      auto_commit: false
      commit_message_template: 'feat: {{description}}'
```

### Logging Configuration

```yaml
workflow:
  # Logging level: debug, info, warn, error
  log_level: 'info'

  # Log to file
  log_to_file: true

  # Log file path
  log_file: '.ai_workflow/logs/workflow.log'

  # Colorized output
  colorize: true
```

### Metrics Configuration

```yaml
workflow:
  # Enable metrics collection
  collect_metrics: true

  # Metrics granularity
  metrics_granularity: 'step' # step | phase | workflow

  # Save metrics to file
  save_metrics: true
```

---

## AI Helpers

### AI Helper Configuration

AI helpers provide context-aware assistance:

```yaml
ai_helpers:
  # Enable AI helpers
  enabled: true

  # Helpers to load
  helpers:
    - step0b_documentation_generation
    - step1a_initial_analysis
    - step2a_comprehensive_analysis

  # Helper-specific configuration
  helper_config:
    step0b_documentation_generation:
      style: 'technical'
      audience: 'developers'
      format: 'markdown'
```

### Prompt Configuration

```yaml
ai_helpers:
  # Custom prompts
  prompts:
    analysis:
      system: 'You are a code analysis expert...'
      user_prefix: 'Analyze the following code:'

    documentation:
      system: 'You are a technical writer...'
      user_prefix: 'Generate documentation for:'
```

---

## Advanced Configuration

### Performance Tuning

```yaml
performance:
  # Enable caching
  enable_cache: true

  # Cache TTL (seconds)
  cache_ttl: 3600

  # Parallel execution
  max_parallel: 4

  # Memory limit (MB)
  memory_limit: 512
```

### Security Configuration

```yaml
security:
  # Validate checksums
  validate_checksums: true

  # Allow external commands
  allow_external_commands: false

  # Whitelist commands
  command_whitelist:
    - git
    - npm
    - node
```

### Integration Points

```yaml
integrations:
  # Git integration
  git:
    enabled: true
    auto_detect_changes: true
    branch_strategy: 'feature'

  # CI/CD integration
  ci_cd:
    platform: 'github-actions' # github-actions, gitlab-ci
    notify_on_completion: true

  # Issue tracking
  issue_tracker:
    enabled: false
    platform: 'github'
    auto_create_issues: false
```

---

## Environment Variables

### System Environment Variables

```bash
# Node.js environment
export NODE_ENV=production

# Workflow debug mode
export WORKFLOW_DEBUG=true

# Override artifact directory
export WORKFLOW_ARTIFACT_DIR=/custom/path

# Override log level
export WORKFLOW_LOG_LEVEL=debug

# Disable colors
export NO_COLOR=1
```

### Usage in Configuration

```yaml
workflow:
  # Use environment variable with fallback
  log_level: '${WORKFLOW_LOG_LEVEL:-info}'

  # Reference paths
  artifact_dir: '${WORKFLOW_ARTIFACT_DIR:-.ai_workflow}'
```

---

## Configuration Examples

### Example 1: Node.js Express API

```yaml
project:
  name: 'User Management API'
  type: 'nodejs-application'
  kind: 'nodejs_api'
  version: '1.0.0'
  description: 'RESTful API for user management with Express'

tech_stack:
  primary_language: 'javascript'
  framework: 'express'
  build_system: 'npm'
  test_framework: 'jest'
  test_command: 'npm test'
  lint_command: 'eslint . --fix'
  coverage_threshold: 80
  databases:
    - postgresql
    - redis
  orm: 'sequelize'

structure:
  source_dirs:
    - src
  test_dirs:
    - test
  docs_dirs:
    - docs
  config_files:
    - package.json
    - .eslintrc.json
    - .prettierrc
  exclude_patterns:
    - 'node_modules/**'
    - 'coverage/**'
    - 'dist/**'

workflow:
  mode: 'interactive'
  log_level: 'info'
  collect_metrics: true
  continue_on_error: false

ai_helpers:
  enabled: true
  helpers:
    - step1a_initial_analysis
    - step2a_comprehensive_analysis
```

### Example 2: React SPA

```yaml
project:
  name: 'Admin Dashboard'
  type: 'react-spa'
  kind: 'react_spa'
  version: '2.1.0'
  description: 'Admin dashboard built with React and TypeScript'

tech_stack:
  primary_language: 'typescript'
  framework: 'react'
  build_system: 'vite'
  test_framework: 'vitest'
  test_command: 'npm run test'
  lint_command: 'eslint . && tsc --noEmit'
  coverage_threshold: 75
  secondary_languages:
    - javascript
    - html
    - css

structure:
  source_dirs:
    - src
  test_dirs:
    - src/__tests__
  docs_dirs:
    - docs
  config_files:
    - package.json
    - vite.config.ts
    - tsconfig.json

workflow:
  mode: 'auto'
  log_level: 'info'
  steps:
    file_operations: true
    git_operations: true
    ai_integration: true
    validation: true
    reporting: true
```

### Example 3: Python Flask Application

```yaml
project:
  name: 'Data Processing Service'
  type: 'python-application'
  kind: 'python_app'
<<<<<<< HEAD
  version: '1.8.0'
=======
  version: '1.6.1'
>>>>>>> a4c4d4d (chore(workflow): update docs and metrics [skip ci])
  description: 'Data processing service with Flask'

tech_stack:
  primary_language: 'python'
  framework: 'flask'
  build_system: 'pip'
  test_framework: 'pytest'
  test_command: 'pytest'
  lint_command: 'pylint src/ && black src/ --check'
  coverage_threshold: 80
  databases:
    - postgresql

structure:
  source_dirs:
    - src
    - app
  test_dirs:
    - tests
  docs_dirs:
    - docs
  config_files:
    - requirements.txt
    - pyproject.toml
    - setup.py
  exclude_patterns:
    - 'venv/**'
    - '.pytest_cache/**'
    - '__pycache__/**'
    - '*.pyc'

workflow:
  mode: 'interactive'
  log_level: 'debug'
  max_retries: 3
```

### Example 4: Shell Script Automation

```yaml
project:
  name: 'Deployment Scripts'
  type: 'shell-scripts'
  kind: 'shell_script_automation'
  version: '3.0.0'
  description: 'Automated deployment scripts for infrastructure'

tech_stack:
  primary_language: 'bash'
  test_framework: 'bats'
  test_command: './tests/run_tests.sh'
  lint_command: 'shellcheck **/*.sh'
  coverage_threshold: 60

structure:
  source_dirs:
    - scripts
    - bin
  test_dirs:
    - tests
  docs_dirs:
    - docs
  config_files:
    - .shellcheckrc

workflow:
  mode: 'interactive'
  log_level: 'info'
  continue_on_error: true
```

### Example 5: Static Website

```yaml
project:
  name: 'Company Website'
  type: 'static-website'
  kind: 'static_website'
  version: '1.0.0'
  description: 'Company marketing website'

tech_stack:
  primary_language: 'html'
  build_system: 'none'
  lint_command: 'htmlhint **/*.html && stylelint **/*.css'
  secondary_languages:
    - css
    - javascript

structure:
  source_dirs:
    - .
  docs_dirs:
    - docs
  exclude_patterns:
    - '.git/**'
    - 'node_modules/**'

workflow:
  mode: 'auto'
  log_level: 'info'
  steps:
    validation: true
    reporting: true
```

---

## Configuration Validation

### Validate Configuration

Run validation before starting workflow:

```bash
# Validate configuration
node src/cli/validate-config.js

# Show parsed configuration
node src/cli/show-config.js
```

### Common Validation Errors

**Missing required fields:**

```
Error: Missing required field 'project.name' in .workflow-config.yaml
```

**Invalid project kind:**

```
Error: Invalid project kind 'unknown_type'. Must be one of: shell_script_automation, nodejs_api, client_spa, react_spa, static_website, python_app, configuration_library, generic
```

**Invalid coverage threshold:**

```
Error: coverage_threshold must be between 0 and 100, got: 150
```

---

## Configuration Best Practices

### 1. Start Simple

Begin with minimal configuration, add complexity as needed:

```yaml
# Minimal configuration
project:
  name: 'My Project'
  kind: 'nodejs_api'
  version: '1.0.0'

tech_stack:
  primary_language: 'javascript'
  test_command: 'npm test'
```

### 2. Use Comments

Document non-obvious choices:

```yaml
tech_stack:
  # Using Vite instead of webpack for faster builds
  build_system: 'vite'

  # Coverage threshold set to 75% during MVP phase
  # TODO: Increase to 80% after v1.0.0
  coverage_threshold: 75
```

### 3. Version Control Configuration

Commit `.workflow-config.yaml` to version control:

```bash
git add .workflow-config.yaml
git commit -m "docs: add workflow configuration"
```

### 4. Keep Secrets Out

Never commit secrets in configuration:

```yaml
# ❌ Bad - secrets in config
database:
  password: "my-secret-password"

# ✅ Good - use environment variables
database:
  password: "${DB_PASSWORD}"
```

### 5. Document Overrides

If overriding defaults, explain why:

```yaml
workflow:
  # Increased timeout for slow CI environment
  step_timeout: 600 # Default: 300
```

---

## Troubleshooting

### Configuration Not Loading

**Problem:** Configuration file not found

**Solution:**

```bash
# Check file exists
ls -la .workflow-config.yaml

# Check file permissions
chmod 644 .workflow-config.yaml

# Validate YAML syntax
npx js-yaml .workflow-config.yaml
```

### Invalid YAML Syntax

**Problem:** YAML parsing error

**Common issues:**

- Inconsistent indentation (use 2 spaces)
- Missing quotes around strings with colons
- Incorrect list syntax

**Solution:**

```yaml
# ❌ Bad
project:
  name:My Project
    version: 1.0.0

# ✅ Good
project:
  name: "My Project"
  version: "1.0.0"
```

### Project Kind Not Detected

**Problem:** Workflow doesn't recognize project type

**Solution:**

1. Explicitly set `project.kind` in config
2. Ensure project structure matches expectations
3. Check `.workflow_core/` submodule is initialized

---

## Additional Resources

- **[User Guide](./USER_GUIDE.md)** - Building workflows
- **[Developer Guide](./DEVELOPER_GUIDE.md)** - Contributing to ai_workflow.js
- **[API Documentation](../api/)** - Module reference

---

**Last Updated:** 2026-02-01
**Version:** 1.0.0

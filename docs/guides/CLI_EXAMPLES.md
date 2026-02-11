# CLI Examples

Practical examples of using the ai-workflow CLI in real-world scenarios.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [CI/CD Integration](#cicd-integration)
4. [Configuration Management](#configuration-management)
5. [Error Recovery](#error-recovery)
6. [Maintenance](#maintenance)

---

## Getting Started

### Example 1: New Project Setup

Initialize a Node.js API project:

```bash
# Create project directory
mkdir my-api && cd my-api
npm init -y

# Initialize workflow with template
ai-workflow init --template nodejs_api --name my-api

# Run first validation
ai-workflow run --stage quick

# Check status
ai-workflow status
```

### Example 2: Interactive Setup

Use the configuration wizard:

```bash
ai-workflow init --interactive
```

**Interactive prompts:**

```
? Project name: my-awesome-app
? Project type: react_spa - React Single Page Application
? Primary language: typescript
? Project description (optional): My awesome React app
```

**Output:**

```
✓ Created .workflow-config.yaml
✓ Created workflow directories

Initialization complete! 🎉

Next steps:
  1. Review configuration: ai-workflow config show
  2. Run quick validation: ai-workflow run --stage quick
  3. Run full workflow: ai-workflow run
```

---

## Development Workflow

### Example 3: Fast Feedback Loop

During active development:

```bash
# Make code changes
vim src/app.js

# Quick validation (1-2 min)
ai-workflow run --stage quick --auto

# Continue if passed, fix if failed
```

### Example 4: Pre-Commit Checks

Before committing code:

```bash
# Run medium stage (5-10 min)
ai-workflow run --stage medium

# If passed, commit
git add .
git commit -m "feat: add new feature"

# If failed, review issues
ai-workflow status
```

### Example 5: Weekly Quality Check

Full workflow for thorough validation:

```bash
# Run full workflow (15-30 min)
ai-workflow run --verbose

# Review results
ai-workflow status

# Check workflow artifacts
ls -la .ai_workflow/backlog/
ls -la .ai_workflow/summaries/
```

---

## CI/CD Integration

### Example 6: GitHub Actions

`.github/workflows/ai-workflow.yml`:

```yaml
name: AI Workflow

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install ai-workflow
        run: npm install -g ai-workflow

      - name: Run quick validation
        run: ai-workflow run --stage quick --auto --no-color --verbose

      - name: Upload artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: workflow-artifacts
          path: .ai_workflow/
```

### Example 7: GitLab CI

`.gitlab-ci.yml`:

```yaml
workflow-validation:
  stage: test
  image: node:18
  script:
    - npm ci
    - npm install -g ai-workflow
    - ai-workflow run --stage quick --auto --no-color
  artifacts:
    when: on_failure
    paths:
      - .ai_workflow/
    expire_in: 1 week
```

### Example 8: Jenkins Pipeline

`Jenkinsfile`:

```groovy
pipeline {
    agent any

    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
                sh 'npm install -g ai-workflow'
            }
        }

        stage('Validate') {
            steps {
                sh 'ai-workflow run --stage medium --auto --no-color --verbose'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: '.ai_workflow/**/*', allowEmptyArchive: true
        }
    }
}
```

---

## Configuration Management

### Example 9: Environment-Specific Configs

Multiple configuration files:

```bash
# Development config
ai-workflow run --config .workflow-config.dev.yaml

# Staging config
ai-workflow run --config .workflow-config.staging.yaml --stage medium

# Production config
ai-workflow run --config .workflow-config.prod.yaml
```

### Example 10: Configuration Validation

Validate before committing:

```bash
# Edit configuration
vim .workflow-config.yaml

# Validate syntax and values
ai-workflow config validate

# View current config
ai-workflow config show

# Test specific values
ai-workflow config get project.name
ai-workflow config get validation.testing.min_coverage
```

### Example 11: Dynamic Configuration

Update configuration programmatically:

```bash
# Set project name
ai-workflow config set project.name "my-new-name"

# Update test coverage requirement
ai-workflow config set validation.testing.min_coverage 85

# Enable documentation validation
ai-workflow config set validation.documentation.required true

# Validate changes
ai-workflow config validate
```

---

## Error Recovery

### Example 12: Resume After Interruption

Workflow was interrupted (power loss, Ctrl+C):

```bash
# List available checkpoints
ai-workflow resume --list

# Output:
# Available checkpoints:
# 1. wf-20260211-123456 - 2/11/2026, 10:30:00 AM (5/10 steps, 50% complete)
# 2. wf-20260211-090000 - 2/11/2026, 9:00:00 AM (3/10 steps, 30% complete)

# Resume from latest
ai-workflow resume --latest

# Or resume from specific checkpoint
ai-workflow resume wf-20260211-123456
```

### Example 13: Fix and Resume

Workflow failed, fix issues and continue:

```bash
# Run workflow
ai-workflow run

# Workflow fails at step 4
# Error: Test coverage below minimum (65% < 70%)

# Fix the issue
vim test/app.test.js
npm test

# Resume from latest checkpoint
ai-workflow resume --latest --verbose
```

### Example 14: Debug Mode

Troubleshoot issues with verbose output:

```bash
# Enable verbose logging
ai-workflow run --verbose

# Check detailed status
ai-workflow status --verbose

# Resume with verbose output
ai-workflow resume --latest --verbose
```

---

## Maintenance

### Example 15: Weekly Cleanup

Clean old artifacts:

```bash
# Preview what will be deleted
ai-workflow clean --all --dry-run

# Output:
# Would delete 15 file(s)
# Would free 5.24 MB

# Execute cleanup
ai-workflow clean --all

# Keep last 10 checkpoints
ai-workflow clean --checkpoints --keep-last 10
```

### Example 16: Selective Cleanup

Clean specific types of artifacts:

```bash
# Clean artifacts only
ai-workflow clean --artifacts

# Clean cache and artifacts
ai-workflow clean --artifacts --cache

# Clean old files (30+ days)
ai-workflow clean --all --older-than-days 30
```

### Example 17: Disk Space Management

Monitor and clean based on disk usage:

```bash
# Check current disk usage
du -sh .ai_workflow/

# Clean aggressively
ai-workflow clean --all --keep-last 3

# Verify space freed
du -sh .ai_workflow/
```

---

## Advanced Use Cases

### Example 18: Multi-Project Workflow

Manage multiple projects:

```bash
# Project A (Node.js API)
cd ~/projects/api
ai-workflow run --stage quick

# Project B (React SPA)
cd ~/projects/frontend
ai-workflow run --stage quick

# Project C (Python App)
cd ~/projects/backend
ai-workflow run --stage medium
```

### Example 19: Scripted Workflow

Automate with shell scripts:

```bash
#!/bin/bash
# run-workflow.sh

set -e

echo "Starting AI workflow validation..."

# Run quick validation
if ai-workflow run --stage quick --auto --quiet; then
    echo "✓ Quick validation passed"

    # Run medium validation
    if ai-workflow run --stage medium --auto --quiet; then
        echo "✓ Medium validation passed"
        exit 0
    else
        echo "✗ Medium validation failed"
        ai-workflow status
        exit 1
    fi
else
    echo "✗ Quick validation failed"
    ai-workflow status
    exit 1
fi
```

### Example 20: Pre-Commit Hook

Git hook for automatic validation:

`.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "Running AI workflow validation..."

# Run quick validation before commit
if ai-workflow run --stage quick --auto --quiet; then
    echo "✓ Validation passed"
    exit 0
else
    echo "✗ Validation failed - commit aborted"
    echo "Run 'ai-workflow status' for details"
    exit 1
fi
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

---

## Tips and Tricks

### Use Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias awf='ai-workflow'
alias awfq='ai-workflow run --stage quick --auto'
alias awfm='ai-workflow run --stage medium --auto'
alias awfs='ai-workflow status'
alias awfr='ai-workflow resume --latest'
alias awfc='ai-workflow clean --all --dry-run'
```

Usage:

```bash
awfq         # Quick run
awfm         # Medium run
awfs         # Status
awfr         # Resume
awfc         # Clean preview
```

### Combine with Other Tools

```bash
# Run after successful tests
npm test && ai-workflow run --stage quick

# Clean before building
ai-workflow clean --cache && npm run build

# Validate before pushing
git add . && ai-workflow run --stage medium && git push
```

---

**See Also:**

- [CLI Usage Guide](CLI_USAGE_GUIDE.md)
- [CLI Quick Reference](CLI_QUICK_REFERENCE.md)

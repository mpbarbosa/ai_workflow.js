# Basic Examples

**AI Workflow Automation v1.0.0**
**Last Updated:** 2026-02-01

---

## Overview

This directory contains basic examples to help you get started with AI Workflow Automation.

---

## Example 1: Simple File Analysis

Analyze files in a project and generate a summary report.

### Workflow File

`file-analysis.yaml`:

```yaml
name: 'Simple File Analysis'
description: 'Analyze project files and count lines of code'
version: '1.0.0'

steps:
  - name: 'Scan Source Directory'
    action: 'file_scan'
    params:
      directory: 'src'
      patterns:
        - '**/*.js'
        - '**/*.ts'
      exclude:
        - '**/*.test.js'
        - '**/*.spec.ts'

  - name: 'Count Lines'
    action: 'count_lines'
    params:
      files: '${previous.files}'

  - name: 'Generate Report'
    action: 'generate_report'
    params:
      template: 'file_summary'
      data: '${previous.stats}'
      output: '.ai_workflow/reports/file-analysis.md'
```

### Run

```bash
ai-workflow run file-analysis.yaml
```

### Expected Output

```
🚀 Starting workflow: Simple File Analysis
✅ Step 1: Scan Source Directory [PASSED] (0.5s)
   Found 42 files
✅ Step 2: Count Lines [PASSED] (0.3s)
   Total lines: 3,547
✅ Step 3: Generate Report [PASSED] (0.1s)
   Report saved to .ai_workflow/reports/file-analysis.md
🎉 Workflow completed successfully!
```

---

## Example 2: Code Quality Check

Run linters and tests, then generate a quality report.

### Workflow File

`quality-check.yaml`:

```yaml
name: 'Code Quality Check'
description: 'Run linters and tests to check code quality'
version: '1.0.0'

steps:
  - name: 'Run Linter'
    action: 'execute_command'
    params:
      command: 'npm run lint'
      capture_output: true
      continue_on_error: false

  - name: 'Run Tests'
    action: 'execute_command'
    params:
      command: 'npm test'
      capture_output: true
      continue_on_error: false

  - name: 'Check Coverage'
    action: 'execute_command'
    params:
      command: 'npm run test:coverage'
      capture_output: true

  - name: 'Generate Quality Report'
    action: 'generate_report'
    params:
      template: 'quality_summary'
      data:
        lint: '${steps[0].output}'
        tests: '${steps[1].output}'
        coverage: '${steps[2].output}'
      output: '.ai_workflow/reports/quality-check.md'
```

### Run

```bash
ai-workflow run quality-check.yaml
```

### Expected Output

```
🚀 Starting workflow: Code Quality Check
✅ Step 1: Run Linter [PASSED] (3.2s)
   ✅ No linting errors
✅ Step 2: Run Tests [PASSED] (12.5s)
   ✅ 247 tests passed
✅ Step 3: Check Coverage [PASSED] (5.1s)
   ✅ Coverage: 87.3% (target: 80%)
✅ Step 4: Generate Quality Report [PASSED] (0.2s)
   Report saved to .ai_workflow/reports/quality-check.md
🎉 Workflow completed successfully!
```

---

## Example 3: Documentation Generator

Generate documentation from source code comments.

### Workflow File

`generate-docs.yaml`:

```yaml
name: 'Documentation Generator'
description: 'Extract documentation from source code'
version: '1.0.0'

steps:
  - name: 'Scan Source Files'
    action: 'file_scan'
    params:
      directory: 'src'
      patterns:
        - '**/*.js'
      exclude:
        - '**/*.test.js'

  - name: 'Extract JSDoc Comments'
    action: 'extract_comments'
    params:
      files: '${previous.files}'
      format: 'jsdoc'

  - name: 'Generate API Documentation'
    action: 'generate_markdown'
    params:
      data: '${previous.comments}'
      template: 'api_reference'
      output: 'docs/api/generated/'

  - name: 'Generate Index'
    action: 'generate_index'
    params:
      directory: 'docs/api/generated/'
      output: 'docs/api/INDEX.md'
```

### Run

```bash
ai-workflow run generate-docs.yaml
```

### Expected Output

```
🚀 Starting workflow: Documentation Generator
✅ Step 1: Scan Source Files [PASSED] (0.4s)
   Found 35 source files
✅ Step 2: Extract JSDoc Comments [PASSED] (1.2s)
   Extracted 142 documented functions
✅ Step 3: Generate API Documentation [PASSED] (2.1s)
   Generated 35 documentation files
✅ Step 4: Generate Index [PASSED] (0.3s)
   Created INDEX.md with 142 entries
🎉 Workflow completed successfully!
```

---

## Example 4: Git Pre-commit Hook

Validate code before committing.

### Workflow File

`pre-commit.yaml`:

```yaml
name: 'Pre-commit Validation'
description: 'Validate code before commit'
version: '1.0.0'

steps:
  - name: 'Check Staged Files'
    action: 'git_status'
    params:
      staged_only: true

  - name: 'Run Linter on Staged'
    action: 'execute_command'
    params:
      command: 'eslint ${previous.files}'
      continue_on_error: false

  - name: 'Run Tests'
    action: 'execute_command'
    params:
      command: 'npm test -- --bail'
      continue_on_error: false

  - name: 'Check Commit Message'
    action: 'validate_commit_message'
    params:
      format: 'conventional'
```

### Install as Git Hook

```bash
# Copy workflow to .git/hooks/
cp pre-commit.yaml .git/hooks/pre-commit-workflow.yaml

# Create hook script
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
ai-workflow run .git/hooks/pre-commit-workflow.yaml
EOF

chmod +x .git/hooks/pre-commit
```

### Run

```bash
git commit -m "feat: add new feature"
# Workflow runs automatically
```

---

## Example 5: Environment Setup

Set up development environment.

### Workflow File

`setup-env.yaml`:

```yaml
name: 'Environment Setup'
description: 'Set up development environment'
version: '1.0.0'

steps:
  - name: 'Check Node.js Version'
    action: 'check_version'
    params:
      command: 'node --version'
      required: '>=20.0.0'

  - name: 'Install Dependencies'
    action: 'execute_command'
    params:
      command: 'npm install'

  - name: 'Initialize Git Hooks'
    action: 'execute_command'
    params:
      command: 'npx husky install'

  - name: 'Create Directories'
    action: 'create_directories'
    params:
      directories:
        - '.ai_workflow/logs'
        - '.ai_workflow/reports'
        - '.ai_workflow/cache'

  - name: 'Copy Config Template'
    action: 'copy_file'
    params:
      source: '.workflow_core/config/.workflow-config.yaml.template'
      dest: '.workflow-config.yaml'
      overwrite: false
```

### Run

```bash
ai-workflow run setup-env.yaml
```

### Expected Output

```
🚀 Starting workflow: Environment Setup
✅ Step 1: Check Node.js Version [PASSED] (0.1s)
   Node.js v18.17.0 (>= 20.0.0)
✅ Step 2: Install Dependencies [PASSED] (8.3s)
   Installed 247 packages
✅ Step 3: Initialize Git Hooks [PASSED] (0.5s)
   Husky initialized
✅ Step 4: Create Directories [PASSED] (0.1s)
   Created 3 directories
✅ Step 5: Copy Config Template [PASSED] (0.1s)
   Configuration template copied
🎉 Workflow completed successfully!
```

---

## Running Examples

### Prerequisites

- Node.js >= 20.0.0
- AI Workflow Automation installed
- Project initialized with `.workflow-config.yaml`

### Quick Start

```bash
# Clone repository
git clone https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js

# Install dependencies
npm install

# Run example
ai-workflow run docs/examples/basic/file-analysis.yaml
```

### Customizing Examples

1. Copy example workflow file
2. Modify parameters to match your project
3. Test with `--dry-run` flag
4. Run workflow

```bash
cp docs/examples/basic/quality-check.yaml my-quality-check.yaml
vi my-quality-check.yaml  # Edit as needed
ai-workflow run --dry-run my-quality-check.yaml
ai-workflow run my-quality-check.yaml
```

---

## Next Steps

- **[Advanced Examples](../advanced/)** - Complex workflows
- **[Integration Examples](../integration/)** - CI/CD integration
- **[User Guide](../../guides/USER_GUIDE.md)** - Building custom workflows

---

**Last Updated:** 2026-02-01
**Version:** 1.0.0

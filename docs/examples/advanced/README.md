# Advanced Examples

**AI Workflow Automation v1.0.0**  
**Last Updated:** 2026-02-01

---

## Overview

Advanced workflow examples demonstrating complex features, error handling, conditional logic, and parallel execution.

---

## Example 1: Multi-Stage Release Pipeline

Complete release pipeline with versioning, testing, building, and deployment.

### Workflow

```yaml
name: 'Release Pipeline'
description: 'Complete release workflow with validation and deployment'
version: '2.0.0'

variables:
  version: '${project.version}'
  build_dir: 'dist'
  test_coverage_threshold: 80

stages:
  - name: 'Validation'
    steps:
      - name: 'Validate Configuration'
        action: 'validate_config'

      - name: 'Check Dependencies'
        action: 'execute_command'
        params:
          command: 'npm audit'
          fail_on_error: true

  - name: 'Testing'
    parallel: true
    steps:
      - name: 'Unit Tests'
        action: 'execute_command'
        params:
          command: 'npm run test:unit'

      - name: 'Integration Tests'
        action: 'execute_command'
        params:
          command: 'npm run test:integration'

      - name: 'Linting'
        action: 'execute_command'
        params:
          command: 'npm run lint'

  - name: 'Build'
    steps:
      - name: 'Clean Build Directory'
        action: 'clean_directory'
        params:
          path: '${variables.build_dir}'

      - name: 'Build Application'
        action: 'execute_command'
        params:
          command: 'npm run build'
          timeout: 300

      - name: 'Verify Build Output'
        action: 'file_exists'
        params:
          paths:
            - '${variables.build_dir}/index.js'
            - '${variables.build_dir}/package.json'

  - name: 'Deployment'
    condition: "${stages.Build.status == 'success'}"
    steps:
      - name: 'Create Git Tag'
        action: 'git_tag'
        params:
          tag: 'v${variables.version}'
          message: 'Release ${variables.version}'

      - name: 'Publish to npm'
        action: 'execute_command'
        params:
          command: 'npm publish'
          env:
            NPM_TOKEN: '${secrets.NPM_TOKEN}'
```

**Run:**

```bash
ai-workflow run release-pipeline.yaml --auto
```

---

## Example 2: Error Recovery Workflow

Demonstrates error handling, retries, and fallback strategies.

### Workflow

```yaml
name: 'Resilient Data Processing'
description: 'Data processing with error recovery'
version: '1.0.0'

error_handling:
  default_retry: 3
  retry_delay: 5000
  on_error: 'continue'

steps:
  - name: 'Fetch Data from API'
    action: 'http_request'
    params:
      url: 'https://api.example.com/data'
      method: 'GET'
      timeout: 10000
    retry:
      max_attempts: 5
      backoff: 'exponential'
    fallback:
      action: 'load_cached_data'
      params:
        cache_file: '.ai_workflow/cache/data.json'

  - name: 'Process Data'
    action: 'custom_processor'
    params:
      data: '${previous.data}'
      validate: true
    error_handler:
      on_validation_error:
        action: 'log_and_skip'
      on_processing_error:
        action: 'retry_with_reduced_batch'

  - name: 'Save Results'
    action: 'save_to_database'
    params:
      data: '${previous.results}'
      connection: '${config.database.connection}'
    retry:
      max_attempts: 3
      on_retry:
        action: 'reconnect_database'
```

---

## Example 3: Conditional Workflow

Dynamic workflow based on conditions and environment.

### Workflow

```yaml
name: 'Conditional Deployment'
description: 'Deploy to different environments based on branch'
version: '1.0.0'

variables:
  branch: '${git.branch}'
  environment: |
    ${branch == 'main' ? 'production' : 
      branch == 'develop' ? 'staging' : 
      'development'}

steps:
  - name: 'Determine Environment'
    action: 'set_variable'
    params:
      env: '${variables.environment}'

  - name: 'Run Tests'
    action: 'execute_command'
    params:
      command: |
        ${variables.env == 'production' ? 'npm run test:full' : 'npm test'}

  - name: 'Build for Production'
    condition: "${variables.env == 'production'}"
    action: 'execute_command'
    params:
      command: 'npm run build:production'

  - name: 'Build for Staging'
    condition: "${variables.env == 'staging'}"
    action: 'execute_command'
    params:
      command: 'npm run build:staging'

  - name: 'Deploy'
    action: 'deploy'
    params:
      environment: '${variables.env}'
      config: 'deploy/${variables.env}.yaml'
      skip_validation: "${variables.env != 'production'}"
```

---

## Example 4: Parallel Processing Pipeline

Process multiple tasks in parallel with synchronization.

### Workflow

```yaml
name: 'Parallel Processing'
description: 'Process multiple data sources in parallel'
version: '1.0.0'

steps:
  - name: 'Initialize'
    action: 'setup'
    params:
      create_temp_dirs: true

  - name: 'Parallel Data Ingestion'
    parallel: true
    max_concurrent: 4
    tasks:
      - name: 'Ingest Database A'
        action: 'ingest_data'
        params:
          source: 'database_a'
          output: 'temp/data_a.json'

      - name: 'Ingest Database B'
        action: 'ingest_data'
        params:
          source: 'database_b'
          output: 'temp/data_b.json'

      - name: 'Ingest API Data'
        action: 'fetch_api'
        params:
          url: 'https://api.example.com'
          output: 'temp/api_data.json'

      - name: 'Ingest File Data'
        action: 'read_files'
        params:
          pattern: 'data/**/*.csv'
          output: 'temp/file_data.json'

  - name: 'Wait for All Tasks'
    action: 'barrier'
    params:
      wait_for: 'all'
      timeout: 300

  - name: 'Merge Data'
    action: 'merge_datasets'
    params:
      inputs:
        - 'temp/data_a.json'
        - 'temp/data_b.json'
        - 'temp/api_data.json'
        - 'temp/file_data.json'
      output: 'merged_data.json'

  - name: 'Parallel Analysis'
    parallel: true
    tasks:
      - name: 'Statistical Analysis'
        action: 'analyze_statistics'
        params:
          data: 'merged_data.json'

      - name: 'Trend Analysis'
        action: 'analyze_trends'
        params:
          data: 'merged_data.json'

      - name: 'Anomaly Detection'
        action: 'detect_anomalies'
        params:
          data: 'merged_data.json'
```

---

## Example 5: AI-Assisted Code Review

Workflow using AI for automated code review.

### Workflow

```yaml
name: 'AI Code Review'
description: 'Automated code review with AI assistance'
version: '1.0.0'

ai_config:
  provider: 'openai'
  model: 'gpt-4'
  temperature: 0.3

steps:
  - name: 'Get Changed Files'
    action: 'git_diff'
    params:
      base: 'main'
      target: 'HEAD'
      output: 'files'

  - name: 'Filter Code Files'
    action: 'filter_files'
    params:
      files: '${previous.files}'
      patterns:
        - '**/*.js'
        - '**/*.ts'
      exclude:
        - '**/*.test.js'
        - '**/*.spec.ts'

  - name: 'AI Code Review'
    parallel: true
    max_concurrent: 3
    foreach: '${previous.files}'
    action: 'ai_review_file'
    params:
      file: '${item}'
      diff: '${git.diff(item)}'
      prompt: |
        Review this code change for:
        - Bugs and logic errors
        - Security vulnerabilities
        - Performance issues
        - Best practice violations

        Provide specific, actionable feedback.

  - name: 'Aggregate Reviews'
    action: 'aggregate_results'
    params:
      reviews: '${previous.results}'
      output: '.ai_workflow/reports/code-review.md'

  - name: 'Post Review Comments'
    condition: '${config.post_to_pr}'
    action: 'github_comment'
    params:
      pr_number: '${git.pr_number}'
      body: '${previous.summary}'
```

---

## Running Advanced Examples

### Prerequisites

- Node.js >= 18.0.0
- AI Workflow Automation >= 1.0.0
- Additional dependencies (varies by example)

### Execution

```bash
# Run with verbose output
ai-workflow run --verbose advanced-workflow.yaml

# Run in auto mode
ai-workflow run --auto advanced-workflow.yaml

# Dry run (preview only)
ai-workflow run --dry-run advanced-workflow.yaml
```

---

## Next Steps

- **[Integration Examples](../integration/)** - CI/CD workflows
- **[Developer Guide](../../guides/DEVELOPER_GUIDE.md)** - Custom actions
- **[API Documentation](../../api/)** - Module reference

---

**Last Updated:** 2026-02-01  
**Version:** 1.0.0

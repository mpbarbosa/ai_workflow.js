# Configuration Schema Reference

**AI Workflow Automation v1.7.2**
**Last Updated:** 2026-02-01
**Audience:** Developers, DevOps Engineers

---

## Table of Contents

- [Overview](#overview)
- [Schema Structure](#schema-structure)
- [Project Section](#project-section)
- [Tech Stack Section](#tech-stack-section)
- [Structure Section](#structure-section)
- [Workflow Section](#workflow-section)
- [AI Helpers Section](#ai-helpers-section)
- [Performance Section](#performance-section)
- [Security Section](#security-section)
- [Validation Rules](#validation-rules)

---

## Overview

This document provides the complete JSON Schema for `.workflow-config.yaml` configuration files.

### Schema Version

- **Schema Version:** 1.0.0
- **Specification:** YAML 1.2
- **Validation:** JSON Schema Draft 7

---

## Schema Structure

### Root Schema

```yaml
type: object
required:
  - project
  - tech_stack
  - structure
properties:
  project:
    $ref: '#/definitions/Project'
  tech_stack:
    $ref: '#/definitions/TechStack'
  structure:
    $ref: '#/definitions/Structure'
  workflow:
    $ref: '#/definitions/Workflow'
  ai_helpers:
    $ref: '#/definitions/AIHelpers'
  performance:
    $ref: '#/definitions/Performance'
  security:
    $ref: '#/definitions/Security'
```

---

## Project Section

### Schema Definition

```yaml
Project:
  type: object
  required:
    - name
    - type
    - kind
    - version
  properties:
    name:
      type: string
      description: Human-readable project name
      minLength: 1
      maxLength: 100
      examples:
        - 'My Application'
        - 'Data Processing Service'

    type:
      type: string
      description: Project type (hyphenated)
      pattern: ^[a-z]+(-[a-z]+)*$
      examples:
        - 'nodejs-application'
        - 'react-spa'
        - 'python-app'

    kind:
      type: string
      description: Project kind for validation
      enum:
        - shell_script_automation
        - nodejs_api
        - client_spa
        - react_spa
        - static_website
        - python_app
        - configuration_library
        - generic

    version:
      type: string
      description: Semantic version (no 'v' prefix)
      pattern: ^\d+\.\d+\.\d+(-[a-z0-9.]+)?(\+[a-z0-9.]+)?$
      examples:
        - '1.0.0'
        - '2.1.3-beta.1'
        - '3.0.0+20210101'

    description:
      type: string
      description: Brief project description
      minLength: 10
      maxLength: 500
      examples:
        - 'RESTful API for user management'
```

### Example

```yaml
project:
  name: 'User Management API'
  type: 'nodejs-application'
  kind: 'nodejs_api'
  version: '1.0.0'
  description: 'RESTful API for user authentication and management'
```

---

## Tech Stack Section

### Schema Definition

```yaml
TechStack:
  type: object
  required:
    - primary_language
    - test_command
  properties:
    primary_language:
      type: string
      description: Primary programming language
      enum:
        - javascript
        - typescript
        - python
        - bash
        - go
        - rust
        - java
        - csharp
        - ruby
        - php

    framework:
      type: string
      description: Framework in use
      examples:
        - 'express'
        - 'react'
        - 'flask'
        - 'spring'

    build_system:
      type: string
      description: Build system / package manager
      enum:
        - npm
        - yarn
        - pnpm
        - webpack
        - vite
        - maven
        - gradle
        - pip
        - cargo
        - none

    test_framework:
      type: string
      description: Testing framework
      examples:
        - 'jest'
        - 'mocha'
        - 'pytest'
        - 'junit'

    test_command:
      type: string
      description: Command to run tests
      minLength: 1
      examples:
        - 'npm test'
        - 'pytest'
        - './run_tests.sh'

    lint_command:
      type: string
      description: Command to run linter
      examples:
        - 'eslint .'
        - 'pylint src/'

    coverage_threshold:
      type: integer
      description: Minimum code coverage percentage
      minimum: 0
      maximum: 100
      default: 80

    databases:
      type: array
      description: Database systems in use
      items:
        type: string
        enum:
          - postgresql
          - mysql
          - mongodb
          - redis
          - sqlite
          - cassandra
          - elasticsearch

    secondary_languages:
      type: array
      description: Additional languages
      items:
        type: string
```

### Example

```yaml
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
  secondary_languages:
    - typescript
    - html
    - css
```

---

## Structure Section

### Schema Definition

```yaml
Structure:
  type: object
  required:
    - source_dirs
  properties:
    source_dirs:
      type: array
      description: Source code directories
      minItems: 1
      items:
        type: string
        pattern: ^[a-zA-Z0-9_/-]+$
      examples:
        - ['src']
        - ['src', 'lib']

    test_dirs:
      type: array
      description: Test directories
      items:
        type: string
      examples:
        - ['test']
        - ['tests', '__tests__']

    docs_dirs:
      type: array
      description: Documentation directories
      items:
        type: string
      default:
        - docs

    config_files:
      type: array
      description: Configuration files
      items:
        type: string
      examples:
        - ['package.json', '.eslintrc.json']

    exclude_patterns:
      type: array
      description: Glob patterns to exclude
      items:
        type: string
        pattern: ^[a-zA-Z0-9_/*.-]+$
      default:
        - 'node_modules/**'
        - '.git/**'
        - 'dist/**'
        - 'build/**'
        - 'coverage/**'

    artifact_dir:
      type: string
      description: Directory for workflow artifacts
      pattern: ^\.?[a-zA-Z0-9_-]+$
      default: '.ai_workflow'
```

### Example

```yaml
structure:
  source_dirs:
    - src
    - lib
  test_dirs:
    - test
  docs_dirs:
    - docs
  config_files:
    - package.json
    - .eslintrc.json
    - tsconfig.json
  exclude_patterns:
    - 'node_modules/**'
    - 'dist/**'
    - 'coverage/**'
  artifact_dir: '.ai_workflow'
```

---

## Workflow Section

### Schema Definition

```yaml
Workflow:
  type: object
  properties:
    mode:
      type: string
      description: Execution mode
      enum:
        - auto
        - interactive
      default: 'interactive'

    log_level:
      type: string
      description: Logging level
      enum:
        - debug
        - info
        - warn
        - error
      default: 'info'

    log_to_file:
      type: boolean
      description: Enable file logging
      default: true

    log_file:
      type: string
      description: Log file path
      default: '.ai_workflow/logs/workflow.log'

    colorize:
      type: boolean
      description: Enable colored output
      default: true

    continue_on_error:
      type: boolean
      description: Continue workflow on step failure
      default: false

    max_retries:
      type: integer
      description: Maximum retries per step
      minimum: 0
      maximum: 10
      default: 3

    step_timeout:
      type: integer
      description: Timeout per step (seconds)
      minimum: 10
      maximum: 3600
      default: 300

    collect_metrics:
      type: boolean
      description: Enable metrics collection
      default: true

    save_metrics:
      type: boolean
      description: Save metrics to file
      default: true

    steps:
      type: object
      description: Enable/disable step types
      properties:
        file_operations:
          type: boolean
          default: true
        git_operations:
          type: boolean
          default: true
        ai_integration:
          type: boolean
          default: true
        validation:
          type: boolean
          default: true
        reporting:
          type: boolean
          default: true
```

### Example

```yaml
workflow:
  mode: 'interactive'
  log_level: 'info'
  log_to_file: true
  colorize: true
  continue_on_error: false
  max_retries: 3
  step_timeout: 300
  collect_metrics: true
  save_metrics: true
  steps:
    file_operations: true
    git_operations: true
    ai_integration: true
    validation: true
    reporting: true
```

---

## AI Helpers Section

### Schema Definition

```yaml
AIHelpers:
  type: object
  properties:
    enabled:
      type: boolean
      description: Enable AI helpers
      default: true

    helpers:
      type: array
      description: Helpers to load
      items:
        type: string
        pattern: ^step[0-9][a-z]_[a-z_]+$
      examples:
        - 'step0b_documentation_generation'
        - 'step1a_initial_analysis'

    helper_config:
      type: object
      description: Helper-specific configuration
      additionalProperties: true

    prompts:
      type: object
      description: Custom prompt configuration
      properties:
        analysis:
          type: object
          properties:
            system:
              type: string
            user_prefix:
              type: string
        documentation:
          type: object
          properties:
            system:
              type: string
            user_prefix:
              type: string
```

### Example

```yaml
ai_helpers:
  enabled: true
  helpers:
    - step0b_documentation_generation
    - step1a_initial_analysis
    - step2a_comprehensive_analysis
  helper_config:
    step0b_documentation_generation:
      style: 'technical'
      audience: 'developers'
      format: 'markdown'
  prompts:
    analysis:
      system: 'You are a code analysis expert...'
      user_prefix: 'Analyze the following code:'
```

---

## Performance Section

### Schema Definition

```yaml
Performance:
  type: object
  properties:
    enable_cache:
      type: boolean
      description: Enable caching
      default: true

    cache_ttl:
      type: integer
      description: Cache TTL (seconds)
      minimum: 60
      maximum: 86400
      default: 3600

    max_parallel:
      type: integer
      description: Maximum parallel operations
      minimum: 1
      maximum: 16
      default: 4

    memory_limit:
      type: integer
      description: Memory limit (MB)
      minimum: 128
      maximum: 8192
      default: 512
```

### Example

```yaml
performance:
  enable_cache: true
  cache_ttl: 3600
  max_parallel: 4
  memory_limit: 512
```

---

## Security Section

### Schema Definition

```yaml
Security:
  type: object
  properties:
    validate_checksums:
      type: boolean
      description: Validate file checksums
      default: true

    allow_external_commands:
      type: boolean
      description: Allow external command execution
      default: false

    command_whitelist:
      type: array
      description: Whitelisted commands
      items:
        type: string
      examples:
        - ['git', 'npm', 'node']
```

### Example

```yaml
security:
  validate_checksums: true
  allow_external_commands: false
  command_whitelist:
    - git
    - npm
    - node
```

---

## Validation Rules

### Required Fields

```yaml
# These fields are mandatory
project:
  name: ✅ Required
  type: ✅ Required
  kind: ✅ Required
  version: ✅ Required

tech_stack:
  primary_language: ✅ Required
  test_command: ✅ Required

structure:
  source_dirs: ✅ Required (min 1 item)
```

### Field Constraints

**String Length:**

```yaml
project.name:
  minLength: 1
  maxLength: 100

project.description:
  minLength: 10
  maxLength: 500
```

**Integer Ranges:**

```yaml
tech_stack.coverage_threshold:
  minimum: 0
  maximum: 100

workflow.max_retries:
  minimum: 0
  maximum: 10

workflow.step_timeout:
  minimum: 10
  maximum: 3600

performance.cache_ttl:
  minimum: 60
  maximum: 86400
```

**Pattern Matching:**

```yaml
project.type:
  pattern: ^[a-z]+(-[a-z]+)*$ # lowercase-with-hyphens

project.version:
  pattern: ^\d+\.\d+\.\d+(-[a-z0-9.]+)?(\+[a-z0-9.]+)?$ # semver
```

### Enum Values

**Project Kinds:**

```yaml
- shell_script_automation
- nodejs_api
- client_spa
- react_spa
- static_website
- python_app
- configuration_library
- generic
```

**Languages:**

```yaml
- javascript
- typescript
- python
- bash
- go
- rust
- java
- csharp
- ruby
- php
```

**Build Systems:**

```yaml
- npm
- yarn
- pnpm
- webpack
- vite
- maven
- gradle
- pip
- cargo
- none
```

---

## Complete Example

```yaml
# Complete .workflow-config.yaml example with all sections

project:
  name: 'User Management API'
  type: 'nodejs-application'
  kind: 'nodejs_api'
  version: '1.0.0'
  description: 'RESTful API for user authentication and management'

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
  exclude_patterns:
    - 'node_modules/**'
    - 'dist/**'
    - 'coverage/**'

workflow:
  mode: 'interactive'
  log_level: 'info'
  continue_on_error: false
  max_retries: 3
  step_timeout: 300
  collect_metrics: true

ai_helpers:
  enabled: true
  helpers:
    - step1a_initial_analysis
    - step2a_comprehensive_analysis

performance:
  enable_cache: true
  cache_ttl: 3600
  max_parallel: 4

security:
  validate_checksums: true
  allow_external_commands: false
  command_whitelist:
    - git
    - npm
    - node
```

---

## Additional Resources

- **[Configuration Guide](../guides/CONFIGURATION_GUIDE.md)** - User guide
- **[API Documentation](../api/lib/config.md)** - Config module reference

---

**Last Updated:** 2026-02-01
**Version:** 1.7.2

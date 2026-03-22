# Integration Examples

**AI Workflow Automation v1.9.0**
**Last Updated:** 2026-02-01

---

## Overview

Integration examples for CI/CD platforms, version control systems, and development tools.

---

## Example 1: GitHub Actions Integration

Complete CI/CD pipeline with GitHub Actions.

### `.github/workflows/ci.yml`

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Dependencies
        run: npm ci

      - name: Run AI Workflow Validation
        run: |
          ai-workflow validate --strict

      - name: Run Quality Checks
        run: |
          ai-workflow run .github/workflows/quality-check.yaml --auto

      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: quality-reports
          path: .ai_workflow/reports/

  test:
    needs: validate
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - run: npm ci

      - name: Run Tests with AI Workflow
        run: |
          ai-workflow run workflows/test-suite.yaml --auto

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [validate, test]
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - run: npm ci

      - name: Deploy with AI Workflow
        run: |
          ai-workflow run workflows/deploy-production.yaml --auto
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

---

## Example 2: GitLab CI Integration

`.gitlab-ci.yml` pipeline configuration.

```yaml
variables:
  NODE_VERSION: '18'

stages:
  - validate
  - test
  - build
  - deploy

before_script:
  - npm ci
  - npm install -g ai-workflow

validate:
  stage: validate
  image: node:${NODE_VERSION}
  script:
    - ai-workflow validate --strict
    - ai-workflow run workflows/code-quality.yaml --auto
  artifacts:
    reports:
      junit: .ai_workflow/reports/junit.xml
    paths:
      - .ai_workflow/reports/

test:
  stage: test
  image: node:${NODE_VERSION}
  parallel:
    matrix:
      - NODE_VERSION: ['18', '20']
  script:
    - ai-workflow run workflows/test-suite.yaml --auto
  coverage: '/Coverage: \d+\.\d+%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  image: node:${NODE_VERSION}
  script:
    - ai-workflow run workflows/build-app.yaml --auto
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

deploy_staging:
  stage: deploy
  image: node:${NODE_VERSION}
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - ai-workflow run workflows/deploy-staging.yaml --auto
  only:
    - develop

deploy_production:
  stage: deploy
  image: node:${NODE_VERSION}
  environment:
    name: production
    url: https://example.com
  script:
    - ai-workflow run workflows/deploy-production.yaml --auto
  only:
    - main
  when: manual
```

---

## Example 3: Jenkins Pipeline

`Jenkinsfile` for Jenkins CI/CD.

```groovy
pipeline {
    agent any

    environment {
        NODE_VERSION = '18'
        WORKFLOW_CONFIG = '.workflow-config.yaml'
    }

    stages {
        stage('Setup') {
            steps {
                script {
                    nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                        sh 'npm ci'
                        sh 'npm install -g ai-workflow'
                    }
                }
            }
        }

        stage('Validate') {
            steps {
                script {
                    nodejs(nodeJSInstallationName: "Node ${NODE_VERSION}") {
                        sh 'ai-workflow validate --strict'
                    }
                }
            }
        }

        stage('Quality Check') {
            parallel {
                stage('Linting') {
                    steps {
                        sh 'ai-workflow run workflows/lint.yaml --auto'
                    }
                }
                stage('Tests') {
                    steps {
                        sh 'ai-workflow run workflows/test-suite.yaml --auto'
                    }
                }
                stage('Security Scan') {
                    steps {
                        sh 'ai-workflow run workflows/security-scan.yaml --auto'
                    }
                }
            }
        }

        stage('Build') {
            steps {
                sh 'ai-workflow run workflows/build-app.yaml --auto'
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                sh 'ai-workflow run workflows/deploy-staging.yaml --auto'
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to production?', ok: 'Deploy'
                sh 'ai-workflow run workflows/deploy-production.yaml --auto'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: '.ai_workflow/reports/**/*', allowEmptyArchive: true
            junit testResults: '.ai_workflow/reports/junit.xml', allowEmptyResults: true
        }
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed!'
            sh 'ai-workflow metrics --export=.ai_workflow/reports/failure-metrics.json'
        }
    }
}
```

---

## Example 4: Docker Integration

Build and test within Docker containers.

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - WORKFLOW_CONFIG=/app/.workflow-config.yaml
    command: ai-workflow run workflows/dev-workflow.yaml --watch

  test:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - .:/app
    environment:
      - NODE_ENV=test
    command: ai-workflow run workflows/test-suite.yaml --auto

  ci:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - .:/app
    environment:
      - NODE_ENV=production
    command: |
      sh -c "
        ai-workflow validate --strict &&
        ai-workflow run workflows/quality-check.yaml --auto &&
        ai-workflow run workflows/test-suite.yaml --auto &&
        ai-workflow run workflows/build-app.yaml --auto
      "
```

### `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install AI Workflow CLI
RUN npm install -g ai-workflow

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Default command
CMD ["ai-workflow", "run", "workflows/default.yaml"]
```

**Usage:**

```bash
# Run CI pipeline in Docker
docker-compose run --rm ci

# Run tests
docker-compose run --rm test

# Development with watch mode
docker-compose up app
```

---

## Example 5: Pre-commit Hook Integration

Integrate with Husky for Git hooks.

### `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Run AI Workflow validation
ai-workflow run .husky/workflows/pre-commit.yaml --auto

# Check exit code
if [ $? -ne 0 ]; then
  echo "❌ Pre-commit checks failed!"
  echo "Run 'ai-workflow status' to see details"
  exit 1
fi

echo "✅ Pre-commit checks passed!"
```

### `.husky/workflows/pre-commit.yaml`

```yaml
name: 'Pre-commit Validation'
description: 'Validate changes before commit'
version: '1.0.0'

steps:
  - name: 'Get Staged Files'
    action: 'git_staged_files'
    params:
      patterns:
        - '**/*.js'
        - '**/*.ts'

  - name: 'Run Linter on Staged Files'
    condition: '${previous.files.length > 0}'
    action: 'execute_command'
    params:
      command: "eslint ${previous.files.join(' ')}"

  - name: 'Run Formatter'
    condition: '${previous.files.length > 0}'
    action: 'execute_command'
    params:
      command: "prettier --write ${previous.files.join(' ')}"

  - name: 'Run Tests'
    action: 'execute_command'
    params:
      command: "npm test -- --bail --findRelatedTests ${steps[0].files.join(' ')}"
```

**Setup:**

```bash
# Install Husky
npm install --save-dev husky

# Initialize Husky
npx husky install

# Create pre-commit hook
npx husky add .husky/pre-commit "ai-workflow run .husky/workflows/pre-commit.yaml --auto"

chmod +x .husky/pre-commit
```

---

## Example 6: VS Code Integration

Integrate with VS Code tasks and launch configurations.

### `.vscode/tasks.json`

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "AI Workflow: Validate",
      "type": "shell",
      "command": "ai-workflow",
      "args": ["validate", "--strict"],
      "problemMatcher": []
    },
    {
      "label": "AI Workflow: Run Quality Check",
      "type": "shell",
      "command": "ai-workflow",
      "args": ["run", "workflows/quality-check.yaml"],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "AI Workflow: Run Tests",
      "type": "shell",
      "command": "ai-workflow",
      "args": ["run", "workflows/test-suite.yaml", "--watch"],
      "isBackground": true
    },
    {
      "label": "AI Workflow: Generate Docs",
      "type": "shell",
      "command": "ai-workflow",
      "args": ["run", "workflows/generate-docs.yaml", "--auto"]
    }
  ]
}
```

### `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug AI Workflow",
      "program": "${workspaceFolder}/node_modules/.bin/ai-workflow",
      "args": ["run", "${file}", "--verbose"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Best Practices for Integration

### 1. Environment-Specific Configurations

Use different configs for different environments:

```bash
# Development
ai-workflow --config=.workflow-config.dev.yaml run

# Staging
ai-workflow --config=.workflow-config.staging.yaml run

# Production
ai-workflow --config=.workflow-config.prod.yaml run
```

### 2. Secrets Management

Never commit secrets. Use environment variables:

```yaml
steps:
  - name: 'Deploy'
    action: 'deploy'
    params:
      api_key: '${env.DEPLOY_API_KEY}'
      secret: '${secrets.DEPLOY_SECRET}'
```

### 3. Artifact Retention

Configure artifact cleanup:

```yaml
workflow:
  artifacts:
    retention_days: 7
    cleanup_on_success: true
    cleanup_on_failure: false
```

### 4. Notifications

Send notifications on completion:

```yaml
on_complete:
  - action: 'notify_slack'
    params:
      webhook: '${env.SLACK_WEBHOOK}'
      message: 'Workflow ${workflow.name} completed with status ${workflow.status}'

on_failure:
  - action: 'notify_email'
    params:
      to: 'team@example.com'
      subject: 'Workflow Failed: ${workflow.name}'
```

---

## Additional Resources

- **[Basic Examples](../basic/)** - Getting started
- **[Advanced Examples](../advanced/)** - Complex workflows
- **[User Guide](../../guides/USER_GUIDE.md)** - Workflow building
- **[CI/CD Guide](../../guides/DEVELOPER_GUIDE.md#cicd-integration)** - Integration patterns

---

**Last Updated:** 2026-02-01
**Version:** 1.9.0

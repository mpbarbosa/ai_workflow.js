# User Guide

**AI Workflow Automation v1.8.0**
**Last Updated:** 2026-02-01
**Audience:** End users building workflows

---

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Building Your First Workflow](#building-your-first-workflow)
- [Core Concepts](#core-concepts)
- [Common Workflows](#common-workflows)
- [Configuration](#configuration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

---

## Introduction

Welcome to AI Workflow Automation! This guide will help you build automated workflows for your software development projects using Node.js.

### What Can You Build?

- **Project Analyzers** - Detect project types, analyze tech stacks
- **Code Quality Tools** - Linters, formatters, validators
- **Documentation Generators** - Automated docs from code
- **Build Pipelines** - Custom build and deployment workflows
- **Testing Frameworks** - Test generation and execution
- **File Processors** - Batch file operations

### Prerequisites

- Node.js 20.0.0 or higher
- Basic JavaScript knowledge
- Familiarity with command line

---

## Installation

See [INSTALLATION.md](../getting-started/INSTALLATION.md) for detailed installation instructions.

**Quick Install:**

```bash
# Clone repository
git clone https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js

# Install dependencies
npm install

# Verify installation
npm test
```

---

## Quick Start

### 5-Minute Quickstart

See [QUICK_START.md](../getting-started/QUICK_START.md) for a 5-minute introduction to the framework.

**Basic Example:**

```javascript
import { logger } from './src/core/logger.js';
import { FileOperations } from './src/lib/file_operations.js';

const fileOps = new FileOperations();

// Read file
const content = await fileOps.readFile('./README.md');
logger.info(`File size: ${content.length} bytes`);

// List files
const files = await fileOps.listFiles('./src');
logger.success(`Found ${files.length} files`);
```

---

## Building Your First Workflow

### Step-by-Step Tutorial

See [FIRST_WORKFLOW.md](../getting-started/FIRST_WORKFLOW.md) for a comprehensive tutorial on building a complete workflow.

**Workflow Structure:**

```javascript
// workflow.js

import { logger } from './src/core/logger.js';
import { Config } from './src/lib/config.js';
import { FileOperations } from './src/lib/file_operations.js';

async function main() {
  try {
    // 1. Initialize
    logger.info('Starting workflow...');
    const config = new Config(process.cwd());
    await config.initialize();

    // 2. Execute workflow steps
    await step1();
    await step2();
    await step3();

    // 3. Complete
    logger.success('Workflow complete!');
  } catch (error) {
    logger.error(`Workflow failed: ${error.message}`);
    process.exit(1);
  }
}

async function step1() {
  logger.info('Step 1: Analyzing project...');
  // Your logic here
}

// Run workflow
main();
```

---

## Core Concepts

### Modules Overview

The framework provides modules organized in three phases:

**Phase 1: Core Infrastructure**

```javascript
import { logger } from './src/core/logger.js';
import { colors } from './src/core/colors.js';
import { detectOS } from './src/core/system.js';
import { execute } from './src/core/executor.js';
import { parseVersion } from './src/core/version.js';
```

**Phase 2: Configuration & Workflow**

```javascript
import { Config } from './src/lib/config.js';
import { Backlog } from './src/lib/backlog.js';
import { SessionManager } from './src/lib/session_manager.js';
import { Metrics } from './src/lib/metrics.js';
```

**Phase 3: File Operations & Utilities**

```javascript
import { FileOperations } from './src/lib/file_operations.js';
import { EditOperations } from './src/lib/edit_operations.js';
import { ArgumentParser } from './src/lib/argument_parser.js';
import { camelCase, truncate } from './src/lib/utils.js';
```

### Logging

```javascript
import { logger, Logger } from './src/core/logger.js';

// Use default logger
logger.info('Processing files...');
logger.success('Complete!');
logger.warn('Missing config');
logger.error('Failed');

// Create custom logger
const myLogger = new Logger({
  prefix: '[MyApp]',
  verbose: true,
  quiet: false,
});

myLogger.debug('Debug info');
```

### File Operations

```javascript
import { FileOperations } from './src/lib/file_operations.js';

const fileOps = new FileOperations();

// Read file
const content = await fileOps.readFile('/path/to/file.txt');

// Write file
await fileOps.writeFile('/path/to/output.txt', 'content');

// List files
const files = await fileOps.listFiles('/path/to/dir');

// Check existence
const exists = await fileOps.fileExists('/path/to/file');

// Copy/move files
await fileOps.copyFile(src, dest);
await fileOps.moveFile(src, dest);
```

### Configuration

```javascript
import { Config } from './src/lib/config.js';

const config = new Config(process.cwd());
await config.initialize();

// Get paths
const paths = config.getAllPaths();
console.log(paths.artifactDir); // .ai_workflow/
console.log(paths.logsDir); // .ai_workflow/logs/

// Get metadata
const metadata = config.getMetadata();
console.log(metadata.scriptVersion);
```

---

## Common Workflows

### 1. Project Analyzer

Detect project type and analyze technology stack:

```javascript
import { logger } from './src/core/logger.js';
import { FileOperations } from './src/lib/file_operations.js';
import { detectProjectKind } from './src/lib/project_kind_detection.js';
import { analyzeTechStack } from './src/lib/tech_stack.js';

async function analyzeProject(projectPath) {
  const fileOps = new FileOperations();

  // Detect project type
  logger.info('Detecting project type...');
  const projectKind = await detectProjectKind(projectPath, fileOps);
  logger.success(`Project type: ${projectKind}`);

  // Analyze tech stack
  logger.info('Analyzing tech stack...');
  const techStack = await analyzeTechStack(projectPath, fileOps);
  logger.success(`Languages: ${techStack.languages.join(', ')}`);
  logger.success(`Frameworks: ${techStack.frameworks.join(', ')}`);

  return { projectKind, techStack };
}

// Run analysis
const analysis = await analyzeProject(process.cwd());
console.log(JSON.stringify(analysis, null, 2));
```

### 2. File Processor

Batch process files in a directory:

```javascript
import { FileOperations } from './src/lib/file_operations.js';
import { EditOperations } from './src/lib/edit_operations.js';
import { logger } from './src/core/logger.js';

async function processFiles(directory, pattern) {
  const fileOps = new FileOperations();
  const editor = new EditOperations(fileOps);

  // List files matching pattern
  const files = await fileOps.listFiles(directory);
  const matching = files.filter((f) => pattern.test(f));

  logger.info(`Found ${matching.length} files to process`);

  // Process each file
  for (const file of matching) {
    logger.info(`Processing ${file}...`);

    // Read and transform
    const content = await fileOps.readFile(file);
    const transformed = transformContent(content);

    // Write back
    await fileOps.writeFile(file, transformed);
    logger.success(`Processed ${file}`);
  }
}

function transformContent(content) {
  // Your transformation logic
  return content.replace(/old/g, 'new');
}

// Process all JavaScript files
await processFiles('./src', /\.js$/);
```

### 3. Report Generator

Generate project reports:

```javascript
import { FileOperations } from './src/lib/file_operations.js';
import { Backlog } from './src/lib/backlog.js';
import { Metrics } from './src/lib/metrics.js';
import { logger } from './src/core/logger.js';

async function generateReport(projectPath) {
  const fileOps = new FileOperations();
  const config = new Config(projectPath);
  await config.initialize();

  // Collect metrics
  const metrics = new Metrics(fileOps, config.getAllPaths());
  metrics.recordStepStart(0);

  // Generate report
  const backlog = new Backlog(fileOps, config.getAllPaths());
  await backlog.generateSummary({
    metadata: config.getMetadata(),
    executionMode: { auto: true },
    workflowStatus: new Map(),
    analysisContext: { changeScope: 'full' },
    timestamp: generateTimestamp(new Date()),
  });

  metrics.recordStepEnd(0, 'passed');
  await metrics.saveMetrics();

  logger.success('Report generated!');
}

// Generate report
await generateReport(process.cwd());
```

### 4. Test Runner

Run tests and collect results:

```javascript
import { execute } from './src/core/executor.js';
import { logger } from './src/core/logger.js';
import { Metrics } from './src/lib/metrics.js';

async function runTests(testCommand = 'npm test') {
  const metrics = new Metrics();
  const startTime = Date.now();

  try {
    logger.info(`Running tests: ${testCommand}`);

    const result = await execute(testCommand, {
      timeout: 300000, // 5 minutes
    });

    const duration = Date.now() - startTime;
    logger.success(`Tests passed in ${duration}ms`);

    return { success: true, duration, output: result.stdout };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Tests failed in ${duration}ms`);
    logger.error(error.stderr);

    return { success: false, duration, error: error.stderr };
  }
}

// Run tests
const result = await runTests();
console.log(JSON.stringify(result, null, 2));
```

---

## Configuration

### Project Configuration File

Create `.workflow-config.yaml` in your project root:

```yaml
project:
  name: 'My Project'
  type: 'nodejs-application'
  description: 'My awesome project'
  kind: 'web_application'
  version: '1.0.0'

tech_stack:
  primary_language: 'javascript'
  build_system: 'npm'
  test_framework: 'jest'
  test_command: 'npm test'
  lint_command: 'npm run lint'

structure:
  source_dirs:
    - src
  test_dirs:
    - test
  docs_dirs:
    - docs
```

See [CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md) for complete configuration options.

---

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```javascript
import { logger } from './src/core/logger.js';
import { FileSystemError, ExecutionError } from './src/utils/errors.js';

try {
  await riskyOperation();
} catch (error) {
  if (error instanceof FileSystemError) {
    logger.error(`File error: ${error.path}`);
    // Handle file error
  } else if (error instanceof ExecutionError) {
    logger.error(`Command failed with exit code ${error.exitCode}`);
    logger.error(error.stderr);
  } else {
    logger.error(`Unexpected error: ${error.message}`);
    throw error;
  }
}
```

### 2. Logging

Use appropriate log levels:

```javascript
logger.debug('Detailed debug info'); // Only in verbose mode
logger.info('Processing files...'); // General information
logger.success('Operation complete!'); // Positive outcomes
logger.warn('Missing optional config'); // Non-critical issues
logger.error('Critical failure'); // Errors
```

### 3. Performance

Measure and optimize performance:

```javascript
import { Metrics } from './src/lib/metrics.js';

const metrics = new Metrics();
const startTime = Date.now();

// Your operation
await expensiveOperation();

const duration = Date.now() - startTime;
logger.info(`Operation took ${duration}ms`);
```

### 4. Testing

Test your workflows:

```javascript
// workflow.test.js
import { describe, test, expect } from '@jest/globals';
import { myWorkflow } from './workflow.js';

describe('MyWorkflow', () => {
  test('should process files correctly', async () => {
    const result = await myWorkflow();
    expect(result.success).toBe(true);
  });
});
```

---

## Troubleshooting

### Common Issues

**Problem:** Module not found error

```bash
Error: Cannot find module './src/core/logger.js'
```

**Solution:** Check import paths use correct relative paths:

```javascript
// ✅ Correct
import { logger } from './src/core/logger.js';

// ❌ Incorrect (missing .js extension)
import { logger } from './src/core/logger';
```

---

**Problem:** Permission denied when writing files

**Solution:** Check file permissions or run with appropriate privileges:

```bash
# Check permissions
ls -la /path/to/file

# Fix permissions (Unix/Linux)
chmod 644 /path/to/file
```

---

**Problem:** Tests failing

**Solution:** Run tests with verbose output:

```bash
npm test -- --verbose
```

---

**Problem:** Out of memory errors

**Solution:** Increase Node.js memory limit:

```bash
node --max-old-space-size=4096 workflow.js
```

---

### Getting Help

- **Documentation:** [docs/](../)
- **API Reference:** [docs/api/](../api/)
- **Issues:** [GitHub Issues](https://github.com/mpbarbosa/ai_workflow.js/issues)
- **Examples:** See [examples/](../examples/) directory

---

## Examples

### Complete Workflow Example

See [FIRST_WORKFLOW.md](../getting-started/FIRST_WORKFLOW.md) for a complete, working workflow example that demonstrates:

- Project detection
- Tech stack analysis
- File exclusion
- Report generation
- Error handling

### Additional Examples

More examples coming soon:

- CI/CD integration
- Custom validators
- Data processors
- Documentation generators

---

## Next Steps

1. **Complete the tutorial:** [FIRST_WORKFLOW.md](../getting-started/FIRST_WORKFLOW.md)
2. **Explore API docs:** [API Documentation](../api/)
3. **Read configuration guide:** [CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md)
4. **Check out examples:** [examples/](../examples/)
5. **Join the community:** [GitHub Discussions](https://github.com/mpbarbosa/ai_workflow.js/discussions)

---

**Last Updated:** 2026-02-08
**Version:** 1.8.0

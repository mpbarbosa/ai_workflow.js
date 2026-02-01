# Developer Guide

**AI Workflow Automation v1.0.0**  
**Last Updated:** 2026-02-01  
**Audience:** Contributors and maintainers

---

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Module Development](#module-development)
- [Debugging](#debugging)
- [Release Process](#release-process)

---

## Overview

This guide provides comprehensive information for developers contributing to ai_workflow.js. Whether you're fixing bugs, adding features, or improving documentation, this guide will help you navigate the codebase and development process.

### Project Goals

- **Cross-platform compatibility** - Works on Linux, macOS, Windows
- **Pure functional architecture** - Referentially transparent core logic
- **Comprehensive testing** - >95% code coverage
- **Professional documentation** - Clear, consistent, and complete
- **Developer experience** - Fast setup, clear patterns, helpful tooling

---

## Getting Started

### Prerequisites

**Required:**

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git >= 2.30.0

**Recommended:**

- GitHub CLI (`gh`) for PR management
- VS Code with ESLint/Prettier extensions

### Quick Setup

```bash
# Clone repository
git clone https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js

# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

### Verify Installation

```bash
# All tests should pass
npm test

# Linter should report no errors
npm run lint

# Code should be properly formatted
npm run format:check
```

---

## Development Environment Setup

### VS Code Configuration

**Recommended Extensions:**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "github.copilot",
    "orta.vscode-jest"
  ]
}
```

**Workspace Settings (.vscode/settings.json):**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": ["javascript"],
  "jest.autoRun": "watch"
}
```

### Git Hooks

Pre-commit hooks automatically run on every commit:

- **ESLint** - Catches code quality issues
- **Prettier** - Ensures consistent formatting
- **Tests** - Runs affected tests

Configured via Husky + lint-staged:

```bash
# Pre-commit hooks run automatically
git commit -m "feat: add new feature"

# To bypass (not recommended)
git commit --no-verify -m "WIP: work in progress"
```

### Environment Variables

Optional environment variables for development:

```bash
# Enable verbose logging
export DEBUG=ai-workflow:*

# Override default paths
export AI_WORKFLOW_CONFIG=/path/to/.workflow-config.yaml

# Test mode
export NODE_ENV=test
```

---

## Project Architecture

### Directory Structure

```
ai_workflow.js/
├── src/
│   ├── core/          # Core infrastructure (colors, logger, system, etc.)
│   ├── lib/           # Business logic modules (pure functions + wrappers)
│   ├── utils/         # Utility functions and error classes
│   └── cli/           # CLI entry point (future)
├── test/
│   ├── core/          # Core module tests
│   ├── lib/           # Library module tests
│   └── utils/         # Utility tests
├── docs/
│   ├── api/           # API reference documentation
│   ├── guides/        # Developer and user guides
│   ├── architecture/  # Architecture decisions (future)
│   └── getting-started/ # Quick start and installation
├── .workflow_core/    # Git submodule (template configs)
└── .ai_workflow/      # Workflow artifacts (gitignored)
```

### Architecture Patterns

#### Pure Functions + Wrapper Pattern

All modules follow this pattern:

```javascript
// Pure functions (lines 15-200)
// - Referentially transparent
// - No side effects
// - Easy to test

/**
 * Calculate duration (PURE)
 */
export function calculateDuration(startTime, endTime) {
  return endTime - startTime;
}

// Wrapper class (lines 200-end)
// - Handles I/O
// - Manages state
// - Composes pure functions

export class MetricsCollector {
  constructor(fileOps) {
    this.fileOps = fileOps;
  }

  async recordDuration(start, end) {
    const duration = calculateDuration(start, end);
    await this.fileOps.writeFile('metrics.json', JSON.stringify({ duration }));
  }
}
```

#### Module Dependency Layers

```
Application Code
    ↓
Phase 3 (File Ops & Utils)
    ↓
Phase 2 (Config & Workflow)
    ↓
Phase 1 (Core Infrastructure)
    ↓
Node.js Built-ins
```

### Design Principles

1. **Referential Transparency** - Same inputs always produce same outputs
2. **Separation of Concerns** - Pure logic separated from I/O
3. **Composition over Inheritance** - Small, composable functions
4. **Explicit Dependencies** - No hidden globals or singletons
5. **Testability First** - Easy to test in isolation

---

## Development Workflow

### Branch Strategy

```
main              # Production-ready code
  ↓
feature/xyz       # New features
fix/xyz           # Bug fixes
docs/xyz          # Documentation updates
refactor/xyz      # Code improvements
```

### Typical Workflow

1. **Create feature branch:**

   ```bash
   git checkout -b feature/add-new-module
   ```

2. **Make changes:**

   ```bash
   # Edit code
   vim src/lib/new_module.js

   # Run tests continuously
   npm run test:watch
   ```

3. **Commit changes:**

   ```bash
   git add .
   git commit -m "feat(lib): add new module for X"
   # Pre-commit hooks run automatically
   ```

4. **Push and create PR:**

   ```bash
   git push origin feature/add-new-module
   gh pr create --title "Add new module for X" --body "Implements feature X"
   ```

5. **Address review feedback:**
   ```bash
   # Make changes
   git add .
   git commit -m "refactor: address review comments"
   git push
   ```

---

## Coding Standards

### JavaScript Style

**ESLint Configuration:**

```javascript
// .eslintrc.json enforces:
{
  "rules": {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "off",  // Console allowed for CLI tools
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

**Key Conventions:**

```javascript
// ✅ Good - camelCase for functions/variables
function calculateTotal(items) {}

// ✅ Good - PascalCase for classes
class MetricsCollector {}

// ✅ Good - UPPER_CASE for constants
const MAX_RETRIES = 3;

// ✅ Good - async/await for promises
async function fetchData() {
  const result = await fetch(url);
  return result;
}

// ❌ Bad - var instead of const/let
var count = 0;

// ❌ Bad - Implicit returns without braces
const fn = () => value; // Prefer explicit returns
```

### Naming Conventions

| Type            | Convention  | Example                               |
| --------------- | ----------- | ------------------------------------- |
| Variables       | camelCase   | `userName`, `totalCount`              |
| Functions       | camelCase   | `calculateDuration()`, `formatDate()` |
| Classes         | PascalCase  | `MetricsCollector`, `FileOperations`  |
| Constants       | UPPER_CASE  | `MAX_RETRIES`, `DEFAULT_TIMEOUT`      |
| Private methods | \_camelCase | `_formatInternal()`                   |
| Test files      | \*.test.js  | `metrics.test.js`                     |

### File Organization

**Module Structure:**

```javascript
/**
 * Module Documentation
 * @version 1.0.0
 * @description Brief description
 * @module path/to/module
 */

// Imports
import fs from 'fs/promises';
import { logger } from '../core/logger.js';

// Pure functions (exported)
export function pureFunction1() {}
export function pureFunction2() {}

// Helper functions (not exported)
function helperFunction() {}

// Wrapper class (exported)
export class WrapperClass {}

// Default export (if applicable)
export default {};
```

### Documentation Standards

**JSDoc Comments:**

```javascript
/**
 * Calculate workflow duration
 * @param {number} startTime - Start timestamp in ms
 * @param {number} endTime - End timestamp in ms
 * @returns {number} Duration in milliseconds
 * @throws {ValidationError} If timestamps are invalid
 * @example
 * const duration = calculateDuration(1000000, 1005000);
 * console.log(duration); // 5000
 */
export function calculateDuration(startTime, endTime) {
  if (startTime > endTime) {
    throw new ValidationError('Start time must be before end time');
  }
  return endTime - startTime;
}
```

### Error Handling

```javascript
// ✅ Good - Use custom error types
import { ValidationError, FileSystemError } from '../utils/errors.js';

function validateInput(input) {
  if (!input) {
    throw new ValidationError('Input is required', 'input');
  }
}

// ✅ Good - Catch specific errors
try {
  await processFile(path);
} catch (error) {
  if (error instanceof FileSystemError) {
    logger.error(`File error: ${error.path}`);
  } else {
    throw error; // Re-throw unexpected errors
  }
}

// ❌ Bad - Generic error messages
throw new Error('Something went wrong');

// ❌ Bad - Swallowing errors
try {
  riskyOperation();
} catch (error) {
  // Silent failure
}
```

---

## Testing Guidelines

### Test Structure

**Test File Organization:**

```javascript
/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { functionToTest } from '../../src/lib/module.js';

describe('Module Name', () => {
  describe('functionToTest()', () => {
    test('should handle valid input', () => {
      const result = functionToTest('valid');
      expect(result).toBe('expected');
    });

    test('should throw error for invalid input', () => {
      expect(() => functionToTest(null)).toThrow(ValidationError);
    });
  });
});
```

### Writing Good Tests

**AAA Pattern (Arrange, Act, Assert):**

```javascript
test('should calculate duration correctly', () => {
  // Arrange
  const startTime = 1000000;
  const endTime = 1005000;

  // Act
  const duration = calculateDuration(startTime, endTime);

  // Assert
  expect(duration).toBe(5000);
});
```

**Test Pure Functions:**

```javascript
test('pure function should always return same output', () => {
  const input = { a: 1, b: 2 };

  // Call multiple times
  const result1 = pureFunction(input);
  const result2 = pureFunction(input);
  const result3 = pureFunction(input);

  // Results should be identical
  expect(result1).toEqual(result2);
  expect(result2).toEqual(result3);
});
```

**Test Edge Cases:**

```javascript
describe('edge cases', () => {
  test('should handle empty input', () => {
    expect(processArray([])).toEqual([]);
  });

  test('should handle null input', () => {
    expect(processValue(null)).toBe(DEFAULT_VALUE);
  });

  test('should handle large numbers', () => {
    const large = Number.MAX_SAFE_INTEGER;
    expect(calculate(large)).toBeLessThan(Infinity);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (runs on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific test file
npm test -- metrics.test.js

# Run tests matching pattern
npm test -- --testNamePattern="calculateDuration"
```

### Coverage Requirements

- **Minimum:** 80% coverage for new code
- **Target:** 95% overall coverage
- **Pure functions:** Aim for 100% coverage

```bash
# Check coverage
npm run test:coverage

# View detailed report
open coverage/lcov-report/index.html
```

---

## Pull Request Process

### PR Checklist

Before submitting a PR, ensure:

- [ ] All tests pass (`npm test`)
- [ ] Linter passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] New tests added for new functionality
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention
- [ ] PR description is clear and complete

### Commit Message Convention

Format: `<type>(<scope>): <subject>`

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/tooling changes

**Examples:**

```bash
git commit -m "feat(lib): add metrics collection module"
git commit -m "fix(core): handle null values in logger"
git commit -m "docs(api): update executor documentation"
git commit -m "refactor(utils): simplify date formatting"
git commit -m "test(lib): add edge case tests for config"
```

### PR Description Template

```markdown
## Description

Brief description of the changes

## Changes

- Added X feature
- Fixed Y bug
- Updated Z documentation

## Testing

- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing completed

## Related Issues

Fixes #123
Related to #456
```

---

## Module Development

### Creating a New Module

**1. Create module file:**

```javascript
// src/lib/new_module.js

/**
 * New Module
 * @version 1.0.0
 * @description Purpose of this module
 * @module lib/new_module
 */

/**
 * PURE FUNCTIONS
 */

export function pureFunction1(input) {
  // Referentially transparent logic
  return transformedOutput;
}

/**
 * WRAPPER CLASS
 */

export class NewModuleManager {
  constructor(dependencies) {
    this.deps = dependencies;
  }

  async operation() {
    const result = pureFunction1(input);
    await this.deps.fileOps.writeFile(path, result);
  }
}

export default { pureFunction1, NewModuleManager };
```

**2. Create test file:**

```javascript
// test/lib/new_module.test.js

import { pureFunction1, NewModuleManager } from '../../src/lib/new_module.js';

describe('NewModule', () => {
  describe('pureFunction1()', () => {
    test('should process input correctly', () => {
      const result = pureFunction1('test');
      expect(result).toBe('expected');
    });
  });

  describe('NewModuleManager', () => {
    test('should perform operation', async () => {
      const mockDeps = { fileOps: { writeFile: jest.fn() } };
      const manager = new NewModuleManager(mockDeps);

      await manager.operation();

      expect(mockDeps.fileOps.writeFile).toHaveBeenCalled();
    });
  });
});
```

**3. Create API documentation:**

```markdown
# new_module - Brief Description

**Module:** `lib/new_module`
**Version:** 1.0.0
**Type:** Pure Functions + Wrapper

## Overview

...
```

**4. Update index exports:**

```javascript
// src/lib/index.js
export * from './new_module.js';
```

---

## Debugging

### VS Code Debugging

**launch.json configuration:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/jest/bin/jest.js",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Current Test",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/jest/bin/jest.js",
      "args": ["${file}", "--runInBand"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Debugging Tips

```javascript
// Add breakpoints
debugger;

// Verbose logging
import { logger } from '../core/logger.js';
logger.debug('Variable value:', value);

// Inspect objects
console.dir(object, { depth: null });

// Timing operations
console.time('operation');
// ... code ...
console.timeEnd('operation');
```

---

## Release Process

### Version Bumping

```bash
# Patch release (bug fixes)
npm version patch  # 1.0.0 → 1.0.1

# Minor release (new features)
npm version minor  # 1.0.0 → 1.1.0

# Major release (breaking changes)
npm version major  # 1.0.0 → 2.0.0
```

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped
- [ ] Git tag created
- [ ] Changes pushed to main
- [ ] GitHub release created

### Creating a Release

```bash
# 1. Update CHANGELOG.md
vim CHANGELOG.md

# 2. Commit changelog
git add CHANGELOG.md
git commit -m "docs: update changelog for v1.1.0"

# 3. Create version tag
npm version minor

# 4. Push with tags
git push origin main --tags

# 5. Create GitHub release
gh release create v1.1.0 --title "v1.1.0" --notes "Release notes here"
```

---

## Additional Resources

- **[API Documentation](../api/)** - Complete API reference
- **[Testing Guide](./TESTING_GUIDE.md)** - Detailed testing practices
- **[Configuration Guide](./CONFIGURATION_GUIDE.md)** - Configuration options
- **[Contributing Guidelines](../../CONTRIBUTING.md)** - General contribution info

---

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/mpbarbosa/ai_workflow.js/issues)
- **Discussions:** [GitHub Discussions](https://github.com/mpbarbosa/ai_workflow.js/discussions)
- **Documentation:** [docs/](../)

---

**Last Updated:** 2026-02-01  
**Version:** 1.0.0

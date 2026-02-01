# Testing Guide

**AI Workflow Automation v1.0.0**  
**Last Updated:** 2026-02-01  
**Audience:** Developers writing tests

---

## Table of Contents

- [Overview](#overview)
- [Testing Philosophy](#testing-philosophy)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Testing Patterns](#testing-patterns)
- [Mocking](#mocking)
- [Integration Testing](#integration-testing)
- [Best Practices](#best-practices)

---

## Overview

This guide covers testing strategies, patterns, and best practices for ai_workflow.js. We use **Jest** as our testing framework with Node.js experimental VM modules for ES module support.

### Testing Goals

- **High Coverage:** Maintain >95% code coverage
- **Fast Execution:** Tests should run quickly (<5 minutes)
- **Reliable:** Tests should be deterministic (no flaky tests)
- **Maintainable:** Tests should be easy to read and update
- **Comprehensive:** Cover happy paths, edge cases, and error conditions

---

## Testing Philosophy

### Test Pyramid

```
           /\
          /  \        E2E Tests (Few)
         /    \       - Complete workflows
        /------\      - CLI integration
       /        \
      /          \    Integration Tests (Some)
     /            \   - Module interactions
    /--------------\  - File I/O operations
   /                \
  /                  \ Unit Tests (Many)
 /____________________\ - Pure functions
                        - Individual methods
```

### Pure Functions First

Focus testing on pure functions - they're easiest to test and most reliable:

```javascript
// ✅ Easy to test - pure function
export function calculateDuration(start, end) {
  return end - start;
}

test('calculateDuration should return difference', () => {
  expect(calculateDuration(1000, 1500)).toBe(500);
});

// ❌ Harder to test - side effects
async function saveDuration(start, end) {
  const duration = end - start;
  await fs.writeFile('duration.txt', duration.toString());
}
```

---

## Test Structure

### File Organization

Tests mirror source code structure:

```
src/
├── core/
│   ├── logger.js
│   └── executor.js
└── lib/
    ├── config.js
    └── metrics.js

test/
├── core/
│   ├── logger.test.js
│   └── executor.test.js
└── lib/
    ├── config.test.js
    └── metrics.test.js
```

### Test File Template

```javascript
/**
 * Module Name Tests
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { functionToTest, ClassToTest } from '../../src/lib/module.js';

describe('ModuleName', () => {
  // Pure function tests
  describe('functionToTest()', () => {
    test('should handle valid input', () => {
      const result = functionToTest('valid');
      expect(result).toBe('expected');
    });

    test('should throw error for invalid input', () => {
      expect(() => functionToTest(null)).toThrow(ValidationError);
    });
  });

  // Class tests
  describe('ClassToTest', () => {
    let instance;

    beforeEach(() => {
      instance = new ClassToTest();
    });

    afterEach(() => {
      // Cleanup if needed
    });

    test('should initialize correctly', () => {
      expect(instance).toBeDefined();
    });
  });
});
```

---

## Writing Tests

### AAA Pattern

Structure tests using **Arrange, Act, Assert**:

```javascript
test('should calculate total price', () => {
  // Arrange - Set up test data
  const items = [
    { price: 10.0, quantity: 2 },
    { price: 5.0, quantity: 3 },
  ];

  // Act - Execute the function
  const total = calculateTotal(items);

  // Assert - Verify the result
  expect(total).toBe(35.0);
});
```

### Test Naming

Use descriptive test names that explain behavior:

```javascript
// ✅ Good - describes what and why
test('should return empty array when input is empty', () => {});
test('should throw ValidationError when email is invalid', () => {});
test('should cache results after first call', () => {});

// ❌ Bad - vague or technical jargon
test('works', () => {});
test('test1', () => {});
test('returns stuff', () => {});
```

### Testing Pure Functions

Pure functions are straightforward to test:

```javascript
import { formatDuration } from '../../src/lib/metrics.js';

describe('formatDuration()', () => {
  test('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  test('should format seconds', () => {
    expect(formatDuration(5000)).toBe('5.00s');
  });

  test('should format minutes', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  test('should handle zero', () => {
    expect(formatDuration(0)).toBe('0ms');
  });
});
```

### Testing Async Functions

Use `async/await` in tests:

```javascript
import { execute } from '../../src/core/executor.js';

describe('execute()', () => {
  test('should return stdout for successful command', async () => {
    const result = await execute('echo "hello"');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello');
  });

  test('should throw ExecutionError for failed command', async () => {
    await expect(execute('exit 1')).rejects.toThrow(ExecutionError);
  });
});
```

### Testing Error Conditions

Always test error paths:

```javascript
import { parseVersion } from '../../src/core/version.js';

describe('parseVersion()', () => {
  test('should parse valid version', () => {
    const result = parseVersion('1.2.3');
    expect(result).toEqual({ major: 1, minor: 2, patch: 3, prerelease: '', build: '' });
  });

  test('should throw error for invalid version', () => {
    expect(() => parseVersion('invalid')).toThrow('Invalid version format');
  });

  test('should throw error for null input', () => {
    expect(() => parseVersion(null)).toThrow();
  });

  test('should throw error for empty string', () => {
    expect(() => parseVersion('')).toThrow();
  });
});
```

### Testing Edge Cases

Cover boundary conditions:

```javascript
describe('edge cases', () => {
  test('should handle empty array', () => {
    expect(processArray([])).toEqual([]);
  });

  test('should handle single item', () => {
    expect(processArray([1])).toEqual([1]);
  });

  test('should handle large array', () => {
    const large = new Array(10000).fill(1);
    expect(processArray(large).length).toBe(10000);
  });

  test('should handle max safe integer', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(calculate(max)).toBeLessThan(Infinity);
  });

  test('should handle negative numbers', () => {
    expect(calculate(-100)).toBe(expected);
  });
});
```

---

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Watch mode (runs on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Verbose output
npm test -- --verbose

# Run specific test file
npm test -- metrics.test.js

# Run tests matching pattern
npm test -- --testNamePattern="calculateDuration"

# Run tests in specific directory
npm test -- test/lib/
```

### Jest CLI Options

```bash
# Run only failed tests from last run
npm test -- --onlyFailures

# Run tests in parallel (faster)
npm test -- --maxWorkers=4

# Update snapshots
npm test -- --updateSnapshot

# Show coverage in terminal
npm test -- --coverage --coverageReporters=text

# Debug tests
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Watch Mode

Best for development:

```bash
npm run test:watch

# Press 'a' to run all tests
# Press 'f' to run only failed tests
# Press 'p' to filter by filename
# Press 't' to filter by test name
# Press 'q' to quit
```

---

## Test Coverage

### Coverage Goals

| Type       | Minimum | Target |
| ---------- | ------- | ------ |
| Statements | 80%     | 95%    |
| Branches   | 75%     | 90%    |
| Functions  | 80%     | 95%    |
| Lines      | 80%     | 95%    |

### Generating Coverage Reports

```bash
# Generate coverage
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html

# View summary in terminal
npm test -- --coverage --coverageReporters=text-summary
```

### Coverage Configuration

Jest configuration in `package.json`:

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 75,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    },
    "collectCoverageFrom": ["src/**/*.js", "!src/**/*.test.js", "!src/cli/**"]
  }
}
```

### Ignoring Code from Coverage

Use comments to exclude code:

```javascript
/* istanbul ignore next */
function debugFunction() {
  console.log('Only used in development');
}

/* istanbul ignore if */
if (process.env.DEBUG) {
  console.log('Debug mode');
}
```

---

## Testing Patterns

### Testing Classes

```javascript
import { MetricsCollector } from '../../src/lib/metrics.js';

describe('MetricsCollector', () => {
  let metrics;
  let mockFileOps;
  let mockPaths;

  beforeEach(() => {
    mockFileOps = {
      writeFile: jest.fn().mockResolvedValue(),
      readFile: jest.fn(),
    };

    mockPaths = {
      metricsDir: '/tmp/metrics',
    };

    metrics = new MetricsCollector(mockFileOps, mockPaths);
  });

  test('should record step timing', () => {
    metrics.recordStepStart(1);
    metrics.recordStepEnd(1, 'passed');

    const timings = metrics.getMetrics().stepTimings;
    expect(timings.has(1)).toBe(true);
  });

  test('should save metrics to file', async () => {
    await metrics.saveMetrics();

    expect(mockFileOps.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('metrics'),
      expect.any(String)
    );
  });
});
```

### Testing with Timestamps

Use dependency injection for time:

```javascript
// ✅ Good - time is injected
export function generateTimestamp(date) {
  return date
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
}

test('should generate timestamp', () => {
  const date = new Date('2026-01-15T10:30:00Z');
  expect(generateTimestamp(date)).toBe('20260115103000');
});

// ❌ Bad - uses current time (non-deterministic)
export function generateTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
}
```

### Testing Pure vs Impure Functions

```javascript
// Pure function - easy to test
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

test('calculateTotal should sum prices', () => {
  const items = [{ price: 10 }, { price: 20 }];
  expect(calculateTotal(items)).toBe(30);
});

// Impure function - test via wrapper
export class OrderProcessor {
  constructor(fileOps) {
    this.fileOps = fileOps;
  }

  async processOrder(items) {
    const total = calculateTotal(items);
    await this.fileOps.writeFile('total.txt', total.toString());
    return total;
  }
}

test('processOrder should save total', async () => {
  const mockFileOps = { writeFile: jest.fn() };
  const processor = new OrderProcessor(mockFileOps);

  await processor.processOrder([{ price: 10 }]);

  expect(mockFileOps.writeFile).toHaveBeenCalledWith('total.txt', '10');
});
```

---

## Mocking

### Mocking Functions

```javascript
import { jest } from '@jest/globals';

// Mock a simple function
const mockFn = jest.fn();
mockFn.mockReturnValue(42);

test('should use mocked function', () => {
  expect(mockFn()).toBe(42);
  expect(mockFn).toHaveBeenCalledTimes(1);
});

// Mock async function
const mockAsync = jest.fn().mockResolvedValue('result');

test('should use mocked async function', async () => {
  const result = await mockAsync();
  expect(result).toBe('result');
});
```

### Mocking Modules

```javascript
// Mock entire module
jest.mock('../../src/core/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

import { logger } from '../../src/core/logger.js';

test('should call logger', () => {
  someFunction();
  expect(logger.info).toHaveBeenCalledWith('Processing...');
});
```

### Mocking File Operations

```javascript
describe('with mocked file operations', () => {
  let mockFileOps;

  beforeEach(() => {
    mockFileOps = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      listFiles: jest.fn(),
      fileExists: jest.fn(),
    };
  });

  test('should read file', async () => {
    mockFileOps.readFile.mockResolvedValue('file content');

    const manager = new FileManager(mockFileOps);
    const content = await manager.loadConfig();

    expect(content).toBe('file content');
    expect(mockFileOps.readFile).toHaveBeenCalledWith(expect.stringContaining('config'));
  });
});
```

### Spy on Methods

```javascript
test('should call internal method', () => {
  const instance = new MyClass();
  const spy = jest.spyOn(instance, 'internalMethod');

  instance.publicMethod();

  expect(spy).toHaveBeenCalled();

  spy.mockRestore(); // Clean up
});
```

---

## Integration Testing

### Testing Module Interactions

```javascript
import { Config } from '../../src/lib/config.js';
import { BacklogManager } from '../../src/lib/backlog.js';
import { FileOperations } from '../../src/lib/file_operations.js';

describe('Integration: Config + Backlog', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('should generate backlog with config', async () => {
    const fileOps = new FileOperations();
    const config = new Config(tmpDir);
    await config.initialize();

    const backlog = new BacklogManager(fileOps, config.getAllPaths());
    await backlog.generateSummary({
      metadata: config.getMetadata(),
      executionMode: { auto: true },
      workflowStatus: new Map(),
      analysisContext: {},
      timestamp: '20260101_120000',
    });

    // Verify file was created
    const summaryPath = path.join(config.getPath('backlogDir'), 'workflow_summary.md');
    const exists = await fileOps.fileExists(summaryPath);
    expect(exists).toBe(true);
  });
});
```

### Testing with Real Files

```javascript
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('with real filesystem', () => {
  let testDir;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should write and read file', async () => {
    const filePath = path.join(testDir, 'test.txt');
    const fileOps = new FileOperations();

    await fileOps.writeFile(filePath, 'content');
    const content = await fileOps.readFile(filePath);

    expect(content).toBe('content');
  });
});
```

---

## Best Practices

### 1. Test Behavior, Not Implementation

```javascript
// ✅ Good - tests behavior
test('should return formatted name', () => {
  const result = formatName('john', 'doe');
  expect(result).toBe('John Doe');
});

// ❌ Bad - tests implementation
test('should call capitalize twice', () => {
  const spy = jest.spyOn(utils, 'capitalize');
  formatName('john', 'doe');
  expect(spy).toHaveBeenCalledTimes(2);
});
```

### 2. Keep Tests Simple

```javascript
// ✅ Good - simple, focused test
test('should add two numbers', () => {
  expect(add(2, 3)).toBe(5);
});

// ❌ Bad - too complex
test('should handle complex calculation', () => {
  const a = Math.random() * 100;
  const b = Math.random() * 100;
  const expected = a + b;
  expect(add(a, b)).toBeCloseTo(expected);
});
```

### 3. Don't Repeat Yourself

```javascript
// ✅ Good - use helper functions
function createTestUser(overrides = {}) {
  return {
    name: 'Test User',
    email: 'test@example.com',
    age: 30,
    ...overrides,
  };
}

test('should validate adult user', () => {
  const user = createTestUser({ age: 25 });
  expect(isAdult(user)).toBe(true);
});

test('should validate minor user', () => {
  const user = createTestUser({ age: 15 });
  expect(isAdult(user)).toBe(false);
});
```

### 4. Test One Thing at a Time

```javascript
// ✅ Good - focused tests
test('should parse valid email', () => {
  expect(parseEmail('user@example.com')).toBeTruthy();
});

test('should reject invalid email', () => {
  expect(() => parseEmail('invalid')).toThrow();
});

// ❌ Bad - tests multiple things
test('should handle emails', () => {
  expect(parseEmail('user@example.com')).toBeTruthy();
  expect(() => parseEmail('invalid')).toThrow();
  expect(parseEmail('admin@test.com')).toBeTruthy();
});
```

### 5. Use Descriptive Assertions

```javascript
// ✅ Good - clear assertion
expect(result.status).toBe('success');
expect(result.data).toHaveLength(3);
expect(result.errors).toEqual([]);

// ❌ Bad - vague assertion
expect(result).toBeTruthy();
```

---

## Continuous Testing

### Pre-commit Testing

Tests run automatically on commit via Husky:

```bash
# .husky/pre-commit
npm test
```

### CI/CD Integration

GitHub Actions workflow example:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npm test
      - run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Additional Resources

- **[Jest Documentation](https://jestjs.io/docs/getting-started)**
- **[Developer Guide](./DEVELOPER_GUIDE.md)** - Development workflow
- **[API Documentation](../api/)** - Module reference

---

**Last Updated:** 2026-02-01  
**Version:** 1.0.0

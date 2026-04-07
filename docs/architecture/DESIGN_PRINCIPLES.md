# Design Principles

**AI Workflow Automation v1.9.8**
**Last Updated:** 2026-02-01
**Audience:** Architects, Senior Developers

---

## Table of Contents

- [Core Philosophy](#core-philosophy)
- [Pure Functions First](#pure-functions-first)
- [Wrapper Pattern](#wrapper-pattern)
- [Separation of Concerns](#separation-of-concerns)
- [Testability](#testability)
- [Composability](#composability)
- [Error Handling](#error-handling)
- [Performance](#performance)
- [Maintainability](#maintainability)
- [Design Decisions](#design-decisions)

---

## Core Philosophy

AI Workflow Automation is built on fundamental principles that guide all architectural decisions:

### 1. Predictability Over Cleverness

**Principle:** Code should be obvious and predictable, not clever or magical.

```javascript
// ✅ Good - predictable, clear intent
export function calculateDuration(startTime, endTime) {
  return endTime - startTime;
}

// ❌ Bad - clever but obscure
export const calcDur = (s, e) => e - s;
```

**Benefits:**

- Easy to understand for new contributors
- Reduces cognitive load
- Fewer bugs from misunderstanding
- Easier to maintain long-term

### 2. Explicit Over Implicit

**Principle:** Make dependencies and effects explicit, not hidden.

```javascript
// ✅ Good - dependencies explicit
export function formatLog(message, colors, timestamp) {
  const time = timestamp.toISOString();
  return `${colors.gray}[${time}]${colors.reset} ${message}`;
}

// ❌ Bad - hidden dependencies
export function formatLog(message) {
  const time = new Date().toISOString(); // Hidden time dependency
  return `[${time}] ${message}`;
}
```

**Benefits:**

- Easier to test (inject dependencies)
- Clear data flow
- No hidden side effects
- Better for debugging

### 3. Composition Over Inheritance

**Principle:** Build complex behavior by composing simple functions, not inheritance hierarchies.

```javascript
// ✅ Good - composition
export function processWorkflow(config, logger, metrics) {
  return {
    start: () => startWorkflow(config, logger),
    track: (data) => trackProgress(data, metrics),
    complete: () => finalizeWorkflow(config, logger, metrics),
  };
}

// ❌ Bad - inheritance
class BaseWorkflow {
  start() {
    /* ... */
  }
}
class ProcessWorkflow extends BaseWorkflow {
  start() {
    super.start(); /* ... */
  }
}
```

**Benefits:**

- More flexible combinations
- Easier to reason about
- No fragile base class problems
- Better testability

---

## Pure Functions First

### Definition

A **pure function**:

1. Given the same inputs, always returns the same output
2. Has no side effects (no I/O, no state mutation)
3. Doesn't depend on external state

### Implementation Strategy

**Structure:** Every module follows this pattern:

```
module.js (1000 lines)
├── Lines 1-100:    Documentation, imports
├── Lines 100-800:  Pure functions (testable logic)
├── Lines 800-1000: Wrapper class (I/O, side effects)
```

### Example: Logger Module

```javascript
// ========================================
// PURE FUNCTIONS (Lines 15-200)
// ========================================

/**
 * Format log message with timestamp and color
 * @pure
 */
export function formatLogMessage(message, level, colors, timestamp) {
  const time = timestamp.toISOString();
  const colorCode = colors[level] || colors.reset;
  return `${colorCode}[${time}] [${level.toUpperCase()}] ${message}${colors.reset}`;
}

/**
 * Filter log messages by level
 * @pure
 */
export function filterByLevel(messages, minLevel) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const threshold = levels[minLevel] || 0;
  return messages.filter((msg) => levels[msg.level] >= threshold);
}

// ========================================
// WRAPPER CLASS (Lines 200-300)
// ========================================

/**
 * Logger wrapper handling I/O and state
 * @impure
 */
export class Logger {
  constructor(config, fileOps) {
    this.config = config;
    this.fileOps = fileOps;
    this.messages = [];
  }

  /**
   * Log a message (side effect: writes to file)
   */
  async log(message, level = 'info') {
    const timestamp = new Date();
    const formatted = formatLogMessage(message, level, colors, timestamp);

    // Side effects
    console.log(formatted);
    this.messages.push({ message, level, timestamp });

    if (this.config.logToFile) {
      await this.fileOps.appendFile(this.config.logFile, formatted + '\n');
    }
  }
}
```

### Benefits

1. **Testability:** Pure functions tested without mocks
2. **Reliability:** No unexpected side effects
3. **Parallelization:** Safe to run concurrently
4. **Caching:** Results can be memoized
5. **Reasoning:** Easy to understand data flow

---

## Wrapper Pattern

### Structure

**Wrappers** encapsulate side effects and provide a clean API:

```javascript
// Core pattern
export class ModuleWrapper {
  constructor(dependencies) {
    this.deps = dependencies;
    this.state = {};
  }

  // Public methods delegate to pure functions
  async publicMethod(input) {
    // 1. Read state/I/O
    const data = await this.deps.readData();

    // 2. Call pure function
    const result = pureFunctionLogic(input, data);

    // 3. Write state/I/O
    await this.deps.writeData(result);

    return result;
  }
}
```

### Responsibilities

**Pure Functions:**

- Business logic
- Data transformation
- Validation
- Calculations
- Formatting

**Wrappers:**

- I/O operations (file, network, console)
- State management
- Dependency injection
- Error handling
- Lifecycle management

### Example: Config Module

```javascript
// ========================================
// PURE FUNCTIONS
// ========================================

export function validateConfig(config, schema) {
  const errors = [];

  // Validate required fields
  for (const field of schema.required) {
    if (!config[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function mergeConfigs(base, overrides) {
  return {
    ...base,
    ...overrides,
    nested: {
      ...base.nested,
      ...overrides.nested,
    },
  };
}

// ========================================
// WRAPPER
// ========================================

export class Config {
  constructor(projectRoot, fileOps) {
    this.projectRoot = projectRoot;
    this.fileOps = fileOps;
    this.config = null;
  }

  async initialize() {
    // I/O: Read file
    const raw = await this.fileOps.readFile(path.join(this.projectRoot, '.workflow-config.yaml'));

    // Pure: Parse and validate
    const parsed = yaml.parse(raw);
    const validation = validateConfig(parsed, CONFIG_SCHEMA);

    if (!validation.valid) {
      throw new ValidationError(validation.errors.join(', '));
    }

    // State: Store config
    this.config = parsed;
  }

  get(key) {
    // Pure getter, no side effects
    return this.config?.[key];
  }
}
```

---

## Separation of Concerns

### Module Organization

Modules are organized by concern, not by layer:

```
src/
├── core/              # Core infrastructure (low-level)
│   ├── colors.js      # ANSI color codes
│   ├── logger.js      # Logging utilities
│   ├── system.js      # OS detection
│   ├── version.js     # Version comparison
│   ├── executor.js    # Command execution
│   └── errors.js      # Custom error types
├── lib/               # Business logic (mid-level)
│   ├── config.js      # Configuration management
│   ├── backlog.js     # Workflow summaries
│   ├── session_manager.js  # Session lifecycle
│   └── metrics.js     # Metrics collection
└── utils/             # Utilities (helpers)
    ├── file_operations.js   # File system ops
    ├── edit_operations.js   # File editing
    └── utils.js            # General utilities
```

### Dependency Direction

Dependencies flow **downward** only:

```
CLI Layer
   ↓
Business Logic (lib/)
   ↓
Core Infrastructure (core/)
   ↓
Node.js Built-ins
```

**Rules:**

- `cli/` can import from `lib/`, `core/`, `utils/`
- `lib/` can import from `core/`, `utils/`
- `core/` can import from Node.js only
- `utils/` can import from `core/`, Node.js

### Example: Respecting Boundaries

```javascript
// ✅ Good - respects dependency direction
// lib/config.js
import { readFile } from '../utils/file_operations.js';
import { logger } from '../core/logger.js';

// ❌ Bad - circular dependency
// core/logger.js
import { Config } from '../lib/config.js'; // NO! Core can't depend on lib
```

---

## Testability

### Test-Driven Design

Every module designed for easy testing:

**1. Pure Functions:** No mocks needed

```javascript
// Easy to test - just call with inputs
test('calculateDuration should return difference', () => {
  const result = calculateDuration(1000, 1500);
  expect(result).toBe(500);
});
```

**2. Dependency Injection:** Mock external dependencies

```javascript
// Inject dependencies for testing
class Metrics {
  constructor(fileOps, paths) {
    // Injected
    this.fileOps = fileOps;
    this.paths = paths;
  }
}

// Test with mock
test('should save metrics', async () => {
  const mockFileOps = { writeFile: jest.fn() };
  const collector = new Metrics(mockFileOps, { metricsDir: '/tmp' });

  await collector.saveMetrics();

  expect(mockFileOps.writeFile).toHaveBeenCalled();
});
```

**3. Small, Focused Functions:** Easy to test exhaustively

```javascript
// Small function - easy to test all paths
export function getStatusIcon(status) {
  const icons = {
    passed: '✅',
    failed: '❌',
    skipped: '⏭️',
    pending: '⏳',
  };
  return icons[status] || '❓';
}

// All cases tested easily
test('getStatusIcon should return correct icons', () => {
  expect(getStatusIcon('passed')).toBe('✅');
  expect(getStatusIcon('failed')).toBe('❌');
  expect(getStatusIcon('unknown')).toBe('❓');
});
```

---

## Composability

### Building Blocks

Small, focused functions compose into larger capabilities:

```javascript
// Small building blocks
export function formatTimestamp(date) {
  return date
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
}

export function generateFilename(prefix, timestamp, ext) {
  return `${prefix}_${timestamp}.${ext}`;
}

export function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Composed functionality
export async function saveReport(report, config) {
  const timestamp = formatTimestamp(new Date());
  const filename = generateFilename('report', timestamp, 'json');
  const filepath = path.join(config.outputDir, filename);

  ensureDirectory(config.outputDir);
  await fs.writeFile(filepath, JSON.stringify(report, null, 2));

  return filepath;
}
```

### Function Composition

Use higher-order functions for reusable patterns:

```javascript
// Generic composition utilities
export function pipe(...fns) {
  return (input) => fns.reduce((acc, fn) => fn(acc), input);
}

export function map(fn) {
  return (array) => array.map(fn);
}

export function filter(predicate) {
  return (array) => array.filter(predicate);
}

// Composed workflow
const processLogs = pipe(
  filter((log) => log.level === 'error'),
  map((log) => ({ ...log, formatted: formatLog(log) })),
  map((log) => log.formatted)
);

const errorLogs = processLogs(allLogs);
```

---

## Error Handling

### Custom Error Types

Domain-specific errors for clear handling:

```javascript
// Custom error hierarchy
export class WorkflowError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends WorkflowError {
  constructor(message, details) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class ExecutionError extends WorkflowError {
  constructor(message, details) {
    super(message, 'EXECUTION_ERROR', details);
  }
}
```

### Error Handling Strategy

**1. Fail Fast:** Validate early, fail immediately

```javascript
export function validateStep(step, schema) {
  if (!step.name) {
    throw new ValidationError('Step name is required');
  }
  if (!step.action) {
    throw new ValidationError('Step action is required');
  }
  // ... more validations
}
```

**2. Contextual Errors:** Include relevant context

```javascript
try {
  await executeCommand(cmd);
} catch (error) {
  throw new ExecutionError(`Failed to execute command: ${cmd}`, {
    command: cmd,
    exitCode: error.code,
    stderr: error.stderr,
    originalError: error,
  });
}
```

**3. Recovery:** Handle recoverable errors gracefully

```javascript
export async function loadConfigWithFallback(paths) {
  for (const configPath of paths) {
    try {
      return await loadConfig(configPath);
    } catch (error) {
      logger.debug(`Config not found at ${configPath}, trying next...`);
    }
  }

  // Fall back to defaults
  return getDefaultConfig();
}
```

---

## Performance

### Design for Performance

**1. Lazy Loading:** Load modules on demand

```javascript
// Don't load heavy dependencies at startup
export async function runAnalysis() {
  // Lazy load only when needed
  const { analyze } = await import('./analysis/deep_analyzer.js');
  return analyze();
}
```

**2. Caching:** Cache expensive operations

```javascript
// Cache parsed configuration
export class Config {
  constructor() {
    this._cache = new Map();
  }

  getPath(key) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }

    const value = this._computePath(key);
    this._cache.set(key, value);
    return value;
  }
}
```

**3. Streaming:** Process data incrementally

```javascript
// Stream large files instead of loading into memory
export async function processLargeLog(filepath) {
  const stream = fs.createReadStream(filepath);
  const rl = readline.createInterface({ input: stream });

  for await (const line of rl) {
    processLine(line); // Process one line at a time
  }
}
```

---

## Maintainability

### Code Organization

**1. Single Responsibility:** One module, one purpose

```javascript
// ✅ Good - focused responsibility
// logger.js - handles logging only
// config.js - handles configuration only
// metrics.js - handles metrics only

// ❌ Bad - multiple responsibilities
// utils.js - logging, config, metrics, validation, formatting...
```

**2. Clear Interfaces:** Well-defined public APIs

```javascript
// Public API clearly documented
export class SessionManager {
  /**
   * Initialize a new workflow session
   * @param {Object} config - Session configuration
   * @returns {Promise<string>} Session ID
   */
  async initializeSession(config) {}

  /**
   * Resume an existing session
   * @param {string} sessionId - Session to resume
   * @returns {Promise<Object>} Session state
   */
  async resumeSession(sessionId) {}
}
```

**3. Documentation:** Code explains "why", not "what"

```javascript
// ✅ Good - explains why
// Use recursive: true to handle nested directories
// This prevents ENOENT errors when parent dirs don't exist
await fs.mkdir(dir, { recursive: true });

// ❌ Bad - restates code
// Create directory
await fs.mkdir(dir);
```

---

## Design Decisions

### Why Pure Functions First?

**Decision:** Separate pure logic from side effects

**Rationale:**

- Pure functions are 10x easier to test
- No mocks needed for business logic
- Easier to reason about correctness
- Can be parallelized safely
- Results can be cached

**Trade-offs:**

- More verbose (wrapper + pure functions)
- Requires discipline to maintain separation
- Initial learning curve for contributors

**Verdict:** Benefits far outweigh costs

### Why No Classes for Core Logic?

**Decision:** Use plain functions for core logic, classes only for wrappers

**Rationale:**

- Functions compose better than classes
- No "this" binding issues
- Easier to test (no instantiation needed)
- More functional programming friendly
- Smaller bundle size

**Trade-offs:**

- Less familiar to OOP developers
- No private fields (use modules instead)

**Verdict:** Functions are better fit for our use case

### Why Dependency Injection?

**Decision:** Inject dependencies instead of importing globally

**Rationale:**

- Testability: easy to mock dependencies
- Flexibility: swap implementations
- No global state
- Clear dependency graph

**Trade-offs:**

- More verbose constructors
- Requires passing dependencies down

**Verdict:** Essential for maintainable tests

---

## Additional Resources

- **[Module Structure](./MODULE_STRUCTURE.md)** - Detailed module organization
- **[Dependency Graph](./DEPENDENCY_GRAPH.md)** - Module dependencies
- **[Developer Guide](../guides/DEVELOPER_GUIDE.md)** - Development workflow

---

**Last Updated:** 2026-02-01
**Version:** 1.9.8

# Module Structure

**AI Workflow Automation v1.0.0**  
**Last Updated:** 2026-02-01  
**Audience:** Developers, Architects

---

## Table of Contents

- [Overview](#overview)
- [Module Organization](#module-organization)
- [Phase 1: Core Infrastructure](#phase-1-core-infrastructure)
- [Phase 2: Configuration & Workflow](#phase-2-configuration--workflow)
- [Phase 3: File Operations & Utilities](#phase-3-file-operations--utilities)
- [Phase 4: Advanced Features](#phase-4-advanced-features)
- [Module Anatomy](#module-anatomy)
- [Import Patterns](#import-patterns)
- [Export Strategy](#export-strategy)

---

## Overview

AI Workflow Automation uses a **phased module architecture** where modules are organized by development phase and responsibility. Each phase builds on the previous, creating clear dependency hierarchies.

### Module Hierarchy

```
Phase 4 (Advanced Features)
    ↓
Phase 3 (File Ops & Utils)
    ↓
Phase 2 (Config & Workflow)
    ↓
Phase 1 (Core Infrastructure)
    ↓
Node.js Built-ins
```

---

## Module Organization

### Directory Structure

```
src/
├── core/                    # Phase 1: Core infrastructure
│   ├── colors.js           # ANSI color codes
│   ├── logger.js           # Logging utilities
│   ├── system.js           # OS detection
│   ├── version.js          # Version comparison
│   ├── executor.js         # Command execution
│   └── errors.js           # Custom error types
│
├── lib/                     # Phase 2 & 3: Business logic
│   ├── config.js           # Configuration management
│   ├── backlog.js          # Workflow summaries
│   ├── session_manager.js  # Session lifecycle
│   ├── metrics.js          # Metrics collection
│   ├── file_operations.js  # File system operations
│   ├── edit_operations.js  # File editing
│   └── argument_parser.js  # CLI argument parsing
│
├── utils/                   # Phase 3: Utilities
│   ├── utils.js            # General utilities
│   └── cleanup_handlers.js # Cleanup operations
│
├── modules/                 # Phase 4: Advanced features
│   ├── step_processor.js   # Step execution
│   ├── context_manager.js  # Context handling
│   ├── prompt_builder.js   # AI prompt construction
│   └── validator.js        # Validation logic
│
└── cli/                     # Command-line interface
    └── index.js            # Main CLI entry point
```

---

## Phase 1: Core Infrastructure

Low-level utilities with no dependencies on other project modules.

### colors.js (235 lines)

**Purpose:** ANSI color code management

**Exports:**

- `colors` - Color code object
- `colorize()` - Colorize text
- `stripColors()` - Remove color codes

**Dependencies:** None

**Example:**

```javascript
import { colors, colorize } from './core/colors.js';

console.log(colorize('Success!', 'green'));
console.log(`${colors.red}Error!${colors.reset}`);
```

### logger.js (407 lines)

**Purpose:** Logging with levels and file output

**Exports:**

- `logger` - Logger instance
- `formatLogMessage()` - Format messages (pure)
- `filterByLevel()` - Filter logs (pure)

**Dependencies:** `colors.js`

**Example:**

```javascript
import { logger } from './core/logger.js';

logger.info('Processing started');
logger.error('Something failed');
logger.success('Operation completed');
```

### system.js (151 lines)

**Purpose:** Operating system detection and utilities

**Exports:**

- `detectOS()` - Detect current OS (pure)
- `isWindows()` - Check if Windows (pure)
- `getShellCommand()` - Get shell for OS (pure)

**Dependencies:** None

**Example:**

```javascript
import { detectOS, isWindows } from './core/system.js';

const os = detectOS();
if (isWindows()) {
  console.log('Running on Windows');
}
```

### version.js (101 lines)

**Purpose:** Semantic version comparison

**Exports:**

- `parseVersion()` - Parse semver string (pure)
- `compareVersions()` - Compare versions (pure)
- `isCompatible()` - Check compatibility (pure)

**Dependencies:** None

**Example:**

```javascript
import { compareVersions, isCompatible } from './core/version.js';

if (compareVersions('2.0.0', '1.5.0') > 0) {
  console.log('Newer version available');
}

if (isCompatible('1.2.3', '^1.0.0')) {
  console.log('Version is compatible');
}
```

### executor.js (216 lines)

**Purpose:** Command execution with error handling

**Exports:**

- `execute()` - Execute shell command
- `executeWithTimeout()` - Execute with timeout
- `Executor` - Command executor class

**Dependencies:** `logger.js`, `errors.js`, `system.js`

**Example:**

```javascript
import { execute } from './core/executor.js';

try {
  const result = await execute('npm test');
  console.log(result.stdout);
} catch (error) {
  console.error('Command failed:', error.message);
}
```

### errors.js (296 lines)

**Purpose:** Custom error types for domain-specific errors

**Exports:**

- `WorkflowError` - Base error
- `ValidationError` - Validation failures
- `ExecutionError` - Execution failures
- `ConfigurationError` - Config issues
- `FileOperationError` - File I/O errors

**Dependencies:** None

**Example:**

```javascript
import { ValidationError, ExecutionError } from './core/errors.js';

if (!config.name) {
  throw new ValidationError('Project name is required');
}

try {
  await runCommand(cmd);
} catch (error) {
  throw new ExecutionError('Command failed', { command: cmd, error });
}
```

---

## Phase 2: Configuration & Workflow

Business logic for configuration and workflow management.

### config.js (110 lines)

**Purpose:** Configuration file loading and validation

**Exports:**

- `validateConfig()` - Validate config (pure)
- `mergeConfigs()` - Merge configs (pure)
- `Config` - Config manager class

**Dependencies:** `errors.js`, `file_operations.js`

**Example:**

```javascript
import { Config } from './lib/config.js';

const config = new Config(projectRoot, fileOps);
await config.initialize();

const projectName = config.get('project.name');
const paths = config.getAllPaths();
```

### backlog.js (109 lines)

**Purpose:** Workflow summary generation

**Exports:**

- `generateBacklog()` - Generate summary (pure)
- `formatSection()` - Format markdown (pure)
- `Backlog` - Backlog manager class

**Dependencies:** `logger.js`, `file_operations.js`

**Example:**

```javascript
import { Backlog } from './lib/backlog.js';

const backlog = new Backlog(fileOps, paths);
await backlog.generateSummary({
  metadata: config.getMetadata(),
  workflowStatus,
  timestamp,
});
```

### session_manager.js (126 lines)

**Purpose:** Session lifecycle management

**Exports:**

- `generateSessionId()` - Generate ID (pure)
- `SessionManager` - Session manager class

**Dependencies:** `logger.js`, `config.js`, `file_operations.js`

**Example:**

```javascript
import { SessionManager } from './lib/session_manager.js';

const session = new SessionManager(config, fileOps);
const sessionId = await session.initializeSession();
await session.saveCheckpoint('step_1', { data: 'checkpoint data' });
const state = await session.resumeSession(sessionId);
```

### metrics.js (123 lines)

**Purpose:** Performance metrics collection

**Exports:**

- `formatDuration()` - Format time (pure)
- `calculateStats()` - Calculate statistics (pure)
- `Metrics` - Metrics collector class

**Dependencies:** `logger.js`, `file_operations.js`

**Example:**

```javascript
import { Metrics } from './lib/metrics.js';

const metrics = new Metrics(fileOps, paths);
metrics.recordStepStart(1);
await executeStep();
metrics.recordStepEnd(1, 'passed');

await metrics.saveMetrics();
const summary = metrics.getSummary();
```

---

## Phase 3: File Operations & Utilities

File system operations and general utilities.

### file_operations.js (107 lines)

**Purpose:** File system operations abstraction

**Exports:**

- `FileOperations` - File operations class

**Methods:**

- `readFile()` - Read file contents
- `writeFile()` - Write file contents
- `appendFile()` - Append to file
- `deleteFile()` - Delete file
- `listFiles()` - List directory files
- `fileExists()` - Check file existence
- `createDirectory()` - Create directory

**Dependencies:** Node.js `fs`, `path`

**Example:**

```javascript
import { FileOperations } from './lib/file_operations.js';

const fileOps = new FileOperations();

const content = await fileOps.readFile('config.yaml');
await fileOps.writeFile('output.txt', 'data');
const exists = await fileOps.fileExists('test.js');
```

### edit_operations.js (121 lines)

**Purpose:** File editing and transformation

**Exports:**

- `findLineNumber()` - Find line in file (pure)
- `replaceText()` - Replace text (pure)
- `insertText()` - Insert text (pure)
- `EditOperations` - Edit operations class

**Dependencies:** `file_operations.js`, `errors.js`

**Example:**

```javascript
import { EditOperations } from './lib/edit_operations.js';

const editOps = new EditOperations(fileOps);

await editOps.replaceInFile('file.js', 'oldText', 'newText');
await editOps.insertAtLine('file.js', 10, 'new code');
await editOps.deleteLines('file.js', 5, 8);
```

### utils.js (145 lines)

**Purpose:** General utility functions

**Exports:**

- `formatTimestamp()` - Format dates (pure)
- `sanitizeFilename()` - Clean filenames (pure)
- `debounce()` - Debounce function (pure)
- `deepClone()` - Deep clone object (pure)

**Dependencies:** None

**Example:**

```javascript
import { formatTimestamp, sanitizeFilename } from './utils/utils.js';

const timestamp = formatTimestamp(new Date());
const safe = sanitizeFilename('file:name*.txt'); // "file_name.txt"
```

### argument_parser.js (80 lines)

**Purpose:** CLI argument parsing

**Exports:**

- `parseArguments()` - Parse CLI args (pure)
- `validateArguments()` - Validate args (pure)

**Dependencies:** `errors.js`

**Example:**

```javascript
import { parseArguments } from './lib/argument_parser.js';

const args = parseArguments(process.argv.slice(2));
console.log(args.command); // 'run'
console.log(args.options); // { verbose: true }
```

### cleanup_handlers.js (78 lines)

**Purpose:** Cleanup operations on exit

**Exports:**

- `registerCleanupHandler()` - Register handler
- `cleanupOnExit()` - Cleanup function

**Dependencies:** `logger.js`

**Example:**

```javascript
import { registerCleanupHandler } from './utils/cleanup_handlers.js';

registerCleanupHandler(async () => {
  await saveState();
  await closeDatabaseConnection();
});
```

---

## Phase 4: Advanced Features

Advanced workflow features (in development).

### Module 1: Step Processor

**Purpose:** Execute workflow steps

**Status:** ✅ Complete

**Exports:**

- `StepProcessor` - Step execution engine

### Module 2: Context Manager

**Purpose:** Manage workflow context

**Status:** ✅ Complete

**Exports:**

- `ContextManager` - Context handler

### Module 3: Prompt Builder

**Purpose:** Build AI prompts

**Status:** ✅ Complete

**Exports:**

- `PromptBuilder` - Prompt constructor

### Module 4: Validator

**Purpose:** Validate workflow definitions

**Status:** 🚧 In Progress

**Exports:**

- `Validator` - Workflow validator

---

## Module Anatomy

Every module follows a consistent structure:

### Standard Module Template

```javascript
/**
 * Module Name
 *
 * Brief description of module purpose.
 *
 * @module core/module_name
 * @version 1.0.0
 */

// ========================================
// IMPORTS
// ========================================

import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';
import { ValidationError } from './errors.js';

// ========================================
// CONSTANTS
// ========================================

const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;

// ========================================
// PURE FUNCTIONS
// ========================================

/**
 * Pure function description
 * @pure
 * @param {string} input - Input parameter
 * @returns {string} Output value
 */
export function pureFunction(input) {
  // Pure logic - no side effects
  return input.toUpperCase();
}

/**
 * Another pure function
 * @pure
 */
export function anotherPureFunction(a, b) {
  return a + b;
}

// ========================================
// WRAPPER CLASS
// ========================================

/**
 * Wrapper class handling side effects
 * @class
 */
export class ModuleWrapper {
  /**
   * Constructor
   * @param {Object} dependencies - Injected dependencies
   */
  constructor(dependencies) {
    this.deps = dependencies;
    this.state = {};
  }

  /**
   * Public method
   * @param {string} input - Input parameter
   * @returns {Promise<string>} Result
   */
  async publicMethod(input) {
    // 1. Validation
    if (!input) {
      throw new ValidationError('Input is required');
    }

    // 2. Read state/I/O
    const data = await this.deps.readData();

    // 3. Call pure function
    const result = pureFunction(input);

    // 4. Write state/I/O
    await this.deps.writeData(result);

    // 5. Return result
    return result;
  }
}

// ========================================
// DEFAULT INSTANCE (optional)
// ========================================

export const moduleInstance = new ModuleWrapper({
  /* default dependencies */
});
```

### Section Breakdown

**Lines 1-50:** Documentation and imports

- Module header with description
- Import statements grouped by type
- Constants defined at top

**Lines 50-300:** Pure functions

- All business logic as pure functions
- Marked with `@pure` JSDoc tag
- No side effects, no I/O
- Easy to test

**Lines 300-500:** Wrapper class

- Handles I/O and state
- Delegates to pure functions
- Dependency injection
- Error handling

**Lines 500+:** Exports (optional)

- Default instances
- Factory functions
- Helper utilities

---

## Import Patterns

### Relative Imports

Always use explicit relative paths:

```javascript
// ✅ Good - explicit relative path
import { logger } from './core/logger.js';
import { Config } from './lib/config.js';
import { formatTimestamp } from './utils/utils.js';

// ❌ Bad - absolute/bare imports
import { logger } from 'core/logger';
import { Config } from '@/lib/config';
```

### Import Grouping

Group imports by type:

```javascript
// 1. Node.js built-ins
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 2. Core modules
import { logger } from './core/logger.js';
import { colors } from './core/colors.js';

// 3. Business logic modules
import { Config } from './lib/config.js';
import { Metrics } from './lib/metrics.js';

// 4. Utilities
import { formatTimestamp } from './utils/utils.js';
```

### Named vs Default Exports

Prefer named exports:

```javascript
// ✅ Good - named exports
import { logger, formatLogMessage } from './core/logger.js';
import { Config, validateConfig } from './lib/config.js';

// ❌ Bad - default exports
import Logger from './core/logger.js';
import Config from './lib/config.js';
```

---

## Export Strategy

### Module Exports

Export both pure functions and wrappers:

```javascript
// Export pure functions for testing
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`;
}

// Export wrapper class
export class OrderProcessor {
  constructor(fileOps) {
    this.fileOps = fileOps;
  }

  async processOrder(items) {
    const total = calculateTotal(items);
    const formatted = formatCurrency(total);
    await this.fileOps.writeFile('total.txt', formatted);
    return formatted;
  }
}

// Optional: Export default instance
export const orderProcessor = new OrderProcessor(defaultFileOps);
```

### Public API

Clearly document public vs internal:

```javascript
/**
 * Public API - exported and documented
 * @public
 */
export function publicFunction() {
  return internalFunction();
}

/**
 * Internal helper - not exported
 * @private
 */
function internalFunction() {
  return 'internal';
}
```

---

## Module Dependencies

### Dependency Rules

1. **Phase 1** depends on: Node.js only
2. **Phase 2** depends on: Phase 1, Node.js
3. **Phase 3** depends on: Phase 1, Phase 2, Node.js
4. **Phase 4** depends on: Phase 1-3, Node.js

### Circular Dependency Prevention

Never create circular dependencies:

```javascript
// ❌ Bad - circular dependency
// module_a.js
import { funcB } from './module_b.js';

// module_b.js
import { funcA } from './module_a.js';

// ✅ Good - extract to common module
// shared.js
export function sharedFunc() {}

// module_a.js
import { sharedFunc } from './shared.js';

// module_b.js
import { sharedFunc } from './shared.js';
```

---

## Additional Resources

- **[Design Principles](./DESIGN_PRINCIPLES.md)** - Architectural patterns
- **[Dependency Graph](./DEPENDENCY_GRAPH.md)** - Module relationships
- **[API Documentation](../api/)** - Module API reference

---

**Last Updated:** 2026-02-01  
**Version:** 1.0.0

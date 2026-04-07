# Dependency Graph

**AI Workflow Automation v1.9.9**
**Last Updated:** 2026-02-01
**Audience:** Architects, Developers

---

## Table of Contents

- [Overview](#overview)
- [Complete Dependency Graph](#complete-dependency-graph)
- [Phase Breakdown](#phase-breakdown)
- [Module Dependencies](#module-dependencies)
- [Dependency Rules](#dependency-rules)
- [Analysis](#analysis)

---

## Overview

This document visualizes the dependency relationships between all modules in AI Workflow Automation. Dependencies flow **downward** only, from higher-level modules to lower-level modules.

### Dependency Layers

```
┌─────────────────────────────────┐
│     CLI Layer (cli/)            │  User interface
├─────────────────────────────────┤
│     Phase 4 (modules/)          │  Advanced features
├─────────────────────────────────┤
│     Phase 3 (lib/, utils/)      │  File ops & utilities
├─────────────────────────────────┤
│     Phase 2 (lib/)              │  Config & workflow
├─────────────────────────────────┤
│     Phase 1 (core/)             │  Core infrastructure
├─────────────────────────────────┤
│     Node.js Built-ins           │  System libraries
└─────────────────────────────────┘
```

---

## Complete Dependency Graph

### Visual Representation

```
                                CLI
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              StepProcessor  ContextMgr  PromptBuilder
                    │            │            │
                    └────────────┼────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            SessionManager  BacklogMgr   Metrics
                    │            │            │
                    └────────────┼────────────┘
                                 │
                              Config
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            FileOperations  EditOps      Utils
                    │            │            │
                    └────────────┼────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                Logger      Executor      Errors
                    │            │            │
                    └────────────┼────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                Colors        System       Version
                    │            │            │
                    └────────────┼────────────┘
                                 │
                           Node.js Built-ins
                         (fs, path, os, etc.)
```

---

## Phase Breakdown

### Phase 1: Core Infrastructure

**No internal dependencies** - only depends on Node.js

```
colors.js
  └─ Node.js (none)

system.js
  └─ Node.js (os)

version.js
  └─ Node.js (none)

errors.js
  └─ Node.js (none)

logger.js
  └─ colors.js
  └─ Node.js (fs, path)

executor.js
  └─ logger.js
  └─ system.js
  └─ errors.js
  └─ Node.js (child_process)
```

### Phase 2: Configuration & Workflow

**Depends on:** Phase 1, Node.js

```
config.js
  └─ errors.js (Phase 1)
  └─ file_operations.js (Phase 3)
  └─ Node.js (path, yaml)

backlog.js
  └─ logger.js (Phase 1)
  └─ file_operations.js (Phase 3)
  └─ Node.js (path)

session_manager.js
  └─ logger.js (Phase 1)
  └─ config.js (Phase 2)
  └─ file_operations.js (Phase 3)
  └─ Node.js (path)

metrics.js
  └─ logger.js (Phase 1)
  └─ file_operations.js (Phase 3)
  └─ Node.js (path)
```

### Phase 3: File Operations & Utilities

**Depends on:** Phase 1, Node.js

```
file_operations.js
  └─ errors.js (Phase 1)
  └─ Node.js (fs, path)

edit_operations.js
  └─ file_operations.js (Phase 3)
  └─ errors.js (Phase 1)
  └─ Node.js (none)

utils.js
  └─ Node.js (none)

argument_parser.js
  └─ errors.js (Phase 1)
  └─ Node.js (none)

cleanup_handlers.js
  └─ logger.js (Phase 1)
  └─ Node.js (process)
```

### Phase 4: Advanced Features

**Depends on:** Phase 1-3, Node.js

```
step_processor.js
  └─ logger.js (Phase 1)
  └─ executor.js (Phase 1)
  └─ errors.js (Phase 1)
  └─ config.js (Phase 2)
  └─ metrics.js (Phase 2)
  └─ Node.js (none)

context_manager.js
  └─ logger.js (Phase 1)
  └─ config.js (Phase 2)
  └─ file_operations.js (Phase 3)
  └─ Node.js (none)

prompt_builder.js
  └─ logger.js (Phase 1)
  └─ config.js (Phase 2)
  └─ file_operations.js (Phase 3)
  └─ Node.js (none)

validator.js
  └─ errors.js (Phase 1)
  └─ config.js (Phase 2)
  └─ utils.js (Phase 3)
  └─ Node.js (none)
```

---

## Module Dependencies

### Detailed Dependency Lists

#### colors.js

```javascript
// No dependencies
```

#### logger.js

```javascript
import { colors } from './colors.js';
import fs from 'fs/promises';
import path from 'path';
```

#### system.js

```javascript
import os from 'os';
```

#### version.js

```javascript
// No dependencies
```

#### executor.js

```javascript
import { logger } from './logger.js';
import { detectOS, getShellCommand } from './system.js';
import { ExecutionError } from './errors.js';
import { spawn } from 'child_process';
```

#### errors.js

```javascript
// No dependencies
```

#### config.js

```javascript
import { ValidationError, ConfigurationError } from '../core/errors.js';
import { FileOperations } from './file_operations.js';
import yaml from 'yaml';
import path from 'path';
```

#### backlog.js

```javascript
import { logger } from '../core/logger.js';
import { FileOperations } from './file_operations.js';
import path from 'path';
```

#### session_manager.js

```javascript
import { logger } from '../core/logger.js';
import { Config } from './config.js';
import { FileOperations } from './file_operations.js';
import path from 'path';
```

#### metrics.js

```javascript
import { logger } from '../core/logger.js';
import { FileOperations } from './file_operations.js';
import path from 'path';
```

#### file_operations.js

```javascript
import { FileOperationError } from '../core/errors.js';
import fs from 'fs/promises';
import path from 'path';
```

#### edit_operations.js

```javascript
import { FileOperations } from './file_operations.js';
import { FileOperationError } from '../core/errors.js';
```

#### utils.js

```javascript
// No dependencies
```

#### argument_parser.js

```javascript
import { ValidationError } from '../core/errors.js';
```

#### cleanup_handlers.js

```javascript
import { logger } from '../core/logger.js';
```

---

## Dependency Rules

### Rule 1: No Circular Dependencies

**Rule:** Module A cannot depend on Module B if Module B depends on Module A (directly or indirectly).

**Example:**

```javascript
// ❌ ILLEGAL - Circular dependency
// config.js
import { logger } from './logger.js';

// logger.js
import { Config } from './config.js'; // CIRCULAR!

// ✅ LEGAL - Break circle with dependency injection
// config.js
export class Config {
  constructor(logger) {
    // Inject logger
    this.logger = logger;
  }
}

// logger.js
// No import of config.js
```

### Rule 2: Phase Ordering

**Rule:** Higher phases can depend on lower phases, but not vice versa.

**Legal:**

- Phase 4 → Phase 3 ✅
- Phase 4 → Phase 2 ✅
- Phase 4 → Phase 1 ✅
- Phase 3 → Phase 2 ✅
- Phase 3 → Phase 1 ✅
- Phase 2 → Phase 1 ✅

**Illegal:**

- Phase 1 → Phase 2 ❌
- Phase 1 → Phase 3 ❌
- Phase 2 → Phase 3 ❌

### Rule 3: Core Independence

**Rule:** Core modules (Phase 1) cannot depend on business logic modules (Phase 2+).

**Example:**

```javascript
// ❌ ILLEGAL - Core depending on lib
// core/logger.js
import { Config } from '../lib/config.js'; // NO!

// ✅ LEGAL - Dependency injection
// core/logger.js
export class Logger {
  constructor(config) {
    // Inject config
    this.config = config;
  }
}
```

### Rule 4: Utility Flexibility

**Rule:** Utilities can depend on core but not business logic.

**Example:**

```javascript
// ✅ LEGAL - Utils depending on core
// utils/utils.js
import { logger } from '../core/logger.js';

// ❌ ILLEGAL - Utils depending on lib
// utils/utils.js
import { Config } from '../lib/config.js'; // NO!
```

---

## Analysis

### Dependency Metrics

**Total Modules:** 19 (Phase 1-3)

**Dependency Counts:**

| Module           | Direct Dependencies | Total Dependencies |
| ---------------- | ------------------- | ------------------ |
| colors           | 0                   | 0                  |
| system           | 0                   | 0                  |
| version          | 0                   | 0                  |
| errors           | 0                   | 0                  |
| utils            | 0                   | 0                  |
| argument_parser  | 1                   | 1                  |
| logger           | 1                   | 1                  |
| cleanup_handlers | 1                   | 2                  |
| executor         | 3                   | 5                  |
| file_operations  | 1                   | 1                  |
| edit_operations  | 2                   | 3                  |
| config           | 2                   | 3                  |
| backlog          | 2                   | 3                  |
| session_manager  | 3                   | 6                  |
| metrics          | 2                   | 3                  |

### Most Depended Upon

Modules that other modules depend on most:

1. **logger.js** - Used by 8 modules
2. **errors.js** - Used by 6 modules
3. **file_operations.js** - Used by 5 modules
4. **config.js** - Used by 4 modules
5. **colors.js** - Used by 1 module

### Least Dependencies

Modules with no dependencies (leaf nodes):

- `colors.js`
- `system.js`
- `version.js`
- `errors.js`
- `utils.js`

These are the most reusable and testable modules.

### Critical Path

The longest dependency chain:

```
cli/index.js
  → modules/step_processor.js (Phase 4)
    → lib/session_manager.js (Phase 2)
      → lib/config.js (Phase 2)
        → lib/file_operations.js (Phase 3)
          → core/errors.js (Phase 1)

Total depth: 6 levels
```

---

## Dependency Graph by Category

### By Functionality

```
Configuration:
  config.js
    └─ file_operations.js
    └─ errors.js

Workflow Management:
  backlog.js
    └─ logger.js
    └─ file_operations.js

  session_manager.js
    └─ logger.js
    └─ config.js
    └─ file_operations.js

  metrics.js
    └─ logger.js
    └─ file_operations.js

File Operations:
  file_operations.js
    └─ errors.js

  edit_operations.js
    └─ file_operations.js
    └─ errors.js

Core Infrastructure:
  logger.js
    └─ colors.js

  executor.js
    └─ logger.js
    └─ system.js
    └─ errors.js

  colors.js
  system.js
  version.js
  errors.js

Utilities:
  utils.js
  argument_parser.js
    └─ errors.js
  cleanup_handlers.js
    └─ logger.js
```

---

## Detecting Circular Dependencies

### Manual Check

Use this command to detect circular dependencies:

```bash
# Install madge
npm install -g madge

# Check for circular dependencies
madge --circular src/

# Generate dependency graph
madge --image deps.png src/
```

### Automated Check

Add to package.json:

```json
{
  "scripts": {
    "check-deps": "madge --circular src/"
  }
}
```

Run: `npm run check-deps`

---

## Evolution Guidelines

When adding new modules:

### 1. Determine Phase

Where does the new module belong?

- **Phase 1:** Core infrastructure (no business logic)
- **Phase 2:** Configuration/workflow management
- **Phase 3:** File operations/utilities
- **Phase 4:** Advanced features

### 2. Check Dependencies

What does it depend on?

- Only lower phases? ✅ Good
- Same phase? ⚠️ Caution - check for cycles
- Higher phase? ❌ Bad - refactor

### 3. Minimize Dependencies

- Can functionality be achieved with fewer dependencies?
- Can logic be extracted to pure functions?
- Are all dependencies necessary?

### 4. Update Documentation

- Add module to this dependency graph
- Document in MODULE_STRUCTURE.md
- Create API documentation

---

## Additional Resources

- **[Design Principles](./DESIGN_PRINCIPLES.md)** - Architectural patterns
- **[Module Structure](./MODULE_STRUCTURE.md)** - Module organization
- **[Developer Guide](../guides/DEVELOPER_GUIDE.md)** - Development workflow

---

**Last Updated:** 2026-02-01
**Version:** 1.9.9

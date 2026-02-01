# API Documentation Index

**AI Workflow Automation v1.0.0**  
**Generated:** 2026-02-01

Complete API reference for all modules in the ai_workflow.js project.

---

## Quick Navigation

### Phase 1: Core Modules

- **[colors](./colors.md)** - ANSI color codes and terminal color support
- **[logger](./logger.md)** - Colored logging with multiple log levels
- **[system](./system.md)** - OS detection and system information
- **[version](./version.md)** - Semantic version parsing and comparison
- **[executor](./executor.md)** - Shell command execution utilities
- **[errors](./errors.md)** - Custom error types

### Phase 2: Configuration & Workflow

- **[config](./config.md)** - Workflow configuration and path management
- **[backlog](./backlog.md)** - Workflow summaries and backlog reports
- **[session_manager](./session_manager.md)** - Session lifecycle management
- **[metrics](./metrics.md)** - Metrics collection and reporting

### Phase 3: File Operations & Utilities

- **[file_operations](./file_operations.md)** - File system operations
- **[edit_operations](./edit_operations.md)** - File content editing utilities
- **[utils](./utils.md)** - General utility functions
- **[argument_parser](./argument_parser.md)** - CLI argument parsing
- **[cleanup_handlers](./cleanup_handlers.md)** - Cleanup operations

---

## Module Overview by Category

### Core Infrastructure (Phase 1)

**6 Modules | Pure Functions & Classes**

| Module                    | Purpose           | Key Features                                   |
| ------------------------- | ----------------- | ---------------------------------------------- |
| [colors](./colors.md)     | Terminal colors   | ANSI codes, color support detection            |
| [logger](./logger.md)     | Logging           | Multi-level logging, quiet/verbose modes       |
| [system](./system.md)     | System info       | OS detection, package manager detection        |
| [version](./version.md)   | Versioning        | Semver parsing, version comparison             |
| [executor](./executor.md) | Command execution | Shell commands, streaming output, sudo support |
| [errors](./errors.md)     | Error handling    | Custom error types with context                |

### Configuration & Workflow (Phase 2)

**4 Modules | Pure Functions + Wrappers**

| Module                                  | Purpose       | Key Features                             |
| --------------------------------------- | ------------- | ---------------------------------------- |
| [config](./config.md)                   | Configuration | Path calculation, metadata generation    |
| [backlog](./backlog.md)                 | Reporting     | Workflow summaries, markdown generation  |
| [session_manager](./session_manager.md) | Session mgmt  | Session tracking, cleanup queues         |
| [metrics](./metrics.md)                 | Metrics       | Duration tracking, step timing, counters |

### File Operations & Utilities (Phase 3)

**5 Modules | Pure Functions + Wrappers**

| Module                                    | Purpose      | Key Features                          |
| ----------------------------------------- | ------------ | ------------------------------------- |
| [file_operations](./file_operations.md)   | File system  | Read, write, list, filter, validation |
| [edit_operations](./edit_operations.md)   | File editing | Find, replace, insert, extract        |
| [utils](./utils.md)                       | Utilities    | String, array, object, date utilities |
| [argument_parser](./argument_parser.md)   | CLI parsing  | Flag/option parsing, validation       |
| [cleanup_handlers](./cleanup_handlers.md) | Cleanup      | Age-based, size-based file cleanup    |

---

## Architecture Patterns

### Pure Functions (Referential Transparency)

All modules follow **pure functional** design principles:

- **Deterministic:** Same inputs always produce same outputs
- **No side effects:** Don't modify external state
- **Composable:** Functions can be combined easily
- **Testable:** Easy to unit test in isolation

**Example Pattern:**

```javascript
// Pure function (Phase 1-3 modules)
export function calculateDuration(startTime, endTime) {
  return endTime - startTime;
}

// I/O wrapper class (Phase 2-3 modules)
export class MetricsCollector {
  constructor(fileOps) {
    this.fileOps = fileOps;
  }

  async saveDuration(start, end) {
    const duration = calculateDuration(start, end);
    await this.fileOps.writeFile('metrics.json', JSON.stringify({ duration }));
  }
}
```

### Module Structure

Modules are organized into two layers:

1. **Pure Functions** (lines ~15-200)
   - Core business logic
   - No I/O operations
   - 100% testable

2. **Wrapper Classes** (lines ~200-end)
   - Handle I/O operations
   - Integrate with file system, logger, etc.
   - Compose pure functions

---

## Module Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│                    (Your Workflow Code)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Phase 3 Modules                         │
│  file_operations  edit_operations  utils  argument_parser   │
│                   cleanup_handlers                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Phase 2 Modules                         │
│    config  backlog  session_manager  metrics                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Phase 1 Modules                         │
│  colors  logger  system  version  executor  errors          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Built-ins                         │
│        fs  path  os  child_process  crypto  util            │
└─────────────────────────────────────────────────────────────┘
```

---

## Version History

| Version | Date       | Changes                           |
| ------- | ---------- | --------------------------------- |
| 1.0.0   | 2026-02-01 | Initial API documentation release |

---

## Documentation Standards

All API documentation files follow these conventions:

- **Module header:** Name, version, type
- **Overview:** Brief description and purpose
- **Exports:** All exported members
- **Functions:** Detailed parameters, returns, examples
- **Usage examples:** Real-world code samples
- **Related modules:** Cross-references
- **Best practices:** Recommended patterns

---

## Contributing

When adding new modules or updating existing ones:

1. Follow the existing documentation structure
2. Include code examples for all public APIs
3. Document parameters, return values, and types
4. Add usage examples and best practices
5. Update this index file

See [CONTRIBUTING.md](../../docs/CONTRIBUTING.md) for full guidelines.

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.0.0

# API Documentation Index

**AI Workflow Automation v2.0.0**  
**Generated:** 2026-02-07

Complete API reference for all modules in the ai_workflow.js project (Phase 1-7).

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

### Phase 4: Project Detection

- **[project_kind_detection](./lib/project_kind_detection.md)** - Auto-detect project type
- **[project_kind_config](./lib/project_kind_config.md)** - Load project configs
- **[tech_stack](./lib/tech_stack.md)** - Detect tech stack
- **[third_party_exclusion](./lib/third_party_exclusion.md)** - Filter third-party files

### Phase 5: Git Integration

**⚠️ API documentation pending**

- **git_automation** - Git operations
- **git_cache** - Git caching
- **auto_commit** - Auto-commit artifacts
- **change_detection** - Change detection

### Phase 6: AI Integration

**⚠️ API documentation pending**

- **jq_wrapper** - JSON processing
- **ai_personas** - AI personas
- **ai_validation** - AI validation
- **ai_cache** - AI caching
- **ai_prompt_builder** - Prompt building
- **ai_helpers** - AI helpers

### Phase 7: Orchestrator

- **[workflow_engine](./orchestrator/workflow_engine.md)** - Core workflow orchestration
- **[step_registry](./orchestrator/step_registry.md)** - Step registration and management
- **[dependency_resolver](./orchestrator/dependency_resolver.md)** - Dependency resolution
- **[step_executor](./orchestrator/step_executor.md)** - Step execution with retry
- **[conditional_executor](./orchestrator/conditional_executor.md)** - Conditional execution
- **[checkpoint_manager](./orchestrator/checkpoint_manager.md)** - Checkpoint management

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

### Project Detection (Phase 4)

**4 Modules | Pure Functions + Wrappers (v1.0.0)**

| Module                                                    | Purpose             | Key Features                              |
| --------------------------------------------------------- | ------------------- | ----------------------------------------- |
| [project_kind_detection](./lib/project_kind_detection.md) | Project detection   | Auto-detect from files, 8 project kinds   |
| [project_kind_config](./lib/project_kind_config.md)       | Config management   | Load YAML configs, merge overrides        |
| [tech_stack](./lib/tech_stack.md)                         | Tech stack analysis | Detect languages, frameworks, build tools |
| [third_party_exclusion](./lib/third_party_exclusion.md)   | File filtering      | Exclude third-party code, .gitignore      |

### AI Integration (Phase 6)

**6 Modules | Pure Functions + Wrappers (v2.0.0)**

| Module                                          | Purpose             | Key Features                             |
| ----------------------------------------------- | ------------------- | ---------------------------------------- |
| [jq_wrapper](./lib/jq_wrapper.md)               | JSON processing     | Safe jq execution, validation, parsing   |
| [ai_personas](./lib/ai_personas.md)             | Persona management  | 14 personas, lookup, validation          |
| [ai_validation](./lib/ai_validation.md)         | Response validation | Confidence scoring, fallback strategies  |
| [ai_cache](./lib/ai_cache.md)                   | Response caching    | TTL, disk storage, 60-80% token savings  |
| [ai_prompt_builder](./lib/ai_prompt_builder.md) | Prompt construction | Templates, context injection, structured |
| [ai_helpers](./lib/ai_helpers.md)               | AI orchestration    | SDK integration, retry, batch processing |

### Workflow Orchestration (Phase 7)

**6 Modules | Pure Functions + Wrappers (v2.0.0)**

| Module                                                         | Purpose                | Key Features                                    |
| -------------------------------------------------------------- | ---------------------- | ----------------------------------------------- |
| [workflow_engine](./orchestrator/workflow_engine.md)           | Workflow orchestration | Execution, dependency management, checkpoints   |
| [step_registry](./orchestrator/step_registry.md)               | Step management        | Registration, validation, filtering             |
| [dependency_resolver](./orchestrator/dependency_resolver.md)   | Dependency resolution  | Topological sort, parallel grouping, validation |
| [step_executor](./orchestrator/step_executor.md)               | Step execution         | Timeout, retry, validation, event emission      |
| [conditional_executor](./orchestrator/conditional_executor.md) | Conditional logic      | Change detection, impact analysis, smart skip   |
| [checkpoint_manager](./orchestrator/checkpoint_manager.md)     | State management       | Save/resume, cleanup, validation                |

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

// I/O wrapper class (Phase 2-5 modules)
export class Metrics {
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

| Version | Date       | Changes                                          |
| ------- | ---------- | ------------------------------------------------ |
| 2.2.0   | 2026-02-07 | Added Phase 6 AI integration modules (6 docs)    |
| 2.1.0   | 2026-02-07 | Added Phase 4 project detection modules (4 docs) |
| 2.0.0   | 2026-02-07 | Added Phase 7 orchestrator modules (6 docs)      |
| 1.0.0   | 2026-02-01 | Initial API documentation release                |

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

**Last Updated:** 2026-02-07  
**Part of:** AI Workflow Automation v2.0.0

# API Reference

**Version:** 2.0.0  
**Last Updated:** February 7, 2026

Complete API documentation for ai_workflow.js modules (Phase 1-8).

**✅ Phase 4 Complete:** Project Detection modules now fully documented!  
**✅ Phase 5 Complete:** Git Integration modules now fully documented!  
**✅ Phase 6 Complete:** AI Integration modules now fully documented!  
**✅ Phase 7 Complete:** Orchestrator modules now fully documented!  
**🚧 Phase 8 In Progress:** Performance Optimization (step1_parallel)

## 📦 Module Categories

### Core Modules (Phase 1 - v1.0.0)

Foundation utilities providing basic functionality:

- **[colors](./core/colors.md)** - ANSI color codes with terminal support detection
- **[logger](./core/logger.md)** - Colored logging system with multiple severity levels
- **[system](./core/system.md)** - OS detection and system configuration
- **[version](./core/version.md)** - Semantic version parsing and comparison
- **[executor](./core/executor.md)** - Command execution with async/streaming support

### Library Modules (Phase 2-5 - v2.0.0 or v1.0.0)

Core libraries implementing business logic:

#### Configuration & State Management (Phase 2)

- **[config](./lib/config.md)** - Configuration file management with validation
- **[backlog](./lib/backlog.md)** - Workflow summary and backlog reporting
- **[session_manager](./lib/session_manager.md)** - Session lifecycle management
- **[metrics](./lib/metrics.md)** - Performance metrics collection and reporting

#### File Operations (Phase 3)

- **[file_operations](./lib/file_operations.md)** - File system operations (read, write, copy, etc.)
- **[edit_operations](./lib/edit_operations.md)** - File editing utilities (find, replace, diff, etc.)
- **[utils](./lib/utils.md)** - General utility functions (string, array, object helpers)
- **[argument_parser](./lib/argument_parser.md)** - CLI argument parsing with validation
- **[cleanup_handlers](./lib/cleanup_handlers.md)** - Cleanup operations (temp files, cache, etc.)

### Utility Modules (Phase 1 - v1.0.0)

Helper utilities:

- **[errors](./utils/errors.md)** - Custom error class hierarchy for workflow errors

#### Project Detection (Phase 4 - v1.0.0)

- **[project_kind_detection](./lib/project_kind_detection.md)** - Auto-detect project type from file patterns
- **[project_kind_config](./lib/project_kind_config.md)** - Load/parse project configs from YAML
- **[tech_stack](./lib/tech_stack.md)** - Detect languages, frameworks, tools
- **[third_party_exclusion](./lib/third_party_exclusion.md)** - Filter third-party files from analysis

#### Git Integration (Phase 5 - v2.0.0)

- **[git_automation](./lib/git_automation.md)** - Git operations (status, diff, commit)
- **[git_cache](./lib/git_cache.md)** - Git operation caching with invalidation
- **[auto_commit](./lib/auto_commit.md)** - Automatic artifact commits
- **[change_detection](./lib/change_detection.md)** - File change detection and categorization

#### AI Integration (Phase 6 - v2.0.0)

- **[jq_wrapper](./lib/jq_wrapper.md)** - JSON processing with jq CLI
- **[ai_personas](./lib/ai_personas.md)** - AI persona management
- **[ai_validation](./lib/ai_validation.md)** - AI response validation
- **[ai_cache](./lib/ai_cache.md)** - AI response caching
- **[ai_prompt_builder](./lib/ai_prompt_builder.md)** - AI prompt construction
- **[ai_helpers](./lib/ai_helpers.md)** - AI helper utilities

#### Performance Optimization (Phase 8 - v2.0.0) 🚧

- **[step1_parallel](./lib/step1_parallel.md)** - Parallel documentation validation for Step 1

### Orchestrator Modules (Phase 7 - v2.0.0)

Workflow orchestration and execution management:

- **[workflow_engine](./orchestrator/workflow_engine.md)** - Core workflow orchestration engine
- **[step_registry](./orchestrator/step_registry.md)** - Step definition and registration
- **[dependency_resolver](./orchestrator/dependency_resolver.md)** - Dependency graph and topological sort
- **[step_executor](./orchestrator/step_executor.md)** - Step execution with timeout and retry
- **[conditional_executor](./orchestrator/conditional_executor.md)** - Conditional step execution
- **[checkpoint_manager](./orchestrator/checkpoint_manager.md)** - Checkpoint save/resume functionality

## 🚀 Quick Reference

### Import Syntax

```javascript
// Import from main package
import { Logger, Colors, Config, SessionManager, FileOperations } from 'ai-workflow';

// Import specific modules (when published as separate packages)
import { Logger } from 'ai-workflow/core/logger';
import { Config } from 'ai-workflow/lib/config';
```

### Common Usage Patterns

#### Logging

```javascript
import { Logger } from 'ai-workflow';

const logger = new Logger({ level: 'info' });
logger.info('Information message');
logger.success('Operation completed');
logger.error('Error occurred');
```

#### Configuration

```javascript
import { Config } from 'ai-workflow';

const config = new Config();
await config.loadConfig('.workflow-config.yaml');
const value = config.get('project.name');
```

#### File Operations

```javascript
import { FileOperations } from 'ai-workflow';

const fileOps = new FileOperations();
const content = await fileOps.readFile('file.txt');
await fileOps.writeFile('output.txt', 'Hello, World!');
```

#### Session Management

```javascript
import { SessionManager } from 'ai-workflow';

const sessions = new SessionManager();
const sessionId = sessions.createSession({ user: 'developer' });
const session = sessions.getSession(sessionId);
sessions.endSession(sessionId);
```

#### Metrics Collection

```javascript
import { Metrics } from 'ai-workflow';

const metrics = new Metrics();
const opId = metrics.startOperation('processing');
// ... perform operation ...
metrics.endOperation(opId, { success: true });
const summary = metrics.getSummary();
```

## 📊 Module Comparison

### Phase 1 vs Phase 2-5 Architecture

| Aspect              | Phase 1 (v1.0.0)         | Phase 2-5 (v2.0.0 or v1.0.0)        |
| ------------------- | ------------------------ | ----------------------------------- |
| **Architecture**    | Basic modular            | Referential transparency            |
| **Testing**         | Standard unit tests      | Pure function + integration tests   |
| **Side Effects**    | Mixed with logic         | Isolated in wrapper classes         |
| **Predictability**  | Moderate                 | High (deterministic pure functions) |
| **Testability**     | Good                     | Excellent (no mocks for pure fns)   |
| **Time/Random**     | Internal calls           | Injected as parameters              |
| **Example Modules** | colors, logger, executor | config, metrics, file_operations    |

## 🔍 Module Details

### Core Modules

#### colors.js

**Purpose:** ANSI color codes for terminal output  
**Architecture:** Simple constants and functions  
**Key Features:**

- Color code constants (red, green, yellow, etc.)
- Terminal support detection
- Style combinations (bold, underline, etc.)

[📖 Full Documentation](./core/colors.md)

#### logger.js

**Purpose:** Colored logging system  
**Architecture:** Class-based with log levels  
**Key Features:**

- Multiple severity levels (debug, info, warn, error)
- Colored output with terminal detection
- Custom formatting support
- Log level filtering

[📖 Full Documentation](./core/logger.md)

#### system.js

**Purpose:** Operating system detection  
**Architecture:** Singleton pattern  
**Key Features:**

- OS detection (Linux, macOS, Windows)
- System information retrieval
- Platform-specific path handling
- Environment detection

[📖 Full Documentation](./core/system.md)

#### version.js

**Purpose:** Semantic version handling  
**Architecture:** Class-based with comparison methods  
**Key Features:**

- Semantic version parsing
- Version comparison (greater, less, equal)
- Version validation
- Range checking

[📖 Full Documentation](./core/version.md)

#### executor.js

**Purpose:** Command execution  
**Architecture:** Class-based with async support  
**Key Features:**

- Async/await command execution
- Streaming output support
- Exit code handling
- Error capture

[📖 Full Documentation](./core/executor.md)

### Library Modules (Configuration & State)

#### config.js

**Purpose:** Configuration management  
**Architecture:** Pure functions + wrapper class (v2.0.0)  
**Key Features:**

- YAML configuration loading
- Schema validation
- Configuration merging
- Nested value access

[📖 Full Documentation](./lib/config.md)

#### backlog.js

**Purpose:** Workflow backlog reporting  
**Architecture:** Pure functions + wrapper class (v2.0.0)  
**Key Features:**

- Markdown report generation
- Status emoji mapping
- Summary formatting
- Report persistence

[📖 Full Documentation](./lib/backlog.md)

#### session_manager.js

**Purpose:** Session lifecycle management  
**Architecture:** Pure functions + wrapper class (v2.0.0)  
**Key Features:**

- Session creation with unique IDs
- Session metadata tracking
- Session archiving
- Session expiration

[📖 Full Documentation](./lib/session_manager.md)

#### metrics.js

**Purpose:** Performance metrics collection  
**Architecture:** Pure functions + wrapper class (v2.0.0)  
**Key Features:**

- Operation timing
- Resource usage tracking
- Metrics aggregation
- Report generation

[📖 Full Documentation](./lib/metrics.md)

### Library Modules (File Operations)

#### file_operations.js

**Purpose:** File system operations  
**Architecture:** Pure functions + wrapper class (v2.0.0)  
**Key Features:**

- Read/write operations
- Directory management
- File existence checks
- Path validation

[📖 Full Documentation](./lib/file_operations.md)

#### edit_operations.js

**Purpose:** File editing utilities  
**Architecture:** Pure functions + wrapper class (v2.0.0)  
**Key Features:**

- Find and replace
- Diff generation
- Line operations
- Pattern matching

[📖 Full Documentation](./lib/edit_operations.md)

#### utils.js

**Purpose:** General utility functions  
**Architecture:** Pure functions only (v1.0.0)  
**Key Features:**

- String manipulation
- Array operations
- Object helpers
- Data validation

[📖 Full Documentation](./lib/utils.md)

#### argument_parser.js

**Purpose:** CLI argument parsing  
**Architecture:** Pure functions + wrapper class (v2.0.0)  
**Key Features:**

- Argument parsing with schema
- Type validation and coercion
- Auto-generated help text
- Default values

[📖 Full Documentation](./lib/argument_parser.md)

#### cleanup_handlers.js

**Purpose:** Cleanup operations  
**Architecture:** Pure functions + wrapper class (v2.0.0)  
**Key Features:**

- Age-based cleanup
- Size-based cleanup
- Pattern-based filtering
- Dry-run mode

[📖 Full Documentation](./lib/cleanup_handlers.md)

### Utility Modules

#### errors.js

**Purpose:** Custom error classes  
**Architecture:** Class hierarchy  
**Key Features:**

- Custom error types
- Error context preservation
- Error code mapping
- Stack trace handling

[📖 Full Documentation](./utils/errors.md)

## 🧪 Testing

All modules have comprehensive test coverage:

- **Phase 1 modules:** 85 tests (standard unit tests)
- **Phase 2-5 modules:** 829 tests (pure function + integration tests)
- **Total:** 528+ tests with 100% pass rate

### Test Structure

```
test/
├── core/          # Phase 1 tests
│   ├── colors.test.js
│   ├── logger.test.js
│   ├── system.test.js
│   ├── version.test.js
│   └── executor.test.js
├── lib/           # Phase 2-5 tests
│   ├── config.test.js
│   ├── backlog.test.js
│   ├── session_manager.test.js
│   ├── metrics.test.js
│   ├── file_operations.test.js
│   ├── edit_operations.test.js
│   ├── utils.test.js
│   ├── argument_parser.test.js
│   └── cleanup_handlers.test.js
└── utils/         # Phase 1 tests
    └── errors.test.js
```

## 📚 Related Documentation

- **[Architecture Overview](../architecture/OVERVIEW.md)** - System design and patterns
- **[Developer Guide](../guides/DEVELOPER_GUIDE.md)** - Development workflow
- **[Testing Guide](../guides/TESTING_GUIDE.md)** - Testing patterns
- **[Quick Start](../getting-started/QUICK_START.md)** - Getting started guide

## 🔗 External Resources

- **GitHub Repository:** [mpbarbosa/ai_workflow.js](https://github.com/mpbarbosa/ai_workflow.js)
- **Issue Tracker:** [GitHub Issues](https://github.com/mpbarbosa/ai_workflow.js/issues)
- **npm Package:** _(Coming soon)_

---

**Need more details?** Browse individual module documentation linked above.

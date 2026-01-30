# GitHub Copilot Instructions: ai_workflow.js

> 🎯 **Project Context**: This is a **JavaScript/Node.js implementation** of AI-powered workflow automation for software development projects. It is a complete migration from the shell-based [ai_workflow](https://github.com/mpbarbosa/ai_workflow) repository, reimagining the architecture with modern JavaScript best practices while maintaining feature parity.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture & Design Principles](#architecture--design-principles)
- [Current Implementation Status](#current-implementation-status)
- [Module Structure](#module-structure)
- [Referential Transparency Pattern](#referential-transparency-pattern)
- [Coding Standards & Conventions](#coding-standards--conventions)
- [Key Documentation References](#key-documentation-references)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Common Assistance Patterns](#common-assistance-patterns)
- [Migration Context](#migration-context)
- [Quick Reference](#quick-reference)
- [Contact & Resources](#contact--resources)

---

## Project Overview

**ai_workflow.js** is a Node.js implementation of an AI-powered workflow automation system for software development. It provides a comprehensive 15-step pipeline for documentation validation, test generation, code quality analysis, and CI/CD integration with GitHub Copilot.

**Key Characteristics:**

- **Workflow Automation Engine**: Orchestrates 15-step AI-powered development workflows
- **Cross-Platform**: Works on Linux, macOS, and Windows via Node.js
- **Modern JavaScript**: ES6+ modules, async/await, pure functional patterns
- **Referentially Transparent**: v2.0.0 modules follow functional programming principles
- **Comprehensive Testing**: 259+ tests with 100% pass rate and high coverage

**Version**: 1.1.0 (Project) / 1.0.0 (Phase 1 modules) / 2.0.0 (Phase 2.1 modules)  
**License**: MIT  
**Source Repository**: [mpbarbosa/ai_workflow](https://github.com/mpbarbosa/ai_workflow) (Shell/Bash v3.0.0)

**Migration Note**: This is NOT a line-by-line shell-to-JavaScript translation. It's a complete architectural redesign extracting behaviors and features from the original shell scripts while building idiomatic JavaScript code with modern best practices.

---

## Architecture & Design Principles

### Core Architectural Patterns

1. **Referential Transparency (v2.0.0)**
   - Pure functions for core logic (deterministic, no side effects)
   - Impure wrapper classes for I/O and state management
   - Time and random dependencies injected as parameters
   - Immutable data transformations throughout
   - Isolated side effects at system boundaries

2. **Layered Architecture**

   ```
   ┌─────────────────────────────────────┐
   │  CLI Layer (future Phase 7)         │
   ├─────────────────────────────────────┤
   │  Workflow Engine (future Phase 4)   │
   ├─────────────────────────────────────┤
   │  Configuration & State (Phase 2.1)  │  ← Current: v2.0.0 with pure functions
   ├─────────────────────────────────────┤
   │  Core Foundation (Phase 1)          │  ← Complete: v1.0.0
   └─────────────────────────────────────┘
   ```

3. **Module Organization**
   - **src/core/**: Foundation utilities (colors, logger, system, version, executor)
   - **src/utils/**: Helper functions (errors)
   - **src/lib/**: Configuration and state management (config, backlog, session_manager, metrics)
   - **test/**: Comprehensive test suite mirroring src/ structure
   - **docs/**: Architecture, requirements, and migration documentation

4. **Dependency Management**
   - Minimal external dependencies (@github/copilot-sdk only for production)
   - No heavy frameworks - lightweight and focused
   - Dev dependencies for testing (jest) and code quality (eslint, prettier)

5. **Configuration Management**
   - Uses `.workflow_core/` submodule for shared configuration templates
   - Project-specific config in `.workflow-config.yaml`
   - Workflow artifacts in `.ai_workflow/` directory (logs, metrics, backlog, summaries)

---

## Current Implementation Status

### ✅ Phase 1: Core Foundation (v1.0.0) - COMPLETE

**Modules Implemented (7 modules, ~595 LOC):**

| Module                 | Version | LOC | Purpose                                              |
| ---------------------- | ------- | --- | ---------------------------------------------------- |
| `src/core/colors.js`   | v1.0.0  | 54  | ANSI color codes with terminal support detection     |
| `src/core/logger.js`   | v1.0.0  | 99  | Colored logging system with multiple severity levels |
| `src/utils/errors.js`  | v1.0.0  | 68  | Custom error class hierarchy for workflow errors     |
| `src/core/system.js`   | v1.0.0  | 130 | OS detection and system configuration                |
| `src/core/version.js`  | v1.0.0  | 114 | Semantic version parsing and comparison              |
| `src/core/executor.js` | v1.0.0  | 105 | Command execution with async/streaming support       |
| `src/index.js`         | v1.0.0  | 25  | Module exports and public API                        |

**Testing:** 85 tests, 95%+ coverage, 100% pass rate

### ✅ Phase 2.1: Configuration & State Management (v2.0.0) - COMPLETE

**Modules Implemented (4 modules, ~1,205 LOC):**

| Module                       | Version | LOC | Purpose                          | Architecture             |
| ---------------------------- | ------- | --- | -------------------------------- | ------------------------ |
| `src/lib/config.js`          | v2.0.0  | 315 | Configuration management         | Pure functions + wrapper |
| `src/lib/backlog.js`         | v2.0.0  | 195 | Workflow summary/backlog reports | Pure functions + wrapper |
| `src/lib/session_manager.js` | v2.0.0  | 220 | Session lifecycle management     | Pure functions + wrapper |
| `src/lib/metrics.js`         | v2.0.0  | 475 | Performance metrics collection   | Pure functions + wrapper |

**Testing:** 174 tests (86 pure function tests + 88 integration tests), 100% coverage, 100% pass rate

**Referential Transparency Refactoring:**

- All Phase 2.1 modules refactored to v2.0.0 with pure functional architecture
- Core logic extracted as pure functions (deterministic, no side effects, immutable)
- Side effects isolated in wrapper classes (I/O, console logging, state management)
- Time/random dependencies injected as parameters instead of internal calls
- Comprehensive testing: 86 deterministic tests for pure functions, 88 tests for integration

### 🚧 Phase 2.2-2.4: Remaining Configuration (IN PROGRESS)

- Phase 2.2: Git Integration (lib/git_automation.js, lib/git_cache.js)
- Phase 2.3: Project Detection (lib/project_type.js, lib/tech_stack_detection.js)
- Phase 2.4: File Operations (lib/file_operations.js, lib/edit_operations.js)

### 📋 Future Phases

- **Phase 3**: AI Integration (Copilot integration, AI personas, caching, prompt generation)
- **Phase 4**: Workflow Engine (Step orchestration, dependencies, parallelization, checkpoints)
- **Phase 5**: Step Implementations (15 workflow steps)
- **Phase 6**: Performance Optimizations (Smart execution, ML optimization, caching strategies)
- **Phase 7**: CLI & User Interface (Interactive CLI, progress indicators, configuration wizard)
- **Phase 8**: Testing & Quality Assurance (End-to-end tests, validation, performance testing)
- **Phase 9**: Documentation & Examples (Complete docs, tutorials, migration guides)
- **Phase 10**: Packaging & Distribution (npm package, installation, deployment)

**Overall Progress:** 2 of 10 major phases complete (~20% of migration)

---

## Module Structure

### Directory Layout

```
ai_workflow.js/
├── src/
│   ├── core/                    # Phase 1: Foundation utilities (v1.0.0)
│   │   ├── colors.js            # ANSI color codes
│   │   ├── logger.js            # Logging system
│   │   ├── system.js            # OS detection
│   │   ├── version.js           # Semver handling
│   │   └── executor.js          # Command execution
│   ├── utils/                   # Phase 1: Helper utilities (v1.0.0)
│   │   └── errors.js            # Custom error classes
│   ├── lib/                     # Phase 2: Core libraries (v2.0.0+)
│   │   ├── config.js            # ✅ Configuration management (v2.0.0)
│   │   ├── backlog.js           # ✅ Backlog reporting (v2.0.0)
│   │   ├── session_manager.js   # ✅ Session lifecycle (v2.0.0)
│   │   ├── metrics.js           # ✅ Performance metrics (v2.0.0)
│   │   ├── git_automation.js    # 🚧 Git operations (planned)
│   │   ├── git_cache.js         # 🚧 Git caching (planned)
│   │   ├── project_type.js      # 🚧 Project detection (planned)
│   │   └── ...                  # 🚧 More modules (future phases)
│   ├── cli/                     # Phase 7: CLI (future)
│   ├── orchestrator/            # Phase 4: Workflow engine (future)
│   ├── managers/                # Phase 3: AI integration (future)
│   └── index.js                 # Public API exports
├── test/                        # Comprehensive test suite
│   ├── core/                    # Phase 1 tests (85 tests)
│   ├── utils/                   # Phase 1 tests
│   └── lib/                     # Phase 2.1 tests (174 tests)
├── docs/                        # Documentation
│   ├── FUNCTIONAL_REQUIREMENTS.md
│   ├── reports/
│   │   ├── implementation/
│   │   │   └── MIGRATION_PLAN.md
│   │   └── analysis/
│   │       └── CORRECTION_REPORT.md
│   └── misc/
├── .workflow_core/              # Config templates submodule
├── .ai_workflow/                # Workflow artifacts
│   ├── backlog/                 # Execution reports
│   ├── summaries/               # AI summaries
│   ├── logs/                    # Execution logs
│   └── metrics/                 # Performance data
├── .github/
│   ├── copilot-instructions.md  # This file
│   └── REFERENTIAL_TRANSPARENCY.md
├── .workflow-config.yaml        # Project configuration
├── package.json                 # Node.js project metadata
├── jest.config.json             # Jest configuration
├── eslint.config.mjs            # ESLint configuration
├── README.md                    # Project overview
├── CHANGELOG.md                 # Version history
├── CONTRIBUTING.md              # Contribution guidelines
└── LICENSE                      # MIT License
```

### Module Dependency Graph (Phase 1 + 2.1)

```
┌────────────────────────────────────────┐
│         Phase 2.1: lib/ (v2.0.0)       │
│   ┌──────────┐  ┌──────────┐          │
│   │ config   │  │ backlog  │          │
│   └────┬─────┘  └────┬─────┘          │
│        │             │                 │
│   ┌────┴─────┐  ┌───┴──────┐          │
│   │ session_ │  │ metrics  │          │
│   │ manager  │  │          │          │
│   └────┬─────┘  └────┬─────┘          │
└────────┼─────────────┼────────────────┘
         │             │
         ▼             ▼
┌────────────────────────────────────────┐
│       Phase 1: core/ (v1.0.0)          │
│                                         │
│   ┌────────┐  ┌────────┐  ┌────────┐ │
│   │ logger │  │ system │  │executor│ │
│   └────┬───┘  └────┬───┘  └────┬───┘ │
│        │           │           │      │
│        └───────────┴───────────┘      │
│                    │                   │
│              ┌─────▼─────┐            │
│              │  colors   │            │
│              └───────────┘            │
│                                        │
│         ┌──────────┐  ┌──────────┐   │
│         │ version  │  │  errors  │   │
│         └──────────┘  └──────────┘   │
└────────────────────────────────────────┘
```

**Dependency Rules:**

- Phase 1 modules have no dependencies on Phase 2+ modules
- Phase 2.1 modules depend only on Phase 1 core utilities
- Future phases will depend on Phase 1 + 2 foundation

---

## Referential Transparency Pattern (v2.0.0)

### Overview

Phase 2.1 modules (v2.0.0) follow a **referential transparency architecture** separating pure functions from side effects:

```javascript
// ✅ Pure Functions - Exported for testing and reuse
export function generateSessionId(randomBytes) {
  return randomBytes.toString('hex'); // Deterministic given input
}

export function createSessionEntry(sessionId, currentTime, metadata) {
  return { id: sessionId, startTime: currentTime, ...metadata }; // Immutable
}

// ❌ Impure Wrapper - Handles side effects
export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(metadata = {}) {
    // Inject dependencies (time, randomness)
    const randomBytes = crypto.randomBytes(16);
    const sessionId = generateSessionId(randomBytes); // Pure function
    const entry = createSessionEntry(sessionId, Date.now(), metadata); // Pure function

    this.sessions.set(sessionId, entry); // Side effect: state mutation
    logger.info(`Session created: ${sessionId}`); // Side effect: I/O
    return sessionId;
  }
}
```

### Design Principles

1. **Pure Functions (Referentially Transparent)**
   - Always produce same output for same input (deterministic)
   - No observable side effects (no mutation, I/O, global state)
   - Time/random dependencies passed as parameters
   - Immutable data transformations
   - Easy to test (no mocks needed)

2. **Impure Wrappers (Side Effect Boundaries)**
   - Handle I/O operations (file system, console, network)
   - Manage mutable state (in-memory caches, sessions)
   - Inject time (`Date.now()`) and randomness (`crypto.randomBytes()`)
   - Call pure functions for business logic
   - Isolate side effects at system boundaries

3. **Benefits**
   - **Testability**: Pure functions have deterministic tests, no setup/teardown
   - **Predictability**: Same inputs always produce same outputs
   - **Composability**: Pure functions can be freely combined
   - **Maintainability**: Clear separation of concerns
   - **Debugging**: Side effects are obvious and isolated

### Architecture Pattern

```
┌──────────────────────────────────────────────┐
│         APPLICATION LAYER (Impure)           │
│  SessionManager, ConfigManager, etc.         │
│  - File I/O, Console logging                 │
│  - State management, Time/Random injection   │
└──────────────┬───────────────────────────────┘
               │ calls
               ▼
┌──────────────────────────────────────────────┐
│         BUSINESS LOGIC (Pure Functions)      │
│  generateSessionId, createSessionEntry, etc. │
│  - Deterministic calculations                │
│  - Immutable transformations                 │
│  - No side effects                           │
└──────────────────────────────────────────────┘
```

### Testing Strategy

**Pure Functions** (86 tests across Phase 2.1 modules):

```javascript
describe('Pure Functions', () => {
  test('generateSessionId is deterministic', () => {
    const bytes = Buffer.from('test1234test1234');
    expect(generateSessionId(bytes)).toBe('7465737431323334746573743132333');
    expect(generateSessionId(bytes)).toBe('7465737431323334746573743132333'); // Always same
  });
});
```

**Integration Tests** (88 tests across Phase 2.1 modules):

```javascript
describe('SessionManager Integration', () => {
  test('createSession generates unique IDs', () => {
    const manager = new SessionManager();
    const id1 = manager.createSession();
    const id2 = manager.createSession();
    expect(id1).not.toBe(id2); // Non-deterministic (uses crypto.randomBytes)
  });
});
```

### Modules Using This Pattern

| Module             | Pure Functions                                   | Wrapper Class      | Benefits                          |
| ------------------ | ------------------------------------------------ | ------------------ | --------------------------------- |
| config.js          | `parseYamlSync`, `validateConfig`, etc.          | `ConfigManager`    | Configuration parsing is testable |
| backlog.js         | `getStatusEmoji`, `generateSummaryContent`, etc. | `BacklogManager`   | Markdown generation is pure       |
| session_manager.js | `generateSessionId`, `createSessionEntry`, etc.  | `SessionManager`   | Session logic is deterministic    |
| metrics.js         | `calculateDuration`, `formatMetrics`, etc.       | `MetricsCollector` | Metric calculations are pure      |

**See:** `.github/REFERENTIAL_TRANSPARENCY.md` for complete guide and examples.

---

## Coding Standards & Conventions

### Documentation Standards

From project conventions:

- **File paths**: Always use inline code: `` `config/.workflow-config.yaml.template` ``
- **Commands**: Use code blocks or inline code: `` `git submodule add ...` ``
- **Configuration values**: Use inline code: `` `primary_language: "bash"` ``
- **Status indicators**: Use emoji: ✅ ❌ ⚠️ 🚧
- **Placeholders**: Keep `{{PLACEHOLDER}}` format in templates

### Template File Standards

**Template Naming:**

- Use `.template` extension for files that need customization
- Users copy without extension and replace placeholders

**Placeholder Format:**

```yaml
# In templates (ai_workflow_core):
project:
  name: "{{PROJECT_NAME}}"
  language: "{{LANGUAGE}}"

# In user projects (after customization):
project:
  name: "My Actual Project"
  language: "javascript"
```

**YAML Standards:**

- 2-space indentation
- Quote string values
- Comment complex sections
- Group related configurations
- Document required vs optional fields

### Script Standards (for templates)

For `.template` scripts:

```bash
#!/usr/bin/env bash
# Script name and purpose
# Placeholders: {{PROJECT_ROOT}}, {{ARTIFACT_DIR}}

set -euo pipefail

# Configuration with placeholders
readonly PROJECT_ROOT="{{PROJECT_ROOT}}"
readonly ARTIFACT_DIR="{{ARTIFACT_DIR}}"
```

### Commit Message Convention

Format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:

```
feat(config): Add TypeScript project kind

- Add typescript_app to project_kinds.yaml
- Define linting with tslint/eslint
- Set coverage threshold to 80%

Closes #123
```

---

## Key Documentation References

When assisting with this project, reference these critical documents:

### Essential Reading

1. **README.md**: Project overview, quick start, placeholder reference
2. **CHANGELOG.md**: Version history and changes
3. **docs/INTEGRATION.md**: Integration guide for using as Git submodule
4. **docs/AI_WORKFLOW_DIRECTORY.md**: `.ai_workflow/` directory structure explanation
5. **docs/CODE_OF_CONDUCT.md**: Contributor Covenant 2.1

### Configuration References (Core Assets)

6. **config/.workflow-config.yaml.template**: Main configuration template with placeholders
7. **config/project_kinds.yaml**: Project type definitions with validation rules (7 project types)
8. **config/ai_helpers.yaml**: AI helper configurations (1900+ lines)
9. **config/ai_prompts_project_kinds.yaml**: Project-specific AI prompts
10. **config/paths.yaml**: Path configurations
11. **config/README.md**: Configuration system overview

### Integration Examples

12. **examples/shell/README.md**: Shell script integration example (basic quick start)
13. **examples/nodejs/README.md**: Node.js integration example (comprehensive with full setup)

**Note**: The shell example is a minimal quick-start. The nodejs example provides a complete, detailed integration guide. Consider expanding the shell example with similar detail if working on examples.

### Additional Documentation

14. **docs/CONTRIBUTING.md**: Contributing guidelines (references parent ai_workflow project features)
15. **docs/guides/PROJECT_REFERENCE.md**: Project reference (documents parent ai_workflow v3.0.0)
16. **docs/guides/ML_OPTIMIZATION_GUIDE.md**: ML optimization guide (for parent project)
17. **docs/guides/MULTI_STAGE_PIPELINE_GUIDE.md**: Pipeline guide (for parent project)

### ⚠️ Important: Documentation Context

**Note**: `docs/CONTRIBUTING.md`, `docs/guides/PROJECT_REFERENCE.md`, and some other docs in `docs/guides/` reference features from the **parent ai_workflow project** (the execution engine), NOT this configuration library. When helping with ai_workflow_core:

- **Focus on**: Configuration templates, project_kinds schemas, placeholder patterns, integration examples
- **This repo provides**: Templates, configs, examples, documentation structure
- **This repo does NOT provide**: Workflow execution engine, step orchestration, AI pipeline features
- **Parent project** (ai_workflow) uses this as a foundation and adds execution capabilities

---

## Development Workflow

### Working on Configuration Templates

When modifying template files in `config/`:

1. Update the configuration file (`.yaml` or `.template`)
2. Update placeholder documentation in README.md if adding new placeholders
3. Test with actual values in `.workflow-config.yaml` (this repo's own config)
4. Update CHANGELOG.md if significant change
5. Ensure backward compatibility or document breaking changes in migration guide

### Adding New Project Kinds

To add a new project type to `config/project_kinds.yaml`:

1. Study existing project kind definitions (7 current types)
2. Define validation rules (required files, directories, file patterns)
3. Specify testing configuration (framework, commands, coverage thresholds)
4. Define quality standards (linters, documentation requirements)
5. Add AI guidance (testing standards, style guides, best practices, directory standards)
6. Update metadata changelog at bottom of file
7. Consider creating example integration in `examples/` directory

### Working on Examples

When creating or updating integration examples in `examples/`:

1. Create complete project structure showing realistic integration
2. Include customized `.workflow-config.yaml` with actual values (no placeholders)
3. Write comprehensive README.md with step-by-step setup
4. Show before/after for key configuration files
5. Include working code examples relevant to the language
6. Document common pitfalls and solutions

### Testing Changes

Since this is a template/configuration repository:

1. **Self-test**: Apply changes to `.workflow-config.yaml` in this repo
2. **Example test**: Verify changes work in `examples/*/` projects
3. **Validation**: Run `scripts/validate_context_blocks.py` for documentation
4. **Schema validation**: Ensure YAML syntax is valid
5. **Placeholder verification**: Check all `{{PLACEHOLDERS}}` are documented

**No execution tests**: This repo doesn't contain workflow execution code, so there are no unit/integration tests for step execution.

### Documentation Updates

When updating documentation:

- Follow documentation conventions (inline code for paths, commands, config values)
- Update table of contents for long documents
- Include examples for complex concepts
- Test all commands and code examples if applicable
- Keep "Last Updated" dates current
- **Remember**: Some docs in `docs/guides/` reference parent ai_workflow features

---

## Common Assistance Patterns

### When Helping with Configuration Files

- Always preserve `{{PLACEHOLDER}}` syntax in template files
- Don't replace placeholders with specific values in core templates
- Validate YAML syntax (proper indentation, quoting)
- Check against existing project kind schemas in `config/project_kinds.yaml`
- Consider backward compatibility with existing integrations
- Document any new placeholders in README.md

### When Helping with Documentation

- Use inline code for file paths: `` `config/.workflow-config.yaml.template` ``
- Follow markdown conventions consistently
- Add examples for complex concepts
- Link to related configuration files or examples
- Keep language clear and concise
- Be aware some docs reference parent ai_workflow features

### When Helping with Script Templates

- Keep `.template` extension on template files
- Document required placeholder substitutions in comments
- Ensure cross-platform compatibility where possible (bash vs. platform-specific)
- Add usage examples in script header comments or accompanying README
- Use placeholder format: `{{PLACEHOLDER_NAME}}`

### When Helping with Integration

- Understand this project is used as a Git submodule, not standalone
- Guide through: add submodule → copy template → replace placeholders → create directories
- Reference appropriate example project (`examples/shell/` or `examples/nodejs/`)
- Explain `.ai_workflow/` directory purpose and `.gitignore` patterns
- Clarify this repo provides templates, not execution capabilities

### When Helping with Project Kinds

- Reference existing definitions in `config/project_kinds.yaml`
- Understand the schema: validation, testing, quality, dependencies, build, deployment, ai_guidance
- Know which linters and frameworks are standard for each project type
- Be aware of language-specific best practices in `ai_guidance` sections
- Consider test coverage thresholds (varies by project type: 0-80%)

### When Helping with GitHub Workflows

- Reference existing workflow files in `github/workflows/`
- Current workflows: `code-quality.yml`, `validate-docs.yml`, `validate-tests.yml`
- These are templates that projects can copy and customize
- Workflows assume the target project structure, not this repo's structure
- Workflows are language-agnostic and can be adapted for different project types

---

## Important Context

### This is a Configuration & Template Library

**What this repository IS:**

- Configuration file templates with placeholder patterns
- Project kind definitions and validation schemas
- Integration examples for different languages
- Documentation structure and standards
- Utility script templates
- GitHub workflow templates

**What this repository IS NOT:**

- A workflow execution engine (that's in the parent ai_workflow project)
- A complete automation system
- An application or service
- A testing framework

**Key Distinction:**

- **ai_workflow_core** = Templates + Configuration + Examples (this repo)
- **ai_workflow** = Execution Engine + Orchestration + AI Integration (parent project)

### Documentation Context Warning

⚠️ **Important**: Several documentation files in `docs/` were copied from the parent ai_workflow project and reference execution features:

**Files that reference parent project:**

- `docs/CONTRIBUTING.md` - Documents workflow execution, testing framework, v2.x/v3.x features
- `docs/guides/PROJECT_REFERENCE.md` - Documents ai_workflow v3.0.0 execution features
- `docs/guides/ML_OPTIMIZATION_GUIDE.md` - ML optimization for workflow execution
- `docs/guides/MULTI_STAGE_PIPELINE_GUIDE.md` - Pipeline execution patterns

**When helping with ai_workflow_core, focus on:**

- Configuration templates and schemas
- Placeholder patterns and substitution
- Project kind definitions
- Integration examples
- Documentation structure (not execution features)

### Dual Development Context

When working on this repository, you might be:

1. **Developing the config library**: Improving templates, schemas, examples
2. **Testing integration**: Using it as a submodule in another project
3. **Dogfooding**: Applying ai_workflow_core to itself (see `.workflow-config.yaml`)

Always clarify which context applies to the current task.

### Version Compatibility

- **ai_workflow_core version**: 1.0.0
- **Schema version** (project_kinds.yaml): 1.1.0
- Maintain backward compatibility within major version
- Document breaking changes in CHANGELOG.md
- Provide migration guides for major version changes

### Repository Scope

**This repository contains:**

- Configuration templates (2 files: `.workflow-config.yaml.template`, `cleanup_artifacts.sh.template`)
- Configuration schemas (5 YAML files in `config/`: project_kinds, ai_helpers, ai_prompts_project_kinds, paths, README)
- GitHub workflow templates (3 files in `github/workflows/`: code-quality, validate-docs, validate-tests)
- Integration examples (2 language examples: shell minimal quick-start, nodejs comprehensive guide)
- Documentation (7 core docs in `docs/` + 3 guides in `docs/guides/`)
- Utility scripts (1 Python validator: `validate_context_blocks.py`)
- Workflow artifacts in `.ai_workflow/` (for dogfooding - this repo tests itself)

**This repository does NOT contain:**

- Workflow execution engine (no `src/workflow/` directory)
- Test execution framework (no `tests/` directory)
- AI integration code (only configuration schemas for AI helpers)
- Step orchestration logic (only directory structure definitions)

**Terminology Standards:**

- Project type field: Use hyphens (e.g., `type: "nodejs-application"`, `type: "configuration-library"`)
- Project kind field: Use underscores (e.g., `kind: "nodejs_api"`, `kind: "configuration_library"`)
- YAML keys: Use underscores (e.g., `project_kinds`, `shell_script_automation`)
- Version format: No 'v' prefix in config values (e.g., `version: "1.0.0"` not `"v1.0.0"`)

### Integration Pattern

This repository is designed to be used as a Git submodule:

```bash
# In target project:
git submodule add https://github.com/mpbarbosa/ai_workflow_core.git .workflow_core
cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml
# Edit .workflow-config.yaml to replace {{PLACEHOLDERS}}
```

---

## Quick Reference

### File Extensions

- `.template`: Copy without extension, replace placeholders
- `.yaml` / `.yml`: Configuration files
- `.md`: Markdown documentation
- `.sh`: Shell scripts (must be executable)

### Common Commands

```bash
# Add as submodule
git submodule add https://github.com/mpbarbosa/ai_workflow_core.git .workflow_core

# Update submodule
git submodule update --init --recursive

# Copy and customize config
cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml

# Create artifact directories
mkdir -p .ai_workflow/{backlog,summaries,logs,metrics,checkpoints,prompts,ml_models,.incremental_cache}

# Run validation script
python3 scripts/validate_context_blocks.py docs/
```

### Placeholder Substitution Pattern

```bash
# Don't do this in core templates:
❌ name: "My Project"

# Do this in core templates:
✅ name: "{{PROJECT_NAME}}"

# Users do this in their projects:
✅ name: "My Actual Project"
```

---

## Contact & Resources

- **Repository**: [github.com/mpbarbosa/ai_workflow_core](https://github.com/mpbarbosa/ai_workflow_core)
- **Issues**: [GitHub Issues](https://github.com/mpbarbosa/ai_workflow_core/issues)
- **Original Project**: [github.com/mpbarbosa/ai_workflow](https://github.com/mpbarbosa/ai_workflow)
- **License**: MIT (see docs/LICENSE)

---

**Last Updated**: 2026-01-29  
**Document Version**: 1.0.0  
**For**: GitHub Copilot assistance within ai_workflow_core repository

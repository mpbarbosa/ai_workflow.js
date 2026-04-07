# ai_workflow.js

AI-Powered Workflow Automation for Software Development

[![npm version](https://img.shields.io/npm/v/ai-workflow.svg)](https://www.npmjs.com/package/ai-workflow)
[![Node.js Version](https://img.shields.io/node/v/ai-workflow.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-6209%20passing-brightgreen)](test/)
[![Coverage](https://img.shields.io/badge/coverage-86.79%25-green)](coverage/)

**Version:** 1.9.6 🎉 **STABLE RELEASE**
**Status:** Production Ready ✅
**Last Updated:** March 11, 2026

---

## 🚀 Quick Start

```bash
# Install globally
npm install -g ai-workflow

# Initialize in your project
cd your-project/
ai-workflow init

# Run the workflow
ai-workflow run

# Check status
ai-workflow status
```

## 📖 Overview

**ai_workflow.js** is a production-ready Node.js implementation of AI-powered workflow automation for software development projects. It provides a comprehensive 20-step pipeline for documentation validation, test generation, code quality analysis, and CI/CD integration with GitHub Copilot.

This is a complete JavaScript/Node.js reimplementation of [ai_workflow](https://github.com/mpbarbosa/ai_workflow) (Shell/Bash v3.0.0), redesigned with modern architecture patterns and cross-platform compatibility.

### ✨ Key Features

- **🤖 AI-Powered**: 14 specialized personas for different workflow tasks
- **⚡ Fast**: Parallel execution, smart caching, incremental processing
- **🔧 Configurable**: Project-specific workflows via YAML config
- **📊 Observable**: Progress tracking, metrics, and checkpoints
- **🧪 Tested**: 6,209 tests passing, 86.79% coverage
- **🔒 Secure**: 0 vulnerabilities, automated security scanning
- **📦 Production-Ready**: npm package with CI/CD automation

---

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g ai-workflow
```

### Project-Local Installation

```bash
npm install --save-dev ai-workflow
```

### Requirements

- **Node.js**: >= 20.0.0
- **npm**: >= 9.0.0
- **Git**: >= 2.0.0 (for git automation features)
- **jq**: >= 1.6 (for JSON processing, optional)

---

## Current Implementation Status

**Version:** 1.9.6 (Stable Release)
**Tests:** 6,209 passing (3 skipped)
**Coverage:** 86.79% overall, 95.43% orchestrator
**Security:** 0 vulnerabilities
**Phases Complete:** 13 of 13 ✅

### Phase Completion

| Phase    | Status | Modules | Tests | Description                                                                            |
| -------- | ------ | ------- | ----- | -------------------------------------------------------------------------------------- |
| Phase 1  | ✅     | 7       | 113   | Core Foundation (colors, logger, system, version, executor, errors)                    |
| Phase 2  | ✅     | 4       | 174   | Configuration & State (config, backlog, session, metrics)                              |
| Phase 3  | ✅     | 5       | 354   | File Operations (file ops, edit ops, utils, arg parser, cleanup)                       |
| Phase 4  | ✅     | 4       | 167   | Project Detection (kind detection, config, tech stack, exclusions)                     |
| Phase 5  | ✅     | 4       | 219   | Git Integration (automation, cache, auto-commit, change detection)                     |
| Phase 6  | ✅     | 6       | 424   | AI Integration (jq, personas, validation, cache, prompts, helpers)                     |
| Phase 7  | ✅     | 6       | 329   | Workflow Orchestration (engine, registry, resolver, executor, conditional, checkpoint) |
| Phase 8  | ✅     | 1       | 646   | Performance Optimization (parallel validation)                                         |
| Phase 9  | ✅     | 20      | 1100+ | Workflow Steps (20 complete steps)                                                     |
| Phase 10 | ✅     | 1       | 64    | Main Orchestrator (main workflow orchestrator)                                         |
| Phase 11 | ✅     | 10      | 231   | CLI Layer (6 commands, 4 utilities)                                                    |
| Phase 12 | ✅     | -       | 8     | Testing & Security (automation scripts, security audit)                                |
| Phase 13 | ✅     | -       | -     | Packaging & Release (npm package, CI/CD, documentation)                                |

**Total:** 67 modules, 4,412 passing tests, 13 phases complete

---

- Markdown linting
- UX/accessibility analysis
- Context management
- Prompt engineering

## Migration Plan

A comprehensive migration plan has been created that outlines:

- Current state analysis
- Architecture design for the JavaScript implementation
- Technology stack and dependencies
- Phase-by-phase implementation strategy
- Testing strategy
- Timeline and resources

📄 **See [MIGRATION_PLAN.md](./docs/reports/implementation/MIGRATION_PLAN.md) for the complete migration plan.**

## Documentation

Key project documents:

- **[API Reference](./docs/api/README.md)** - Complete API documentation for all modules with usage examples
- **[Workflow Engine Requirements](./docs/WORKFLOW_ENGINE_REQUIREMENTS.md)** - Phase 7 planning, test validation, and orchestration specifications
- **[MIGRATION_PLAN.md](./docs/reports/implementation/MIGRATION_PLAN.md)** - Comprehensive migration plan with architecture, phases, and implementation details
- **[FUNCTIONAL_REQUIREMENTS.md](./docs/FUNCTIONAL_REQUIREMENTS.md)** - Detailed module requirements for Phase 1-5 (Foundation, Configuration/State Management, File Operations, Project Detection, Git Integration)
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and notable changes with semantic versioning
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Guidelines for contributing to the project
- **[LICENSE](./LICENSE)** - MIT License

## Copilot SDK Integration

This project leverages **GitHub Copilot SDK** to provide:

- 🤖 **AI-Powered Development** - Intelligent code generation and refactoring
- 🔄 **Workflow Automation** - Automated migration assistance and code transformation
- 📊 **Code Analysis** - AI-driven code quality and architecture recommendations
- 🧪 **Test Generation** - Automated test creation and coverage improvements
- 📝 **Documentation** - AI-assisted documentation generation and maintenance

### Configuration & Templates

The project uses two Git submodules:

- [ai_workflow_core](https://github.com/mpbarbosa/ai_workflow_core) (`.workflow_core/`) — shared configuration templates, GitHub integration, and utility scripts
- [ai_workflow_fspec](https://github.com/mpbarbosa/ai_workflow_fspec) (`.workflow_fspec/`) — language-independent functional specification

To update the submodules:

```bash
git submodule update --remote .workflow_core
git submodule update --remote .workflow_fspec
```

See [.workflow-config.yaml](./.workflow-config.yaml) for project-specific configuration.

## Target Features

The JavaScript implementation will maintain feature parity with the original shell scripts while adding:

- ✅ Cross-platform compatibility
- ✅ Improved testability with comprehensive unit and integration tests
- ✅ Modern async/await patterns
- ✅ Better error handling and recovery
- ✅ Enhanced modularity and extensibility
- ✅ Plugin system for custom updaters
- ✅ Rich CLI with progress indicators and colors
- ✅ Type documentation with JSDoc
- ✅ npm package distribution
- ✅ **Copilot SDK integration** for AI-enhanced development

## Project Structure

```
ai_workflow.js/
├── src/
│   ├── core/             # Foundation utilities (colors, logger, system, version, executor)
│   ├── utils/            # Helper utilities (errors)
│   ├── lib/              # Core libraries (config, session, metrics, file ops, git, AI)
│   ├── steps/            # Workflow step implementations (step_00–step_17)
│   │   └── step_02_5_lib/ # Helper modules for step_02_5 (doc optimization)
│   ├── orchestrator/     # Workflow orchestration engine
│   ├── cli/              # Command-line interface
│   │   ├── commands/     # CLI command implementations (run, init, status, etc.)
│   │   └── tui/          # Terminal UI components (Ink/React)
│   │       └── components/ # TUI React components (panels, overlays, progress bars)
│   └── index.js          # Public API exports
├── test/                 # Test suite (mirrors src/ structure)
├── docs/                 # Documentation
│   ├── api/              # API reference (Markdown + auto-generated HTML in docs/api/html/)
│   ├── architecture/     # Architecture documentation and dependency graphs
│   ├── guides/           # Developer and user guides
│   ├── reference/        # Error codes, CLI reference, configuration schema
│   ├── examples/         # Usage examples (basic, advanced, integration)
│   ├── tutorials/        # Step-by-step tutorials
│   ├── reports/          # Bug fix reports and analysis
│   └── workflow-automation/ # Workflow automation documentation
├── scripts/              # Automation scripts (setup, validate, release)
├── bin/                  # CLI entry point (ai-workflow)
├── .husky/               # Git hooks (pre-commit validation)
├── .workflow_core/       # Configuration templates (submodule)
└── .workflow_fspec/      # Functional specification (submodule)
```

See [docs/architecture/MODULE_STRUCTURE.md](./docs/architecture/MODULE_STRUCTURE.md) for the full module-level breakdown.

## Development Setup

### Prerequisites

- **Node.js**: >= 20.0.0 (check with `node --version`)
- **npm**: >= 9.0.0 (check with `npm --version`)
- **Git**: For cloning and submodule management

### Quick Start

```bash
# 1. Clone the repository with submodules
git clone --recursive https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js

# If already cloned without --recursive, initialize submodules:
git submodule update --init --recursive

# 2. Install dependencies
npm install

# 3. Install CLI globally (optional)
npm link

# 4. Run tests
npm test

# 5. Run linter
npm run lint

# 6. Format check
npm run format:check
```

---

## CLI Usage

The `ai-workflow` CLI provides a user-friendly command-line interface for workflow automation.

### Installation

```bash
# Install globally from npm (when published)
npm install -g ai-workflow

# Or install from source
npm link
```

### Quick Start with CLI

```bash
# Initialize a new project
ai-workflow init --interactive

# Run quick validation
ai-workflow run --stage quick

# View status
ai-workflow status

# Run full workflow
ai-workflow run
```

### Available CLI Commands

| Command  | Description            | Example                             |
| -------- | ---------------------- | ----------------------------------- |
| `run`    | Execute workflow       | `ai-workflow run --stage quick`     |
| `resume` | Resume from checkpoint | `ai-workflow resume --latest`       |
| `status` | Show workflow status   | `ai-workflow status`                |
| `init`   | Initialize project     | `ai-workflow init --interactive`    |
| `config` | Manage configuration   | `ai-workflow config show`           |
| `clean`  | Clean artifacts        | `ai-workflow clean --all --dry-run` |

### CLI Documentation

- **Usage Guide**: [CLI_USAGE_GUIDE.md](./docs/guides/CLI_USAGE_GUIDE.md) - Complete CLI documentation
- **Quick Reference**: [CLI_QUICK_REFERENCE.md](./docs/guides/CLI_QUICK_REFERENCE.md) - Command cheat sheet

### Auto-Resume on Startup

When you run `ai-workflow run`, the CLI automatically checks whether the **most recent workflow execution was incomplete** (e.g. it was killed by Ctrl+C, a crash, or a power loss). If so, it locates the latest valid checkpoint for that run and resumes from where it left off — no manual intervention required.

**How it works:**

1. The CLI scans `.ai_workflow/logs/` for the most recently-dated execution directory (format: `workflow_YYYYMMDD_HHMMSS`).
2. It reads `workflow.log` inside that directory and looks for completion markers (`✓ Workflow completed successfully` / `⚠ Workflow completed with failures`).
3. If no completion marker is found the run is considered **incomplete**.
4. The CLI then finds the latest valid checkpoint for that run under `.ai_workflow/checkpoints/` and calls `resume` automatically.
5. If no checkpoint is found (e.g. the run was interrupted before the first checkpoint was saved) the CLI falls through to a normal fresh execution.

**Opt out** of auto-resume with the `--no-auto-resume` flag:

```bash
# Always start a fresh run, regardless of prior incomplete executions
ai-workflow run --no-auto-resume
```

**Manual resume** is still available via the dedicated `resume` command:

```bash
# Resume from the latest checkpoint explicitly
ai-workflow resume --latest

# Resume from a specific checkpoint
ai-workflow resume <checkpointId>

# List all available checkpoints
ai-workflow resume --list
```

### CLI Features

- ✅ **Interactive Prompts**: Configuration wizard with validation
- ✅ **Progress Indicators**: Real-time spinners and progress bars
- ✅ **Colored Output**: Clear visual feedback (green=success, red=error)
- ✅ **Auto-Resume**: Automatically resumes incomplete workflows on next startup
- ✅ **Checkpoint Management**: Resume workflows from interruptions
- ✅ **Help System**: Built-in examples and use cases
- ✅ **Dry Run Mode**: Preview operations without execution

---

## Development Commands

- `npm test` - Run Jest test suite (6,232 tests, 6,209 passing ✅, 20 failures, 3 skipped)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Check code style with ESLint
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without changes

## Automation Scripts

| Script                         | Description                                                    | Guide                                                      |
| ------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `scripts/setup.sh`             | Set up development environment (deps, submodules, directories) | [SETUP.md](./docs/guides/SETUP.md)                         |
| `scripts/test-integration.sh`  | Run integration tests with optional coverage report            | [TEST_INTEGRATION.md](./docs/guides/TEST_INTEGRATION.md)   |
| `scripts/validate.sh`          | Full validation pipeline (lint, format, tests, versions)       | [VALIDATE.md](./docs/guides/VALIDATE.md)                   |
| `scripts/prepare-release.sh`   | Prepare a versioned release (tests, version bump, changelog)   | [PREPARE_RELEASE.md](./docs/guides/PREPARE_RELEASE.md)     |
| `scripts/cleanup_artifacts.sh` | Clean up workflow artifacts by age/type                        | [CLEANUP_ARTIFACTS.md](./docs/guides/CLEANUP_ARTIFACTS.md) |

### Project Structure

See [MIGRATION_PLAN.md](./docs/reports/implementation/MIGRATION_PLAN.md) for detailed architecture.

## Development

This project is being developed incrementally following the migration plan phases:

1. **Phase 1**: Foundation & Core Utilities ✅ (Complete)
2. **Phase 2**: Core Workflow Library (Configuration, State management) ✅ (Complete)
3. **Phase 3**: File Operations & Utilities ✅ (Complete)
4. **Phase 4**: Project Detection & Analysis ✅ (Complete)
5. **Phase 5**: Git Integration ✅ (Complete)
6. **Phase 6**: AI Integration ✅ (Complete - 3 jq_wrapper test failures)
7. **Phase 7**: Workflow Orchestration ✅ (Complete)
8. **Phase 8**: Performance Optimization ✅ (Complete - 11 modules: performance, monitoring, ML optimization, caching, incremental, multi-stage pipeline)
9. **Phase 9**: Workflow Steps Implementation ✅ (Complete - All 20 steps: step_00 through step_16, including step_0b and step_02_5, ~10,310 lines)
10. **Phase 10**: Main Orchestrator Integration ✅ (Complete - WorkflowOrchestrator class, health checks, progress tracking)
11. **Phase 11**: CLI & User Interface ✅ (Complete - 6 commands, 4 utilities, 134 tests, 2,977 lines)
12. **Phase 12**: Monitoring & Observability 📋 (Next - Real-time metrics, error tracking, dashboards)
13. **Phase 13**: Documentation & Packaging 📋 (Planned - Complete docs, npm package)

## Contributing

Contributions are welcome! Please read the migration plan and contributing guidelines before submitting pull requests.

## License

MIT License - See [LICENSE](./LICENSE) file for details

## Author

mpbarbosa

## Links

- **Migration Plan**: [MIGRATION_PLAN.md](./docs/reports/implementation/MIGRATION_PLAN.md) - Comprehensive migration framework
- **Source Repository**: [mpbarbosa/ai_workflow](https://github.com/mpbarbosa/ai_workflow)
- **Core Configuration**: [mpbarbosa/ai_workflow_core](https://github.com/mpbarbosa/ai_workflow_core) - Shared configuration templates
- **Functional Specification**: [mpbarbosa/ai_workflow_fspec](https://github.com/mpbarbosa/ai_workflow_fspec) - Language-independent functional specification
- **Issue Tracker**: [GitHub Issues](https://github.com/mpbarbosa/ai_workflow.js/issues)

---

**Note:** This migration plan is a living document and will be updated as the source repository becomes available and the migration progresses.

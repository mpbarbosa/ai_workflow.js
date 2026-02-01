# ai_workflow.js Documentation

**Version:** 1.0.0  
**Last Updated:** February 1, 2026

Welcome to the ai_workflow.js documentation! This documentation covers the Node.js implementation of AI-powered workflow automation.

## 📚 Documentation Index

### Getting Started

Start here if you're new to ai_workflow.js:

- **[Quick Start](./getting-started/QUICK_START.md)** - Get up and running in 5 minutes ⚡
- **[Installation Guide](./getting-started/INSTALLATION.md)** - Detailed installation for all platforms 📦
- **[First Workflow Tutorial](./getting-started/FIRST_WORKFLOW.md)** - Build your first workflow step-by-step 🎓

### Guides

In-depth guides for developers and users:

- **[Developer Guide](./guides/DEVELOPER_GUIDE.md)** - Contributing and development workflow
- **[User Guide](./guides/USER_GUIDE.md)** - End-user documentation
- **[Configuration Guide](./guides/CONFIGURATION_GUIDE.md)** - Configuration options and patterns
- **[Testing Guide](./guides/TESTING_GUIDE.md)** - Testing patterns and best practices

### API Reference

Complete API documentation for all modules:

- **[API Index](./api/README.md)** - Overview of all modules
- **[Core Modules](./api/core/)** - Foundation utilities (colors, logger, system, version, executor)
- **[Library Modules](./api/lib/)** - Core libraries (config, sessions, metrics, file operations, etc.)
- **[Utility Modules](./api/utils/)** - Helper utilities (errors)

### Architecture

System design and architectural patterns:

- **[Architecture Overview](./architecture/OVERVIEW.md)** - High-level system design
- **[Design Principles](./architecture/DESIGN_PRINCIPLES.md)** - Design patterns and conventions
- **[Module Structure](./architecture/MODULE_STRUCTURE.md)** - Module organization
- **[Dependency Graph](./architecture/DEPENDENCY_GRAPH.md)** - Module dependencies

### Reference

Detailed reference documentation:

- **[Error Codes](./reference/ERROR_CODES.md)** - Complete error reference
- **[Configuration Schema](./reference/CONFIGURATION_SCHEMA.md)** - Configuration file schema
- **[CLI Reference](./reference/CLI_REFERENCE.md)** - Command-line interface reference

### Examples

Practical usage examples:

- **[Basic Usage](./examples/basic-usage.md)** - Simple examples to get started
- **[Advanced Patterns](./examples/advanced-patterns.md)** - Complex usage patterns
- **[Integration Examples](./examples/integration-examples.md)** - Integration scenarios

### Additional Resources

- **[Glossary](./misc/GLOSSARY.md)** - Terms and definitions
- **[Functional Requirements](./FUNCTIONAL_REQUIREMENTS.md)** - Module requirements
- **[Migration Plan](./reports/implementation/MIGRATION_PLAN.md)** - Migration strategy

## 🚀 Current Status

**Phase 4 Complete** - Project Detection & Analysis

### Implemented Modules (20 modules)

#### Phase 1: Core Foundation (v1.0.0)

- ✅ `colors` - ANSI color codes with terminal support
- ✅ `logger` - Colored logging system
- ✅ `system` - OS detection and configuration
- ✅ `version` - Semantic version parsing
- ✅ `executor` - Command execution
- ✅ `errors` - Custom error classes

#### Phase 2: Configuration & State (v2.0.0)

- ✅ `config` - Configuration management
- ✅ `backlog` - Workflow reporting
- ✅ `session_manager` - Session lifecycle
- ✅ `metrics` - Performance metrics

#### Phase 3: File Operations (v2.0.0)

- ✅ `file_operations` - File system operations
- ✅ `edit_operations` - File editing utilities
- ✅ `utils` - General utilities (pure functions)
- ✅ `argument_parser` - CLI argument parsing
- ✅ `cleanup_handlers` - Cleanup operations

#### Phase 4: Project Detection (v1.0.0)

- ✅ `project_kind_detection` - Auto-detect project types
- ✅ `project_kind_config` - Load project configurations
- ✅ `tech_stack` - Tech stack detection
- ✅ `third_party_exclusion` - Filter third-party files

**Testing:** 695 tests, 693 passing (99.7%)

## 📖 Quick Navigation

### By Role

**New Users:**

1. [Quick Start](./getting-started/QUICK_START.md)
2. [User Guide](./guides/USER_GUIDE.md)
3. [Basic Examples](./examples/basic-usage.md)

**Developers:**

1. [Developer Guide](./guides/DEVELOPER_GUIDE.md)
2. [Architecture Overview](./architecture/OVERVIEW.md)
3. [Testing Guide](./guides/TESTING_GUIDE.md)
4. [API Reference](./api/README.md)

**Contributors:**

1. [Contributing Guidelines](../CONTRIBUTING.md)
2. [Design Principles](./architecture/DESIGN_PRINCIPLES.md)
3. [Testing Guide](./guides/TESTING_GUIDE.md)

### By Task

**Installing:**

- [Installation Guide](./getting-started/INSTALLATION.md)

**Configuring:**

- [Configuration Guide](./guides/CONFIGURATION_GUIDE.md)
- [Configuration Schema](./reference/CONFIGURATION_SCHEMA.md)

**Using APIs:**

- [API Index](./api/README.md)
- [Core Modules API](./api/core/)
- [Library Modules API](./api/lib/)

**Testing:**

- [Testing Guide](./guides/TESTING_GUIDE.md)
- [Running Tests](./guides/DEVELOPER_GUIDE.md#testing)

**Contributing:**

- [Developer Guide](./guides/DEVELOPER_GUIDE.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

## 🏗️ Architecture Highlights

### Referential Transparency (v2.0.0)

Phase 2 and 3 modules follow a pure functional architecture:

- **Pure functions** for deterministic business logic
- **Impure wrappers** for side effects (I/O, state)
- **Testable** with 86+ pure function tests
- **Predictable** same inputs = same outputs

See: [Referential Transparency Guide](./guides/REFERENTIAL_TRANSPARENCY.md)

### Layered Architecture

```
┌─────────────────────────────────────┐
│  CLI Layer (future Phase 11)        │
├─────────────────────────────────────┤
│  Workflow Engine (future Phase 7)   │
├─────────────────────────────────────┤
│  AI Integration (future Phase 6)    │
├─────────────────────────────────────┤
│  Git Integration (future Phase 5)   │
├─────────────────────────────────────┤
│  Project Detection (Phase 4) ✅     │
├─────────────────────────────────────┤
│  File Operations (Phase 3) ✅       │
├─────────────────────────────────────┤
│  Configuration & State (Phase 2) ✅ │
├─────────────────────────────────────┤
│  Core Foundation (Phase 1) ✅       │
└─────────────────────────────────────┘
```

## 🔗 External Links

- **GitHub Repository:** [mpbarbosa/ai_workflow.js](https://github.com/mpbarbosa/ai_workflow.js)
- **Source Repository:** [mpbarbosa/ai_workflow](https://github.com/mpbarbosa/ai_workflow) (Shell v3.0.0)
- **Issue Tracker:** [GitHub Issues](https://github.com/mpbarbosa/ai_workflow.js/issues)
- **npm Package:** _(Coming soon)_

## 📝 Contributing to Documentation

Found an issue or want to improve the docs? See:

- [Contributing Guidelines](../CONTRIBUTING.md)
- [Documentation Standards](./guides/DEVELOPER_GUIDE.md#documentation-standards)

## 📄 License

MIT License - See [LICENSE](../LICENSE) file for details

---

**Need Help?**

- Check the [Quick Start](./getting-started/QUICK_START.md)
- Browse [Examples](./examples/)
- Open an [Issue](https://github.com/mpbarbosa/ai_workflow.js/issues)

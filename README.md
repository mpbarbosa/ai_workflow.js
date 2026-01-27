# ai_workflow.js

AI Workflow Automation (in JavaScript)

## Overview

This project is a comprehensive migration of the [mpb_scripts](https://github.com/mpbarbosa/mpb_scripts) repository from shell script to JavaScript with Node.js. The goal is to transform shell-based system automation scripts into a modern, cross-platform Node.js application.

## Status

🚧 **Work in Progress** - This project is currently under active development.

## Original Repository

The original shell script repository can be found at: [mpbarbosa/mpb_scripts](https://github.com/mpbarbosa/mpb_scripts)

### Original Features

- **Multi-Package Manager Support**: APT (Debian/Ubuntu), Pacman (Arch Linux), Snap, Cargo, Pip, npm
- **System Updates**: Comprehensive package management and system update automation
- **System Diagnostics**: Detailed system information and diagnostics
- **Application Updaters**: Automated checks and updates for various applications
- **Modular Architecture**: High cohesion, loose coupling design

## Migration Plan

A comprehensive migration plan has been created that outlines:
- Current state analysis
- Architecture design for the JavaScript implementation
- Technology stack and dependencies
- Phase-by-phase implementation strategy
- Testing strategy
- Timeline and resources

📄 **See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for the complete migration plan.**

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

## Planned Architecture

```
ai_workflow.js/
├── src/
│   ├── cli/              # Command-line interface
│   ├── orchestrator/     # Workflow orchestration
│   ├── managers/         # Package and app managers
│   ├── core/             # Core utilities
│   ├── utils/            # Helper utilities
│   └── config/           # Configuration
├── test/                 # Test suite
└── docs/                 # Documentation
```

## Installation (Future)

Once development is complete, the package will be available via npm:

```bash
npm install -g ai-workflow
```

## Usage (Planned)

```bash
# Update system packages
ai-workflow update

# Update with all options
ai-workflow update --full

# Run in quiet mode
ai-workflow update --quiet

# Display system summary
ai-workflow summary

# List all packages
ai-workflow list

# Cleanup packages
ai-workflow cleanup
```

## Development

This project is being developed incrementally following the migration plan phases:

1. **Phase 1**: Foundation - Core utilities and base architecture
2. **Phase 2**: Package Managers - Core package manager implementations
3. **Phase 3**: System Summary - Diagnostics and system information
4. **Phase 4**: App Updaters - Application update checkers
5. **Phase 5**: Orchestration - Workflow engine
6. **Phase 6**: CLI - Command-line interface
7. **Phase 7**: Configuration - Plugin system and extensibility
8. **Phase 8**: Testing - Comprehensive test coverage
9. **Phase 9**: Documentation - Complete documentation
10. **Phase 10**: Packaging - npm distribution

## Contributing

Contributions are welcome! Please read the migration plan and contributing guidelines before submitting pull requests.

## License

MIT License - See [LICENSE](./LICENSE) file for details

## Author

mpbarbosa

## Links

- **Migration Plan**: [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
- **Original Repository**: [mpbarbosa/mpb_scripts](https://github.com/mpbarbosa/mpb_scripts)
- **Issue Tracker**: [GitHub Issues](https://github.com/mpbarbosa/ai_workflow.js/issues)

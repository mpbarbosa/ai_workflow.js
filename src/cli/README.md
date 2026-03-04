# CLI Layer

**Phase:** 11 (Future Implementation)
**Status:** Placeholder
**Priority:** Future Development

## Overview

This directory is reserved for the Command-Line Interface (CLI) layer implementation as part of Phase 11.

## Planned Architecture

### CLI Structure

```
src/cli/
├── commands/         # CLI command implementations
│   ├── run.js        # Run workflow command
│   ├── init.js       # Initialize project command
│   ├── config.js     # Configuration command
│   └── validate.js   # Validation command
├── prompts/          # Interactive prompts
├── output/           # Output formatters
└── cli.js            # Main CLI entry point
```

### Planned Features

1. **Interactive Configuration Wizard**
   - Project kind selection
   - Configuration file generation
   - Dependency detection

2. **Workflow Execution Commands**
   - Run specific workflow steps
   - Execute full workflow pipeline
   - Resume from checkpoints

3. **Validation and Debugging**
   - Configuration validation
   - Project structure verification
   - Verbose debugging mode

4. **Output Formatting**
   - Colored terminal output
   - Progress indicators
   - Summary reports

## Dependencies (Planned)

- **commander** or **yargs** - Command-line argument parsing
- **inquirer** - Interactive prompts
- **chalk** - Terminal color output
- **ora** - Progress spinners
- **cli-table3** - Table formatting

## Integration Points

The CLI will integrate with:

- **Workflow Engine** (`src/orchestrator/workflow_engine.js`) - Execute workflows
- **Configuration Manager** (`src/lib/config.js`) - Load and validate config
- **Session Manager** (`src/lib/session_manager.js`) - Track execution sessions
- **Metrics Collector** (`src/lib/metrics.js`) - Report performance metrics

## Usage Examples (Planned)

```bash
# Initialize new project
ai-workflow init

# Run full workflow
ai-workflow run

# Run specific step
ai-workflow run --step 01

# Resume from checkpoint
ai-workflow resume <checkpoint-id>

# Validate configuration
ai-workflow validate
```

## Implementation Timeline

- **Phase 11** - CLI foundation and basic commands
- **Phase 12** - Advanced features and optimizations
- **Phase 13** - Polish and documentation

## Current Workaround

Until the CLI is implemented, use the workflow engine programmatically:

```javascript
import { WorkflowEngine } from './src/orchestrator/workflow_engine.js';
import { ConfigManager } from './src/lib/config.js';

const config = await ConfigManager.loadConfig();
const engine = new WorkflowEngine(config);
await engine.run();
```

## Related Documentation

- [Workflow Engine API](../../docs/api/orchestrator/workflow_engine.md)
- [Configuration Guide](../../docs/guides/CONFIGURATION_GUIDE.md)
- [Developer Guide](../../docs/guides/DEVELOPER_GUIDE.md)

---

**Last Updated:** 2026-02-08
**Status:** Placeholder - Implementation planned for Phase 11

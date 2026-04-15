# Quick Start Guide

Get up and running with ai_workflow.js in 5 minutes!

## Prerequisites

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **npm** >= 9.0.0 (comes with Node.js)
- **Git** (for cloning the repository)

## Installation

### Option 1: Clone from GitHub (Development)

```bash
# Clone the repository with submodules
git clone --recursive https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js

# Install dependencies
npm install
```

### Option 2: npm Package (Future)

```bash
# Once published to npm
npm install -g ai-workflow
```

## Verify Installation

```bash
# Check Node.js version
node --version  # Should be >= 20.0.0

# Run tests to verify everything works
npm test

# Expected output: 4412 of 4437 tests passing ✅ (6 failures, 19 skipped)
```

## Basic Usage

**Performance tip:** importing from `ai-workflow` loads the full public API barrel. For smaller startup and bundle overhead, prefer scoped entry points such as `ai-workflow/core`, `ai-workflow/lib`, `ai-workflow/orchestrator`, and `ai-workflow/steps` when you only need one area of the package.

### 1. Import Core Modules

```javascript
import { Logger, Colors } from 'ai-workflow';

// Create a logger instance
const logger = new Logger({ level: 'info' });

// Use colored output
logger.info('Hello from ai_workflow.js!');
logger.success('Installation successful!');
```

### 2. Configuration Management

```javascript
import { Config } from 'ai-workflow';

// Create config manager
const config = new Config();

// Load configuration
await config.loadConfig('.workflow-config.yaml');

// Access configuration
const projectName = config.get('project.name');
console.log(`Project: ${projectName}`);
```

### 3. File Operations

```javascript
import { FileOperations } from 'ai-workflow';

// Create file operations instance
const fileOps = new FileOperations();

// Read a file
const content = await fileOps.readFile('package.json');
console.log('Package.json content:', content);

// Write a file
await fileOps.writeFile('output.txt', 'Hello, World!');

// Check if file exists
const exists = await fileOps.exists('output.txt');
console.log('File exists:', exists);
```

### 4. Session Management

```javascript
import { SessionManager } from 'ai-workflow';

// Create session manager
const sessions = new SessionManager();

// Create a new session
const sessionId = sessions.createSession({
  projectName: 'my-project',
  user: 'developer',
});

console.log(`Session created: ${sessionId}`);

// Get session info
const session = sessions.getSession(sessionId);
console.log('Session details:', session);

// End session
sessions.endSession(sessionId);
```

### 5. Metrics Collection

```javascript
import { Metrics } from 'ai-workflow';

// Create metrics collector
const metrics = new Metrics();

// Start tracking an operation
const operationId = metrics.startOperation('file-processing', {
  fileCount: 10,
});

// ... perform operation ...

// End tracking
metrics.endOperation(operationId, { success: true });

// Get metrics summary
const summary = metrics.getSummary();
console.log('Metrics:', summary);
```

### 6. Project Detection

```javascript
import { ProjectKindDetection, TechStackDetector } from 'ai-workflow';

// Detect project type
const detector = new ProjectKindDetection();
const projectKind = await detector.detectProjectKind('/path/to/project');
console.log(`Detected project: ${projectKind}`);

// Analyze tech stack
const techStack = new TechStackDetector();
const stack = await techStack.detectTechStack('/path/to/project');
console.log('Languages:', stack.languages);
console.log('Frameworks:', stack.frameworks);
console.log('Build systems:', stack.buildSystems);
```

### 7. Third-Party File Exclusion

```javascript
import { ThirdPartyExclusion } from 'ai-workflow';

// Create exclusion manager
const exclusion = new ThirdPartyExclusion('/path/to/project');

// Load .gitignore patterns
await exclusion.loadGitignorePatterns();

// Check if file should be excluded
const isExcluded = exclusion.shouldExclude('node_modules/package/index.js');
console.log('Should exclude:', isExcluded); // true

// Get all exclusion patterns
const patterns = exclusion.getPatterns();
console.log('Exclusion patterns:', patterns);
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Code Quality

```bash
# Check code style
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Check formatting
npm run format:check

# Auto-format code
npm run format
```

## Project Structure

```
ai_workflow.js/
├── src/
│   ├── core/           # Foundation utilities
│   │   ├── colors.js
│   │   ├── logger.js
│   │   ├── system.js
│   │   ├── version.js
│   │   └── executor.js
│   ├── lib/            # Core libraries
│   │   ├── config.js
│   │   ├── backlog.js
│   │   ├── session_manager.js
│   │   ├── metrics.js
│   │   ├── file_operations.js
│   │   ├── edit_operations.js
│   │   ├── utils.js
│   │   ├── argument_parser.js
│   │   ├── cleanup_handlers.js
│   │   ├── project_kind_detection.js
│   │   ├── project_kind_config.js
│   │   ├── tech_stack.js
│   │   └── third_party_exclusion.js
│   ├── utils/          # Helper utilities
│   │   └── errors.js
│   └── index.js        # Public API
├── test/               # Test suite
└── docs/               # Documentation
```

## Common Tasks

### Load and Use Configuration

```javascript
import { Config } from 'ai-workflow';

const config = new Config();
await config.loadConfig('.workflow-config.yaml');

// Get configuration values
const projectName = config.get('project.name');
const language = config.get('project.primary_language');

console.log(`${projectName} (${language})`);
```

### Execute System Commands

```javascript
import { Executor } from 'ai-workflow';

const executor = new Executor();

// Execute a command
const result = await executor.execute('git status', {
  cwd: '/path/to/repo',
});

console.log('Exit code:', result.exitCode);
console.log('Output:', result.stdout);
```

### Parse Command-Line Arguments

```javascript
import { ArgumentParser } from 'ai-workflow';

const parser = new ArgumentParser({
  name: 'my-command',
  version: '1.0.0',
  description: 'My CLI tool',
});

// Define arguments
parser.addOption('--verbose', {
  type: 'boolean',
  description: 'Enable verbose output',
  default: false,
});

parser.addOption('--config', {
  type: 'string',
  description: 'Configuration file path',
  required: true,
});

// Parse arguments
const args = parser.parse(process.argv.slice(2));
console.log('Parsed arguments:', args);
```

### Clean Up Old Files

```javascript
import { CleanupManager } from 'ai-workflow';

const cleanup = new CleanupManager();

// Clean up old log files
const removed = await cleanup.cleanupByAge(
  '/path/to/logs',
  7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  { pattern: '*.log' }
);

console.log(`Removed ${removed.length} old log files`);
```

### Detect Project Configuration

```javascript
import { ProjectKindConfig } from 'ai-workflow';

const configLoader = new ProjectKindConfig();

// Load project kind configuration
const config = await configLoader.loadConfig('nodejs_api');

console.log('Validation rules:', config.validation);
console.log('Testing config:', config.testing);
console.log('Quality standards:', config.quality);
```

## Next Steps

### For Users

1. Read the [User Guide](../guides/USER_GUIDE.md)
2. Explore [Examples](../examples/basic/README.md)
3. Check [Configuration Guide](../guides/CONFIGURATION_GUIDE.md)

### For Developers

1. Read the [Developer Guide](../guides/DEVELOPER_GUIDE.md)
2. Review [Architecture Overview](../architecture/OVERVIEW.md)
3. Browse [API Reference](../api/README.md)
4. Study [Testing Guide](../guides/TESTING_GUIDE.md)

### For Contributors

1. Read [Contributing Guidelines](../../CONTRIBUTING.md)
2. Review [Design Principles](../architecture/DESIGN_PRINCIPLES.md)
3. Set up development environment
4. Pick an issue to work on

## Getting Help

- **Documentation:** Browse the [docs](../README.md)
- **Examples:** Check [examples](../examples/)
- **Issues:** Report bugs or request features on [GitHub Issues](https://github.com/mpbarbosa/ai_workflow.js/issues)
- **Discussions:** Join discussions on GitHub

## Troubleshooting

### Node.js Version Error

```bash
# Error: Requires Node.js >= 20.0.0
# Solution: Upgrade Node.js
nvm install 18
nvm use 18
```

### Module Import Error

```bash
# Error: Cannot find module 'ai-workflow'
# Solution: Install dependencies
npm install
```

### Test Failures

```bash
# Solution: Clean install
rm -rf node_modules package-lock.json
npm install
npm test
```

### Git Submodule Issues

```bash
# Solution: Initialize submodules
git submodule update --init --recursive
```

## Additional Resources

- **[Full API Documentation](../api/README.md)**
- **[Architecture Guide](../architecture/OVERVIEW.md)**
- **[Migration Plan](../reports/implementation/MIGRATION_PLAN.md)**
- **[Changelog](../../CHANGELOG.md)**

---

**Ready to dive deeper?** Check out the [User Guide](../guides/USER_GUIDE.md) or explore the [API Reference](../api/README.md)!

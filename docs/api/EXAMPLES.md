# API Usage Examples

**Version:** 2.6.0
**Last Updated:** February 2, 2026
**Status:** Complete

---

## Table of Contents

- [Overview](#overview)
- [Phase 1: Core Foundation](#phase-1-core-foundation)
  - [Colors](#colors)
  - [Logger](#logger)
  - [System Detection](#system-detection)
  - [Version Comparison](#version-comparison)
  - [Command Execution](#command-execution)
  - [Error Handling](#error-handling)
- [Phase 2: Configuration & State](#phase-2-configuration--state)
  - [Configuration Management](#configuration-management)
  - [Session Management](#session-management)
  - [Metrics Collection](#metrics-collection)
  - [Backlog Reporting](#backlog-reporting)
- [Phase 3: File Operations](#phase-3-file-operations)
  - [File System Operations](#file-system-operations)
  - [Text Editing](#text-editing)
  - [String Utilities](#string-utilities)
  - [Argument Parsing](#argument-parsing)
  - [Cleanup Operations](#cleanup-operations)
- [Phase 4: Project Detection](#phase-4-project-detection)
  - [Project Kind Detection](#project-kind-detection)
  - [Tech Stack Analysis](#tech-stack-analysis)
  - [Third-Party Exclusion](#third-party-exclusion)
- [Complete Workflow Example](#complete-workflow-example)

---

## Overview

This document provides comprehensive usage examples for all ai_workflow.js API modules. Each example is self-contained and demonstrates practical use cases.

**Import Convention:**

```javascript
import { Logger, Config, FileOperations } from 'ai-workflow';
```

---

## Phase 1: Core Foundation

### Colors

**Basic Usage:**

```javascript
import { colors, colorize } from 'ai-workflow';

// Direct color codes
console.log(`${colors.GREEN}Success!${colors.RESET}`);
console.log(`${colors.RED}Error!${colors.RESET}`);

// Using colorize helper
console.log(colorize('Success!', 'green'));
console.log(colorize('Warning!', 'yellow'));
console.log(colorize('Error!', 'red'));
```

**Color Detection:**

```javascript
import { supportsColor } from 'ai-workflow';

if (supportsColor()) {
  console.log(colorize('Fancy colors!', 'cyan'));
} else {
  console.log('Plain text');
}
```

**Available Colors:**

- `BLACK`, `RED`, `GREEN`, `YELLOW`, `BLUE`, `MAGENTA`, `CYAN`, `WHITE`
- `BRIGHT_BLACK`, `BRIGHT_RED`, `BRIGHT_GREEN`, etc.
- `BG_RED`, `BG_GREEN`, `BG_BLUE`, etc.
- `BOLD`, `DIM`, `UNDERLINE`, `RESET`

---

### Logger

**Basic Logging:**

```javascript
import { logger, LogLevel } from 'ai-workflow';

// Simple logging
logger.debug('Debugging information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred');
logger.success('Operation successful');
```

**Custom Logger Instance:**

```javascript
import { Logger, LogLevel } from 'ai-workflow';

const customLogger = new Logger({
  level: LogLevel.DEBUG,
  colorize: true,
  timestamp: true,
});

customLogger.info('Custom logger message');
```

**Structured Logging:**

```javascript
logger.info('User action', { userId: 123, action: 'login' });
logger.error('API request failed', {
  endpoint: '/api/users',
  statusCode: 500,
  error: err.message,
});
```

**Log Level Control:**

```javascript
import { Logger, LogLevel } from 'ai-workflow';

// Create production logger (only warnings and errors)
const prodLogger = new Logger({ level: LogLevel.WARN });

// Create debug logger (all messages)
const debugLogger = new Logger({ level: LogLevel.DEBUG });
```

---

### System Detection

**OS Detection:**

```javascript
import { detectOS, OS } from 'ai-workflow';

const currentOS = detectOS();

if (currentOS === OS.LINUX) {
  console.log('Running on Linux');
} else if (currentOS === OS.MACOS) {
  console.log('Running on macOS');
} else if (currentOS === OS.WINDOWS) {
  console.log('Running on Windows');
}
```

**Package Manager Detection:**

```javascript
import { detectPackageManager, PackageManager } from 'ai-workflow';

const pm = detectPackageManager();

switch (pm) {
  case PackageManager.APT:
    console.log('Using apt (Debian/Ubuntu)');
    break;
  case PackageManager.DNF:
    console.log('Using dnf (Fedora/RHEL)');
    break;
  case PackageManager.BREW:
    console.log('Using Homebrew (macOS)');
    break;
  case PackageManager.PACMAN:
    console.log('Using pacman (Arch Linux)');
    break;
}
```

**Command Availability:**

```javascript
import { commandExists } from 'ai-workflow';

if (await commandExists('git')) {
  console.log('Git is installed');
}

if (await commandExists('docker')) {
  console.log('Docker is available');
}
```

**Complete System Info:**

```javascript
import { getSystemInfo } from 'ai-workflow';

const sysInfo = getSystemInfo();
console.log(`OS: ${sysInfo.os}`);
console.log(`Platform: ${sysInfo.platform}`);
console.log(`Architecture: ${sysInfo.arch}`);
console.log(`Package Manager: ${sysInfo.packageManager}`);
console.log(`Node Version: ${sysInfo.nodeVersion}`);
```

---

### Version Comparison

**Parse and Compare:**

```javascript
import { parseVersion, compareVersions } from 'ai-workflow';

const v1 = parseVersion('1.2.3');
<<<<<<< HEAD
const v2 = parseVersion('1.9.11');
=======
const v2 = parseVersion('1.6.1');
>>>>>>> a4c4d4d (chore(workflow): update docs and metrics [skip ci])

console.log(compareVersions(v1, v2)); // -1 (v1 < v2)
console.log(compareVersions(v2, v1)); // 1 (v2 > v1)
```

**Version Checks:**

```javascript
import { isGreaterThan, isLessThan, isEqual } from 'ai-workflow';

if (isGreaterThan('2.0.0', '1.9.11')) {
  console.log('Version 2.0.0 is newer');
}

if (isLessThan('1.0.0', '2.0.0')) {
  console.log('Need to upgrade');
}

if (isEqual('1.2.3', '1.2.3')) {
  console.log('Versions match');
}
```

**Latest Version Selection:**

```javascript
import { getLatestVersion } from 'ai-workflow';

<<<<<<< HEAD
const versions = ['1.0.0', '1.2.3', '2.0.0', '1.9.11'];
=======
const versions = ['1.0.0', '1.2.3', '2.0.0', '1.6.1'];
>>>>>>> a4c4d4d (chore(workflow): update docs and metrics [skip ci])
const latest = getLatestVersion(versions);
console.log(`Latest: ${latest}`); // "2.0.0"
```

---

### Command Execution

**Basic Execution:**

```javascript
import { execute } from 'ai-workflow';

try {
  const { stdout, stderr, exitCode } = await execute('ls', ['-la']);
  console.log(stdout);
} catch (err) {
  console.error('Command failed:', err.message);
}
```

**Streaming Output:**

```javascript
import { executeStream } from 'ai-workflow';

const stream = executeStream('npm', ['install'], {
  cwd: '/path/to/project',
});

stream.stdout.on('data', (data) => {
  console.log(`STDOUT: ${data}`);
});

stream.stderr.on('data', (data) => {
  console.error(`STDERR: ${data}`);
});

await stream.promise;
```

**Sudo Execution (Unix):**

```javascript
import { executeSudo } from 'ai-workflow';

try {
  const result = await executeSudo('systemctl', ['restart', 'nginx']);
  console.log('Service restarted');
} catch (err) {
  console.error('Failed to restart service:', err.message);
}
```

**With Options:**

```javascript
import { execute } from 'ai-workflow';

const result = await execute('git', ['clone', 'repo-url'], {
  cwd: '/target/directory',
  timeout: 60000, // 60 seconds
  shell: false,
  env: { ...process.env, GIT_ASKPASS: 'echo' },
});
```

---

### Error Handling

**Custom Error Types:**

```javascript
import {
  WorkflowError,
  SystemError,
  ExecutionError,
  ConfigurationError,
  ValidationError,
  FileSystemError,
} from 'ai-workflow';

// System error
throw new SystemError('Failed to detect OS', { platform: process.platform });

// Execution error
throw new ExecutionError('Command failed', {
  command: 'npm install',
  exitCode: 1,
});

// Configuration error
throw new ConfigurationError('Invalid config', {
  field: 'version',
  value: 'invalid',
});

// Validation error
throw new ValidationError('Invalid input', {
  field: 'email',
  constraint: 'valid email required',
});

// File system error
throw new FileSystemError('File not found', {
  path: '/missing/file.txt',
  operation: 'read',
});
```

**Error Handling Pattern:**

```javascript
import { logger, WorkflowError, SystemError } from 'ai-workflow';

try {
  // Workflow operation
  await someWorkflowOperation();
} catch (err) {
  if (err instanceof SystemError) {
    logger.error('System error:', err.message);
    logger.debug('Context:', err.context);
    process.exit(1);
  } else if (err instanceof WorkflowError) {
    logger.error('Workflow error:', err.message);
    // Handle gracefully
  } else {
    logger.error('Unexpected error:', err);
    throw err;
  }
}
```

---

## Phase 2: Configuration & State

### Configuration Management

**Basic Configuration:**

```javascript
import { Config } from 'ai-workflow';

const configManager = new Config('.workflow-config.yaml');

// Load configuration
const config = await configManager.load();
console.log(`Project: ${config.project.name}`);
console.log(`Version: ${config.project.version}`);
```

**Updating Configuration:**

```javascript
const configManager = new Config('.workflow-config.yaml');

// Update specific fields
await configManager.update({
  'project.version': '2.0.0',
  'workflow.steps.enabled': ['docs', 'tests', 'quality'],
});
```

**Validation:**

```javascript
import { Config } from 'ai-workflow';

const configManager = new Config('.workflow-config.yaml');

try {
  const config = await configManager.load();
  // Config is valid
} catch (err) {
  if (err instanceof ConfigurationError) {
    console.error('Invalid configuration:', err.message);
    console.error('Details:', err.context);
  }
}
```

**Default Configuration:**

```javascript
const configManager = new Config('.workflow-config.yaml', {
  defaults: {
    project: {
      version: '1.0.0',
      type: 'nodejs-application',
    },
    workflow: {
      steps: {
        enabled: ['all'],
      },
    },
  },
});
```

---

### Session Management

**Create and Track Sessions:**

```javascript
import { SessionManager } from 'ai-workflow';

const sessionManager = new SessionManager('.ai_workflow/sessions');

// Create new session
const sessionId = await sessionManager.createSession({
  type: 'workflow',
  user: 'developer',
});

console.log(`Session created: ${sessionId}`);

// Update session
await sessionManager.updateSession(sessionId, {
  status: 'running',
  currentStep: 3,
});

// End session
await sessionManager.endSession(sessionId);
```

**Query Sessions:**

```javascript
const sessionManager = new SessionManager('.ai_workflow/sessions');

// Get active sessions
const activeSessions = await sessionManager.getActiveSessions();
console.log(`Active sessions: ${activeSessions.length}`);

// Get session details
const session = await sessionManager.getSession(sessionId);
console.log(`Status: ${session.status}`);
console.log(`Duration: ${session.duration}ms`);

// Get all sessions
const allSessions = await sessionManager.getAllSessions();
```

**Session Cleanup:**

```javascript
const sessionManager = new SessionManager('.ai_workflow/sessions');

// Clean up old sessions (older than 7 days)
const cleaned = await sessionManager.cleanupOldSessions(7 * 24 * 60 * 60 * 1000);
console.log(`Cleaned up ${cleaned} old sessions`);
```

---

### Metrics Collection

**Collect Metrics:**

```javascript
import { Metrics } from 'ai-workflow';

const metrics = new Metrics('.ai_workflow/metrics');

// Start metric tracking
const metricId = metrics.start('build_time', {
  module: 'core',
  type: 'compilation',
});

// ... perform operation ...

// End metric
metrics.end(metricId);

// Record value directly
metrics.record('test_coverage', 87.5, {
  suite: 'unit',
  module: 'core',
});
```

**Query Metrics:**

```javascript
const metrics = new Metrics('.ai_workflow/metrics');

// Get metric by ID
const metric = metrics.get(metricId);
console.log(`Duration: ${metric.duration}ms`);

// Get all metrics by name
const buildMetrics = metrics.getByName('build_time');
console.log(`Average build time: ${calculateAverage(buildMetrics)}ms`);

// Get metrics by tag
const coreMetrics = metrics.getByTag('module', 'core');
```

**Export Metrics:**

```javascript
const metrics = new Metrics('.ai_workflow/metrics');

// Export to JSON
const jsonData = await metrics.exportJSON();
console.log(jsonData);

// Export to CSV
const csvData = await metrics.exportCSV();

// Save to file
await metrics.save('.ai_workflow/metrics/report.json');
```

---

### Backlog Reporting

**Generate Backlog:**

```javascript
import { Backlog } from 'ai-workflow';

const backlog = new Backlog('.ai_workflow/backlog');

// Create backlog entry
await backlog.create({
  step: 'documentation',
  status: 'success',
  duration: 1250,
  changes: ['Updated API docs', 'Added examples'],
  issues: [],
});
```

**Generate Summary:**

```javascript
const backlog = new Backlog('.ai_workflow/backlog');

// Generate markdown summary
const summary = await backlog.generateSummary('workflow-run-123');
console.log(summary);

// Summary includes:
// - Step completion status
// - Duration
// - Changes made
// - Issues encountered
```

**Query Backlog:**

```javascript
const backlog = new Backlog('.ai_workflow/backlog');

// Get recent entries
const recent = await backlog.getRecent(10);

// Get by step
const docEntries = await backlog.getByStep('documentation');

// Get by status
const failures = await backlog.getByStatus('failed');
```

---

## Phase 3: File Operations

### File System Operations

**Basic File Operations:**

```javascript
import { FileOperations } from 'ai-workflow';

const fileOps = new FileOperations();

// Read file
const content = await fileOps.readFile('config.yaml');

// Write file
await fileOps.writeFile('output.txt', 'Hello, World!');

// Copy file
await fileOps.copyFile('source.txt', 'destination.txt');

// Move file
await fileOps.moveFile('old-location.txt', 'new-location.txt');

// Delete file
await fileOps.deleteFile('temp.txt');
```

**Directory Operations:**

```javascript
const fileOps = new FileOperations();

// Create directory
await fileOps.createDirectory('new-dir');

// List directory
const files = await fileOps.listDirectory('src', {
  recursive: true,
  includeHidden: false,
});

// Copy directory
await fileOps.copyDirectory('src', 'backup');

// Delete directory
await fileOps.deleteDirectory('temp', { recursive: true });
```

**File Metadata:**

```javascript
import { buildFileMetadata } from 'ai-workflow';

const metadata = await buildFileMetadata('package.json');
console.log(`Size: ${metadata.size} bytes`);
console.log(`Modified: ${metadata.modified}`);
console.log(`Is directory: ${metadata.isDirectory}`);
```

**Filtering Files:**

```javascript
import { filterByExtension, filterByPattern } from 'ai-workflow';

const files = await fileOps.listDirectory('src', { recursive: true });

// Filter by extension
const jsFiles = filterByExtension(files, ['.js', '.mjs']);

// Filter by pattern
const testFiles = filterByPattern(files, /\.test\.js$/);
```

**Dry Run Mode:**

```javascript
const fileOps = new FileOperations({ dryRun: true });

// These operations won't actually execute
await fileOps.deleteFile('important.txt'); // Only logs, doesn't delete
await fileOps.writeFile('new.txt', 'data'); // Only logs, doesn't write
```

---

### Text Editing

**Find and Replace:**

```javascript
import { EditOperations } from 'ai-workflow';

const editor = new EditOperations();

// Read file
const content = await editor.readFile('config.js');

// Find matches
const matches = editor.findMatches(content, /version: ['"](.+?)['"]/g);
console.log(`Found ${matches.length} versions`);

// Replace all occurrences
const updated = editor.replaceAll(content, /version: ['"][\d.]+['"]/g, 'version: "2.0.0"');

// Save changes
await editor.writeFile('config.js', updated);
```

**Replace First Occurrence:**

```javascript
const editor = new EditOperations();

const content = await editor.readFile('README.md');

// Replace only first match
const updated = editor.replaceFirst(content, /## Version/, '## Version 2.0.0');

await editor.writeFile('README.md', updated);
```

**Insert, Append, Prepend:**

```javascript
const editor = new EditOperations();

let content = await editor.readFile('script.js');

// Insert at specific line
content = editor.insertAtLine(content, 5, 'console.log("Debug");');

// Append to end
content = editor.appendText(content, '\n// End of file');

// Prepend to beginning
content = editor.prependText(content, '// Auto-generated\n');

await editor.writeFile('script.js', content);
```

**Line Operations:**

```javascript
const editor = new EditOperations();

let content = await editor.readFile('data.txt');

// Extract specific lines
const lines = editor.extractLines(content, 10, 20);

// Get line range
const range = editor.getLineRange(content, 5, 15);

// Delete lines
content = editor.deleteLines(content, 3, 7);

// Replace line range
content = editor.replaceLineRange(content, 10, 12, 'New content');

await editor.writeFile('data.txt', content);
```

**Diff Generation:**

```javascript
import { generateDiff, formatDiff } from 'ai-workflow';

const original = await editor.readFile('old.js');
const modified = await editor.readFile('new.js');

// Generate diff
const diff = generateDiff(original, modified);

// Format for display
const formatted = formatDiff(diff);
console.log(formatted);
```

---

### String Utilities

**Case Conversion:**

```javascript
import { camelCase, kebabCase, snakeCase, pascalCase } from 'ai-workflow';

const str = 'user profile settings';

console.log(camelCase(str)); // "userProfileSettings"
console.log(kebabCase(str)); // "user-profile-settings"
console.log(snakeCase(str)); // "user_profile_settings"
console.log(pascalCase(str)); // "UserProfileSettings"
```

**String Manipulation:**

```javascript
import { capitalize, truncate, sanitize, cleanWhitespace, escapeRegex } from 'ai-workflow';

console.log(capitalize('hello')); // "Hello"

console.log(truncate('Long text...', 10)); // "Long te..."

console.log(sanitize('<script>alert("xss")</script>')); // Safe string

console.log(cleanWhitespace('  multiple   spaces  ')); // "multiple spaces"

console.log(escapeRegex('test.*regex')); // "test\\.\\*regex"
```

**Array Utilities:**

```javascript
import { dedupe, chunk, flatten, groupBy, intersection } from 'ai-workflow';

// Remove duplicates
console.log(dedupe([1, 2, 2, 3, 3, 3])); // [1, 2, 3]

// Split into chunks
console.log(chunk([1, 2, 3, 4, 5], 2)); // [[1, 2], [3, 4], [5]]

// Flatten nested arrays
console.log(
  flatten([
    [1, 2],
    [3, [4, 5]],
  ])
); // [1, 2, 3, 4, 5]

// Group by property
const users = [
  { name: 'Alice', role: 'admin' },
  { name: 'Bob', role: 'user' },
];
console.log(groupBy(users, 'role'));

// Set operations
console.log(intersection([1, 2, 3], [2, 3, 4])); // [2, 3]
```

**Object Utilities:**

```javascript
import { deepClone, deepMerge, pick, omit, getProperty } from 'ai-workflow';

const obj = { a: 1, b: { c: 2 } };

// Deep clone
const clone = deepClone(obj);

// Deep merge
const merged = deepMerge(obj, { b: { d: 3 } });
// Result: { a: 1, b: { c: 2, d: 3 } }

// Pick properties
console.log(pick(obj, ['a'])); // { a: 1 }

// Omit properties
console.log(omit(obj, ['b'])); // { a: 1 }

// Get nested property
console.log(getProperty(obj, 'b.c')); // 2
```

---

### Argument Parsing

**Basic Parsing:**

```javascript
import { ArgumentParser } from 'ai-workflow';

const parser = new ArgumentParser({
  schema: {
    name: { type: 'string', required: true },
    version: { type: 'string', default: '1.0.0' },
    debug: { type: 'boolean', default: false },
  },
});

const args = parser.parse(process.argv.slice(2));
console.log(args);
```

**With Aliases:**

```javascript
const parser = new ArgumentParser({
  schema: {
    verbose: {
      type: 'boolean',
      alias: ['v'],
      default: false,
    },
    output: {
      type: 'string',
      alias: ['o'],
      required: true,
    },
  },
});

// Both work: --verbose or -v, --output or -o
const args = parser.parse(['--output', 'result.txt', '-v']);
```

**Validation:**

```javascript
import { ArgumentParser } from 'ai-workflow';

const parser = new ArgumentParser({
  schema: {
    port: {
      type: 'number',
      validate: (val) => val > 0 && val < 65536,
      errorMessage: 'Port must be between 1 and 65535',
    },
    email: {
      type: 'string',
      validate: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      errorMessage: 'Invalid email address',
    },
  },
});

try {
  const args = parser.parse(['--port', '8080', '--email', 'user@example.com']);
} catch (err) {
  console.error('Validation error:', err.message);
}
```

**Auto-Generated Help:**

```javascript
const parser = new ArgumentParser({
  name: 'my-cli',
  version: '1.0.0',
  description: 'My CLI tool',
  schema: {
    input: {
      type: 'string',
      required: true,
      description: 'Input file path',
    },
    verbose: {
      type: 'boolean',
      alias: ['v'],
      description: 'Enable verbose output',
    },
  },
});

// User runs: my-cli --help
console.log(parser.generateHelp());
```

---

### Cleanup Operations

**Age-Based Cleanup:**

```javascript
import { CleanupManager } from 'ai-workflow';

const cleanup = new CleanupManager();

// Clean files older than 7 days
const removed = await cleanup.cleanByAge('.ai_workflow/logs', 7 * 24 * 60 * 60 * 1000);
console.log(`Removed ${removed.length} old log files`);
```

**Size-Based Cleanup:**

```javascript
const cleanup = new CleanupManager();

// Keep total size under 100MB
const removed = await cleanup.cleanBySize(
  '.ai_workflow/cache',
  100 * 1024 * 1024 // 100 MB limit
);
console.log(`Cleaned up ${removed.totalSize} bytes`);
```

**Pattern-Based Cleanup:**

```javascript
const cleanup = new CleanupManager();

// Remove temporary files
await cleanup.cleanByPattern('.ai_workflow', /\.tmp$/);

// Remove old backups
await cleanup.cleanByPattern('.ai_workflow/backlog', /^\d{4}-\d{2}-\d{2}/);
```

**Cleanup with Options:**

```javascript
const cleanup = new CleanupManager({ dryRun: true });

// Preview what would be deleted
const preview = await cleanup.cleanByAge('.ai_workflow/sessions', 30 * 24 * 60 * 60 * 1000);
console.log(
  'Would delete:',
  preview.map((f) => f.path)
);

// Actual cleanup (remove dryRun)
const cleanupReal = new CleanupManager();
await cleanupReal.cleanByAge('.ai_workflow/sessions', 30 * 24 * 60 * 60 * 1000);
```

**Cleanup Summary:**

```javascript
import { generateCleanupSummary } from 'ai-workflow';

const cleanup = new CleanupManager();
const removed = await cleanup.cleanByAge('.ai_workflow/logs', 7 * 24 * 60 * 60 * 1000);

const summary = generateCleanupSummary(removed);
console.log(summary);
// Output:
// Cleaned up 15 files
// Total size: 5.2 MB
// Oldest file: 30 days ago
```

---

## Phase 4: Project Detection

### Project Kind Detection

**Automatic Detection:**

```javascript
import { ProjectKindDetector } from 'ai-workflow';

const detector = new ProjectKindDetector('/path/to/project');

// Detect project kind
const kind = await detector.detect();
console.log(`Project kind: ${kind}`);
// Output: "nodejs_api", "react_spa", "python_app", etc.
```

**Detection with Details:**

```javascript
const detector = new ProjectKindDetector('/path/to/project');

const result = await detector.detectWithDetails();
console.log(`Kind: ${result.kind}`);
console.log(`Confidence: ${result.confidence}%`);
console.log(`Indicators:`, result.indicators);
```

**Manual Detection:**

```javascript
import { detectNodeJsApi, detectReactSpa } from 'ai-workflow';

const isNodeApi = await detectNodeJsApi('/path/to/project');
const isReactApp = await detectReactSpa('/path/to/project');

if (isNodeApi) {
  console.log('This is a Node.js API project');
} else if (isReactApp) {
  console.log('This is a React SPA project');
}
```

---

### Tech Stack Analysis

**Comprehensive Analysis:**

```javascript
import { TechStackAnalyzer } from 'ai-workflow';

const analyzer = new TechStackAnalyzer('/path/to/project');

const techStack = await analyzer.analyze();

console.log('Languages:', techStack.languages);
// ["javascript", "typescript"]

console.log('Frameworks:', techStack.frameworks);
// ["react", "express"]

console.log('Build Tools:', techStack.buildTools);
// ["webpack", "babel"]

console.log('Test Frameworks:', techStack.testFrameworks);
// ["jest", "cypress"]

console.log('Linters:', techStack.linters);
// ["eslint", "prettier"]
```

**Specific Detection:**

```javascript
const analyzer = new TechStackAnalyzer('/path/to/project');

// Detect languages
const languages = await analyzer.detectLanguages();
console.log('Languages:', languages);

// Detect frameworks
const frameworks = await analyzer.detectFrameworks();
console.log('Frameworks:', frameworks);

// Detect dependencies
const deps = await analyzer.detectDependencies();
console.log('Dependencies:', deps);
```

---

### Third-Party Exclusion

**Filter Third-Party Files:**

```javascript
import { ThirdPartyExcluder } from 'ai-workflow';

const excluder = new ThirdPartyExcluder('/path/to/project');

// Get all files
const allFiles = await getProjectFiles('/path/to/project');

// Filter out third-party files
const projectFiles = await excluder.filter(allFiles);

console.log(`Total files: ${allFiles.length}`);
console.log(`Project files: ${projectFiles.length}`);
console.log(`Third-party files: ${allFiles.length - projectFiles.length}`);
```

**Custom Exclusion Patterns:**

```javascript
const excluder = new ThirdPartyExcluder('/path/to/project', {
  additionalPatterns: ['vendor/**', 'third_party/**', 'external/**'],
});

const filtered = await excluder.filter(files);
```

**Respect .gitignore:**

```javascript
const excluder = new ThirdPartyExcluder('/path/to/project', {
  respectGitignore: true,
});

// Automatically excludes files matching .gitignore patterns
const filtered = await excluder.filter(files);
```

---

## Complete Workflow Example

Here's a complete example showing how multiple modules work together:

```javascript
import {
  logger,
  Config,
  SessionManager,
  Metrics,
  FileOperations,
  EditOperations,
  ProjectKindDetector,
  TechStackAnalyzer,
  Backlog,
} from 'ai-workflow';

async function runWorkflow(projectPath) {
  // 1. Initialize components
  const config = new Config(`${projectPath}/.workflow-config.yaml`);
  const sessions = new SessionManager(`${projectPath}/.ai_workflow/sessions`);
  const metrics = new Metrics(`${projectPath}/.ai_workflow/metrics`);
  const backlog = new Backlog(`${projectPath}/.ai_workflow/backlog`);
  const fileOps = new FileOperations();
  const editor = new EditOperations();

  // 2. Create session
  const sessionId = await sessions.createSession({ type: 'workflow' });
  logger.info(`Session created: ${sessionId}`);

  try {
    // 3. Load configuration
    const cfg = await config.load();
    logger.info(`Loaded config for: ${cfg.project.name}`);

    // 4. Detect project
    const detector = new ProjectKindDetector(projectPath);
    const projectKind = await detector.detect();
    logger.info(`Detected project kind: ${projectKind}`);

    // 5. Analyze tech stack
    const analyzer = new TechStackAnalyzer(projectPath);
    const techStack = await analyzer.analyze();
    logger.info(`Tech stack: ${techStack.frameworks.join(', ')}`);

    // 6. Update documentation
    const metricId = metrics.start('update_docs');

    const readme = await fileOps.readFile(`${projectPath}/README.md`);
    const updated = editor.replaceFirst(
      readme,
      /## Tech Stack/,
      `## Tech Stack\n\n${techStack.frameworks.join(', ')}`
    );
    await fileOps.writeFile(`${projectPath}/README.md`, updated);

    metrics.end(metricId);
    logger.success('Documentation updated');

    // 7. Create backlog entry
    await backlog.create({
      step: 'documentation',
      status: 'success',
      duration: metrics.get(metricId).duration,
      changes: ['Updated tech stack in README'],
    });

    // 8. End session
    await sessions.endSession(sessionId);
    logger.success('Workflow completed');
  } catch (err) {
    logger.error('Workflow failed:', err.message);
    await sessions.updateSession(sessionId, { status: 'failed', error: err.message });

    await backlog.create({
      step: 'workflow',
      status: 'failed',
      issues: [err.message],
    });

    throw err;
  }
}

// Run workflow
runWorkflow('/path/to/project')
  .then(() => console.log('Success'))
  .catch((err) => console.error('Failed:', err));
```

---

## Next Steps

- Explore individual module documentation in [docs/api/](./README.md)
- Read architecture patterns in [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md)
- Check troubleshooting guide at [docs/guides/TROUBLESHOOTING.md](../guides/TROUBLESHOOTING.md)
- Review best practices at [docs/guides/DEVELOPER_GUIDE.md](../guides/DEVELOPER_GUIDE.md)

---

**Questions or Issues?**

- Open an issue on [GitHub](https://github.com/mpbarbosa/ai_workflow.js/issues)
- Check the [Developer Guide](../guides/DEVELOPER_GUIDE.md)
- Review [Functional Requirements](../FUNCTIONAL_REQUIREMENTS.md)

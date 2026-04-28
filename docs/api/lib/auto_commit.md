# auto_commit.js

**Auto Commit Module** - Automatic workflow artifact commits with conventional messages

## Overview

The Auto Commit module provides intelligent automatic committing of workflow artifacts with conventional commit messages, [skip ci] flag management, and priority-based execution. It categorizes artifacts and generates appropriate commit messages following best practices.

**Module:** `lib/auto_commit`
**Version:** 2.2.16
**Architecture:** Referentially Transparent (Pure Functions + Impure Wrapper)

## Installation

```javascript
import { AutoCommit, generateCommitMessage, categorizeArtifacts } from './src/lib/auto_commit.js';
```

## Architecture

### v2.0.0 Pattern: Referential Transparency

This module follows the v2.0.0 architecture pattern:

- **Pure Functions (10 functions)**: Commit message generation, artifact categorization, validation
  - Deterministic: Same input always produces same output
  - No side effects: No I/O or state mutation
  - Message formatting follows conventional commit spec

- **Impure Wrapper (AutoCommit class)**: Git operations, file system access, commit execution
  - Integrates with GitAutomation
  - Tracks commit history
  - Supports dry-run mode

## Pure Functions

### generateCommitMessage(fileCategories, options)

Generate conventional commit message from file categories.

**Parameters:**

- `fileCategories` (Object): Categorized files
- `options` (Object): Optional commit options

**Returns:** String formatted commit message

**Example:**

```javascript
generateCommitMessage({ docs: ['README.md'], metrics: [] });
// Returns: 'docs(docs): update docs [skip ci]'

generateCommitMessage({ docs: ['a.md'], metrics: ['b.json'] });
// Returns: 'chore(workflow): update docs and metrics [skip ci]'
```

**Message Format:**

```
type(scope): description [flags]
```

### categorizeArtifacts(files)

Categorize workflow artifact files.

**Parameters:**

- `files` (Array<string>): File paths to categorize

**Returns:** Object with categorized files

```javascript
{
  docs: [],
  metrics: [],
  logs: [],
  summaries: [],
  tests: [],
  other: []
}
```

**Categorization Rules:**

- **metrics**: Contains `/metrics/` or ends with `.metrics.json`
- **logs**: Contains `/logs/` or ends with `.log`
- **summaries**: Contains `/summaries/` or `/backlog/`
- **docs**: Contains `/docs/` or ends with `.md`
- **tests**: Contains `/test/`, `.test.`, `test-`, or `coverage`

**Example:**

```javascript
categorizeArtifacts([
  '.ai_workflow/metrics/step1.json',
  'docs/api.md',
  '.ai_workflow/logs/workflow.log',
]);
// Returns: {
//   metrics: ['.ai_workflow/metrics/step1.json'],
//   docs: ['docs/api.md'],
//   logs: ['.ai_workflow/logs/workflow.log'],
//   ...
// }
```

### shouldAutoCommit(file, config)

Determine if file should be auto-committed.

**Parameters:**

- `file` (string): File path to check
- `config` (Object): Auto-commit configuration
  - `enabled` (boolean): Enable auto-commits
  - `exclude` (Array): Patterns to exclude
  - `include` (Array): Patterns to include (if set, only these)

**Returns:** Boolean

**Example:**

```javascript
shouldAutoCommit('.ai_workflow/metrics/m.json', { enabled: true });
// Returns: true

shouldAutoCommit('src/app.js', { enabled: true });
// Returns: false (not an artifact)

shouldAutoCommit('.ai_workflow/logs/debug.log', {
  enabled: true,
  exclude: ['logs'],
});
// Returns: false (excluded)
```

### buildCommitScope(categories)

Build commit scope from file categories.

**Parameters:**

- `categories` (Object): Categorized files

**Returns:** String scope: 'docs', 'tests', 'metrics', or 'workflow'

**Scope Rules:**

- **docs**: Only docs changed
- **tests**: Only tests changed
- **metrics**: Only metrics changed
- **workflow**: Mixed changes (default)

**Example:**

```javascript
buildCommitScope({ docs: ['a.md'], metrics: [], tests: [] });
// Returns: 'docs'

buildCommitScope({ docs: ['a.md'], metrics: ['b.json'] });
// Returns: 'workflow'
```

### formatCommitBody(details)

Format detailed commit body with file list and metadata.

**Parameters:**

- `details` (Object): Commit details
  - `files` (Array): Files to list
  - `step` (number): Workflow step number
  - `timestamp` (string): ISO timestamp

**Returns:** String formatted commit body

**Example:**

```javascript
formatCommitBody({
  files: ['metrics.json', 'summary.md'],
  step: 5,
  timestamp: '2026-02-07T00:00:00Z',
});
// Returns multi-line string:
//
// Files updated:
// - metrics.json
// - summary.md
//
// Auto-committed by ai_workflow.js v2.0.0
// Step: 5 | Files: 2 | Timestamp: 2026-02-07T00:00:00Z
```

### calculateCommitPriority(files)

Calculate commit priority based on file types.

**Parameters:**

- `files` (Array<string>): Files to commit

**Returns:** String priority: 'high', 'medium', 'low'

**Priority Rules:**

- **high**: Test results, coverage data
- **medium**: Metrics, summaries
- **low**: Docs, logs

**Example:**

```javascript
calculateCommitPriority(['test-results.json']);
// Returns: 'high'

calculateCommitPriority(['.ai_workflow/metrics/m.json']);
// Returns: 'medium'

calculateCommitPriority(['docs/api.md']);
// Returns: 'low'
```

### validateArtifactPath(filePath)

Validate if path is a workflow artifact.

**Parameters:**

- `filePath` (string): Path to validate

**Returns:** Boolean

**Valid Artifact Patterns:**

- `.ai_workflow/`
- `docs/`
- `coverage/`
- `.workflow-reports/`
- `test-results/`

**Example:**

```javascript
validateArtifactPath('.ai_workflow/metrics/m.json'); // true
validateArtifactPath('docs/api.md'); // true
validateArtifactPath('src/app.js'); // false
```

### mergeCommitOptions(userOptions, defaults)

Merge user options with defaults.

**Parameters:**

- `userOptions` (Object): User-provided options
- `defaults` (Object): Default options

**Returns:** Merged options object

**Example:**

```javascript
mergeCommitOptions({ message: 'custom', enabled: true }, { message: 'default', skipCI: true });
// Returns: { message: 'custom', enabled: true, skipCI: true }
```

### extractCommitMetadata(files)

Extract metadata from files for commit message.

**Parameters:**

- `files` (Array<string>): Files to analyze

**Returns:** Object with metadata

```javascript
{
  stepNumber: 5,     // Extracted from filename
  timestamp: '...',  // Current ISO timestamp
  fileCount: 3
}
```

**Example:**

```javascript
extractCommitMetadata(['.ai_workflow/metrics/step5.json']);
// Returns: { stepNumber: 5, timestamp: '...', fileCount: 1 }

extractCommitMetadata(['step_3.json', 'step-7.json']);
// Returns: { stepNumber: 3, ... } (first match)
```

### shouldSkipCI(categories)

Determine if [skip ci] flag should be added.

**Parameters:**

- `categories` (Object): File categories

**Returns:** Boolean (true if CI should be skipped)

**Skip Rules:**

- Skip CI if only docs/metrics/logs/summaries changed
- Run CI if tests or code changed

**Example:**

```javascript
shouldSkipCI({ docs: ['a.md'], metrics: ['b.json'] });
// Returns: true

shouldSkipCI({ tests: ['a.test.js'] });
// Returns: false
```

## AutoCommit Class

Wrapper class for automatic workflow artifact commits.

### Constructor

```javascript
new AutoCommit(options);
```

**Parameters:**

- `options.gitAutomation` (GitAutomation): Git automation instance
- `options.enabled` (boolean): Enable auto-commits (default: true)
- `options.dryRun` (boolean): Dry run mode (default: false)
- `options.exclude` (Array<string>): File patterns to exclude
- `options.include` (Array<string>): File patterns to include

**Example:**

```javascript
const autoCommit = new AutoCommit({
  gitAutomation: git,
  enabled: true,
  dryRun: false,
  exclude: ['logs'], // Don't commit log files
});
```

### Methods

#### commitArtifacts(files, options)

Commit workflow artifact files.

**Parameters:**

- `files` (Array<string>): Files to commit
- `options` (Object): Optional commit options
  - `message` (string): Custom commit message

**Returns:** Promise<Object> Commit result

```javascript
{
  committed: true,
  message: 'chore(workflow): update artifacts',
  files: [...],
  categories: {...}
}
```

**Example:**

```javascript
const result = await autoCommit.commitArtifacts(['.ai_workflow/metrics/step1.json', 'docs/api.md']);

if (result.committed) {
  console.log(`Committed: ${result.message}`);
}
```

#### commitDocs()

Commit documentation updates only.

**Returns:** Promise<Object> Commit result

**Example:**

```javascript
const result = await autoCommit.commitDocs();
if (result.committed) {
  console.log('Documentation updated');
}
```

#### commitMetrics()

Commit metrics files only.

**Returns:** Promise<Object> Commit result

**Example:**

```javascript
await autoCommit.commitMetrics();
```

#### commitSummaries()

Commit workflow summaries only.

**Returns:** Promise<Object> Commit result

**Example:**

```javascript
await autoCommit.commitSummaries();
```

#### commitAll()

Commit all pending workflow artifacts.

**Returns:** Promise<Object> Commit result

**Example:**

```javascript
// Commit everything in one go
const result = await autoCommit.commitAll();
console.log(`Committed ${result.files?.length || 0} files`);
```

#### scheduleCommit(delay)

Schedule a delayed commit.

**Parameters:**

- `delay` (number): Delay in milliseconds (default: 5000)

**Returns:** Promise<Object> Commit result after delay

**Example:**

```javascript
// Commit after 10 seconds
await autoCommit.scheduleCommit(10000);
```

#### getCommitHistory()

Get auto-commit history.

**Returns:** Array of commit history entries

```javascript
[
  {
    timestamp: '2026-02-07T00:00:00Z',
    files: ['.ai_workflow/metrics/m.json'],
    message: 'chore(metrics): update metrics [skip ci]',
    categories: { metrics: [...] }
  }
]
```

**Example:**

```javascript
const history = autoCommit.getCommitHistory();
console.log(`Made ${history.length} auto-commits`);
```

## Usage Examples

### Basic Auto-Commit

```javascript
import { AutoCommit } from './src/lib/auto_commit.js';
import { GitAutomation } from './src/lib/git_automation.js';

const git = new GitAutomation();
const autoCommit = new AutoCommit({ gitAutomation: git });

// Commit workflow artifacts
await autoCommit.commitArtifacts([
  '.ai_workflow/metrics/step1.json',
  '.ai_workflow/summaries/workflow.md',
]);
```

### Selective Commits

```javascript
// Commit only documentation
await autoCommit.commitDocs();

// Commit only metrics
await autoCommit.commitMetrics();

// Commit only summaries
await autoCommit.commitSummaries();

// Commit everything
await autoCommit.commitAll();
```

### Dry Run Mode

```javascript
const autoCommit = new AutoCommit({
  gitAutomation: git,
  dryRun: true,
});

const result = await autoCommit.commitArtifacts(['.ai_workflow/metrics/m.json']);

console.log(`[DRY RUN] Would commit: ${result.message}`);
// No actual commit made
```

### Custom Commit Messages

```javascript
await autoCommit.commitArtifacts(['.ai_workflow/metrics/important.json'], {
  message: 'chore: critical metrics update',
});
```

### Exclude Patterns

```javascript
const autoCommit = new AutoCommit({
  gitAutomation: git,
  exclude: ['logs', 'temp'], // Skip logs and temp files
});

await autoCommit.commitAll();
// Logs and temp files not committed
```

### Include-Only Mode

```javascript
const autoCommit = new AutoCommit({
  gitAutomation: git,
  include: ['metrics', 'summaries'], // Only commit these
});

await autoCommit.commitAll();
// Only metrics and summaries committed
```

### Scheduled Commits

```javascript
// Accumulate changes, commit after 5 minutes
await autoCommit.scheduleCommit(300000);

// Or commit immediately
await autoCommit.commitAll();
```

### Track Commit History

```javascript
// Make several commits
await autoCommit.commitDocs();
await autoCommit.commitMetrics();

// Review history
const history = autoCommit.getCommitHistory();
for (const entry of history) {
  console.log(`${entry.timestamp}: ${entry.message}`);
  console.log(`  Files: ${entry.files.join(', ')}`);
}
```

## Conventional Commit Format

Auto Commit generates messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Types

- **docs**: Documentation only changes
- **chore**: Workflow artifacts, metrics, logs
- **test**: Test results and coverage
- **feat**: New workflow outputs (rare)

### Commit Scopes

- **docs**: Documentation files only
- **tests**: Test files only
- **metrics**: Metrics files only
- **workflow**: Mixed artifact types

### Commit Flags

- **[skip ci]**: Added when only docs/metrics/logs changed (no code impact)
- Omitted when tests or code changed (CI should run)

### Example Messages

```
docs(docs): update API documentation [skip ci]
chore(metrics): update performance metrics [skip ci]
chore(workflow): update docs and metrics [skip ci]
test(tests): update test results
```

## Workflow Integration

### Post-Workflow Cleanup

```javascript
// After workflow completes
async function cleanupWorkflow() {
  const autoCommit = new AutoCommit({ gitAutomation: git });

  // Commit all artifacts generated during workflow
  const result = await autoCommit.commitAll();

  if (result.committed) {
    console.log('Workflow artifacts committed');
  }
}
```

### CI/CD Pipeline

```yaml
# .github/workflows/workflow.yml
steps:
  - name: Run Workflow
    run: npm run workflow

  - name: Auto-Commit Artifacts
    run: node auto-commit-artifacts.js
```

```javascript
// auto-commit-artifacts.js
const autoCommit = new AutoCommit({
  gitAutomation: git,
  enabled: process.env.CI === 'true',
});

await autoCommit.commitAll();
```

## Error Handling

```javascript
const result = await autoCommit.commitArtifacts(files);

if (!result.committed) {
  switch (result.reason) {
    case 'disabled':
      console.log('Auto-commit disabled');
      break;
    case 'no_git':
      console.error('No GitAutomation instance');
      break;
    case 'no_files':
      console.log('No files to commit');
      break;
    case 'filtered':
      console.log('All files filtered out');
      break;
    case 'dry_run':
      console.log('Dry run mode active');
      break;
    case 'error':
      console.error(`Error: ${result.error}`);
      break;
  }
}
```

## Performance Considerations

- **Fast categorization**: Path-based, no file reading
- **Batch commits**: Single commit for all artifacts
- **Skip unnecessary commits**: Filters non-artifacts automatically
- **Memory efficient**: Tracks only essential commit metadata

## Related Modules

- **git_automation.js**: Provides Git commit operations
- **change_detection.js**: Categorizes changed files
- **git_cache.js**: Can cache Git status checks

## Version History

- **2.0.0** (2026-02-07): Initial implementation
  - 10 pure functions for commit message generation
  - AutoCommit class with 8 methods
  - Conventional commit message format
  - [skip ci] flag management
  - Priority-based commit scheduling
  - 66 passing tests with 100% coverage

---

**Last Updated:** 2026-02-07
**Maintainer:** ai_workflow.js team

# git_automation.js

**Git Automation Module** - Core Git operations with structured output parsing

## Overview

The Git Automation module provides a comprehensive interface for Git operations with intelligent output parsing and structured results. It implements Git commands as pure parsing functions combined with an impure wrapper class for command execution.

**Module:** `lib/git_automation`
**Version:** 2.5.0
**Architecture:** Referentially Transparent (Pure Functions + Impure Wrapper)

## Installation

```javascript
import { GitAutomation, parseGitStatus, parseGitDiff } from './src/lib/git_automation.js';
```

## Architecture

### v2.0.0 Pattern: Referential Transparency

This module follows the v2.0.0 architecture pattern:

- **Pure Functions (15 functions)**: Git output parsing, validation, command building
  - Deterministic: Same input always produces same output
  - No side effects: No I/O, state mutation, or external dependencies
  - Easily testable: No mocks required

- **Impure Wrapper (GitAutomation class)**: Command execution, I/O operations
  - Handles Git command execution via child_process
  - Manages working directory context
  - Logs operations and errors
  - Wraps pure functions with real Git interactions

## Pure Functions

### parseGitStatus(output)

Parse `git status --porcelain` output into structured data.

**Parameters:**

- `output` (string): Raw git status output

**Returns:** Object with categorized file changes

```javascript
{
  staged: [{ file: 'src/app.js', status: 'modified' }],
  unstaged: [{ file: 'test.js', status: 'modified' }],
  untracked: ['new-file.js']
}
```

**Example:**

```javascript
const output = 'M  src/app.js\n ?? new.js';
const result = parseGitStatus(output);
console.log(result.staged); // [{ file: 'src/app.js', status: 'modified' }]
console.log(result.untracked); // ['new.js']
```

### parseGitDiff(output)

Parse `git diff` output into structured file changes.

**Parameters:**

- `output` (string): Raw git diff output

**Returns:** Array of file diff objects

```javascript
[
  {
    file: 'src/app.js',
    additions: 10,
    deletions: 5,
    changes: '+function newFeature() {...}',
  },
];
```

**Example:**

```javascript
const diff = 'diff --git a/src/app.js b/src/app.js\n+++ b/src/app.js\n+new line';
const result = parseGitDiff(diff);
console.log(result[0].additions); // Number of added lines
```

### parseGitLog(output)

Parse `git log --oneline` output into commit history.

**Parameters:**

- `output` (string): Raw git log output

**Returns:** Array of commit objects

```javascript
[
  { hash: 'abc123f', message: 'feat: add feature' },
  { hash: 'def456a', message: 'fix: bug fix' },
];
```

**Example:**

```javascript
const log = 'abc123f feat: add feature\ndef456a fix: bug fix';
const commits = parseGitLog(log);
console.log(commits[0].hash); // 'abc123f'
```

### parseGitBranch(output)

Parse `git branch` output into branch list.

**Parameters:**

- `output` (string): Raw git branch output

**Returns:** Object with branches and current branch

```javascript
{
  branches: ['main', 'develop', 'feature-x'],
  current: 'main'
}
```

### parseGitRemote(output)

Parse `git remote -v` output into remote configuration.

**Parameters:**

- `output` (string): Raw git remote output

**Returns:** Array of remote objects

```javascript
[{ name: 'origin', url: 'git@github.com:user/repo.git', type: 'fetch' }];
```

### buildGitCommand(operation, args, options)

Build a Git command string with arguments.

**Parameters:**

- `operation` (string): Git operation (e.g., 'status', 'commit')
- `args` (Array<string>): Command arguments
- `options` (Object): Additional options

**Returns:** String command

**Example:**

```javascript
const cmd = buildGitCommand('status', ['--short', '--branch']);
// Returns: 'status --short --branch'
```

### validateGitOutput(output, rules)

Validate Git command output against rules.

**Parameters:**

- `output` (string): Git command output
- `rules` (Object): Validation rules (minLength, maxLength, pattern)

**Returns:** Boolean indicating validity

### isGitRepository(dirPath)

Check if directory contains a Git repository.

**Parameters:**

- `dirPath` (string): Directory path to check

**Returns:** Boolean

**Example:**

```javascript
if (isGitRepository('/home/user/project')) {
  console.log('This is a Git repository');
}
```

### extractCommitHash(text)

Extract commit hash from text (supports 7-40 char hashes).

**Parameters:**

- `text` (string): Text containing commit hash

**Returns:** String hash or null

**Example:**

```javascript
const hash = extractCommitHash('commit abc123f');
// Returns: 'abc123f'
```

### normalizeFilePath(filePath)

Normalize file path (convert backslashes, remove trailing slash).

**Parameters:**

- `filePath` (string): File path to normalize

**Returns:** Normalized string path

### categorizeGitStatus(statusCode)

Categorize Git status code into human-readable category.

**Parameters:**

- `statusCode` (string): Git status code (e.g., 'M', 'A', 'D')

**Returns:** String category ('modified', 'added', 'deleted', etc.)

**Example:**

```javascript
categorizeGitStatus('M'); // 'modified'
categorizeGitStatus('A'); // 'added'
categorizeGitStatus('D'); // 'deleted'
```

### formatGitDate(dateString)

Format Git date string to ISO format.

**Parameters:**

- `dateString` (string): Git date string

**Returns:** ISO date string or null

### calculateDiffStats(diffOutput)

Calculate statistics from diff output (additions, deletions).

**Parameters:**

- `diffOutput` (string): Git diff output

**Returns:** Object with stats

```javascript
{ additions: 15, deletions: 8, files: 3 }
```

### validateCommitMessage(message)

Validate commit message format and content.

**Parameters:**

- `message` (string): Commit message to validate

**Returns:** Validation result

```javascript
{
  valid: true,
  errors: [],
  warnings: ['First line exceeds 50 characters']
}
```

**Example:**

```javascript
const result = validateCommitMessage('feat: add new feature');
if (result.valid) {
  console.log('Message is valid');
}
```

### buildStatusSummary(statusResult)

Build human-readable summary from parsed status.

**Parameters:**

- `statusResult` (Object): Parsed status result

**Returns:** String summary

**Example:**

```javascript
const summary = buildStatusSummary({
  staged: [{ file: 'a.js' }],
  unstaged: [{ file: 'b.js' }],
  untracked: [],
});
// Returns: '1 staged, 1 unstaged, 0 untracked'
```

## GitAutomation Class

Wrapper class for executing Git operations with structured results.

### Constructor

```javascript
new GitAutomation(options);
```

**Parameters:**

- `options.repoPath` (string): Repository path (default: `process.cwd()`)
- `options.executor` (Executor): Custom executor instance
- `options.timeout` (number): Command timeout in ms (default: 10000)

**Example:**

```javascript
const git = new GitAutomation({
  repoPath: '/path/to/repo',
  timeout: 5000,
});
```

### Methods

#### status(options)

Get repository status with structured output.

**Parameters:**

- `options.short` (boolean): Use short format

**Returns:** Promise<Object> with staged, unstaged, untracked files

**Example:**

```javascript
const status = await git.status({ short: true });
console.log(status.staged); // Files staged for commit
console.log(status.unstaged); // Modified but not staged
console.log(status.untracked); // New files
```

#### diff(options)

Get diff of changes with structured output.

**Parameters:**

- `options.cached` (boolean): Show staged changes
- `options.file` (string): Specific file to diff

**Returns:** Promise<Array> of file diffs

**Example:**

```javascript
const diffs = await git.diff({ cached: true });
for (const diff of diffs) {
  console.log(`${diff.file}: +${diff.additions} -${diff.deletions}`);
}
```

#### commit(message, options)

Create a commit with the given message.

**Parameters:**

- `message` (string): Commit message
- `options.amend` (boolean): Amend previous commit
- `options.noVerify` (boolean): Skip pre-commit hooks

**Returns:** Promise<string> commit hash

**Example:**

```javascript
const hash = await git.commit('feat: add new feature');
console.log(`Committed: ${hash}`);
```

#### add(files)

Stage files for commit.

**Parameters:**

- `files` (string|Array): File(s) to stage

**Returns:** Promise<void>

**Example:**

```javascript
await git.add('src/app.js');
await git.add(['src/app.js', 'test/app.test.js']);
```

#### log(options)

Get commit history.

**Parameters:**

- `options.maxCount` (number): Limit number of commits
- `options.oneline` (boolean): Use oneline format

**Returns:** Promise<Array> of commits

**Example:**

```javascript
const commits = await git.log({ maxCount: 10, oneline: true });
commits.forEach((c) => console.log(`${c.hash} ${c.message}`));
```

#### branch(options)

List or manage branches.

**Parameters:**

- `options.all` (boolean): Include remote branches

**Returns:** Promise<Object> with branches and current

**Example:**

```javascript
const { branches, current } = await git.branch({ all: false });
console.log(`Current: ${current}`);
console.log(`All branches: ${branches.join(', ')}`);
```

#### remote(options)

List or manage remotes.

**Parameters:**

- `options.verbose` (boolean): Show URLs

**Returns:** Promise<Array> of remotes

**Example:**

```javascript
const remotes = await git.remote({ verbose: true });
remotes.forEach((r) => console.log(`${r.name}: ${r.url}`));
```

#### checkout(branch, options)

Checkout a branch or commit.

**Parameters:**

- `branch` (string): Branch name or commit hash
- `options.create` (boolean): Create new branch

**Returns:** Promise<void>

**Example:**

```javascript
await git.checkout('develop');
await git.checkout('feature-x', { create: true });
```

#### push(options)

Push commits to remote.

**Parameters:**

- `options.remote` (string): Remote name (default: 'origin')
- `options.branch` (string): Branch name

**Returns:** Promise<void>

**Example:**

```javascript
await git.push({ remote: 'origin', branch: 'main' });
```

#### pull(options)

Pull changes from remote.

**Parameters:**

- `options.remote` (string): Remote name
- `options.branch` (string): Branch name

**Returns:** Promise<void>

**Example:**

```javascript
await git.pull({ remote: 'origin', branch: 'main' });
```

#### reset(options)

Reset current HEAD to specified state.

**Parameters:**

- `options.hard` (boolean): Hard reset (discard changes)
- `options.commit` (string): Commit to reset to

**Returns:** Promise<void>

#### stash(options)

Stash working directory changes.

**Parameters:**

- `options.save` (boolean): Save stash with message
- `options.pop` (boolean): Pop stash
- `options.message` (string): Stash message

**Returns:** Promise<void>

**Example:**

```javascript
await git.stash({ save: true, message: 'WIP: feature' });
// ... do other work ...
await git.stash({ pop: true });
```

## Usage Examples

### Basic Repository Status

```javascript
import { GitAutomation } from './src/lib/git_automation.js';

const git = new GitAutomation({ repoPath: '/path/to/repo' });

// Check status
const status = await git.status();
console.log(`Staged files: ${status.staged.length}`);
console.log(`Unstaged files: ${status.unstaged.length}`);
console.log(`Untracked files: ${status.untracked.length}`);
```

### Create Commit Workflow

```javascript
// Stage files
await git.add(['src/app.js', 'test/app.test.js']);

// Verify what's staged
const status = await git.status();
if (status.staged.length > 0) {
  // Create commit
  const hash = await git.commit('feat: add new feature\n\nDetailed description');
  console.log(`Created commit: ${hash}`);
}
```

### Review Changes Before Commit

```javascript
// Get diff of staged changes
const stagedDiffs = await git.diff({ cached: true });
for (const diff of stagedDiffs) {
  console.log(`File: ${diff.file}`);
  console.log(`  Additions: ${diff.additions}`);
  console.log(`  Deletions: ${diff.deletions}`);
}

// Get diff of unstaged changes
const unstagedDiffs = await git.diff({ cached: false });
```

### Branch Management

```javascript
// List all branches
const { branches, current } = await git.branch();
console.log(`Current branch: ${current}`);
console.log(`Available branches: ${branches.join(', ')}`);

// Create and checkout new branch
await git.checkout('feature-x', { create: true });

// Switch back to main
await git.checkout('main');
```

### Commit History Analysis

```javascript
// Get recent commits
const commits = await git.log({ maxCount: 10, oneline: true });

for (const commit of commits) {
  console.log(`${commit.hash.substring(0, 7)} - ${commit.message}`);
}
```

### Parse Git Output Directly

```javascript
import { parseGitStatus, parseGitDiff } from './src/lib/git_automation.js';

// Parse status output from external source
const statusOutput = 'M  src/app.js\nA  src/new.js\n?? test.js';
const status = parseGitStatus(statusOutput);

// Parse diff output
const diffOutput = `diff --git a/src/app.js b/src/app.js
--- a/src/app.js
+++ b/src/app.js
+new line`;
const diffs = parseGitDiff(diffOutput);
```

## Error Handling

The GitAutomation class throws `ExecutionError` for failed Git operations:

```javascript
import { ExecutionError } from './src/utils/errors.js';

try {
  await git.commit('fix: resolve issue');
} catch (error) {
  if (error instanceof ExecutionError) {
    console.error(`Git command failed: ${error.message}`);
    console.error(`Command: ${error.command}`);
    console.error(`Exit code: ${error.exitCode}`);
  }
}
```

### Common Error Scenarios

- **Not a Git repository**: `isGitRepository()` returns false
- **Invalid commit message**: `validateCommitMessage()` returns validation errors
- **Command timeout**: Operations exceed configured timeout
- **Invalid arguments**: Pure functions return empty/null results

## Performance Considerations

- **Command execution**: Default timeout 10 seconds
- **Large diffs**: Max buffer 10MB for diff output
- **Caching**: Consider using `GitCache` (see git_cache.md) for repeated operations
- **Parallel operations**: Safe to run multiple read-only operations concurrently

## Related Modules

- **git_cache.js**: Caching layer for Git operations (5-10 minute TTL)
- **change_detection.js**: Intelligent file change analysis
- **auto_commit.js**: Automatic workflow artifact commits
- **executor.js**: Command execution foundation

## Version History

- **2.0.0** (2026-02-07): Initial implementation with referential transparency
  - 15 pure functions for parsing and validation
  - GitAutomation class with 12 methods
  - Comprehensive Git operation support
  - 55 passing tests with 100% coverage

---

**Last Updated:** 2026-02-07
**Maintainer:** ai_workflow.js team

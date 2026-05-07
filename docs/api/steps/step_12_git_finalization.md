# step_12_git_finalization.js API Documentation

**Module:** `steps/step_12_git_finalization`
**Version:** 2.3.2
**Architecture:** Pure functions + Wrapper class (Referential Transparency)

## Overview

Step 12 performs git finalization — staging changes, generating commit messages, and pushing to remote. It analyzes the current git state, categorizes changes, and produces conventional commit messages (with optional AI assistance).

**Key Features:**

- Git state analysis and change categorization
- Submodule detection and processing
- AI-powered commit message generation
- Conventional commit message inference (feat/fix/docs/test/chore/refactor/style/perf)
- Atomic staging and push operations

## Installation

```javascript
import {
  Step12GitFinalization,
  parseGitStatusPorcelain,
  categorizeChanges,
  inferCommitType,
  generateCommitMessage,
  COMMIT_TYPES,
  CHANGE_CATEGORIES,
  GIT_OPERATIONS,
} from 'ai-workflow';
```

## Architecture Pattern

### Pure Functions (Exported for Testing)

```javascript
// Git state analysis
export function parseGitStatusPorcelain(statusOutput);
export function categorizeChanges(files);
export function inferCommitType(categories);

// Commit message generation
export function generateCommitMessage(type, summary, body);
export function formatConventionalCommit(type, scope, subject, body, footer);
```

### Impure Wrapper

```javascript
export class Step12GitFinalization {
  // Handles side effects: git commands, file I/O, AI calls, logging
  async execute(projectRoot, options);
}
```

## API Reference

### Constants

#### `COMMIT_TYPES`

Conventional commit type identifiers:

```javascript
export const COMMIT_TYPES = {
  feat: 'feat',
  fix: 'fix',
  docs: 'docs',
  test: 'test',
  chore: 'chore',
  refactor: 'refactor',
  style: 'style',
  perf: 'perf',
};
```

#### `CHANGE_CATEGORIES`

File change categorization by extension with priority weights:

```javascript
export const CHANGE_CATEGORIES = {
  documentation: { pattern: /\.(md|txt|rst|adoc)$/i, weight: 1 },
  tests: { pattern: /\.(test|spec|tests)\.(js|ts|py|go|java|rb|php)$/i, weight: 3 },
  scripts: { pattern: /\.(sh|bash|zsh|ps1|cmd|bat)$/i, weight: 2 },
  code: { pattern: /\.(js|ts|py|go|java|rb|php|c|cpp|rs|swift|kt)$/i, weight: 5 },
  config: { pattern: /\.(json|yaml|yml|toml|ini|xml|conf|config)$/i, weight: 1 },
};
```

#### `GIT_OPERATIONS`

Standard git commands used internally:

```javascript
export const GIT_OPERATIONS = {
  status: 'git status --porcelain',
  statusShort: 'git status --short',
  diff: 'git diff --stat',
  diffSummary: 'git diff --shortstat',
  log: 'git log --oneline -n 10',
  commitsAhead: 'git rev-list --count @{u}..HEAD',
  commitsBehind: 'git rev-list --count HEAD..@{u}',
  currentBranch: 'git branch --show-current',
  hasSubmodules: 'git config --file .gitmodules --list',
  submoduleStatus: 'git submodule status',
};
```

### Pure Functions

#### `parseGitStatusPorcelain(statusOutput)`

Parse `git status --porcelain` output into structured file entries.

**Parameters:**

- `statusOutput` (string) - Raw output from `git status --porcelain`

**Returns:** (Object[]) Array of `{ status, file }` objects

**Example:**

```javascript
const raw = 'M  src/lib/config.js\nA  docs/new.md\nD  old.txt';
const entries = parseGitStatusPorcelain(raw);
// [
//   { status: 'M', file: 'src/lib/config.js' },
//   { status: 'A', file: 'docs/new.md' },
//   { status: 'D', file: 'old.txt' },
// ]
```

#### `categorizeChanges(files)`

Categorize a list of changed file paths by type.

**Parameters:**

- `files` (string[]) - Array of file paths

**Returns:** (Object) Category counts `{ documentation, tests, scripts, code, config, other }`

**Example:**

```javascript
const files = ['src/lib/config.js', 'README.md', 'test/lib/config.test.js'];
const categories = categorizeChanges(files);
// { documentation: 1, tests: 1, scripts: 0, code: 1, config: 0, other: 0 }
```

#### `inferCommitType(categories)`

Infer the conventional commit type from change categories.

**Parameters:**

- `categories` (Object) - Category counts from `categorizeChanges`

**Returns:** (string) Commit type (one of `COMMIT_TYPES` values)

**Example:**

```javascript
const type = inferCommitType({ documentation: 5, tests: 0, code: 0 });
// 'docs'

const type2 = inferCommitType({ documentation: 1, tests: 3, code: 2 });
// 'feat'  (code changes dominate by weight)
```

#### `generateCommitMessage(type, summary, body)`

Build a conventional commit message string.

**Parameters:**

- `type` (string) - Commit type from `COMMIT_TYPES`
- `summary` (string) - Short summary (subject line, ≤72 chars)
- `body` (string, optional) - Longer description

**Returns:** (string) Formatted commit message

**Example:**

```javascript
const msg = generateCommitMessage(
  'feat',
  'add version update step',
  'Implements SemVer bump logic'
);
// 'feat: add version update step\n\nImplements SemVer bump logic'
```

### Wrapper Class

#### `Step12GitFinalization`

Impure wrapper class that coordinates git finalization with I/O, AI, and git operations.

**Constructor:**

```javascript
constructor((options = {}));
```

**Options:**

- `executor` (Executor) - Command executor instance
- `aiHelper` (AiHelper) - AI helper for commit message generation
- `backlog` (Backlog) - Backlog reporting instance

**Methods:**

##### `async execute(projectRoot, options = {})`

Execute the git finalization workflow step.

**Parameters:**

- `projectRoot` (string) - Project root directory
- `options` (Object) - Execution options
  - `options.dryRun` (boolean) - Skip actual git operations
  - `options.push` (boolean) - Push after commit (default: `false`)
  - `options.aiCommitMessage` (boolean) - Use AI for commit message (default: `true`)

**Returns:** (Promise\<Object\>) Result object

- `success` (boolean) - True if finalization completed
- `skipped` (boolean) - True if nothing to commit
- `commitType` (string) - Inferred commit type
- `commitMessage` (string) - Generated commit message
- `filesStaged` (number) - Files staged
- `branch` (string) - Current branch name

**Example:**

```javascript
import { Step12GitFinalization } from 'ai-workflow';

const step = new Step12GitFinalization();
const result = await step.execute('/path/to/project', { push: true });

console.log(result.commitMessage);
// 'feat: update config module and documentation'
```

## Usage Examples

### Basic Finalization

```javascript
const step = new Step12GitFinalization();
const result = await step.execute('/path/to/project');

if (result.skipped) {
  console.log('Nothing to commit');
} else {
  console.log(`Committed: ${result.commitMessage}`);
  console.log(`${result.filesStaged} files staged`);
}
```

### Dry Run

```javascript
const result = await step.execute('/path/to/project', { dryRun: true });
// Analyzes and plans commit without executing git commands
console.log(`Would commit as: ${result.commitType}`);
```

## Error Handling

**No Changes:**

```javascript
const result = await step.execute(projectRoot);
if (result.skipped) {
  console.log('Working tree clean — nothing to finalize');
}
```

**Push Failure:**

The step catches push errors and returns `success: false` with the error detail, leaving the commit intact for manual push.

## Related Modules

- **GitAutomation** (`lib/git_automation`) - Low-level git operations
- **AutoCommit** (`lib/auto_commit`) - Artifact-specific auto-commits
- **GitSubmodules** (`lib/git_submodules`) - Submodule handling
- **AiHelper** (`lib/ai_helpers`) - AI-powered message generation
- **Step11ContextManager** (`steps/step_11`) - Previous step
- **Step16VersionUpdate** (`steps/step_16`) - Next step (version bump)

---

**Last Updated:** 2026-03-04
**Status:** Complete
**Test Coverage:** 100%
**Source:** `src/steps/step_12_git_finalization.js`

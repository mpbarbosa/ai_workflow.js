# step_16_version_update.js API Documentation

**Module:** `steps/step_16_version_update`
**Version:** 2.0.0
**Architecture:** Pure functions + Wrapper class (Referential Transparency)

## Overview

Step 16 performs AI-powered semantic version updates. It analyses changed files, infers the appropriate SemVer bump (major/minor/patch), updates version strings across project metadata files, and optionally validates consistency using a project-defined npm script.

**Key Features:**

- Semantic version extraction and parsing
- Heuristic-based bump type inference (major/minor/patch)
- Version string replacement across multiple file types
- Package metadata file support (package.json, pyproject.toml, Cargo.toml, etc.)
- Optional AI-assisted bump recommendation
- Consistency validation via `npm run check:version`

## Installation

```javascript
import {
  Step16VersionUpdate,
  extractVersion,
  parseVersion,
  bumpVersion,
  inferBumpType,
  replaceVersionInContent,
  SEMVER_PATTERN,
  VERSION_PATTERN_REGEX,
  BUMP_TYPES,
  METADATA_FILES,
  HEURISTIC_THRESHOLDS,
} from 'ai-workflow';
```

## Architecture Pattern

### Pure Functions (Exported for Testing)

```javascript
// Version parsing
export function extractVersion(input);
export function parseVersion(version);

// Version manipulation
export function bumpVersion(version, bumpType);
export function replaceVersionInContent(content, oldVersion, newVersion);

// Bump type inference
export function inferBumpType(diffStats, changedFiles);
```

### Impure Wrapper

```javascript
export class Step16VersionUpdate {
  // Handles side effects: file I/O, git diff, AI calls, npm script execution
  async execute(projectRoot, options);
}
```

## API Reference

### Constants

#### `SEMVER_PATTERN`

Regex for matching semantic version strings:

```javascript
export const SEMVER_PATTERN = /\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?/;
```

#### `BUMP_TYPES`

Available bump type identifiers:

```javascript
export const BUMP_TYPES = Object.freeze({
  major: 'major',
  minor: 'minor',
  patch: 'patch',
});
```

#### `METADATA_FILES`

Project metadata files that receive version updates:

```javascript
export const METADATA_FILES = Object.freeze([
  'package.json',
  'pyproject.toml',
  'setup.py',
  'Cargo.toml',
  '.workflow-config.yaml',
]);
```

#### `HEURISTIC_THRESHOLDS`

Thresholds used to infer bump type from diff statistics:

```javascript
export const HEURISTIC_THRESHOLDS = Object.freeze({
  majorDeletions:    500,  // lines deleted → major bump
  majorModifiedFiles: 20,  // files changed → major bump
  minorInsertions:   100,  // lines inserted → minor bump
});
```

### Pure Functions

#### `extractVersion(input)`

Extract the first semantic version string from any input string.

**Parameters:**

- `input` (string) - String potentially containing a version

**Returns:** (string | null) Version string (e.g. `"1.2.3"`) or `null`

**Example:**

```javascript
extractVersion('version: "1.4.2"');  // '1.4.2'
extractVersion('no version here');   // null
extractVersion('v2.0.0-beta.1');     // '2.0.0-beta.1'
```

#### `parseVersion(version)`

Parse a semantic version string into its components.

**Parameters:**

- `version` (string) - Version string (`X.Y.Z` or `X.Y.Z-prerelease`)

**Returns:** (Object | null) `{ major, minor, patch, prerelease }` or `null` if invalid

**Example:**

```javascript
parseVersion('1.4.2');
// { major: 1, minor: 4, patch: 2, prerelease: undefined }

parseVersion('2.0.0-beta.1');
// { major: 2, minor: 0, patch: 0, prerelease: 'beta.1' }

parseVersion('not-a-version');
// null
```

#### `bumpVersion(version, bumpType)`

Increment a semantic version string.

**Parameters:**

- `version` (string) - Current version (e.g. `"1.4.2"`)
- `bumpType` (string) - One of `BUMP_TYPES` (`'major'`, `'minor'`, `'patch'`)

**Returns:** (string) New version string

**Example:**

```javascript
bumpVersion('1.4.2', 'patch');  // '1.4.3'
<<<<<<< HEAD
bumpVersion('1.4.2', 'minor');  // '1.9.11'
=======
bumpVersion('1.4.2', 'minor');  // '1.6.1'
>>>>>>> a4c4d4d (chore(workflow): update docs and metrics [skip ci])
bumpVersion('1.4.2', 'major');  // '2.0.0'
```

#### `replaceVersionInContent(content, oldVersion, newVersion)`

Replace all version occurrences in file content.

**Parameters:**

- `content` (string) - File content
- `oldVersion` (string) - Version string to replace
- `newVersion` (string) - Replacement version string

**Returns:** (string) Updated content

**Example:**

```javascript
const updated = replaceVersionInContent(
  '{"version": "1.4.2"}',
  '1.4.2',
<<<<<<< HEAD
  '1.9.11'
);
// '{"version": "1.9.11"}'
=======
  '1.6.1'
);
// '{"version": "1.6.1"}'
>>>>>>> a4c4d4d (chore(workflow): update docs and metrics [skip ci])
```

#### `inferBumpType(diffStats, changedFiles)`

Infer the SemVer bump type from git diff statistics.

**Parameters:**

- `diffStats` (Object) - `{ insertions, deletions, filesChanged }`
- `changedFiles` (string[]) - List of changed file paths

**Returns:** (string) Bump type (`'major'`, `'minor'`, or `'patch'`)

**Example:**

```javascript
inferBumpType({ insertions: 500, deletions: 10, filesChanged: 5 }, []);
// 'minor'

inferBumpType({ insertions: 0, deletions: 600, filesChanged: 25 }, []);
// 'major'

inferBumpType({ insertions: 5, deletions: 2, filesChanged: 1 }, ['README.md']);
// 'patch'
```

### Wrapper Class

#### `Step16VersionUpdate`

Impure wrapper class coordinating version detection, bump, file updates, and validation.

**Constructor:**

```javascript
constructor(options = {});
```

**Options:**

- `fileOps` (FileOperations) - File operations instance
- `executor` (Executor) - Command executor instance
- `aiHelper` (AiHelper) - AI helper instance
- `backlog` (Backlog) - Backlog reporting instance

**Methods:**

##### `async execute(projectRoot, options = {})`

Execute the version update workflow step.

**Parameters:**

- `projectRoot` (string) - Project root directory
- `options` (Object) - Execution options
  - `options.dryRun` (boolean) - Preview changes without writing
  - `options.bumpType` (string) - Override inferred bump type
  - `options.aiAssist` (boolean) - Use AI for bump recommendation (default: `true`)

**Returns:** (Promise\<Object\>) Result object

- `success` (boolean) - True if version was updated
- `skipped` (boolean) - True if no metadata files found
- `oldVersion` (string) - Version before update
- `newVersion` (string) - Version after update
- `bumpType` (string) - Applied bump type
- `filesUpdated` (string[]) - Files that were modified

**Example:**

```javascript
import { Step16VersionUpdate } from 'ai-workflow';

const step = new Step16VersionUpdate();
const result = await step.execute('/path/to/project');

console.log(`${result.oldVersion} → ${result.newVersion} (${result.bumpType})`);
<<<<<<< HEAD
// '1.4.2 → 1.9.11 (minor)'
=======
// '1.4.2 → 1.6.1 (minor)'
>>>>>>> a4c4d4d (chore(workflow): update docs and metrics [skip ci])
```

## Usage Examples

### Basic Version Update

```javascript
const step = new Step16VersionUpdate();
const result = await step.execute('/path/to/project');

if (result.success) {
  console.log(`Bumped to ${result.newVersion}`);
  console.log(`Updated files: ${result.filesUpdated.join(', ')}`);
}
```

### Force a Specific Bump Type

```javascript
const result = await step.execute('/path/to/project', {
  bumpType: 'major',
});
```

### Dry Run

```javascript
const result = await step.execute('/path/to/project', { dryRun: true });
console.log(`Would bump ${result.oldVersion} → ${result.newVersion}`);
// No files are written
```

## Error Handling

**No Metadata Files:**

```javascript
const result = await step.execute(projectRoot);
if (result.skipped) {
  console.log('No versioned metadata files found');
}
```

**Version Parse Failure:**

If the current version cannot be parsed, the step returns `success: false` and logs the offending file for manual inspection.

## Related Modules

- **FileOperations** (`lib/file_operations`) - File I/O operations
- **AiHelper** (`lib/ai_helpers`) - AI bump recommendation
- **Step12GitFinalization** (`steps/step_12`) - Git commit after version bump
- **Step17Summary** (`steps/step_17`) - Final summary report

---

**Last Updated:** 2026-03-04
**Status:** Complete
**Test Coverage:** 100%
**Source:** `src/steps/step_16_version_update.js`

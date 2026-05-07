# step1_incremental — Step 1 Incremental Processing

**Module:** `src/lib/step1_incremental.js`
**Version:** v2.3.2
**Phase:** 8 (Performance Optimization)
**Architecture:** Referential Transparency (Pure Functions + Impure Wrapper)

## Overview

Incremental documentation validation for Step 1 (Documentation Validation). Tracks file hashes between workflow runs so that only changed documentation files are re-validated, dramatically reducing execution time on large projects.

**Key Features:**

- 🔍 **Hash-based change detection**: SHA-256 file hashes stored in a persistent cache
- ⚡ **Skip unchanged files**: Only re-validates files modified since the last run
- 📂 **Category-aware**: Classifies docs into README, API, guide, reference, changelog, etc.
- 🔄 **Cache management**: Atomic cache reads/writes with configurable file path
- 🧹 **Pattern exclusion**: Respects `node_modules`, `.git`, `dist`, `build`, `coverage`

## Architecture

```
┌──────────────────────────────────────────────┐
│  Step1IncrementalProcessor (Impure Wrapper)  │
│  - File I/O (hash reads, cache persistence)  │
│  - State management (cache map, counters)    │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  Pure Functions                              │
│  - computeFileHash()                         │
│  - categorizeFile()                          │
│  - filterChangedFiles()                      │
│  - buildCacheEntry()                         │
│  - mergeCacheResults()                       │
└──────────────────────────────────────────────┘
```

## Installation

```javascript
import {
  Step1IncrementalProcessor,
  DEFAULT_CONFIG,
  DOC_CATEGORIES,
  computeFileHash,
  categorizeFile,
  filterChangedFiles,
} from 'ai-workflow/lib/step1_incremental';
```

## Constants

### `DEFAULT_CONFIG`

Default configuration for the incremental processor:

```javascript
export const DEFAULT_CONFIG = {
  cacheFile: '.ai_workflow/.incremental_cache/step1_docs.json',
  hashAlgorithm: 'sha256',
  encoding: 'hex',
  ignorePatterns: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
  ],
};
```

### `DOC_CATEGORIES`

Documentation file category identifiers:

```javascript
export const DOC_CATEGORIES = {
  README: 'readme',
  API: 'api',
  GUIDE: 'guide',
  REFERENCE: 'reference',
  CHANGELOG: 'changelog',
  CONTRIBUTING: 'contributing',
  LICENSE: 'license',
  OTHER: 'other',
};
```

## Pure Functions

### `computeFileHash(content, algorithm, encoding)`

Compute a deterministic hash of file content.

**Parameters:**

- `content` (string | Buffer) - File content
- `algorithm` (string) - Hash algorithm (default: `'sha256'`)
- `encoding` (string) - Output encoding (default: `'hex'`)

**Returns:** (string) Hash digest

**Example:**

```javascript
const hash = computeFileHash('# Hello World\n', 'sha256', 'hex');
// 'a3f1c...' (deterministic)
```

### `categorizeFile(filePath)`

Classify a documentation file path into a `DOC_CATEGORIES` value.

**Parameters:**

- `filePath` (string) - Relative file path

**Returns:** (string) Category from `DOC_CATEGORIES`

**Example:**

```javascript
categorizeFile('README.md'); // 'readme'
categorizeFile('docs/api/config.md'); // 'api'
categorizeFile('docs/guides/setup.md'); // 'guide'
categorizeFile('CHANGELOG.md'); // 'changelog'
categorizeFile('CONTRIBUTING.md'); // 'contributing'
categorizeFile('LICENSE'); // 'license'
categorizeFile('docs/misc/notes.md'); // 'other'
```

### `filterChangedFiles(files, cachedHashes, currentHashes)`

Return only files whose hash has changed since the last run.

**Parameters:**

- `files` (string[]) - All candidate file paths
- `cachedHashes` (Object) - `{ [filePath]: hash }` from previous run cache
- `currentHashes` (Object) - `{ [filePath]: hash }` computed this run

**Returns:** (string[]) Files that are new or modified

**Example:**

```javascript
const changed = filterChangedFiles(
  ['README.md', 'docs/api/config.md'],
  { 'README.md': 'abc123' },
  { 'README.md': 'abc123', 'docs/api/config.md': 'def456' }
);
// ['docs/api/config.md']  (README.md unchanged)
```

### `buildCacheEntry(filePath, hash, category, timestamp)`

Build a structured cache entry object.

**Parameters:**

- `filePath` (string) - File path
- `hash` (string) - File hash
- `category` (string) - Doc category
- `timestamp` (number) - Unix timestamp in ms

**Returns:** (Object) Cache entry `{ hash, category, validatedAt }`

### `mergeCacheResults(existingCache, newEntries)`

Merge new validation entries into existing cache, preserving unchanged entries.

**Parameters:**

- `existingCache` (Object) - Previous cache
- `newEntries` (Object) - New or updated entries

**Returns:** (Object) Merged cache

## Wrapper Class

### `Step1IncrementalProcessor`

Impure wrapper that reads/writes the hash cache and coordinates incremental validation.

**Constructor:**

```javascript
constructor((options = {}));
```

**Options:**

- `config` (Object) - Override `DEFAULT_CONFIG` fields
- `fileOps` (FileOperations) - File operations instance

**Methods:**

#### `async process(files, validateFn, options = {})`

Process a list of documentation files, skipping unchanged ones.

**Parameters:**

- `files` (string[]) - Documentation file paths to consider
- `validateFn` (Function) - `async (filePath) => result` validation callback
- `options` (Object)
  - `options.force` (boolean) - Bypass cache and validate all files (default: `false`)

**Returns:** (Promise\<Object\>) Processing result

- `validated` (string[]) - Files that were validated this run
- `skipped` (string[]) - Files skipped (unchanged)
- `results` (Object) - `{ [filePath]: validationResult }`
- `cacheHitRate` (number) - Fraction of files served from cache (0–1)

**Example:**

```javascript
import { Step1IncrementalProcessor } from 'ai-workflow/lib/step1_incremental';

const processor = new Step1IncrementalProcessor();

const result = await processor.process(
  ['README.md', 'docs/api/config.md', 'docs/guides/setup.md'],
  async (filePath) => {
    // your validation logic
    return { valid: true, issues: [] };
  }
);

console.log(`Validated: ${result.validated.length}, Skipped: ${result.skipped.length}`);
console.log(`Cache hit rate: ${(result.cacheHitRate * 100).toFixed(0)}%`);
```

#### `async loadCache()`

Load the persistent hash cache from disk.

**Returns:** (Promise\<Object\>) Cached hash entries, or `{}` if no cache exists

#### `async saveCache(cache)`

Persist the updated hash cache to disk.

**Parameters:**

- `cache` (Object) - Cache map to write

**Returns:** (Promise\<void\>)

## Usage Examples

### Basic Incremental Processing

```javascript
const processor = new Step1IncrementalProcessor();

const docFiles = ['README.md', 'CONTRIBUTING.md', 'docs/api/config.md', 'docs/guides/setup.md'];

const result = await processor.process(docFiles, async (file) => {
  const content = await fs.readFile(file, 'utf8');
  return validateDocumentation(content);
});

console.log(`${result.skipped.length} files unchanged — skipped`);
console.log(`${result.validated.length} files validated`);
```

### Force Full Revalidation

```javascript
const result = await processor.process(docFiles, validateFn, { force: true });
// All files validated regardless of cache
```

### Custom Cache Location

```javascript
const processor = new Step1IncrementalProcessor({
  config: { cacheFile: '.my_cache/docs.json' },
});
```

## Performance Impact

On a project with 116 documentation files:

| Run type          | Files validated | Typical time |
| ----------------- | --------------- | ------------ |
| First run (cold)  | 116             | ~45s         |
| Subsequent (warm) | 3–10 changed    | ~5s          |
| Force revalidate  | 116             | ~45s         |

## Related Modules

- **[step1_parallel](./step1_parallel.md)** - Parallel variant for large doc sets
- **[FileOperations](./file_operations.md)** - File I/O operations
- **[Step1Documentation](../steps/step_01_documentation.md)** - Parent workflow step

---

**Last Updated:** 2026-03-04
**Status:** Complete
**Test Coverage:** 100%
**Source:** `src/lib/step1_incremental.js`

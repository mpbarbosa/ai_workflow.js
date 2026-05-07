# Cleanup Handlers Module API Documentation

**Module:** `lib/cleanup_handlers`
**Version:** 2.5.0
**Architecture:** Pure Functions + Impure Wrapper (Referential Transparency)

## Overview

The Cleanup Handlers module provides automated cleanup operations for temporary files, caches, old sessions, and workflow artifacts with referential transparency. It supports age-based, size-based, and pattern-based cleanup strategies.

**Key Features:**

- ✅ Age-based cleanup (remove files older than threshold)
- ✅ Size-based cleanup (remove files exceeding size limit)
- ✅ Pattern-based cleanup (remove files matching patterns)
- ✅ Directory-specific cleanup strategies
- ✅ Dry-run mode support
- ✅ Referentially transparent architecture (pure functions + impure wrapper)
- ✅ Safe cleanup with validation and confirmation

## Architecture

```
┌────────────────────────────────────┐
│  CleanupManager Class (Impure)     │
│  - File I/O operations             │
│  - Time injection                  │
│  - Logging side effects            │
│  - User confirmation prompts       │
└─────────────┬──────────────────────┘
              │ calls
              ▼
┌────────────────────────────────────┐
│  Pure Functions                    │
│  - filterByAge()                   │
│  - filterBySize()                  │
│  - filterByPattern()               │
│  - calculateTotalSize()            │
│  - categorizeFiles()               │
│  - generateCleanupPlan()           │
│  - validateCleanupConfig()         │
└────────────────────────────────────┘
```

## Key Pure Functions

### `filterByAge(files, maxAgeMs, currentTime)`

Filter files older than specified age (immutable).

**Parameters:**

- `files` (Array): Array of file objects with `{ path, mtime }`
- `maxAgeMs` (number): Maximum age in milliseconds
- `currentTime` (number): Current timestamp for comparison

**Returns:** Array of files to clean up

### `filterBySize(files, maxSize)`

Filter files exceeding specified size (immutable).

### `filterByPattern(files, patterns)`

Filter files matching glob patterns (immutable).

### `calculateTotalSize(files)`

Calculate total size of files in bytes.

### `categorizeFiles(files, categories)`

Categorize files by type/purpose for selective cleanup.

### `generateCleanupPlan(files, strategy)`

Generate cleanup execution plan based on strategy.

## CleanupManager Class

### Constructor

```javascript
new CleanupManager(config);
```

**Config Options:**

- `tempDir` - Temporary files directory
- `cacheDir` - Cache directory
- `logsDir` - Logs directory
- `maxAge` - Maximum file age in milliseconds
- `maxSize` - Maximum individual file size
- `patterns` - Cleanup glob patterns
- `dryRun` - Enable dry-run mode (no actual deletion)

### Methods

#### `async cleanupTempFiles()`

Clean up temporary files based on age.

#### `async cleanupCache()`

Clean up cache directory based on age and size.

#### `async cleanupLogs()`

Clean up old log files.

#### `async cleanupOldSessions()`

Clean up expired session data.

#### `async cleanupAll()`

Run all cleanup operations.

#### `generateReport()`

Generate cleanup report showing freed space.

## Usage Example

```javascript
import { CleanupManager } from './lib/cleanup_handlers.js';

const cleanup = new CleanupManager({
  tempDir: '.ai_workflow/temp',
  cacheDir: '.ai_workflow/cache',
  logsDir: '.ai_workflow/logs',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxSize: 100 * 1024 * 1024, // 100 MB
  patterns: ['*.tmp', '*.cache'],
  dryRun: false,
});

// Clean up old temporary files
await cleanup.cleanupTempFiles();

// Clean up entire cache
await cleanup.cleanupCache();

// Run all cleanup operations
const report = await cleanup.cleanupAll();
console.log(`Freed ${report.totalSize} bytes`);
```

## Cleanup Strategies

### Age-Based Cleanup

Remove files older than specified threshold:

- **Temporary files**: > 24 hours
- **Cache files**: > 7 days
- **Log files**: > 30 days
- **Session data**: > 90 days

### Size-Based Cleanup

Remove files exceeding size limits:

- **Individual files**: > 100 MB
- **Directory total**: > 1 GB

### Pattern-Based Cleanup

Remove files matching patterns:

- `*.tmp` - Temporary files
- `*.cache` - Cache files
- `*.log.old` - Archived logs
- `*.backup` - Backup files

## Cleanup Report

Example cleanup report:

```javascript
{
  tempFiles: { count: 15, size: 1024000, freed: 1024000 },
  cacheFiles: { count: 42, size: 5242880, freed: 5242880 },
  logFiles: { count: 8, size: 2097152, freed: 2097152 },
  sessions: { count: 3, size: 4096, freed: 4096 },
  totalFreed: 8368128, // bytes
  duration: 250 // ms
}
```

## Safety Features

- ✅ **Dry-run mode**: Preview cleanup without deletion
- ✅ **Validation**: Verify paths before cleanup
- ✅ **Confirmation**: Optional user confirmation for destructive operations
- ✅ **Logging**: Detailed cleanup logs
- ✅ **Rollback**: Preserve backups before deletion
- ✅ **Pattern validation**: Prevent accidental deletion of important files

## Related Modules

- [file_operations](./file_operations.md) - File system operations
- [session_manager](./session_manager.md) - Session lifecycle management
- [metrics](./metrics.md) - Performance metrics

## See Also

- Source: `src/lib/cleanup_handlers.js` (589 LOC)
- Tests: `test/lib/cleanup_handlers.test.js` (43 tests)
- Architecture: [Referential Transparency](../../architecture/DESIGN_PRINCIPLES.md)

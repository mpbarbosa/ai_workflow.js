# cleanup_handlers - Cleanup Operations Module

**Module:** `lib/cleanup_handlers`
**Version:** 2.0.0
**Type:** Pure Functions + Wrapper

## Overview

Cleanup operations for temp files, sessions, cache, logs. Pure functions for filtering, wrapper for I/O.

---

## Pure Functions

### `shouldCleanByAge(fileModifiedTime, currentTime, maxAgeMs)`

Check if file should be cleaned based on age.

**Example:**

```javascript
const now = Date.now();
const fileTime = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago
shouldCleanByAge(fileTime, now, 3 * 24 * 60 * 60 * 1000); // true (>3 days)
```

### `shouldCleanBySize(fileSize, maxSizeBytes)`

Check if file exceeds size limit.

### `filterByAge(files, currentTime, maxAgeMs)`

Filter files by age.

### `filterBySize(files, maxSizeBytes)`

Filter files by size.

---

## CleanupManager Class

Wrapper for cleanup operations.

**Methods:**

- `cleanOldFiles(dir, maxAge)` - Remove old files
- `cleanLargeFiles(dir, maxSize)` - Remove large files
- `cleanEmptyDirs(dir)` - Remove empty directories

---

## Usage Examples

### Clean Old Logs

```javascript
import { CleanupManager } from './lib/cleanup_handlers.js';

const cleanup = new CleanupManager(fileOps);

const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
await cleanup.cleanOldFiles('/logs', maxAge);
```

### Using Pure Functions

```javascript
import { filterByAge } from './lib/cleanup_handlers.js';

const files = await listFiles('/logs');
const old = filterByAge(files, Date.now(), maxAge);
console.log(`Found ${old.length} old files`);
```

---

**Last Updated:** 2026-02-01
**Part of:** AI Workflow Automation v1.9.10

# git_cache.js

**Git Cache Module** - Performance optimization layer for Git operations

## Overview

The Git Cache module provides intelligent caching for Git operations to reduce repeated command execution. It uses TTL-based expiration, automatic invalidation on state changes, and memory-efficient storage with LRU eviction.

**Module:** `lib/git_cache`
**Version:** 2.3.0
**Architecture:** Referentially Transparent (Pure Functions + Impure Wrapper)

## Installation

```javascript
import { GitCache, generateCacheKey, isCacheValid } from './src/lib/git_cache.js';
```

## Architecture

### v2.0.0 Pattern: Referential Transparency

This module follows the v2.0.0 architecture pattern:

- **Pure Functions (8 functions)**: Cache validation, key generation, metrics calculation
  - Deterministic: Same input always produces same output
  - No side effects: No I/O or state mutation
  - Time-injectable: Current time passed as parameter

- **Impure Wrapper (GitCache class)**: Cache storage, retrieval, invalidation
  - In-memory Map storage
  - TTL-based expiration
  - Hit/miss statistics tracking
  - Auto-invalidation on Git operations

## Pure Functions

### generateCacheKey(operation, args)

Generate deterministic cache key from operation and arguments.

**Parameters:**

- `operation` (string): Git operation name
- `args` (Array<string>): Operation arguments

**Returns:** String cache key (e.g., 'git_status_abc123')

**Example:**

```javascript
const key = generateCacheKey('status', ['--short']);
// Returns: 'git_status_a1b2c3d4' (deterministic hash)

// Same inputs always produce same key
const key2 = generateCacheKey('status', ['--short']);
assert(key === key2); // true
```

### isCacheValid(entry, ttl, currentTime)

Check if cache entry is still valid based on TTL.

**Parameters:**

- `entry` (Object): Cache entry with timestamp
- `ttl` (number): Time to live in milliseconds
- `currentTime` (number): Current timestamp (injected)

**Returns:** Boolean indicating validity

**Example:**

```javascript
const entry = { timestamp: 1000, result: { files: [] } };
const ttl = 5000; // 5 seconds

isCacheValid(entry, ttl, 5000); // true (within TTL)
isCacheValid(entry, ttl, 7000); // false (expired)
```

### shouldInvalidateCache(reason)

Determine if cache should be invalidated for given reason.

**Parameters:**

- `reason` (string): Operation that triggered check

**Returns:** Boolean (true for state-changing operations)

**Example:**

```javascript
shouldInvalidateCache('commit'); // true (modifies repo)
shouldInvalidateCache('status'); // false (read-only)
shouldInvalidateCache('add'); // true (stages files)
```

**State-Changing Operations:**

- commit, add, reset, checkout
- merge, rebase, pull, fetch
- stash

### calculateCacheStats(metrics)

Calculate cache statistics from metrics object.

**Parameters:**

- `metrics` (Object): Metrics with hits/misses

**Returns:** Object with calculated stats

```javascript
{
  hits: 80,
  misses: 20,
  hitRate: 80, // percentage
  total: 100
}
```

**Example:**

```javascript
const stats = calculateCacheStats({ hits: 80, misses: 20 });
console.log(`Hit rate: ${stats.hitRate}%`);
```

### filterExpiredEntries(entries, currentTime, ttl)

Filter out expired entries from cache Map.

**Parameters:**

- `entries` (Map): Cache entries
- `currentTime` (number): Current timestamp
- `ttl` (number): Time to live

**Returns:** Array of expired keys

**Example:**

```javascript
const cache = new Map([
  ['key1', { timestamp: 1000 }],
  ['key2', { timestamp: 5000 }],
]);

const expired = filterExpiredEntries(cache, 8000, 5000);
// Returns: ['key1'] (expired at timestamp 6000)
```

### mergeCacheMetrics(metrics1, metrics2)

Merge two cache metrics objects.

**Parameters:**

- `metrics1` (Object): First metrics object
- `metrics2` (Object): Second metrics object

**Returns:** Merged metrics object

**Example:**

```javascript
const m1 = { hits: 10, misses: 5 };
const m2 = { hits: 20, misses: 3 };
const merged = mergeCacheMetrics(m1, m2);
// Returns: { hits: 30, misses: 8 }
```

### createCacheEntry(key, result, timestamp)

Create cache entry with metadata.

**Parameters:**

- `key` (string): Cache key
- `result` (\*): Operation result to cache
- `timestamp` (number): Entry timestamp

**Returns:** Cache entry object

```javascript
{
  key: 'git_status_abc',
  result: { files: [] },
  timestamp: 1000,
  size: 14 // bytes
}
```

### validateCacheConfig(config)

Validate cache configuration object.

**Parameters:**

- `config` (Object): Configuration to validate

**Returns:** Validation result

```javascript
{
  valid: true,
  errors: []
}
```

**Example:**

```javascript
const result = validateCacheConfig({
  ttl: 5000,
  maxSize: 100,
  enabled: true,
});

if (!result.valid) {
  console.error('Invalid config:', result.errors);
}
```

## GitCache Class

Wrapper class for managing Git operation cache with TTL-based expiration.

### Constructor

```javascript
new GitCache(options);
```

**Parameters:**

- `options.ttl` (Object): TTL per operation type (ms)
  - `status`: 300000 (5 minutes)
  - `diff`: 60000 (1 minute)
  - `log`: 600000 (10 minutes)
  - `branch`: 600000 (10 minutes)
  - `remote`: 3600000 (1 hour)
  - `default`: 300000 (5 minutes)
- `options.maxSize` (number): Maximum cache entries (default: 100)
- `options.enabled` (boolean): Enable/disable caching (default: true)

**Example:**

```javascript
const cache = new GitCache({
  ttl: {
    status: 300000, // 5 min for status
    diff: 60000, // 1 min for diffs
    log: 600000, // 10 min for logs
  },
  maxSize: 50,
  enabled: true,
});
```

### Methods

#### get(operation, args, executor)

Get cached result or execute operation if cache miss.

**Parameters:**

- `operation` (string): Git operation name
- `args` (Array<string>): Operation arguments
- `executor` (Function): Async function to execute on cache miss

**Returns:** Promise<\*> Operation result (cached or fresh)

**Example:**

```javascript
const cache = new GitCache();
const gitAutomation = new GitAutomation();

// First call - cache miss, executes Git command
const result1 = await cache.get('status', [], async () => {
  return await gitAutomation.status();
});

// Second call - cache hit, returns cached result
const result2 = await cache.get('status', [], async () => {
  return await gitAutomation.status();
});
// executor not called, result returned from cache
```

#### set(operation, args, result)

Store result in cache.

**Parameters:**

- `operation` (string): Git operation name
- `args` (Array<string>): Operation arguments
- `result` (\*): Result to cache

**Returns:** Promise<void>

**Example:**

```javascript
await cache.set('status', ['--short'], { files: [] });
```

#### invalidate(pattern)

Invalidate cache entries matching pattern.

**Parameters:**

- `pattern` (string|RegExp): Pattern to match keys

**Returns:** Promise<number> Number of invalidated entries

**Example:**

```javascript
// Invalidate all status caches
await cache.invalidate('status');

// Invalidate with regex
await cache.invalidate(/^git_(status|diff)/);
```

#### invalidateAfterOperation(reason)

Automatically invalidate cache after state-changing operation.

**Parameters:**

- `reason` (string): Operation that changed state

**Returns:** Promise<number> Number of invalidated entries

**Example:**

```javascript
// After committing changes
await cache.invalidateAfterOperation('commit');
// Invalidates status and diff caches
```

#### clear()

Clear all cache entries.

**Returns:** Promise<number> Number of cleared entries

**Example:**

```javascript
const count = await cache.clear();
console.log(`Cleared ${count} cache entries`);
```

#### getMetrics()

Get cache statistics.

**Returns:** Object with metrics

```javascript
{
  hits: 80,
  misses: 20,
  hitRate: 80,
  size: 45,      // current entries
  maxSize: 100,  // max allowed
  enabled: true
}
```

**Example:**

```javascript
const metrics = cache.getMetrics();
console.log(`Hit rate: ${metrics.hitRate}%`);
console.log(`Cache utilization: ${metrics.size}/${metrics.maxSize}`);
```

#### cleanup()

Remove expired entries from cache.

**Returns:** Promise<number> Number of removed entries

**Example:**

```javascript
// Periodic cleanup
setInterval(async () => {
  const removed = await cache.cleanup();
  if (removed > 0) {
    console.log(`Cleaned up ${removed} expired entries`);
  }
}, 60000); // Every minute
```

## Usage Examples

### Basic Caching with GitAutomation

```javascript
import { GitCache } from './src/lib/git_cache.js';
import { GitAutomation } from './src/lib/git_automation.js';

const git = new GitAutomation();
const cache = new GitCache();

async function getStatus() {
  return await cache.get('status', [], async () => {
    return await git.status();
  });
}

// First call - executes Git command
const status1 = await getStatus(); // Cache miss

// Second call - returns cached result
const status2 = await getStatus(); // Cache hit (fast!)
```

### Custom TTL Configuration

```javascript
const cache = new GitCache({
  ttl: {
    status: 120000, // 2 minutes (frequent changes)
    diff: 30000, // 30 seconds (very frequent)
    log: 900000, // 15 minutes (rarely changes)
    branch: 600000, // 10 minutes
    remote: 3600000, // 1 hour (stable)
  },
});
```

### Cache Invalidation After Changes

```javascript
// Stage files
await git.add('src/app.js');

// Invalidate caches since repo state changed
await cache.invalidateAfterOperation('add');

// Next status call will execute fresh Git command
const status = await cache.get('status', [], () => git.status());
```

### Monitoring Cache Performance

```javascript
// Get metrics periodically
setInterval(() => {
  const metrics = cache.getMetrics();
  console.log(`Cache Performance:`);
  console.log(`  Hits: ${metrics.hits}`);
  console.log(`  Misses: ${metrics.misses}`);
  console.log(`  Hit Rate: ${metrics.hitRate}%`);
  console.log(`  Entries: ${metrics.size}/${metrics.maxSize}`);
}, 30000);
```

### Pattern-Based Invalidation

```javascript
// Invalidate all status-related caches
await cache.invalidate(/status/);

// Invalidate specific operation with args
await cache.invalidate('git_diff_abc123');

// Clear everything
await cache.clear();
```

### Disabled Cache (Bypass for Testing)

```javascript
const cache = new GitCache({ enabled: false });

// All operations bypass cache
const result = await cache.get('status', [], () => git.status());
// Always executes, never caches
```

### LRU Eviction with Max Size

```javascript
const cache = new GitCache({ maxSize: 10 });

// Add 11 entries
for (let i = 0; i < 11; i++) {
  await cache.set(`op${i}`, [], { data: i });
}

// Oldest entry automatically evicted
const metrics = cache.getMetrics();
console.log(metrics.size); // 10 (not 11)
```

## Performance Optimization

### Recommended TTL Values

| Operation | TTL    | Rationale                              |
| --------- | ------ | -------------------------------------- |
| status    | 5 min  | Changes frequently during development  |
| diff      | 1 min  | Very dynamic, shows current changes    |
| log       | 10 min | History rarely changes between commits |
| branch    | 10 min | Branch list stable during work         |
| remote    | 1 hour | Remote config very stable              |

### Cache Hit Rate Targets

- **>80% hit rate**: Excellent (well-tuned TTLs)
- **60-80% hit rate**: Good (consider increasing TTLs)
- **<60% hit rate**: Poor (TTLs too short or operations too diverse)

### Memory Usage

- **Typical entry size**: 50-500 bytes (status/branch)
- **Large entries**: 5-50 KB (diff with many changes)
- **Recommended maxSize**: 50-200 entries
- **Estimated memory**: 10-100 KB typical, up to 10 MB with large diffs

## Error Handling

The GitCache class is resilient to errors:

```javascript
try {
  const result = await cache.get('status', [], async () => {
    throw new Error('Git command failed');
  });
} catch (error) {
  // Error propagated from executor
  console.error('Operation failed:', error.message);
  // Cache remains valid, error not cached
}
```

### Error Scenarios

- **Invalid cache entry**: Silently skipped during retrieval
- **Executor throws error**: Error propagated, nothing cached
- **Cleanup failure**: Logged, doesn't affect other operations

## Related Modules

- **git_automation.js**: Primary Git operations to cache
- **change_detection.js**: Uses cached Git status
- **auto_commit.js**: Benefits from cached status checks

## Performance Benchmarks

Based on typical repository with 1000 files:

| Operation    | Uncached  | Cached | Speedup |
| ------------ | --------- | ------ | ------- |
| git status   | 80-120ms  | <5ms   | 20x     |
| git diff     | 150-250ms | <5ms   | 40x     |
| git log (10) | 100-150ms | <5ms   | 25x     |
| git branch   | 50-80ms   | <5ms   | 15x     |

## Version History

- **2.0.0** (2026-02-07): Initial implementation
  - 8 pure functions for cache management
  - GitCache class with 8 methods
  - TTL-based expiration with auto-invalidation
  - LRU eviction for memory efficiency
  - Hit/miss statistics tracking
  - 76 passing tests with 100% coverage

---

**Last Updated:** 2026-02-07
**Maintainer:** ai_workflow.js team

# ai_cache - AI Response Caching Module

**Module:** `lib/ai_cache`  
**Version:** 2.0.0  
**Type:** Pure Functions + Wrapper

## Overview

Provides persistent disk-based caching of AI responses with TTL expiration to reduce token usage and improve performance. Achieves 60-80% token reduction on repeated operations with intelligent cache invalidation.

---

## Architecture

**Pure Functions** (exported for testing):

- `generateCacheKey()` - Generate SHA256 hash for cache key
- `isCacheValid()` - Check if cache entry is within TTL
- `shouldInvalidateCache()` - Determine if cache should be cleared
- `calculateCacheStats()` - Compute cache statistics
- `filterEntriesByAge()` - Filter expired entries
- `createCacheEntry()` - Build cache entry metadata
- `mergeCacheMetrics()` - Merge cache metrics
- `validateCacheConfig()` - Validate cache configuration

**Wrapper Class**:

- `AiCache` - Manages persistent cache with file I/O

---

## Pure Functions

### `generateCacheKey(prompt, context)`

Generates deterministic cache key from prompt and context.

**Parameters:**

- `prompt` (string) - AI prompt text
- `context` (string) - Additional context (persona, options)

**Returns:** string - SHA256 hash (64 hex characters)

**Example:**

```javascript
import { generateCacheKey } from './lib/ai_cache.js';

const key = generateCacheKey('Write tests for...', 'test_engineer');
// 'a1b2c3d4e5f6...' (64 characters)

// Same inputs always produce same key
const key2 = generateCacheKey('Write tests for...', 'test_engineer');
// key === key2 ✅
```

---

### `isCacheValid(cacheEntry, ttlSeconds, currentTime)`

Checks if cache entry is still valid based on TTL.

**Parameters:**

- `cacheEntry` (Object) - Cache entry with `timestampEpoch`
- `ttlSeconds` (number) - Time-to-live in seconds
- `currentTime` (number) - Current time (Unix epoch seconds)

**Returns:** boolean - True if cache is valid

**Example:**

```javascript
const entry = { timestampEpoch: 1704067200 }; // 2024-01-01 00:00:00
const ttl = 86400; // 24 hours
const now = 1704070800; // 2024-01-01 01:00:00

const valid = isCacheValid(entry, ttl, now);
// true (1 hour old, within 24 hour TTL)
```

---

### `shouldInvalidateCache(reason, options)`

Determines if cache should be invalidated based on reason.

**Parameters:**

- `reason` (string) - Invalidation reason
- `options` (Object) - Options with `forceReasons` array

**Returns:** boolean - True if should invalidate

**Default Force Reasons:**

- `'config_changed'` - Configuration updated
- `'manual_clear'` - User requested clear
- `'version_bump'` - Version changed

**Example:**

```javascript
shouldInvalidateCache('config_changed');
// true

shouldInvalidateCache('minor_update');
// false
```

---

### `calculateCacheStats(entries, currentTime, ttl)`

Calculates cache statistics from entries.

**Parameters:**

- `entries` (Array\<Object\>) - Cache entries
- `currentTime` (number) - Current time (Unix epoch seconds)
- `ttl` (number) - TTL in seconds

**Returns:** Object with `{ total, valid, expired, totalSize }`

**Example:**

```javascript
const stats = calculateCacheStats(entries, Date.now() / 1000, 86400);
// {
//   total: 10,
//   valid: 8,
//   expired: 2,
//   totalSize: 52480,
//   hitRate: 0
// }
```

---

### `filterEntriesByAge(entries, maxAge, currentTime)`

Filters entries older than maxAge.

**Parameters:**

- `entries` (Array\<Object\>) - Cache entries
- `maxAge` (number) - Maximum age in seconds
- `currentTime` (number) - Current time (Unix epoch seconds)

**Returns:** Array\<Object\> - Expired entries

**Example:**

```javascript
const expired = filterEntriesByAge(entries, 86400, Date.now() / 1000);
// Returns entries older than 24 hours
```

---

### `createCacheEntry(cacheKey, prompt, context, responseSize, timestamp, additional)`

Creates cache entry metadata.

**Parameters:**

- `cacheKey` (string) - Cache key (hash)
- `prompt` (string) - Original prompt
- `context` (string) - Context string
- `responseSize` (number) - Response size in bytes
- `timestamp` (number) - Current timestamp (Unix epoch seconds)
- `additional` (Object) - Additional metadata (optional)

**Returns:** Object - Cache entry metadata

**Example:**

```javascript
const entry = createCacheEntry(
  'abc123',
  'Write tests for app.js',
  'test_engineer',
  1024,
  Date.now() / 1000
);
// {
//   cacheKey: 'abc123',
//   timestamp: '2026-02-01T12:00:00.000Z',
//   timestampEpoch: 1738411200,
//   promptPreview: 'Write tests for app.js',
//   context: 'test_engineer',
//   responseSize: 1024
// }
```

---

### `validateCacheConfig(config)`

Validates cache configuration.

**Parameters:**

- `config` (Object) - Config with `cacheDir`, `ttl`, `maxSizeMB`

**Returns:** Object with `{ valid, errors }`

**Example:**

```javascript
const result = validateCacheConfig({
  cacheDir: '.ai_cache',
  ttl: 86400,
  maxSizeMB: 100,
});
// { valid: true, errors: [] }
```

---

## AiCache Class

Manages persistent disk-based AI response caching.

### Constructor

```javascript
new AiCache(options);
```

**Options:**

- `cacheDir` (string) - Cache directory (default: `.ai_workflow/.ai_cache`)
- `ttl` (number) - TTL in seconds (default: 86400 = 24 hours)
- `maxSizeMB` (number) - Maximum cache size in MB (default: 100)
- `enabled` (boolean) - Enable/disable caching (default: true)

### Methods

#### `async init()`

Initializes cache directory and index file.

**Example:**

```javascript
import { AiCache } from './lib/ai_cache.js';

const cache = new AiCache({
  cacheDir: '.ai_workflow/.ai_cache',
  ttl: 86400,
  maxSizeMB: 100,
});

await cache.init();
```

---

#### `async has(cacheKey)`

Checks if cached response exists and is valid.

**Parameters:**

- `cacheKey` (string) - Cache key to check

**Returns:** Promise\<boolean\> - True if cache exists and is valid

**Example:**

```javascript
const key = generateCacheKey('Write tests', 'engineer');
const exists = await cache.has(key);
// true or false
```

---

#### `async get(cacheKey)`

Gets cached response if valid.

**Parameters:**

- `cacheKey` (string) - Cache key

**Returns:** Promise\<string|null\> - Cached response or null

**Example:**

```javascript
const response = await cache.get(key);
if (response) {
  console.log('Cache hit!');
  console.log(response);
} else {
  console.log('Cache miss');
}
```

---

#### `async set(cacheKey, response, metadata)`

Saves response to cache.

**Parameters:**

- `cacheKey` (string) - Cache key
- `response` (string) - AI response to cache
- `metadata` (Object) - Optional metadata (`prompt`, `context`)

**Returns:** Promise\<void\>

**Example:**

```javascript
const key = generateCacheKey(prompt, context);
await cache.set(key, aiResponse, {
  prompt,
  context: 'test_engineer',
});
```

---

#### `async withCache(prompt, context, aiFunction)`

Wrapper for AI calls with automatic caching.

**Parameters:**

- `prompt` (string) - AI prompt
- `context` (string) - Context string
- `aiFunction` (Function) - Async function that calls AI

**Returns:** Promise\<string\> - AI response (cached or fresh)

**Example:**

```javascript
const response = await cache.withCache('Write tests for app.js', 'test_engineer', async () => {
  // This only runs on cache miss
  return await callAI(prompt);
});

// Subsequent calls with same prompt return cached response
```

---

#### `async cleanupExpired()`

Removes expired cache entries.

**Returns:** Promise\<number\> - Number of entries deleted

**Example:**

```javascript
const deleted = await cache.cleanupExpired();
console.log(`Cleaned up ${deleted} expired entries`);
```

---

#### `async clear()`

Clears entire cache.

**Returns:** Promise\<void\>

**Example:**

```javascript
await cache.clear();
console.log('Cache cleared');
```

---

#### `async getStats()`

Gets cache statistics.

**Returns:** Promise\<Object\> - Cache statistics

**Example:**

```javascript
const stats = await cache.getStats();
console.log(stats);
// {
//   total: 50,
//   valid: 45,
//   expired: 5,
//   totalSizeMB: 25.5,
//   created: '2026-02-01T00:00:00.000Z',
//   lastCleanup: '2026-02-01T12:00:00.000Z',
//   location: '.ai_workflow/.ai_cache',
//   runtimeMetrics: {
//     hits: 120,
//     misses: 30,
//     hitRate: 80.0,
//     tokensSaved: 120000
//   }
// }
```

---

#### `async delete(cacheKey)`

Deletes specific cache entry.

**Parameters:**

- `cacheKey` (string) - Cache key to delete

**Returns:** Promise\<boolean\> - True if deleted

**Example:**

```javascript
const deleted = await cache.delete(key);
if (deleted) {
  console.log('Cache entry deleted');
}
```

---

## Usage Examples

### Basic Caching

```javascript
import { AiCache, generateCacheKey } from './lib/ai_cache.js';

// Initialize cache
const cache = new AiCache({
  cacheDir: '.ai_cache',
  ttl: 86400, // 24 hours
  maxSizeMB: 100,
});

await cache.init();

// Generate cache key
const prompt = 'Write tests for app.js';
const context = 'test_engineer';
const key = generateCacheKey(prompt, context);

// Check cache
if (await cache.has(key)) {
  const response = await cache.get(key);
  console.log('Using cached response');
} else {
  const response = await callAI(prompt);
  await cache.set(key, response, { prompt, context });
  console.log('Cached new response');
}
```

### Automatic Caching with withCache

```javascript
// Simplest approach - automatic cache handling
const cache = new AiCache();
await cache.init();

const response = await cache.withCache(
  'Review this code',
  'code_quality_analyst',
  async () => await aiHelper.executeRequest('Review this code')
);

// Cache automatically handles:
// - Key generation
// - Cache lookup
// - Response storage
// - Metrics tracking
```

### Cache Maintenance

```javascript
// Periodic cleanup
setInterval(async () => {
  const deleted = await cache.cleanupExpired();
  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} expired entries`);
  }
}, 3600000); // Every hour

// Get statistics
const stats = await cache.getStats();
console.log(`Cache hit rate: ${stats.runtimeMetrics.hitRate}%`);
console.log(`Tokens saved: ${stats.runtimeMetrics.tokensSaved}`);

// Clear cache if needed
if (configChanged) {
  await cache.clear();
}
```

### Custom TTL and Configuration

```javascript
// Short-lived cache for rapid iteration
const shortCache = new AiCache({
  cacheDir: '.cache/temp',
  ttl: 3600, // 1 hour
  maxSizeMB: 50,
});

// Long-lived cache for stable prompts
const longCache = new AiCache({
  cacheDir: '.cache/stable',
  ttl: 604800, // 7 days
  maxSizeMB: 200,
});
```

---

## Cache Performance

### Token Savings

```javascript
const cache = new AiCache();
await cache.init();

// First call - cache miss
await cache.withCache(prompt, context, () => callAI(prompt));
// Tokens used: 1000

// Second call - cache hit
await cache.withCache(prompt, context, () => callAI(prompt));
// Tokens used: 0 (cached)

// Check savings
const stats = await cache.getStats();
console.log(`Token savings: ${stats.runtimeMetrics.tokensSaved}`);
```

### Hit Rate Monitoring

```javascript
// Monitor cache effectiveness
const stats = await cache.getStats();
console.log(`Cache Performance:
  Hit Rate: ${stats.runtimeMetrics.hitRate}%
  Hits: ${stats.runtimeMetrics.hits}
  Misses: ${stats.runtimeMetrics.misses}
  Tokens Saved: ${stats.runtimeMetrics.tokensSaved}
`);

// Low hit rate? Consider:
// - Increasing TTL
// - Normalizing prompts
// - Adjusting cache size
```

---

## Cache Structure

### Directory Layout

```
.ai_workflow/.ai_cache/
├── index.json              # Cache index with metadata
├── abc123...txt           # Cached response (by hash)
├── abc123...meta          # Response metadata
├── def456...txt
├── def456...meta
└── ...
```

### Index File Format

```json
{
  "version": "1.0.0",
  "created": "2026-02-01T00:00:00.000Z",
  "createdEpoch": 1738368000,
  "lastCleanup": "2026-02-01T12:00:00.000Z",
  "lastCleanupEpoch": 1738411200,
  "entries": [
    {
      "cacheKey": "abc123...",
      "created": "2026-02-01T10:00:00.000Z",
      "lastAccessed": "2026-02-01T11:00:00.000Z",
      "accessCount": 5
    }
  ]
}
```

---

## Related Modules

- **[ai_helpers](./ai_helpers.md)** - AI SDK integration
- **[ai_prompt_builder](./ai_prompt_builder.md)** - Prompt generation
- **[ai_validation](./ai_validation.md)** - Response validation
- **[metrics](./metrics.md)** - Performance metrics

---

## Best Practices

1. **Initialize early**: Call `init()` before first use
2. **Use withCache**: Simplifies cache handling
3. **Monitor hit rate**: Track cache effectiveness
4. **Periodic cleanup**: Remove expired entries
5. **Appropriate TTL**: Balance freshness vs. savings
6. **Cache invalidation**: Clear on config changes

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.2.0 (Phase 6 - AI Integration)

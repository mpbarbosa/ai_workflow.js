# ai_cache

**Module:** `src/lib/ai_cache.js`  
**Version:** 2.0.0  
**Architecture:** Pure functions + Impure wrapper

AI response caching for token reduction and performance optimization.

---

## Overview

The `ai_cache` module provides persistent disk-based caching of AI responses with TTL-based expiration. It reduces token usage by 60-80% on repeated operations while maintaining response freshness.

### Key Features

- **Disk-Based Storage**: Persistent cache survives restarts
- **TTL Expiration**: 24-hour default TTL (configurable)
- **Cache Key Generation**: SHA256 hashing of prompts and context
- **Automatic Cleanup**: Age-based cleanup of expired entries
- **Hit/Miss Metrics**: Track cache effectiveness and token savings
- **Size Management**: Configurable maximum cache size
- **Invalidation**: Manual or automatic cache invalidation

### Performance Benefits

- **60-80% Token Reduction**: On repeated operations
- **Faster Responses**: Instant retrieval from disk
- **Cost Savings**: Reduced AI API costs
- **Persistent Metrics**: Track savings over time

---

## Installation

```javascript
import { AiCache, generateCacheKey, isCacheValid } from './lib/ai_cache.js';
```

---

## Pure Functions

### generateCacheKey

Generate cache key from prompt and context using SHA256 hash.

**Signature:**
```javascript
function generateCacheKey(prompt: string, context?: string): string
```

**Parameters:**
- `prompt` (string): AI prompt text
- `context` (string, optional): Additional context (persona, options) (default: '')

**Returns:**
- (string): SHA256 hash as cache key (64 hex characters)

**Pure:** ✅ Yes

**Example:**
```javascript
const key = generateCacheKey('Write tests for...', 'test_engineer');
// => 'a1b2c3d4e5f6...' (64 char SHA256 hash)

const key2 = generateCacheKey('Write tests for...', 'test_engineer');
// => 'a1b2c3d4e5f6...' (same hash for same inputs)
```

---

### isCacheValid

Check if cache entry is valid based on TTL.

**Signature:**
```javascript
function isCacheValid(
  cacheEntry: { timestampEpoch: number },
  ttlSeconds: number,
  currentTime: number
): boolean
```

**Parameters:**
- `cacheEntry` (Object): Cache entry with `timestampEpoch` (Unix epoch seconds)
- `ttlSeconds` (number): Time-to-live in seconds
- `currentTime` (number): Current time (Unix epoch seconds)

**Returns:**
- (boolean): True if cache is still valid

**Pure:** ✅ Yes

**Example:**
```javascript
const entry = { timestampEpoch: 1704067200 };
const ttl = 86400; // 24 hours
const now = 1704070800; // 1 hour later

isCacheValid(entry, ttl, now);
// => true (within TTL)

const expired = 1704153600 + 86401; // >24 hours later
isCacheValid(entry, ttl, expired);
// => false (expired)
```

---

### shouldInvalidateCache

Determine if cache should be invalidated based on reason.

**Signature:**
```javascript
function shouldInvalidateCache(reason: string, options?: {
  forceReasons?: string[]
}): boolean
```

**Parameters:**
- `reason` (string): Invalidation reason
- `options.forceReasons` (string[], optional): Reasons that always invalidate (default: ['config_changed', 'manual_clear', 'version_bump'])

**Returns:**
- (boolean): True if cache should be invalidated

**Pure:** ✅ Yes

**Example:**
```javascript
shouldInvalidateCache('config_changed');
// => true

shouldInvalidateCache('minor_update');
// => false

shouldInvalidateCache('minor_update', { forceReasons: ['minor_update'] });
// => true
```

---

### calculateCacheStats

Calculate cache statistics from entries.

**Signature:**
```javascript
function calculateCacheStats(
  entries: Array<Object>,
  currentTime: number,
  ttl: number
): {
  total: number,
  valid: number,
  expired: number,
  totalSize: number
}
```

**Parameters:**
- `entries` (Array): Array of cache entries with metadata
- `currentTime` (number): Current time (Unix epoch seconds)
- `ttl` (number): TTL in seconds

**Returns:**
- (Object): Cache statistics

**Pure:** ✅ Yes

**Example:**
```javascript
const entries = [
  { timestampEpoch: now - 3600, size: 1024 },     // Valid
  { timestampEpoch: now - 90000, size: 2048 }      // Expired (>24h)
];

const stats = calculateCacheStats(entries, now, 86400);
// => { total: 2, valid: 1, expired: 1, totalSize: 3072 }
```

---

### filterEntriesByAge

Filter cache entries by age.

**Signature:**
```javascript
function filterEntriesByAge(
  entries: Array<Object>,
  maxAge: number,
  currentTime: number
): Array<Object>
```

**Parameters:**
- `entries` (Array): Cache entries to filter
- `maxAge` (number): Maximum age in seconds
- `currentTime` (number): Current time (Unix epoch seconds)

**Returns:**
- (Array): Entries within maxAge

**Pure:** ✅ Yes

**Example:**
```javascript
const entries = [
  { timestampEpoch: now - 3600 },   // 1 hour old
  { timestampEpoch: now - 90000 }    // 25 hours old
];

const recent = filterEntriesByAge(entries, 86400, now);
// => [{ timestampEpoch: now - 3600 }] (only the recent one)
```

---

### createCacheEntry

Create cache entry with metadata.

**Signature:**
```javascript
function createCacheEntry(
  cacheKey: string,
  response: string,
  currentTime: number,
  metadata?: Object
): {
  key: string,
  timestamp: string,
  timestampEpoch: number,
  size: number,
  metadata: Object
}
```

**Parameters:**
- `cacheKey` (string): Cache key
- `response` (string): AI response to cache
- `currentTime` (number): Current time (Unix epoch seconds)
- `metadata` (Object, optional): Additional metadata

**Returns:**
- (Object): Cache entry with metadata

**Pure:** ✅ Yes

**Example:**
```javascript
const entry = createCacheEntry('abc123', 'Response text', Date.now() / 1000, {
  persona: 'test_engineer',
  model: 'gpt-4'
});
// => {
//   key: 'abc123',
//   timestamp: '2026-02-07T...',
//   timestampEpoch: 1704067200,
//   size: 13,
//   metadata: { persona: 'test_engineer', model: 'gpt-4' }
// }
```

---

### mergeCacheMetrics

Merge two cache metric objects.

**Signature:**
```javascript
function mergeCacheMetrics(
  metrics1: { hits?: number, misses?: number, tokensSaved?: number },
  metrics2: { hits?: number, misses?: number, tokensSaved?: number }
): {
  hits: number,
  misses: number,
  total: number,
  hitRate: number,
  tokensSaved: number
}
```

**Parameters:**
- `metrics1` (Object): First metrics object
- `metrics2` (Object): Second metrics object

**Returns:**
- (Object): Merged metrics with calculated hit rate

**Pure:** ✅ Yes

**Example:**
```javascript
const m1 = { hits: 10, misses: 5, tokensSaved: 5000 };
const m2 = { hits: 15, misses: 10, tokensSaved: 7500 };

const merged = mergeCacheMetrics(m1, m2);
// => { hits: 25, misses: 15, total: 40, hitRate: 62.5, tokensSaved: 12500 }
```

---

### validateCacheConfig

Validate cache configuration.

**Signature:**
```javascript
function validateCacheConfig(config: {
  cacheDir: string,
  ttl: number,
  maxSizeMB: number
}): {
  valid: boolean,
  errors: string[]
}
```

**Parameters:**
- `config` (Object): Cache configuration to validate

**Returns:**
- (Object): Validation result with `valid` and `errors`

**Pure:** ✅ Yes

**Example:**
```javascript
const result = validateCacheConfig({
  cacheDir: '/tmp/.cache',
  ttl: 86400,
  maxSizeMB: 100
});
// => { valid: true, errors: [] }

const invalid = validateCacheConfig({
  cacheDir: '',
  ttl: -1,
  maxSizeMB: 0
});
// => {
//   valid: false,
//   errors: [
//     'cacheDir must be a non-empty string',
//     'ttl must be a positive number',
//     'maxSizeMB must be a positive number'
//   ]
// }
```

---

## Wrapper Class

### AiCache

AI cache manager with persistent disk storage.

**Constructor:**
```javascript
new AiCache(options?: {
  cacheDir?: string,
  ttl?: number,
  maxSizeMB?: number,
  enabled?: boolean
})
```

**Options:**
- `cacheDir` (string, optional): Cache directory (default: '.ai_workflow/.ai_cache')
- `ttl` (number, optional): TTL in seconds (default: 86400 = 24 hours)
- `maxSizeMB` (number, optional): Maximum cache size in MB (default: 100)
- `enabled` (boolean, optional): Enable/disable caching (default: true)

**Side Effects:** File I/O (reads/writes cache files), creates directories

---

### Methods

#### init

Initialize cache directory and index file.

**Signature:**
```javascript
async init(): Promise<void>
```

**Side Effects:** Creates directories, writes index file, performs cleanup

**Example:**
```javascript
const cache = new AiCache({ cacheDir: '.cache', ttl: 3600 });
await cache.init();
// Cache directory created, index initialized, expired entries cleaned
```

---

#### has

Check if cached response exists and is valid.

**Signature:**
```javascript
async has(cacheKey: string): Promise<boolean>
```

**Parameters:**
- `cacheKey` (string): Cache key to check

**Returns:**
- (Promise<boolean>): True if cache exists and is valid

**Side Effects:** Reads cache metadata from disk

**Example:**
```javascript
const cache = new AiCache();
await cache.init();

const key = generateCacheKey('prompt', 'context');
const exists = await cache.has(key);

if (exists) {
  console.log('Cache hit!');
}
```

---

#### get

Get cached response.

**Signature:**
```javascript
async get(cacheKey: string): Promise<string | null>
```

**Parameters:**
- `cacheKey` (string): Cache key

**Returns:**
- (Promise<string | null>): Cached response or null if not found/expired

**Side Effects:** Reads cache file, updates hit/miss metrics

**Example:**
```javascript
const cache = new AiCache();
await cache.init();

const key = generateCacheKey('prompt', 'context');
const response = await cache.get(key);

if (response) {
  console.log('Got cached response:', response);
  console.log('Metrics:', cache.getMetrics());
}
```

---

#### set

Store response in cache.

**Signature:**
```javascript
async set(cacheKey: string, response: string, metadata?: Object): Promise<void>
```

**Parameters:**
- `cacheKey` (string): Cache key
- `response` (string): AI response to cache
- `metadata` (Object, optional): Additional metadata

**Side Effects:** Writes cache file, metadata file, updates index

**Example:**
```javascript
const cache = new AiCache();
await cache.init();

const key = generateCacheKey('prompt', 'context');
await cache.set(key, 'AI response text', {
  persona: 'test_engineer',
  model: 'gpt-4'
});
```

---

#### delete

Delete cache entry.

**Signature:**
```javascript
async delete(cacheKey: string): Promise<boolean>
```

**Parameters:**
- `cacheKey` (string): Cache key to delete

**Returns:**
- (Promise<boolean>): True if deleted, false if not found

**Side Effects:** Deletes cache files, updates index

**Example:**
```javascript
const cache = new AiCache();
await cache.init();

const key = generateCacheKey('prompt', 'context');
const deleted = await cache.delete(key);

if (deleted) {
  console.log('Cache entry deleted');
}
```

---

#### clear

Clear all cache entries.

**Signature:**
```javascript
async clear(): Promise<number>
```

**Returns:**
- (Promise<number>): Number of entries cleared

**Side Effects:** Deletes all cache files, resets index

**Example:**
```javascript
const cache = new AiCache();
await cache.init();

const count = await cache.clear();
console.log(`Cleared ${count} cache entries`);
```

---

#### cleanupExpired

Remove expired cache entries based on TTL.

**Signature:**
```javascript
async cleanupExpired(): Promise<number>
```

**Returns:**
- (Promise<number>): Number of expired entries removed

**Side Effects:** Deletes expired cache files, updates index

**Example:**
```javascript
const cache = new AiCache({ ttl: 3600 }); // 1 hour
await cache.init();

// Later...
const removed = await cache.cleanupExpired();
console.log(`Removed ${removed} expired entries`);
```

---

#### getMetrics

Get cache hit/miss metrics.

**Signature:**
```javascript
getMetrics(): {
  hits: number,
  misses: number,
  total: number,
  hitRate: number,
  tokensSaved: number
}
```

**Returns:**
- (Object): Cache metrics with hit rate and tokens saved

**Side Effects:** None (reads instance property)

**Example:**
```javascript
const cache = new AiCache();
await cache.init();

// Perform some cache operations...

const metrics = cache.getMetrics();
console.log(`Hit rate: ${metrics.hitRate}%`);
console.log(`Tokens saved: ${metrics.tokensSaved}`);
```

---

## Usage Examples

### Example 1: Basic Cache Usage

```javascript
import { AiCache, generateCacheKey } from './lib/ai_cache.js';

const cache = new AiCache();
await cache.init();

const prompt = 'Write tests for authentication module';
const context = 'test_engineer';
const key = generateCacheKey(prompt, context);

// Check cache
const cached = await cache.get(key);

if (cached) {
  console.log('Cache hit! Using cached response');
  console.log(cached);
} else {
  console.log('Cache miss, generating new response...');
  const response = await generateAiResponse(prompt);
  await cache.set(key, response, { persona: context });
}
```

---

### Example 2: Token Savings Tracking

```javascript
import { AiCache, generateCacheKey } from './lib/ai_cache.js';

const cache = new AiCache({ ttl: 3600 }); // 1 hour TTL
await cache.init();

async function aiRequest(prompt, estimatedTokens) {
  const key = generateCacheKey(prompt);
  const cached = await cache.get(key);
  
  if (cached) {
    cache.metrics.tokensSaved += estimatedTokens;
    return cached;
  }
  
  const response = await callAi(prompt);
  await cache.set(key, response);
  return response;
}

// Later...
const metrics = cache.getMetrics();
console.log(`Tokens saved: ${metrics.tokensSaved}`);
console.log(`Cost savings: $${(metrics.tokensSaved / 1000 * 0.002).toFixed(2)}`);
```

---

### Example 3: Manual Cache Invalidation

```javascript
import { AiCache, shouldInvalidateCache } from './lib/ai_cache.js';

const cache = new AiCache();
await cache.init();

function onConfigChange(reason) {
  if (shouldInvalidateCache(reason)) {
    console.log(`Invalidating cache due to: ${reason}`);
    await cache.clear();
  }
}

onConfigChange('config_changed');  // Clears cache
onConfigChange('minor_update');    // Doesn't clear cache
```

---

### Example 4: Periodic Cleanup

```javascript
import { AiCache } from './lib/ai_cache.js';

const cache = new AiCache({ ttl: 86400 }); // 24 hours
await cache.init();

// Cleanup expired entries every hour
setInterval(async () => {
  const removed = await cache.cleanupExpired();
  if (removed > 0) {
    console.log(`Cleaned up ${removed} expired cache entries`);
  }
}, 3600000); // 1 hour
```

---

### Example 5: Cache with Metadata

```javascript
import { AiCache, generateCacheKey } from './lib/ai_cache.js';

const cache = new AiCache();
await cache.init();

const key = generateCacheKey('prompt', 'context');
await cache.set(key, 'Response text', {
  persona: 'test_engineer',
  model: 'gpt-4',
  temperature: 0.7,
  timestamp: Date.now()
});

// Metadata is stored alongside the response
```

---

## Related Modules

- **[ai_helpers](./ai_helpers.md)** - AI request orchestration
- **[ai_prompt_builder](./ai_prompt_builder.md)** - Prompt construction
- **[ai_validation](./ai_validation.md)** - Response validation

---

## Notes

### Cache Storage

- Cache files stored as: `{key}.txt` (response), `{key}.meta` (metadata)
- Index file: `index.json` (tracks all entries)
- Default location: `.ai_workflow/.ai_cache/`

### Performance Considerations

- **Disk I/O**: Cache reads/writes are async and non-blocking
- **Size Limits**: Monitor `maxSizeMB` to prevent disk overflow
- **Cleanup**: Run periodic cleanup to remove expired entries
- **Hit Rate**: Aim for 60-80% for optimal token savings

### TTL Strategies

- **Short TTL (1-6 hours)**: Frequently changing content
- **Medium TTL (24 hours)**: Standard workflow operations (default)
- **Long TTL (7 days)**: Stable documentation/analysis

### Common Pitfalls

1. **Forgetting init()**: Always call `init()` before use
2. **Cache key collisions**: Include enough context in key generation
3. **Disk space**: Monitor cache size with `getMetrics()`
4. **Stale data**: Adjust TTL based on content update frequency

---

**Last Updated:** 2026-02-07  
**Stability:** Stable  
**Test Coverage:** 100%

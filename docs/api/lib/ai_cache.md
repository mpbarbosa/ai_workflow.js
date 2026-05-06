# ai_cache

**Module:** `src/lib/ai_cache.ts`
**Version:** 2.3.1
**Architecture:** Pure functions + Impure wrapper

AI response caching for token reduction and performance optimization.

---

## Overview

The `ai_cache` module provides persistent disk-based caching of AI responses with TTL-based expiration. It reduces token usage by 60-80% on repeated operations while maintaining response freshness.

> **TypeScript source:** `src/lib/ai_cache.ts` compiles to `src/lib/ai_cache.js` via `npm run build`. The compiled `.js` file is the runtime artifact; import it as `ai_cache.js`. Type declarations are available in `src/lib/ai_cache.d.ts`.

### Key Features

- **Disk-Based Storage**: Persistent cache survives restarts
- **TTL Expiration**: 24-hour default TTL (configurable)
- **Cache Key Generation**: SHA256 hashing of prompts and context
- **Automatic Cleanup**: Age-based cleanup of expired entries
- **Hit/Miss Metrics**: Track cache effectiveness and token savings
- **Size Management**: Configurable maximum cache size
- **Invalidation**: Manual or automatic cache invalidation
- **Generic Caching**: `withCache<T>()` preserves caller return type
- **File Change Guard**: `withFileChangeGuard<T>()` skips AI when inputs are unchanged

### Performance Benefits

- **60-80% Token Reduction**: On repeated operations
- **Faster Responses**: Instant retrieval from disk
- **Cost Savings**: Reduced AI API costs
- **Persistent Metrics**: Track savings over time

---

## Installation

```typescript
// TypeScript (imports from compiled .js)
import { AiCache, generateCacheKey, isCacheValid } from './lib/ai_cache.js';
import type { CacheConfigOptions, CacheEntryMeta, FullCacheStats } from './lib/ai_cache.js';
```

```javascript
// JavaScript
import { AiCache, generateCacheKey, isCacheValid } from './lib/ai_cache.js';
```

---

## Exported Interfaces

| Interface                | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `CacheEntryMeta`         | Metadata stored in `.meta` files (includes index signature) |
| `CacheIndexEntry`        | Single entry in `index.json` (includes index signature)     |
| `CacheIndex`             | Full structure of `index.json`                              |
| `CacheMetrics`           | In-memory hit/miss counters                                 |
| `RuntimeMetrics`         | `CacheMetrics` extended with `hitRate`                      |
| `CacheStats`             | Statistics from `calculateCacheStats()`                     |
| `FullCacheStats`         | `getStats()` return when caching is enabled                 |
| `DisabledCacheStats`     | `getStats()` return when caching is disabled                |
| `ErrorCacheStats`        | `getStats()` return on error                                |
| `CacheConfigOptions`     | Constructor options (all optional)                          |
| `CacheConfig`            | Required, validated config for `validateCacheConfig()`      |
| `ValidationResult`       | `{ valid: boolean; errors: string[] }`                      |
| `InvalidateCacheOptions` | Options for `shouldInvalidateCache()`                       |
| `MergedCacheMetrics`     | Return type of `mergeCacheMetrics()`                        |
| `SetMetadata`            | Optional metadata for `AiCache.set()`                       |
| `HashStoreEntry`         | Entry in `step_hashes.json`                                 |
| `HashStore`              | Full step hash store type                                   |
| `CacheTimestampEntry`    | Minimal shape accepted by validity/stats functions          |

---

## Pure Functions

### generateCacheKey

Generate cache key from prompt and context using SHA256 hash.

**Signature:**

```typescript
function generateCacheKey(prompt: string, context?: string): string;
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

```typescript
function isCacheValid(
  cacheEntry: CacheTimestampEntry | null | undefined,
  ttlSeconds: number,
  currentTime: number
): boolean;
```

**Parameters:**

- `cacheEntry` (CacheTimestampEntry): Cache entry with optional `timestampEpoch` (Unix epoch seconds)
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

```typescript
function shouldInvalidateCache(reason: string, options?: InvalidateCacheOptions): boolean;
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

```typescript
function calculateCacheStats(
  entries: CacheTimestampEntry[],
  currentTime: number,
  ttl: number
): CacheStats;
```

**Parameters:**

- `entries` (CacheTimestampEntry[]): Array of cache entries with metadata
- `currentTime` (number): Current time (Unix epoch seconds)
- `ttl` (number): TTL in seconds

**Returns:**

- (CacheStats): Cache statistics `{ total, valid, expired, totalSize, hitRate }`

**Pure:** ✅ Yes

**Example:**

```javascript
const entries = [
  { timestampEpoch: now - 3600, responseSize: 1024 }, // Valid
  { timestampEpoch: now - 90000, responseSize: 2048 }, // Expired (>24h)
];

const stats = calculateCacheStats(entries, now, 86400);
// => { total: 2, valid: 1, expired: 1, totalSize: 3072, hitRate: 0 }
```

---

### filterEntriesByAge

Filter cache entries by age, returning entries older than `maxAge`.

**Signature:**

```typescript
function filterEntriesByAge(
  entries: CacheTimestampEntry[],
  maxAge: number,
  currentTime: number
): CacheTimestampEntry[];
```

**Parameters:**

- `entries` (CacheTimestampEntry[]): Cache entries to filter
- `maxAge` (number): Maximum age in seconds
- `currentTime` (number): Current time (Unix epoch seconds)

**Returns:**

- (CacheTimestampEntry[]): Entries older than maxAge

**Pure:** ✅ Yes

**Example:**

```javascript
const entries = [
  { timestampEpoch: now - 3600 }, // 1 hour old
  { timestampEpoch: now - 90000 }, // 25 hours old
];

const old = filterEntriesByAge(entries, 86400, now);
// => [{ timestampEpoch: now - 90000 }] (only the 25h old one)
```

---

### createCacheEntry

Create cache entry metadata object.

**Signature:**

```typescript
function createCacheEntry(
  cacheKey: string,
  prompt: string | null | undefined,
  context: string,
  responseSize: number,
  timestamp: number,
  additional?: Record<string, unknown>
): CacheEntryMeta;
```

**Parameters:**

- `cacheKey` (string): Cache key (SHA256 hash)
- `prompt` (string | null | undefined): Original prompt (truncated to 100 chars for preview)
- `context` (string): Context string
- `responseSize` (number): Response size in bytes
- `timestamp` (number): Creation time (Unix epoch seconds)
- `additional` (object, optional): Additional metadata to merge

**Returns:**

- (CacheEntryMeta): Cache entry with timestamp, preview, and metadata

**Pure:** ✅ Yes

**Example:**

```javascript
const entry = createCacheEntry('abc123', 'Write tests', 'engineer', 1024, 1704067200);
// => {
//   cacheKey: 'abc123',
//   timestamp: '2024-01-01T00:00:00.000Z',
//   timestampEpoch: 1704067200,
//   promptPreview: 'Write tests',
//   context: 'engineer',
//   responseSize: 1024
// }
```

---

### mergeCacheMetrics

Merge two cache metric objects.

**Signature:**

```typescript
function mergeCacheMetrics(
  metrics1: Partial<CacheMetrics> | null | undefined,
  metrics2: Partial<CacheMetrics> | null | undefined
): MergedCacheMetrics;
```

**Parameters:**

- `metrics1` (Partial\<CacheMetrics\>): First metrics object
- `metrics2` (Partial\<CacheMetrics\>): Second metrics object

**Returns:**

- (MergedCacheMetrics): Merged metrics with calculated hit rate

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

```typescript
function validateCacheConfig(config: Partial<CacheConfig> | null | undefined): ValidationResult;
```

**Parameters:**

- `config` (Partial\<CacheConfig\>): Cache configuration to validate

**Returns:**

- (ValidationResult): `{ valid: boolean, errors: string[] }`

**Pure:** ✅ Yes

**Example:**

```javascript
const result = validateCacheConfig({
  cacheDir: '/tmp/.cache',
  ttl: 86400,
  maxSizeMB: 100,
});
// => { valid: true, errors: [] }

const invalid = validateCacheConfig({
  cacheDir: '',
  ttl: -1,
  maxSizeMB: 0,
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

### computeFilesContentHash

Compute a SHA256 hash of a set of file contents (order-independent).

**Signature:**

```typescript
function computeFilesContentHash(fileContents: string[]): string;
```

**Parameters:**

- `fileContents` (string[]): Array of file-identity strings (e.g. `"relativePath:rawContent"`)

**Returns:**

- (string): SHA256 hex digest (64 chars), or `''` for empty input

**Pure:** ✅ Yes

**Example:**

```javascript
const hash = computeFilesContentHash([
  'package.json:{"name":"my-app"}',
  '.eslintrc.json:{"extends":"eslint:recommended"}',
]);
// => 'a1b2c3...' (64 hex chars, same regardless of array order)
```

---

## Wrapper Class

### AiCache

AI cache manager with persistent disk storage.

**Constructor:**

```typescript
new AiCache(options?: CacheConfigOptions)
```

**Options (`CacheConfigOptions`):**

- `cacheDir` (string, optional): Cache directory (default: `.ai_workflow/.ai_cache`)
- `ttl` (number, optional): TTL in seconds (default: 86400 = 24 hours)
- `maxSizeMB` (number, optional): Maximum cache size in MB (default: 100)
- `enabled` (boolean, optional): Enable/disable caching (default: true)

**Public instance properties:**

- `cacheDir: string`
- `ttl: number`
- `maxSizeMB: number`
- `enabled: boolean`
- `metrics: CacheMetrics` — runtime hit/miss counters (not persisted)

**Side Effects:** File I/O (reads/writes cache files), creates directories

---

### Methods

#### init

Initialize cache directory and index file.

**Signature:**

```typescript
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

```typescript
async has(cacheKey: string): Promise<boolean>
```

**Parameters:**

- `cacheKey` (string): Cache key to check

**Returns:**

- (Promise\<boolean\>): True if cache exists and is valid

**Side Effects:** Reads cache metadata from disk

---

#### get

Get cached response.

**Signature:**

```typescript
async get(cacheKey: string): Promise<unknown>
```

**Parameters:**

- `cacheKey` (string): Cache key

**Returns:**

- (Promise\<unknown\>): Cached response (string or parsed JSON object) or null if not found/expired

**Side Effects:** Reads cache file, updates hit/miss metrics

**Example:**

```javascript
const cache = new AiCache();
await cache.init();

const key = generateCacheKey('prompt', 'context');
const response = await cache.get(key);

if (response !== null) {
  console.log('Got cached response:', response);
}
```

---

#### set

Store response in cache.

**Signature:**

```typescript
async set(cacheKey: string, response: unknown, metadata?: SetMetadata): Promise<void>
```

**Parameters:**

- `cacheKey` (string): Cache key
- `response` (unknown): AI response to cache (string or any JSON-serializable value)
- `metadata` (SetMetadata, optional): Additional metadata (`prompt?`, `context?`, `...rest`)

**Side Effects:** Writes cache file, metadata file, updates index

**Example:**

```javascript
const cache = new AiCache();
await cache.init();

const key = generateCacheKey('prompt', 'context');
await cache.set(key, 'AI response text', {
  prompt: 'Write tests for...',
  context: 'test_engineer',
});
```

---

#### withCache

Wrapper for AI calls with automatic caching. Uses a generic type parameter to preserve the return type of `aiFunction`.

**Signature:**

```typescript
async withCache<T>(
  prompt: string,
  context: string,
  aiFunction: () => Promise<T>
): Promise<T>
```

**Parameters:**

- `prompt` (string): AI prompt
- `context` (string): Context string (used for cache key generation)
- `aiFunction` (() => Promise\<T\>): Async function that calls AI on cache miss

**Returns:**

- (Promise\<T\>): AI response (cached or fresh)

**Example:**

```javascript
const response = await cache.withCache(
  'Write tests for authentication module',
  'test_engineer',
  async () => await callAI(prompt)
);
```

---

#### withFileChangeGuard

Skip AI call when input file contents are unchanged since last run (TTL-independent).

**Signature:**

```typescript
async withFileChangeGuard<T>(
  stepId: string,
  fileContents: string[],
  aiFunction: () => Promise<T>
): Promise<T>
```

**Parameters:**

- `stepId` (string): Unique step identifier (e.g. `'step_04'`)
- `fileContents` (string[]): File-identity strings to hash (e.g. `"${relativePath}:${content}"`)
- `aiFunction` (() => Promise\<T\>): Async function that calls AI; invoked on cache miss

**Returns:**

- (Promise\<T\>): AI response (cached or fresh)

**Example:**

```javascript
const result = await cache.withFileChangeGuard(
  'step_04',
  fileEntries.map((e) => `${e.relativePath}:${e.content}`),
  () => aiHelper.executeRequest(prompt, { persona: 'devops_engineer' })
);
```

---

#### delete

Delete cache entry.

**Signature:**

```typescript
async delete(cacheKey: string): Promise<boolean>
```

**Parameters:**

- `cacheKey` (string): Cache key to delete

**Returns:**

- (Promise\<boolean\>): True if deleted, false if not found

**Side Effects:** Deletes cache files, updates index

---

#### clear

Clear all cache entries and reinitialize.

**Signature:**

```typescript
async clear(): Promise<void>
```

**Side Effects:** Deletes all cache files, resets index

---

#### cleanupExpired

Remove expired cache entries based on TTL.

**Signature:**

```typescript
async cleanupExpired(): Promise<number>
```

**Returns:**

- (Promise\<number\>): Number of expired entries removed

**Side Effects:** Deletes expired cache files, updates index

---

#### getStats

Get cache statistics from index file and disk usage.

**Signature:**

```typescript
async getStats(): Promise<FullCacheStats | DisabledCacheStats | ErrorCacheStats>
```

**Returns:**

- `FullCacheStats` when enabled (total, valid, expired, totalSizeMB, created, lastCleanup, location, runtimeMetrics)
- `DisabledCacheStats` (`{ enabled: false }`) when caching is disabled
- `ErrorCacheStats` (`{ error: string }`) on I/O error

**Example:**

```javascript
const stats = await cache.getStats();
if ('enabled' in stats && stats.enabled === false) {
  console.log('Caching disabled');
} else if ('error' in stats) {
  console.error('Stats error:', stats.error);
} else {
  console.log(`Hit rate: ${stats.runtimeMetrics.hitRate}%`);
  console.log(`Cache size: ${stats.totalSizeMB} MB`);
}
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

const cached = await cache.get(key);

if (cached !== null) {
  console.log('Cache hit! Using cached response');
  console.log(cached);
} else {
  console.log('Cache miss, generating new response...');
  const response = await generateAiResponse(prompt);
  await cache.set(key, response, { prompt, context });
}
```

---

### Example 2: withCache Wrapper (Recommended)

```javascript
import { AiCache } from './lib/ai_cache.js';

const cache = new AiCache({ ttl: 3600 }); // 1 hour TTL
await cache.init();

// Type-safe: response is inferred as string
const response = await cache.withCache(
  'Write a test suite for the auth module',
  'test_engineer',
  () => callAI(prompt)
);

console.log(`Tokens saved so far: ${cache.metrics.tokensSaved}`);
```

---

### Example 3: File Change Guard

```javascript
import { AiCache } from './lib/ai_cache.js';

const cache = new AiCache();
await cache.init();

const fileEntries = await readProjectFiles(['src/auth.js', 'src/middleware.js']);

const analysis = await cache.withFileChangeGuard(
  'step_04_quality',
  fileEntries.map((e) => `${e.path}:${e.content}`),
  () => aiHelper.executeRequest(analysisPrompt)
);
// AI is only called when file contents actually change
```

---

### Example 4: Manual Cache Invalidation

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

### Example 5: TypeScript Usage

```typescript
import { AiCache, generateCacheKey } from './lib/ai_cache.js';
import type { CacheConfigOptions, FullCacheStats } from './lib/ai_cache.js';

const options: CacheConfigOptions = {
  cacheDir: '.ai_workflow/.ai_cache',
  ttl: 86400,
  maxSizeMB: 100,
};

const cache = new AiCache(options);
await cache.init();

// Generic type parameter preserves return type
const result = await cache.withCache<string>(
  'Analyze code quality',
  'quality_reviewer',
  async () => await runAnalysis()
);

const stats = await cache.getStats();
if (!('enabled' in stats) && !('error' in stats)) {
  const full = stats as FullCacheStats;
  console.log(`Cache at ${full.location}: ${full.totalSizeMB} MB`);
}
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
- Hash store: `step_hashes.json` (used by `withFileChangeGuard`)
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
3. **Disk space**: Monitor cache size with `getStats()`
4. **Stale data**: Adjust TTL based on content update frequency

---

**Last Updated:** 2026-03-12
**Stability:** Stable
**Test Coverage:** 100%

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
  { timestampEpoch: now - 3600, size: 1024 }, // Valid
  { timestampEpoch: now - 90000, size: 2048 }, // Expired (>24h)
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
  { timestampEpoch: now - 3600 }, // 1 hour old
  { timestampEpoch: now - 90000 }, // 25 hours old
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
  model: 'gpt-4',
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
  maxSizeMB: 100,
});
// => { valid: true, errors: [] }

const invalid = validateCacheConfig({
  cacheDir: '',
  ttl: -1,
  maxSizeMB: 0,
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
  model: 'gpt-4',
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
console.log(`Cost savings: $${((metrics.tokensSaved / 1000) * 0.002).toFixed(2)}`);
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
  timestamp: Date.now(),
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

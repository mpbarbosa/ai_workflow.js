/**
 * AI Cache Module
 *
 * Provides AI response caching to reduce token usage and improve performance.
 * Implements TTL-based expiration, cache key generation, and invalidation strategies.
 *
 * Architecture: Pure functions + impure wrapper (v2.0.0)
 * - Pure functions for cache logic (deterministic)
 * - Impure wrapper for file I/O operations
 *
 * Cache Performance:
 * - 60-80% token reduction on repeated operations
 * - 24-hour default TTL
 * - Disk-based persistent storage
 *
 * @module lib/ai_cache
 * @version 2.1.0
 */
/** Metadata stored alongside each cached response in a `.meta` file. */
export interface CacheEntryMeta {
    cacheKey: string;
    timestamp: string;
    timestampEpoch: number;
    promptPreview: string;
    context: string;
    responseSize: number;
    [key: string]: unknown;
}
/** Single entry in the cache `index.json` file. */
export interface CacheIndexEntry {
    cacheKey: string;
    created: string;
    lastAccessed: string;
    accessCount: number;
    [key: string]: unknown;
}
/** Full structure of the cache `index.json` file. */
export interface CacheIndex {
    version: string;
    created: string;
    createdEpoch: number;
    lastCleanup: string;
    lastCleanupEpoch: number;
    entries: CacheIndexEntry[];
}
/** In-memory runtime metrics (not persisted). */
export interface CacheMetrics {
    hits: number;
    misses: number;
    tokensSaved: number;
}
/** Runtime metrics extended with calculated hit rate. */
export interface RuntimeMetrics extends CacheMetrics {
    hitRate: number;
}
/** Statistics calculated from cache index entries. */
export interface CacheStats {
    total: number;
    valid: number;
    expired: number;
    totalSize: number;
    hitRate: number;
}
/** Full stats returned by `getStats()` when caching is enabled. */
export interface FullCacheStats extends CacheStats {
    totalSizeMB: number;
    created: string;
    lastCleanup: string;
    location: string;
    runtimeMetrics: RuntimeMetrics;
}
/** `getStats()` return when caching is disabled. */
export interface DisabledCacheStats {
    enabled: false;
}
/** `getStats()` return on error. */
export interface ErrorCacheStats {
    error: string;
}
/** Constructor options for `AiCache`. All fields are optional. */
export interface CacheConfigOptions {
    cacheDir?: string;
    ttl?: number;
    maxSizeMB?: number;
    enabled?: boolean;
}
/** Required, validated cache configuration used by `validateCacheConfig`. */
export interface CacheConfig {
    cacheDir: string;
    ttl: number;
    maxSizeMB: number;
}
/** Result returned by `validateCacheConfig`. */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
/** Options accepted by `shouldInvalidateCache`. */
export interface InvalidateCacheOptions {
    forceReasons?: string[];
}
/** Merged metrics returned by `mergeCacheMetrics`. */
export interface MergedCacheMetrics {
    hits: number;
    misses: number;
    total: number;
    hitRate: number;
    tokensSaved: number;
}
/** Optional metadata accepted by `AiCache.set()`. */
export interface SetMetadata {
    prompt?: string;
    context?: string;
    [key: string]: unknown;
}
/** Single entry in the step hash store (`step_hashes.json`). */
export interface HashStoreEntry {
    hash: string;
    response: unknown;
    timestamp: number;
}
/** Full step hash store keyed by step identifier. */
export type HashStore = Record<string, HashStoreEntry | undefined>;
/**
 * Minimal shape accepted by cache validity and statistics functions.
 * Both `CacheEntryMeta` and `CacheIndexEntry` are assignable to this type.
 */
export interface CacheTimestampEntry {
    timestampEpoch?: number;
    responseSize?: number;
    [key: string]: unknown;
}
/**
 * Generate cache key from prompt and context
 *
 * Creates a SHA256 hash of the prompt and optional context to use as cache key.
 * Identical prompts with identical context produce identical keys (deterministic).
 *
 * @param prompt - AI prompt text
 * @param context - Additional context (persona, options)
 * @returns SHA256 hash as cache key (64 hex characters)
 *
 * @example
 * const key = generateCacheKey('Write tests for...', 'test_engineer');
 * // => 'a1b2c3d4...'
 */
export declare function generateCacheKey(prompt: string, context?: string): string;
/**
 * Check if cache entry is valid based on TTL
 *
 * @param cacheEntry - Cache entry metadata
 * @param ttlSeconds - Time-to-live in seconds
 * @param currentTime - Current time (Unix epoch seconds)
 * @returns True if cache is still valid
 *
 * @example
 * const entry = { timestampEpoch: 1704067200 };
 * const isValid = isCacheValid(entry, 86400, 1704070800);
 * // => true (within 1 hour of 24-hour TTL)
 */
export declare function isCacheValid(cacheEntry: CacheTimestampEntry | null | undefined, ttlSeconds: number, currentTime: number): boolean;
/**
 * Determine if cache should be invalidated based on reason
 *
 * @param reason - Invalidation reason
 * @param options - Invalidation options
 * @returns True if cache should be invalidated
 *
 * @example
 * shouldInvalidateCache('config_changed', { forceReasons: ['config_changed'] });
 * // => true
 */
export declare function shouldInvalidateCache(reason: string, options?: InvalidateCacheOptions): boolean;
/**
 * Calculate cache statistics from entries
 *
 * @param entries - Array of cache entries
 * @param currentTime - Current time (Unix epoch seconds)
 * @param ttl - TTL in seconds
 * @returns Cache statistics
 *
 * @example
 * const stats = calculateCacheStats(entries, Date.now() / 1000, 86400);
 * // => { total: 10, valid: 8, expired: 2, totalSize: 52480 }
 */
export declare function calculateCacheStats(entries: CacheTimestampEntry[], currentTime: number, ttl: number): CacheStats;
/**
 * Filter cache entries by age
 *
 * @param entries - Array of cache entries
 * @param maxAge - Maximum age in seconds
 * @param currentTime - Current time (Unix epoch seconds)
 * @returns Entries older than maxAge
 *
 * @example
 * const expired = filterEntriesByAge(entries, 86400, Date.now() / 1000);
 * // => [entry1, entry2] (entries older than 24 hours)
 */
export declare function filterEntriesByAge(entries: CacheTimestampEntry[], maxAge: number, currentTime: number): CacheTimestampEntry[];
/**
 * Create cache entry metadata
 *
 * @param cacheKey - Cache key (hash)
 * @param prompt - Original prompt
 * @param context - Context string
 * @param responseSize - Response size in bytes
 * @param timestamp - Current timestamp (Unix epoch seconds)
 * @param additional - Additional metadata
 * @returns Cache entry metadata
 *
 * @example
 * const entry = createCacheEntry('abc123', 'Write tests', 'engineer', 1024, 1704067200);
 * // => { cacheKey: 'abc123', timestamp: '...', ... }
 */
export declare function createCacheEntry(cacheKey: string, prompt: string | null | undefined, context: string, responseSize: number, timestamp: number, additional?: Record<string, unknown>): CacheEntryMeta;
/**
 * Merge cache metrics
 *
 * @param metrics1 - First metrics object
 * @param metrics2 - Second metrics object
 * @returns Merged metrics
 *
 * @example
 * const merged = mergeCacheMetrics(
 *   { hits: 5, misses: 2 },
 *   { hits: 3, misses: 1 }
 * );
 * // => { hits: 8, misses: 3, total: 11, hitRate: 72.7 }
 */
export declare function mergeCacheMetrics(metrics1: Partial<CacheMetrics> | null | undefined, metrics2: Partial<CacheMetrics> | null | undefined): MergedCacheMetrics;
/**
 * Validate cache configuration
 *
 * @param config - Cache configuration
 * @returns Validation result with `{ valid, errors }`
 *
 * @example
 * const result = validateCacheConfig({ cacheDir: '/tmp/.cache', ttl: 86400, maxSizeMB: 100 });
 * // => { valid: true, errors: [] }
 */
export declare function validateCacheConfig(config: Partial<CacheConfig> | null | undefined): ValidationResult;
/**
 * Compute a SHA256 hash of a set of file contents.
 *
 * Entries are sorted before hashing so that the result is independent of the
 * order in which the caller provides them. Each entry should be a string that
 * uniquely identifies both the file identity and its contents (e.g.
 * `"${relativePath}:${fileContent}"`).
 *
 * This is used by `AiCache.withFileChangeGuard` to decide whether the input
 * to a step has changed since the last AI call.
 *
 * @param fileContents - Array of file-identity strings
 * @returns SHA256 hex digest (64 characters), or empty string for empty input
 *
 * @example
 * const hash = computeFilesContentHash([
 *   'package.json:{"name":"my-app"}',
 *   '.eslintrc.json:{"extends":"eslint:recommended"}',
 * ]);
 * // => 'a1b2c3...' (64 hex chars)
 */
export declare function computeFilesContentHash(fileContents: string[]): string;
/**
 * AI Cache Manager
 *
 * Manages persistent disk-based caching of AI responses with TTL expiration.
 */
export declare class AiCache {
    cacheDir: string;
    ttl: number;
    maxSizeMB: number;
    enabled: boolean;
    indexFile: string;
    metrics: CacheMetrics;
    /**
     * Create AI cache manager
     *
     * @param options - Cache options
     */
    constructor(options?: CacheConfigOptions);
    /**
     * Initialize cache directory and index
     *
     * Creates cache directory structure and index file if they don't exist.
     * Performs cleanup of expired entries on initialization.
     */
    init(): Promise<void>;
    /**
     * Check if cached response exists and is valid
     *
     * @param cacheKey - Cache key to check
     * @returns True if cache exists and is valid
     */
    has(cacheKey: string): Promise<boolean>;
    /**
     * Get cached response
     *
     * @param cacheKey - Cache key
     * @returns Cached response or null if not found
     */
    get(cacheKey: string): Promise<unknown>;
    /**
     * Save response to cache
     *
     * @param cacheKey - Cache key
     * @param response - AI response to cache
     * @param metadata - Additional metadata
     */
    set(cacheKey: string, response: unknown, metadata?: SetMetadata): Promise<void>;
    /**
     * Wrapper for AI calls with caching
     *
     * @param prompt - AI prompt
     * @param context - Context string
     * @param aiFunction - Async function that calls AI
     * @returns AI response (cached or fresh)
     *
     * @example
     * const response = await cache.withCache(
     *   'Write tests for...',
     *   'test_engineer',
     *   async () => await callAI(prompt)
     * );
     */
    withCache<T>(prompt: string, context: string, aiFunction: () => Promise<T>): Promise<T>;
    /**
     * Skip AI call when input file contents are unchanged since last run.
     *
     * Unlike `withCache`, this guard is TTL-independent: it returns the stored
     * response for as long as the hashed file contents remain the same, and only
     * invokes `aiFunction` when the hash changes (or on the very first call).
     *
     * File scope rule: `fileContents` must include exactly the files whose content
     * is injected into the AI prompt for this step. Typically each element is
     * `"${relativePath}:${rawContent}"`. Order does not matter (entries are sorted
     * before hashing).
     *
     * The hash store is persisted at `<cacheDir>/step_hashes.json`.
     *
     * @param stepId - Unique step identifier (e.g. 'step_04')
     * @param fileContents - File-identity strings to hash (see above)
     * @param aiFunction - Async function that calls AI; invoked on cache miss
     * @returns AI response (cached or fresh)
     *
     * @example
     * const result = await cache.withFileChangeGuard(
     *   'step_04',
     *   fileEntries.map(e => `${e.relativePath}:${e.content}`),
     *   () => aiHelper.executeRequest(prompt, { persona: 'devops_engineer' })
     * );
     */
    withFileChangeGuard<T>(stepId: string, fileContents: string[], aiFunction: () => Promise<T>): Promise<T>;
    /**
     * Load the step hash store from disk.
     * @private
     */
    private _loadHashStore;
    /**
     * Persist the step hash store to disk.
     * @private
     */
    private _saveHashStore;
    /**
     * Cleanup expired cache entries
     *
     * @returns Number of entries deleted
     */
    cleanupExpired(): Promise<number>;
    /**
     * Clear entire cache
     */
    clear(): Promise<void>;
    /**
     * Get cache statistics
     *
     * @returns Cache statistics
     */
    getStats(): Promise<FullCacheStats | DisabledCacheStats | ErrorCacheStats>;
    /**
     * Delete specific cache entry
     *
     * @param cacheKey - Cache key to delete
     * @returns True if deleted
     */
    delete(cacheKey: string): Promise<boolean>;
    private _updateAccessCount;
    private _addToIndex;
    private _removeFromIndex;
    private _updateCleanupTimestamp;
}
//# sourceMappingURL=ai_cache.d.ts.map
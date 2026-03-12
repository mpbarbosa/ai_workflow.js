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

import { createHash } from 'crypto';
import { access, mkdir, readFile, readdir, rm, stat as fsStat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../core/logger.js';
import { ValidationError } from '../utils/errors.js';

// ==============================================================================
// INTERFACES
// ==============================================================================

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

// ==============================================================================
// PURE FUNCTIONS - Cache Logic
// ==============================================================================

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
export function generateCacheKey(prompt: string, context = ''): string {
  const combined = `${prompt}|${context}`;
  return createHash('sha256').update(combined).digest('hex');
}

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
export function isCacheValid(
  cacheEntry: CacheTimestampEntry | null | undefined,
  ttlSeconds: number,
  currentTime: number
): boolean {
  if (!cacheEntry || typeof cacheEntry.timestampEpoch !== 'number') {
    return false;
  }

  const age = currentTime - cacheEntry.timestampEpoch;
  return age >= 0 && age < ttlSeconds;
}

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
export function shouldInvalidateCache(reason: string, options: InvalidateCacheOptions = {}): boolean {
  const { forceReasons = ['config_changed', 'manual_clear', 'version_bump'] } = options;
  return forceReasons.includes(reason);
}

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
export function calculateCacheStats(
  entries: CacheTimestampEntry[],
  currentTime: number,
  ttl: number
): CacheStats {
  const safeEntries = Array.isArray(entries) ? entries : [];
  let valid = 0;
  let expired = 0;
  let totalSize = 0;

  for (const entry of safeEntries) {
    if (isCacheValid(entry, ttl, currentTime)) {
      valid++;
    } else {
      expired++;
    }

    if (typeof entry.responseSize === 'number') {
      totalSize += entry.responseSize;
    }
  }

  return {
    total: safeEntries.length,
    valid,
    expired,
    totalSize,
    hitRate: 0, // Will be calculated dynamically by wrapper
  };
}

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
export function filterEntriesByAge(
  entries: CacheTimestampEntry[],
  maxAge: number,
  currentTime: number
): CacheTimestampEntry[] {
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (typeof entry.timestampEpoch !== 'number') {
      return false;
    }
    const age = currentTime - entry.timestampEpoch;
    return age > maxAge;
  });
}

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
export function createCacheEntry(
  cacheKey: string,
  prompt: string | null | undefined,
  context: string,
  responseSize: number,
  timestamp: number,
  additional: Record<string, unknown> = {}
): CacheEntryMeta {
  const promptStr = prompt != null ? String(prompt) : '';
  const promptPreview = promptStr.length > 100 ? promptStr.substring(0, 100) + '...' : promptStr;

  return {
    cacheKey,
    timestamp: new Date(timestamp * 1000).toISOString(),
    timestampEpoch: timestamp,
    promptPreview,
    context,
    responseSize,
    ...additional,
  };
}

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
export function mergeCacheMetrics(
  metrics1: Partial<CacheMetrics> | null | undefined,
  metrics2: Partial<CacheMetrics> | null | undefined
): MergedCacheMetrics {
  const m1 = metrics1 ?? {};
  const m2 = metrics2 ?? {};
  const hits = (m1.hits ?? 0) + (m2.hits ?? 0);
  const misses = (m1.misses ?? 0) + (m2.misses ?? 0);
  const total = hits + misses;
  const hitRate = total > 0 ? (hits / total) * 100 : 0;

  return {
    hits,
    misses,
    total,
    hitRate: Math.round(hitRate * 10) / 10, // Round to 1 decimal
    tokensSaved: (m1.tokensSaved ?? 0) + (m2.tokensSaved ?? 0),
  };
}

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
export function validateCacheConfig(config: Partial<CacheConfig> | null | undefined): ValidationResult {
  const errors: string[] = [];
  const cfg = config ?? {};

  if (!cfg.cacheDir || typeof cfg.cacheDir !== 'string') {
    errors.push('cacheDir must be a non-empty string');
  }

  if (typeof cfg.ttl !== 'number' || cfg.ttl <= 0) {
    errors.push('ttl must be a positive number');
  }

  if (typeof cfg.maxSizeMB !== 'number' || cfg.maxSizeMB <= 0) {
    errors.push('maxSizeMB must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

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
export function computeFilesContentHash(fileContents: string[]): string {
  if (!Array.isArray(fileContents) || fileContents.length === 0) {
    return '';
  }
  const combined = [...fileContents].sort().join('\n===\n');
  return createHash('sha256').update(combined).digest('hex');
}

// ==============================================================================
// IMPURE WRAPPER - File I/O and Cache Management
// ==============================================================================

/**
 * AI Cache Manager
 *
 * Manages persistent disk-based caching of AI responses with TTL expiration.
 */
export class AiCache {
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
  constructor(options: CacheConfigOptions = {}) {
    this.cacheDir = options.cacheDir ?? '.ai_workflow/.ai_cache';
    this.ttl = options.ttl ?? 86400; // 24 hours
    this.maxSizeMB = options.maxSizeMB ?? 100;
    this.enabled = options.enabled !== false;
    this.indexFile = join(this.cacheDir, 'index.json');

    // Runtime metrics (not persisted)
    this.metrics = {
      hits: 0,
      misses: 0,
      tokensSaved: 0,
    };
  }

  /**
   * Initialize cache directory and index
   *
   * Creates cache directory structure and index file if they don't exist.
   * Performs cleanup of expired entries on initialization.
   */
  async init(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Validate configuration
    const validation = validateCacheConfig({
      cacheDir: this.cacheDir,
      ttl: this.ttl,
      maxSizeMB: this.maxSizeMB,
    });

    if (!validation.valid) {
      throw new ValidationError(`Invalid cache configuration: ${validation.errors.join(', ')}`);
    }

    // Create cache directory
    await mkdir(this.cacheDir, { recursive: true });

    // Create index file if it doesn't exist
    try {
      await access(this.indexFile);
    } catch {
      const now = Math.floor(Date.now() / 1000);
      const initialIndex: CacheIndex = {
        version: '1.0.0',
        created: new Date(now * 1000).toISOString(),
        createdEpoch: now,
        lastCleanup: new Date(now * 1000).toISOString(),
        lastCleanupEpoch: now,
        entries: [],
      };
      await writeFile(this.indexFile, JSON.stringify(initialIndex, null, 2));
    }

    // Cleanup expired entries
    await this.cleanupExpired();

    logger.debug(`AI cache initialized: ${this.cacheDir}`);
  }

  /**
   * Check if cached response exists and is valid
   *
   * @param cacheKey - Cache key to check
   * @returns True if cache exists and is valid
   */
  async has(cacheKey: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const cacheFile = join(this.cacheDir, `${cacheKey}.txt`);
    const metaFile = join(this.cacheDir, `${cacheKey}.meta`);

    try {
      // Check if cache file exists
      await access(cacheFile);

      // Check if meta file exists and cache is valid
      try {
        const metaData = await readFile(metaFile, 'utf8');
        const meta = JSON.parse(metaData) as Partial<CacheEntryMeta>;
        const currentTime = Math.floor(Date.now() / 1000);

        return isCacheValid(meta, this.ttl, currentTime);
      } catch {
        // Meta file doesn't exist or is invalid - cache is invalid
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get cached response
   *
   * @param cacheKey - Cache key
   * @returns Cached response or null if not found
   */
  async get(cacheKey: string): Promise<unknown> {
    if (!this.enabled) {
      return null;
    }

    const isValid = await this.has(cacheKey);
    if (!isValid) {
      this.metrics.misses++;
      return null;
    }

    try {
      const cacheFile = join(this.cacheDir, `${cacheKey}.txt`);
      const response = await readFile(cacheFile, 'utf8');

      this.metrics.hits++;
      logger.debug(`Cache hit: ${cacheKey.substring(0, 8)}...`);

      // Update access count in index
      await this._updateAccessCount(cacheKey);

      // Deserialize JSON objects that were stored as strings
      try {
        const parsed: unknown = JSON.parse(response);
        if (parsed !== null && typeof parsed === 'object') {
          return parsed;
        }
      } catch {
        // Not JSON, return raw string
      }

      return response;
    } catch (error) {
      this.metrics.misses++;
      logger.error(`Failed to read cache: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Save response to cache
   *
   * @param cacheKey - Cache key
   * @param response - AI response to cache
   * @param metadata - Additional metadata
   */
  async set(cacheKey: string, response: unknown, metadata: SetMetadata = {}): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const cacheFile = join(this.cacheDir, `${cacheKey}.txt`);
    const metaFile = join(this.cacheDir, `${cacheKey}.meta`);

    // Serialize response to string if it's an object
    const serialized = typeof response === 'string' ? response : JSON.stringify(response);

    // Save response
    await writeFile(cacheFile, serialized);

    // Save metadata
    const currentTime = Math.floor(Date.now() / 1000);
    const entry = createCacheEntry(
      cacheKey,
      typeof metadata.prompt === 'string' ? metadata.prompt : '',
      typeof metadata.context === 'string' ? metadata.context : '',
      Buffer.byteLength(serialized),
      currentTime,
      metadata
    );

    await writeFile(metaFile, JSON.stringify(entry, null, 2));

    // Update index
    await this._addToIndex(cacheKey, currentTime);

    logger.debug(`Response cached: ${cacheKey.substring(0, 8)}...`);
  }

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
  async withCache<T>(prompt: string, context: string, aiFunction: () => Promise<T>): Promise<T> {
    const cacheKey = generateCacheKey(prompt, context);

    // Try cache first
    const cached = await this.get(cacheKey);
    if (cached !== null) {
      this.metrics.tokensSaved += 1000; // Estimate
      return cached as T;
    }

    // Cache miss - call AI
    logger.debug(`Cache miss: ${cacheKey.substring(0, 8)}...`);
    const response = await aiFunction();

    // Save to cache
    await this.set(cacheKey, response, { prompt, context });

    return response;
  }

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
  async withFileChangeGuard<T>(
    stepId: string,
    fileContents: string[],
    aiFunction: () => Promise<T>
  ): Promise<T> {
    if (!this.enabled) {
      return aiFunction();
    }

    const currentHash = computeFilesContentHash(fileContents);

    // Empty file list — no meaningful content to hash, call AI normally
    if (!currentHash) {
      return aiFunction();
    }

    const hashStore = await this._loadHashStore();
    const entry = hashStore[stepId];

    if (entry?.hash === currentHash && entry?.response !== undefined) {
      logger.debug(`[ai_cache] ${stepId}: file hash unchanged, skipping AI call`);
      this.metrics.hits += 1;
      this.metrics.tokensSaved += 1000; // estimate
      return entry.response as T;
    }

    // Hash changed or first run — call AI and persist new entry
    logger.debug(`[ai_cache] ${stepId}: file hash ${entry ? 'changed' : 'not found'}, calling AI`);
    this.metrics.misses += 1;
    const response = await aiFunction();

    hashStore[stepId] = { hash: currentHash, response, timestamp: Date.now() };
    await this._saveHashStore(hashStore);

    return response;
  }

  /**
   * Load the step hash store from disk.
   * @private
   */
  private async _loadHashStore(): Promise<HashStore> {
    const storeFile = join(this.cacheDir, 'step_hashes.json');
    try {
      const raw = await readFile(storeFile, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as HashStore)
        : {};
    } catch {
      return {};
    }
  }

  /**
   * Persist the step hash store to disk.
   * @private
   */
  private async _saveHashStore(store: HashStore): Promise<void> {
    const storeFile = join(this.cacheDir, 'step_hashes.json');
    try {
      await mkdir(this.cacheDir, { recursive: true });
      await writeFile(storeFile, JSON.stringify(store, null, 2), 'utf8');
    } catch (error) {
      logger.warn(`[ai_cache] Failed to save step_hashes.json: ${(error as Error).message}`);
    }
  }

  /**
   * Cleanup expired cache entries
   *
   * @returns Number of entries deleted
   */
  async cleanupExpired(): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    let deletedCount = 0;

    try {
      const files: string[] = await readdir(this.cacheDir);
      const txtFiles = files.filter((f: string) => f.endsWith('.txt'));

      for (const file of txtFiles) {
        const cacheKey = file.replace('.txt', '');
        const metaFile = join(this.cacheDir, `${cacheKey}.meta`);

        try {
          const metaData = await readFile(metaFile, 'utf8');
          const meta = JSON.parse(metaData) as Partial<CacheEntryMeta>;

          if (!isCacheValid(meta, this.ttl, currentTime)) {
            // Delete both files
            await unlink(join(this.cacheDir, file));
            await unlink(metaFile);
            deletedCount++;
          }
        } catch {
          // Meta file doesn't exist or is invalid - skip
          continue;
        }
      }

      if (deletedCount > 0) {
        await this._updateCleanupTimestamp(currentTime);
        logger.info(`Cleaned up ${deletedCount} expired cache entries`);
      }
    } catch (error) {
      logger.error(`Cache cleanup failed: ${(error as Error).message}`);
    }

    return deletedCount;
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    try {
      await rm(this.cacheDir, { recursive: true, force: true });
      await this.init();
      logger.success('AI cache cleared');
    } catch (error) {
      logger.error(`Failed to clear cache: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  async getStats(): Promise<FullCacheStats | DisabledCacheStats | ErrorCacheStats> {
    if (!this.enabled) {
      return { enabled: false };
    }

    try {
      const indexData = await readFile(this.indexFile, 'utf8');
      const index = JSON.parse(indexData) as CacheIndex;

      const currentTime = Math.floor(Date.now() / 1000);
      const stats = calculateCacheStats(index.entries, currentTime, this.ttl);

      // Get disk usage
      const files: string[] = await readdir(this.cacheDir);
      let totalSize = 0;
      for (const file of files) {
        const fileStat = await fsStat(join(this.cacheDir, file));
        totalSize += fileStat.size;
      }

      return {
        ...stats,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
        created: index.created,
        lastCleanup: index.lastCleanup,
        location: this.cacheDir,
        runtimeMetrics: {
          ...this.metrics,
          hitRate:
            this.metrics.hits + this.metrics.misses > 0
              ? Math.round(
                  (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 1000
                ) / 10
              : 0,
        },
      };
    } catch (error) {
      logger.error(`Failed to get cache stats: ${(error as Error).message}`);
      return { error: (error as Error).message };
    }
  }

  /**
   * Delete specific cache entry
   *
   * @param cacheKey - Cache key to delete
   * @returns True if deleted
   */
  async delete(cacheKey: string): Promise<boolean> {
    try {
      await unlink(join(this.cacheDir, `${cacheKey}.txt`));
      await unlink(join(this.cacheDir, `${cacheKey}.meta`));
      await this._removeFromIndex(cacheKey);
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods

  private async _updateAccessCount(cacheKey: string): Promise<void> {
    try {
      const indexData = await readFile(this.indexFile, 'utf8');
      const index = JSON.parse(indexData) as CacheIndex;

      const entryIndex = index.entries.findIndex((e) => e.cacheKey === cacheKey);
      if (entryIndex >= 0) {
        index.entries[entryIndex].lastAccessed = new Date().toISOString();
        index.entries[entryIndex].accessCount = (index.entries[entryIndex].accessCount ?? 0) + 1;
        await writeFile(this.indexFile, JSON.stringify(index, null, 2));
      }
    } catch (error) {
      logger.debug(`Failed to update access count: ${(error as Error).message}`);
    }
  }

  private async _addToIndex(cacheKey: string, timestamp: number): Promise<void> {
    try {
      const indexData = await readFile(this.indexFile, 'utf8');
      const index = JSON.parse(indexData) as CacheIndex;

      const existingIndex = index.entries.findIndex((e) => e.cacheKey === cacheKey);
      if (existingIndex >= 0) {
        // Update existing
        index.entries[existingIndex].lastAccessed = new Date(timestamp * 1000).toISOString();
        index.entries[existingIndex].accessCount =
          (index.entries[existingIndex].accessCount ?? 0) + 1;
      } else {
        // Add new
        index.entries.push({
          cacheKey,
          created: new Date(timestamp * 1000).toISOString(),
          lastAccessed: new Date(timestamp * 1000).toISOString(),
          accessCount: 1,
        });
      }

      await writeFile(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      logger.debug(`Failed to update index: ${(error as Error).message}`);
    }
  }

  private async _removeFromIndex(cacheKey: string): Promise<void> {
    try {
      const indexData = await readFile(this.indexFile, 'utf8');
      const index = JSON.parse(indexData) as CacheIndex;

      index.entries = index.entries.filter((e) => e.cacheKey !== cacheKey);
      await writeFile(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      logger.debug(`Failed to remove from index: ${(error as Error).message}`);
    }
  }

  private async _updateCleanupTimestamp(timestamp: number): Promise<void> {
    try {
      const indexData = await readFile(this.indexFile, 'utf8');
      const index = JSON.parse(indexData) as CacheIndex;

      index.lastCleanup = new Date(timestamp * 1000).toISOString();
      index.lastCleanupEpoch = timestamp;

      await writeFile(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      logger.debug(`Failed to update cleanup timestamp: ${(error as Error).message}`);
    }
  }
}

/**
 * @fileoverview Dependency Cache (v2.0.0)
 * @module lib/dependency_cache
 *
 * Cache npm audit and outdated check results to improve Step 8 performance.
 * Reduces Step 8 execution time from ~6-7 minutes to <10 seconds on cache hits.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for cache validation, key generation, statistics
 * - Impure wrapper class for file I/O, cache management
 *
 * **Source**: Migrated from ai_workflow v3.2.7 `dependency_cache.sh`
 * **Performance Impact**: 90%+ Step 8 time reduction (6-7 min → <10 sec)
 *
 * @version 2.0.0
 * @since 2026-02-08
 */

import crypto from 'crypto';
import path from 'path';
import { logger } from '../core/logger.js';

/**
 * Default cache configuration
 * @constant
 */
export const DEPENDENCY_CACHE_CONFIG = {
  cacheDir: '.dependency_cache',
  ttl: 3600, // 1 hour in seconds (dependencies change frequently)
  maxSizeMB: 50,
  enabled: true,
};

/**
 * Cache entry types
 * @constant
 */
export const CACHE_TYPE = {
  AUDIT: 'audit',
  OUTDATED: 'outdated',
  SECURITY: 'security',
  LICENSES: 'licenses',
};

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

/**
 * Generate cache key from package.json dependencies and cache type
 * @pure
 * @param {Object} dependencies - Dependencies object from package.json
 * @param {Object} devDependencies - DevDependencies object from package.json
 * @param {string} cacheType - Cache type from CACHE_TYPE
 * @returns {string} SHA256 hash as cache key
 */
export function generateCacheKey(dependencies, devDependencies, cacheType) {
  const depsData = {
    dependencies: dependencies || {},
    devDependencies: devDependencies || {},
  };

  // Create deterministic JSON string with sorted keys at all levels
  const depsJson = JSON.stringify(depsData, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  });

  // Hash dependencies + cache type
  const dataToHash = `${cacheType}_${depsJson}`;
  return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

/**
 * Check if cache entry is valid (not expired)
 * @pure
 * @param {number} createdAt - Unix timestamp when cache was created
 * @param {number} currentTime - Current unix timestamp
 * @param {number} ttl - Time to live in seconds
 * @returns {boolean} True if cache is still valid
 */
export function isCacheValid(createdAt, currentTime, ttl) {
  const age = currentTime - createdAt;
  return age <= ttl;
}

/**
 * Calculate cache age in seconds
 * @pure
 * @param {number} createdAt - Unix timestamp when cache was created
 * @param {number} currentTime - Current unix timestamp
 * @returns {number} Age in seconds
 */
export function calculateCacheAge(createdAt, currentTime) {
  return currentTime - createdAt;
}

/**
 * Format cache age for display
 * @pure
 * @param {number} ageSeconds - Age in seconds
 * @returns {string} Formatted age string
 */
export function formatCacheAge(ageSeconds) {
  if (ageSeconds < 60) {
    return `${ageSeconds}s`;
  } else if (ageSeconds < 3600) {
    const minutes = Math.floor(ageSeconds / 60);
    return `${minutes}m`;
  } else {
    const hours = Math.floor(ageSeconds / 3600);
    const minutes = Math.floor((ageSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Calculate cache size statistics
 * @pure
 * @param {Array<Object>} entries - Array of cache entries with size property
 * @returns {Object} Size statistics
 */
export function calculateCacheStats(entries) {
  const totalEntries = entries.length;
  const totalSizeBytes = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
  const totalSizeKB = Math.round(totalSizeBytes / 1024);
  const totalSizeMB = Math.round(totalSizeKB / 1024);

  return {
    totalEntries,
    totalSizeBytes,
    totalSizeKB,
    totalSizeMB,
  };
}

/**
 * Filter expired cache entries
 * @pure
 * @param {Array<Object>} entries - Array of cache entries
 * @param {number} currentTime - Current unix timestamp
 * @param {number} ttl - Time to live in seconds
 * @returns {Object} Object with valid and expired entries
 */
export function filterExpiredEntries(entries, currentTime, ttl) {
  const valid = [];
  const expired = [];

  for (const entry of entries) {
    if (isCacheValid(entry.createdAt, currentTime, ttl)) {
      valid.push(entry);
    } else {
      expired.push(entry);
    }
  }

  return { valid, expired };
}

/**
 * Create cache entry metadata
 * @pure
 * @param {string} cacheKey - Cache key
 * @param {string} cacheType - Cache type
 * @param {number} createdAt - Unix timestamp
 * @param {number} size - Size in bytes
 * @returns {Object} Cache entry metadata
 */
export function createCacheEntry(cacheKey, cacheType, createdAt, size = 0) {
  return {
    key: cacheKey,
    type: cacheType,
    createdAt,
    size,
    createdAtISO: new Date(createdAt * 1000).toISOString(),
  };
}

/**
 * Create cache index structure
 * @pure
 * @param {string} version - Cache version
 * @param {number} createdAt - Unix timestamp
 * @returns {Object} Cache index structure
 */
export function createCacheIndex(version, createdAt) {
  return {
    version,
    created: new Date(createdAt * 1000).toISOString(),
    lastCleanup: new Date(createdAt * 1000).toISOString(),
    entries: [],
  };
}

/**
 * Validate cache type
 * @pure
 * @param {string} cacheType - Cache type to validate
 * @returns {boolean} True if valid cache type
 */
export function isValidCacheType(cacheType) {
  return Object.values(CACHE_TYPE).includes(cacheType);
}

/**
 * Get cache file paths
 * @pure
 * @param {string} cacheDir - Cache directory path
 * @param {string} cacheKey - Cache key
 * @returns {Object} Object with data and meta file paths
 */
export function getCacheFilePaths(cacheDir, cacheKey) {
  return {
    data: path.join(cacheDir, `${cacheKey}.json`),
    meta: path.join(cacheDir, `${cacheKey}.meta`),
  };
}

// =============================================================================
// IMPURE WRAPPER CLASS
// =============================================================================

/**
 * Dependency cache manager
 * Handles caching of npm audit and outdated results
 */
export class DependencyCache {
  /**
   * Create dependency cache manager
   * @param {Object} options - Configuration options
   * @param {string} options.workflowHome - Workflow home directory
   * @param {Object} options.config - Cache configuration (merges with defaults)
   * @param {Object} options.fileOperations - FileOperations instance for I/O
   */
  constructor(options = {}) {
    this.workflowHome = options.workflowHome || process.cwd();
    this.config = { ...DEPENDENCY_CACHE_CONFIG, ...(options.config || {}) };
    this.fileOps = options.fileOperations || null;

    // Resolve cache directory
    this.cacheDir = path.isAbsolute(this.config.cacheDir)
      ? this.config.cacheDir
      : path.join(this.workflowHome, this.config.cacheDir);

    this.indexFile = path.join(this.cacheDir, 'index.json');
    this.initialized = false;
  }

  /**
   * Initialize cache directory and index
   * @async
   * @returns {Promise<void>}
   */
  async init() {
    if (!this.config.enabled) {
      logger.info('Dependency cache disabled');
      return;
    }

    if (!this.fileOps) {
      throw new Error('FileOperations instance required for cache initialization');
    }

    // Create cache directory
    await this.fileOps.ensureDir(this.cacheDir);

    // Create index if doesn't exist
    if (!(await this.fileOps.exists(this.indexFile))) {
      const index = createCacheIndex('2.0.0', Math.floor(Date.now() / 1000));
      await this.fileOps.writeJson(this.indexFile, index);
    }

    // Cleanup old entries on init
    await this.cleanup();

    this.initialized = true;
    logger.debug(`Dependency cache initialized: ${this.cacheDir}`);
  }

  /**
   * Generate cache key from package.json
   * @async
   * @param {string} packageJsonPath - Path to package.json
   * @param {string} cacheType - Cache type from CACHE_TYPE
   * @returns {Promise<string>} Cache key
   */
  async generateKey(packageJsonPath, cacheType) {
    if (!isValidCacheType(cacheType)) {
      throw new Error(`Invalid cache type: ${cacheType}`);
    }

    if (!this.fileOps) {
      throw new Error('FileOperations instance required');
    }

    const packageJson = await this.fileOps.readJson(packageJsonPath);
    const { dependencies = {}, devDependencies = {} } = packageJson;

    return generateCacheKey(dependencies, devDependencies, cacheType);
  }

  /**
   * Check if cache entry exists and is valid
   * @async
   * @param {string} cacheKey - Cache key
   * @returns {Promise<boolean>} True if valid cache exists
   */
  async has(cacheKey) {
    if (!this.config.enabled || !this.fileOps) {
      return false;
    }

    const paths = getCacheFilePaths(this.cacheDir, cacheKey);

    // Check if files exist
    if (!(await this.fileOps.exists(paths.data))) {
      return false;
    }

    // Check if cache is valid (not expired)
    if (await this.fileOps.exists(paths.meta)) {
      const meta = await this.fileOps.readJson(paths.meta);
      const currentTime = Math.floor(Date.now() / 1000);

      if (!isCacheValid(meta.createdAt, currentTime, this.config.ttl)) {
        logger.debug(`Cache expired (age: ${calculateCacheAge(meta.createdAt, currentTime)}s)`);
        return false;
      }

      return true;
    }

    // No meta file - assume expired for safety
    return false;
  }

  /**
   * Get cached result
   * @async
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object>} Cached data
   */
  async get(cacheKey) {
    if (!this.fileOps) {
      throw new Error('FileOperations instance required');
    }

    const paths = getCacheFilePaths(this.cacheDir, cacheKey);

    if (!(await this.has(cacheKey))) {
      throw new Error(`Cache miss: ${cacheKey}`);
    }

    const data = await this.fileOps.readJson(paths.data);
    logger.success(`Using cached result (key: ${cacheKey.slice(0, 8)}...)`);

    return data;
  }

  /**
   * Save result to cache
   * @async
   * @param {string} cacheKey - Cache key
   * @param {Object} data - Data to cache
   * @param {string} cacheType - Cache type from CACHE_TYPE
   * @returns {Promise<void>}
   */
  async set(cacheKey, data, cacheType) {
    if (!this.config.enabled || !this.fileOps) {
      return;
    }

    if (!isValidCacheType(cacheType)) {
      throw new Error(`Invalid cache type: ${cacheType}`);
    }

    const paths = getCacheFilePaths(this.cacheDir, cacheKey);
    const createdAt = Math.floor(Date.now() / 1000);

    // Save data
    await this.fileOps.writeJson(paths.data, data);

    // Get file size
    const stats = await this.fileOps.stat(paths.data);
    const size = stats.size;

    // Save metadata
    const meta = createCacheEntry(cacheKey, cacheType, createdAt, size);
    await this.fileOps.writeJson(paths.meta, meta);

    // Update index
    await this._updateIndex(cacheKey, cacheType, createdAt, size);

    logger.debug(`Saved to cache (key: ${cacheKey.slice(0, 8)}..., type: ${cacheType})`);
  }

  /**
   * Update cache index with new entry
   * @private
   * @async
   * @param {string} cacheKey - Cache key
   * @param {string} cacheType - Cache type
   * @param {number} createdAt - Unix timestamp
   * @param {number} size - Size in bytes
   * @returns {Promise<void>}
   */
  async _updateIndex(cacheKey, cacheType, createdAt, size) {
    if (!this.fileOps) return;

    const index = await this.fileOps.readJson(this.indexFile);
    const entry = createCacheEntry(cacheKey, cacheType, createdAt, size);

    // Remove existing entry for this key if present
    index.entries = index.entries.filter((e) => e.key !== cacheKey);

    // Add new entry
    index.entries.push(entry);

    await this.fileOps.writeJson(this.indexFile, index);
  }

  /**
   * Remove cache entry
   * @async
   * @param {string} cacheKey - Cache key
   * @returns {Promise<void>}
   */
  async delete(cacheKey) {
    if (!this.fileOps) {
      throw new Error('FileOperations instance required');
    }

    const paths = getCacheFilePaths(this.cacheDir, cacheKey);

    // Remove files
    if (await this.fileOps.exists(paths.data)) {
      await this.fileOps.delete(paths.data);
    }
    if (await this.fileOps.exists(paths.meta)) {
      await this.fileOps.delete(paths.meta);
    }

    // Update index
    const index = await this.fileOps.readJson(this.indexFile);
    index.entries = index.entries.filter((e) => e.key !== cacheKey);
    await this.fileOps.writeJson(this.indexFile, index);

    logger.debug(`Deleted cache entry: ${cacheKey.slice(0, 8)}...`);
  }

  /**
   * Cleanup expired cache entries
   * @async
   * @returns {Promise<number>} Number of entries removed
   */
  async cleanup() {
    if (!this.config.enabled || !this.fileOps) {
      return 0;
    }

    if (!(await this.fileOps.exists(this.indexFile))) {
      return 0;
    }

    const index = await this.fileOps.readJson(this.indexFile);
    const currentTime = Math.floor(Date.now() / 1000);

    const { valid, expired } = filterExpiredEntries(index.entries, currentTime, this.config.ttl);

    // Remove expired entries
    for (const entry of expired) {
      await this.delete(entry.key);
    }

    // Update index with valid entries and new cleanup timestamp
    index.entries = valid;
    index.lastCleanup = new Date(currentTime * 1000).toISOString();
    await this.fileOps.writeJson(this.indexFile, index);

    if (expired.length > 0) {
      logger.info(`Cleaned up ${expired.length} expired cache entries`);
    }

    return expired.length;
  }

  /**
   * Clear entire cache
   * @async
   * @returns {Promise<number>} Number of entries removed
   */
  async clear() {
    if (!this.fileOps) {
      throw new Error('FileOperations instance required');
    }

    if (!(await this.fileOps.exists(this.cacheDir))) {
      return 0;
    }

    const index = await this.fileOps.readJson(this.indexFile);
    const count = index.entries.length;

    // Remove cache directory
    await this.fileOps.deleteDir(this.cacheDir);

    logger.success(`Cleared dependency cache (${count} entries removed)`);
    return count;
  }

  /**
   * Get cache statistics
   * @async
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    if (!this.fileOps || !(await this.fileOps.exists(this.indexFile))) {
      return {
        location: this.cacheDir,
        totalEntries: 0,
        totalSizeKB: 0,
        totalSizeMB: 0,
        ttl: this.config.ttl,
        maxSizeMB: this.config.maxSizeMB,
        enabled: this.config.enabled,
      };
    }

    const index = await this.fileOps.readJson(this.indexFile);
    const stats = calculateCacheStats(index.entries);

    return {
      location: this.cacheDir,
      ...stats,
      ttl: this.config.ttl,
      ttlMinutes: Math.floor(this.config.ttl / 60),
      maxSizeMB: this.config.maxSizeMB,
      enabled: this.config.enabled,
    };
  }

  /**
   * Display cache statistics
   * @async
   */
  async displayStats() {
    const stats = await this.getStats();

    logger.info('\nDependency Cache Statistics:');
    logger.info(`  Location: ${stats.location}`);
    logger.info(`  Total Entries: ${stats.totalEntries}`);
    logger.info(`  Cache Size: ${stats.totalSizeMB} MB (${stats.totalSizeKB} KB)`);
    logger.info(`  TTL: ${stats.ttl} seconds (${stats.ttlMinutes} minutes)`);
    logger.info(`  Max Size: ${stats.maxSizeMB} MB`);
    logger.info(`  Enabled: ${stats.enabled}`);
  }
}

// Export default class
export default DependencyCache;

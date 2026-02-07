/**
 * @fileoverview Git Cache Module - Performance optimization for Git operations
 * 
 * Architecture: v2.0.0 (Referentially Transparent)
 * - Pure functions: Cache validation, key generation, metrics calculation
 * - Impure wrapper: Cache storage, retrieval, invalidation
 * 
 * @module lib/git_cache
 * @version 2.0.0
 */

import crypto from 'crypto';
import { logger } from '../core/logger.js';

// ============================================================================
// PURE FUNCTIONS - Exported for testing and reuse
// ============================================================================

/**
 * Generate a deterministic cache key from operation and arguments
 * 
 * @param {string} operation - Git operation name (e.g., 'status', 'diff')
 * @param {Array<string>} args - Operation arguments
 * @returns {string} Cache key (e.g., 'git_status_abc123')
 * 
 * @example
 * generateCacheKey('status', ['--short'])
 * // Returns: 'git_status_abc123...'
 */
export function generateCacheKey(operation, args = []) {
  if (!operation || typeof operation !== 'string') {
    return 'git_invalid';
  }
  
  const normalized = args
    .filter(arg => arg && typeof arg === 'string')
    .sort()
    .join('|');
  
  const hash = crypto
    .createHash('sha256')
    .update(`${operation}:${normalized}`)
    .digest('hex')
    .substring(0, 8);
  
  return `git_${operation}_${hash}`;
}

/**
 * Check if cache entry is still valid based on TTL
 * 
 * @param {Object} entry - Cache entry with timestamp
 * @param {number} ttl - Time to live in milliseconds
 * @param {number} currentTime - Current timestamp (injected for testing)
 * @returns {boolean} True if entry is valid
 * 
 * @example
 * isCacheValid({ timestamp: 1000 }, 5000, 5000)
 * // Returns: true (within TTL)
 */
export function isCacheValid(entry, ttl, currentTime) {
  if (!entry || typeof entry !== 'object' || !entry.timestamp) {
    return false;
  }
  
  if (typeof ttl !== 'number' || ttl <= 0) {
    return false;
  }
  
  if (typeof currentTime !== 'number' || currentTime < 0) {
    return false;
  }
  
  const age = currentTime - entry.timestamp;
  return age >= 0 && age < ttl;
}

/**
 * Determine if cache should be invalidated based on reason
 * 
 * @param {string} reason - Invalidation reason ('commit', 'add', 'reset', etc.)
 * @returns {boolean} True if cache should be invalidated
 * 
 * @example
 * shouldInvalidateCache('commit')
 * // Returns: true (modifies repo state)
 */
export function shouldInvalidateCache(reason) {
  if (!reason || typeof reason !== 'string') {
    return false;
  }
  
  const invalidationTriggers = [
    'commit',
    'add',
    'reset',
    'checkout',
    'merge',
    'rebase',
    'pull',
    'fetch',
    'stash'
  ];
  
  return invalidationTriggers.includes(reason.toLowerCase());
}

/**
 * Calculate cache statistics from entries
 * 
 * @param {Object} metrics - Metrics object with hits/misses
 * @returns {Object} Statistics { hits, misses, hitRate }
 * 
 * @example
 * calculateCacheStats({ hits: 80, misses: 20 })
 * // Returns: { hits: 80, misses: 20, hitRate: 80, total: 100 }
 */
export function calculateCacheStats(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return { hits: 0, misses: 0, hitRate: 0, total: 0 };
  }
  
  const hits = typeof metrics.hits === 'number' ? metrics.hits : 0;
  const misses = typeof metrics.misses === 'number' ? metrics.misses : 0;
  const total = hits + misses;
  
  const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
  
  return { hits, misses, hitRate, total };
}

/**
 * Filter out expired entries from cache
 * 
 * @param {Map} entries - Cache entries map
 * @param {number} currentTime - Current timestamp
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Array} Array of expired keys
 * 
 * @example
 * filterExpiredEntries(cacheMap, Date.now(), 5000)
 * // Returns: ['git_status_abc', 'git_diff_def']
 */
export function filterExpiredEntries(entries, currentTime, ttl) {
  if (!entries || typeof entries.entries !== 'function') {
    return [];
  }
  
  const expired = [];
  
  for (const [key, entry] of entries.entries()) {
    if (!isCacheValid(entry, ttl, currentTime)) {
      expired.push(key);
    }
  }
  
  return expired;
}

/**
 * Merge two cache metrics objects
 * 
 * @param {Object} metrics1 - First metrics object
 * @param {Object} metrics2 - Second metrics object
 * @returns {Object} Merged metrics
 * 
 * @example
 * mergeCacheMetrics({ hits: 10, misses: 5 }, { hits: 20, misses: 3 })
 * // Returns: { hits: 30, misses: 8 }
 */
export function mergeCacheMetrics(metrics1, metrics2) {
  const m1 = metrics1 || {};
  const m2 = metrics2 || {};
  
  return {
    hits: (m1.hits || 0) + (m2.hits || 0),
    misses: (m1.misses || 0) + (m2.misses || 0)
  };
}

/**
 * Create a cache entry with metadata
 * 
 * @param {string} key - Cache key
 * @param {*} result - Operation result to cache
 * @param {number} timestamp - Entry timestamp
 * @returns {Object} Cache entry { key, result, timestamp, size }
 * 
 * @example
 * createCacheEntry('git_status_abc', { files: [] }, 1000)
 * // Returns: { key: 'git_status_abc', result: {...}, timestamp: 1000, size: 14 }
 */
export function createCacheEntry(key, result, timestamp) {
  if (!key || typeof key !== 'string') {
    return null;
  }
  
  const size = result ? JSON.stringify(result).length : 0;
  
  return {
    key,
    result,
    timestamp: typeof timestamp === 'number' ? timestamp : 0,
    size
  };
}

/**
 * Validate cache configuration
 * 
 * @param {Object} config - Cache configuration
 * @returns {Object} Validation result { valid, errors }
 * 
 * @example
 * validateCacheConfig({ ttl: 5000, maxSize: 100 })
 * // Returns: { valid: true, errors: [] }
 */
export function validateCacheConfig(config) {
  const errors = [];
  
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }
  
  if (config.ttl !== undefined) {
    if (typeof config.ttl !== 'number' || config.ttl <= 0) {
      errors.push('TTL must be a positive number');
    }
  }
  
  if (config.maxSize !== undefined) {
    if (typeof config.maxSize !== 'number' || config.maxSize <= 0) {
      errors.push('Max size must be a positive number');
    }
  }
  
  if (config.enabled !== undefined) {
    if (typeof config.enabled !== 'boolean') {
      errors.push('Enabled must be a boolean');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// IMPURE WRAPPER CLASS - Handles I/O and side effects
// ============================================================================

/**
 * Git Cache - Caches Git operation results to improve performance
 * 
 * Features:
 * - TTL-based expiration (configurable per operation)
 * - Automatic invalidation on state-changing operations
 * - Hit/miss statistics
 * - Memory-efficient with max size limits
 * 
 * @class GitCache
 * 
 * @example
 * const cache = new GitCache({
 *   ttl: { status: 300000, diff: 60000, log: 600000 },
 *   maxSize: 100
 * });
 * 
 * const result = await cache.get('status', ['--short'], async () => {
 *   return await gitAutomation.status();
 * });
 */
export class GitCache {
  /**
   * Create a new Git cache instance
   * 
   * @param {Object} options - Cache options
   * @param {Object} options.ttl - TTL per operation type (ms)
   * @param {number} options.maxSize - Maximum cache entries
   * @param {boolean} options.enabled - Enable/disable caching
   */
  constructor(options = {}) {
    this.cache = new Map();
    this.metrics = { hits: 0, misses: 0 };
    
    // Default TTLs in milliseconds
    this.ttl = {
      status: 300000,    // 5 minutes
      diff: 60000,       // 1 minute
      log: 600000,       // 10 minutes
      branch: 600000,    // 10 minutes
      remote: 3600000,   // 1 hour
      default: 300000,   // 5 minutes
      ...options.ttl
    };
    
    this.maxSize = options.maxSize || 100;
    this.enabled = options.enabled !== false;
    
    // Validate configuration
    const validation = validateCacheConfig({
      ttl: this.ttl.default,
      maxSize: this.maxSize,
      enabled: this.enabled
    });
    
    if (!validation.valid) {
      logger.warn(`Cache config validation warnings: ${validation.errors.join(', ')}`);
    }
  }
  
  /**
   * Get cached result or execute operation
   * 
   * @param {string} operation - Git operation name
   * @param {Array<string>} args - Operation arguments
   * @param {Function} executor - Function to execute if cache miss
   * @returns {Promise<*>} Operation result (cached or fresh)
   */
  async get(operation, args, executor) {
    if (!this.enabled) {
      this.metrics.misses++;
      return await executor();
    }
    
    const key = generateCacheKey(operation, args);
    const entry = this.cache.get(key);
    const ttl = this.ttl[operation] || this.ttl.default;
    
    // Check cache validity
    if (entry && isCacheValid(entry, ttl, Date.now())) {
      this.metrics.hits++;
      logger.debug(`Cache hit: ${key}`);
      return entry.result;
    }
    
    // Cache miss - execute and store
    this.metrics.misses++;
    logger.debug(`Cache miss: ${key}`);
    
    const result = await executor();
    await this.set(operation, args, result);
    
    return result;
  }
  
  /**
   * Store result in cache
   * 
   * @param {string} operation - Git operation name
   * @param {Array<string>} args - Operation arguments
   * @param {*} result - Result to cache
   * @returns {Promise<void>}
   */
  async set(operation, args, result) {
    if (!this.enabled) {
      return;
    }
    
    const key = generateCacheKey(operation, args);
    const entry = createCacheEntry(key, result, Date.now());
    
    if (!entry) {
      logger.warn(`Failed to create cache entry for ${key}`);
      return;
    }
    
    // Enforce max size - remove oldest entry if needed
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      logger.debug(`Cache eviction: ${oldestKey}`);
    }
    
    this.cache.set(key, entry);
    logger.debug(`Cache set: ${key} (${entry.size} bytes)`);
  }
  
  /**
   * Invalidate cache entries matching pattern
   * 
   * @param {string|RegExp} pattern - Pattern to match keys
   * @returns {Promise<number>} Number of invalidated entries
   */
  async invalidate(pattern) {
    let count = 0;
    const regex = pattern instanceof RegExp 
      ? pattern 
      : new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      logger.debug(`Invalidated ${count} cache entries matching ${pattern}`);
    }
    
    return count;
  }
  
  /**
   * Invalidate cache after state-changing operation
   * 
   * @param {string} reason - Operation that triggered invalidation
   * @returns {Promise<number>} Number of invalidated entries
   */
  async invalidateAfterOperation(reason) {
    if (!shouldInvalidateCache(reason)) {
      return 0;
    }
    
    // Invalidate status and diff caches (most affected by changes)
    const count = await this.invalidate(/^git_(status|diff)/);
    
    if (count > 0) {
      logger.info(`Invalidated ${count} cache entries after ${reason}`);
    }
    
    return count;
  }
  
  /**
   * Clear all cache entries
   * 
   * @returns {Promise<number>} Number of cleared entries
   */
  async clear() {
    const count = this.cache.size;
    this.cache.clear();
    logger.debug(`Cleared ${count} cache entries`);
    return count;
  }
  
  /**
   * Get cache statistics
   * 
   * @returns {Object} Statistics { hits, misses, hitRate, size }
   */
  getMetrics() {
    const stats = calculateCacheStats(this.metrics);
    return {
      ...stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      enabled: this.enabled
    };
  }
  
  /**
   * Remove expired entries from cache
   * 
   * @returns {Promise<number>} Number of removed entries
   */
  async cleanup() {
    const ttl = this.ttl.default;
    const currentTime = Date.now();
    const expired = filterExpiredEntries(this.cache, currentTime, ttl);
    
    for (const key of expired) {
      this.cache.delete(key);
    }
    
    if (expired.length > 0) {
      logger.debug(`Cleaned up ${expired.length} expired cache entries`);
    }
    
    return expired.length;
  }
}

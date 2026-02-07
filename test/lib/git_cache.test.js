/**
 * @fileoverview Tests for Git Cache Module
 * Tests both pure functions and GitCache class
 */

import {
  generateCacheKey,
  isCacheValid,
  shouldInvalidateCache,
  calculateCacheStats,
  filterExpiredEntries,
  mergeCacheMetrics,
  createCacheEntry,
  validateCacheConfig,
  GitCache
} from '../../src/lib/git_cache.js';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('git_cache - Pure Functions', () => {
  
  describe('generateCacheKey', () => {
    test('generates key from operation and args', () => {
      const key = generateCacheKey('status', ['--short']);
      expect(key).toMatch(/^git_status_[a-f0-9]{8}$/);
    });
    
    test('generates consistent keys for same inputs', () => {
      const key1 = generateCacheKey('status', ['--short']);
      const key2 = generateCacheKey('status', ['--short']);
      expect(key1).toBe(key2);
    });
    
    test('generates different keys for different operations', () => {
      const key1 = generateCacheKey('status', ['--short']);
      const key2 = generateCacheKey('diff', ['--short']);
      expect(key1).not.toBe(key2);
    });
    
    test('generates different keys for different args', () => {
      const key1 = generateCacheKey('status', ['--short']);
      const key2 = generateCacheKey('status', ['--porcelain']);
      expect(key1).not.toBe(key2);
    });
    
    test('sorts args for consistency', () => {
      const key1 = generateCacheKey('status', ['--short', '--branch']);
      const key2 = generateCacheKey('status', ['--branch', '--short']);
      expect(key1).toBe(key2);
    });
    
    test('handles empty args', () => {
      const key = generateCacheKey('status', []);
      expect(key).toMatch(/^git_status_[a-f0-9]{8}$/);
    });
    
    test('filters invalid args', () => {
      const key = generateCacheKey('status', ['--short', null, undefined, '']);
      expect(key).toMatch(/^git_status_[a-f0-9]{8}$/);
    });
    
    test('handles invalid operation', () => {
      expect(generateCacheKey(null, ['--short'])).toBe('git_invalid');
      expect(generateCacheKey('', ['--short'])).toBe('git_invalid');
    });
  });
  
  describe('isCacheValid', () => {
    test('returns true for valid cache entry', () => {
      const entry = { timestamp: 1000, result: 'data' };
      const valid = isCacheValid(entry, 5000, 5000);
      expect(valid).toBe(true);
    });
    
    test('returns false for expired entry', () => {
      const entry = { timestamp: 1000, result: 'data' };
      const valid = isCacheValid(entry, 5000, 7000);
      expect(valid).toBe(false);
    });
    
    test('returns false for entry at exact TTL boundary', () => {
      const entry = { timestamp: 1000, result: 'data' };
      const valid = isCacheValid(entry, 5000, 6000);
      expect(valid).toBe(false);
    });
    
    test('returns false for null entry', () => {
      const valid = isCacheValid(null, 5000, 1000);
      expect(valid).toBe(false);
    });
    
    test('returns false for entry without timestamp', () => {
      const entry = { result: 'data' };
      const valid = isCacheValid(entry, 5000, 1000);
      expect(valid).toBe(false);
    });
    
    test('returns false for invalid TTL', () => {
      const entry = { timestamp: 1000, result: 'data' };
      expect(isCacheValid(entry, 0, 5000)).toBe(false);
      expect(isCacheValid(entry, -1, 5000)).toBe(false);
    });
    
    test('returns false for invalid current time', () => {
      const entry = { timestamp: 1000, result: 'data' };
      expect(isCacheValid(entry, 5000, -1)).toBe(false);
    });
  });
  
  describe('shouldInvalidateCache', () => {
    test('returns true for commit operation', () => {
      expect(shouldInvalidateCache('commit')).toBe(true);
    });
    
    test('returns true for add operation', () => {
      expect(shouldInvalidateCache('add')).toBe(true);
    });
    
    test('returns true for reset operation', () => {
      expect(shouldInvalidateCache('reset')).toBe(true);
    });
    
    test('returns true for checkout operation', () => {
      expect(shouldInvalidateCache('checkout')).toBe(true);
    });
    
    test('returns true for merge/rebase operations', () => {
      expect(shouldInvalidateCache('merge')).toBe(true);
      expect(shouldInvalidateCache('rebase')).toBe(true);
    });
    
    test('returns true for pull/fetch operations', () => {
      expect(shouldInvalidateCache('pull')).toBe(true);
      expect(shouldInvalidateCache('fetch')).toBe(true);
    });
    
    test('returns true for stash operation', () => {
      expect(shouldInvalidateCache('stash')).toBe(true);
    });
    
    test('returns false for read-only operations', () => {
      expect(shouldInvalidateCache('status')).toBe(false);
      expect(shouldInvalidateCache('diff')).toBe(false);
      expect(shouldInvalidateCache('log')).toBe(false);
    });
    
    test('handles case-insensitive matching', () => {
      expect(shouldInvalidateCache('COMMIT')).toBe(true);
      expect(shouldInvalidateCache('Merge')).toBe(true);
    });
    
    test('returns false for invalid input', () => {
      expect(shouldInvalidateCache(null)).toBe(false);
      expect(shouldInvalidateCache('')).toBe(false);
      expect(shouldInvalidateCache(undefined)).toBe(false);
    });
  });
  
  describe('calculateCacheStats', () => {
    test('calculates stats with hits and misses', () => {
      const stats = calculateCacheStats({ hits: 80, misses: 20 });
      expect(stats).toEqual({
        hits: 80,
        misses: 20,
        hitRate: 80,
        total: 100
      });
    });
    
    test('calculates 0% hit rate for no hits', () => {
      const stats = calculateCacheStats({ hits: 0, misses: 100 });
      expect(stats.hitRate).toBe(0);
    });
    
    test('calculates 100% hit rate for no misses', () => {
      const stats = calculateCacheStats({ hits: 100, misses: 0 });
      expect(stats.hitRate).toBe(100);
    });
    
    test('handles zero total requests', () => {
      const stats = calculateCacheStats({ hits: 0, misses: 0 });
      expect(stats.hitRate).toBe(0);
    });
    
    test('handles null metrics', () => {
      const stats = calculateCacheStats(null);
      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        hitRate: 0,
        total: 0
      });
    });
    
    test('handles missing properties', () => {
      const stats = calculateCacheStats({});
      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        hitRate: 0,
        total: 0
      });
    });
    
    test('rounds hit rate to nearest integer', () => {
      const stats = calculateCacheStats({ hits: 2, misses: 1 });
      expect(stats.hitRate).toBe(67); // 66.666... rounded
    });
  });
  
  describe('filterExpiredEntries', () => {
    test('filters expired entries', () => {
      const entries = new Map([
        ['key1', { timestamp: 1000, result: 'data1' }],
        ['key2', { timestamp: 5000, result: 'data2' }],
        ['key3', { timestamp: 3000, result: 'data3' }]
      ]);
      
      const expired = filterExpiredEntries(entries, 8000, 5000);
      expect(expired).toEqual(['key1', 'key3']);
    });
    
    test('returns empty array when all valid', () => {
      const entries = new Map([
        ['key1', { timestamp: 5000, result: 'data1' }],
        ['key2', { timestamp: 6000, result: 'data2' }]
      ]);
      
      const expired = filterExpiredEntries(entries, 8000, 5000);
      expect(expired).toEqual([]);
    });
    
    test('returns all keys when all expired', () => {
      const entries = new Map([
        ['key1', { timestamp: 1000, result: 'data1' }],
        ['key2', { timestamp: 2000, result: 'data2' }]
      ]);
      
      const expired = filterExpiredEntries(entries, 10000, 5000);
      expect(expired).toEqual(['key1', 'key2']);
    });
    
    test('handles empty map', () => {
      const entries = new Map();
      const expired = filterExpiredEntries(entries, 1000, 5000);
      expect(expired).toEqual([]);
    });
    
    test('handles invalid entries', () => {
      const expired = filterExpiredEntries(null, 1000, 5000);
      expect(expired).toEqual([]);
    });
  });
  
  describe('mergeCacheMetrics', () => {
    test('merges two metrics objects', () => {
      const m1 = { hits: 10, misses: 5 };
      const m2 = { hits: 20, misses: 3 };
      const merged = mergeCacheMetrics(m1, m2);
      expect(merged).toEqual({ hits: 30, misses: 8 });
    });
    
    test('handles null metrics', () => {
      const m1 = { hits: 10, misses: 5 };
      const merged = mergeCacheMetrics(m1, null);
      expect(merged).toEqual({ hits: 10, misses: 5 });
    });
    
    test('handles both null', () => {
      const merged = mergeCacheMetrics(null, null);
      expect(merged).toEqual({ hits: 0, misses: 0 });
    });
    
    test('handles missing properties', () => {
      const m1 = { hits: 10 };
      const m2 = { misses: 5 };
      const merged = mergeCacheMetrics(m1, m2);
      expect(merged).toEqual({ hits: 10, misses: 5 });
    });
  });
  
  describe('createCacheEntry', () => {
    test('creates cache entry with metadata', () => {
      const entry = createCacheEntry('git_status_abc', { files: [] }, 1000);
      expect(entry).toEqual({
        key: 'git_status_abc',
        result: { files: [] },
        timestamp: 1000,
        size: 12 // JSON.stringify({ files: [] }).length
      });
    });
    
    test('calculates size for complex objects', () => {
      const result = { files: ['a', 'b', 'c'], count: 3 };
      const entry = createCacheEntry('key', result, 1000);
      expect(entry.size).toBeGreaterThan(0);
    });
    
    test('handles null result', () => {
      const entry = createCacheEntry('key', null, 1000);
      expect(entry).toEqual({
        key: 'key',
        result: null,
        timestamp: 1000,
        size: 0
      });
    });
    
    test('handles invalid key', () => {
      expect(createCacheEntry(null, 'data', 1000)).toBeNull();
      expect(createCacheEntry('', 'data', 1000)).toBeNull();
    });
    
    test('handles invalid timestamp', () => {
      const entry = createCacheEntry('key', 'data', null);
      expect(entry.timestamp).toBe(0);
    });
  });
  
  describe('validateCacheConfig', () => {
    test('validates valid config', () => {
      const result = validateCacheConfig({
        ttl: 5000,
        maxSize: 100,
        enabled: true
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    test('rejects invalid TTL', () => {
      const result = validateCacheConfig({ ttl: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TTL must be a positive number');
    });
    
    test('rejects zero TTL', () => {
      const result = validateCacheConfig({ ttl: 0 });
      expect(result.valid).toBe(false);
    });
    
    test('rejects invalid maxSize', () => {
      const result = validateCacheConfig({ maxSize: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Max size must be a positive number');
    });
    
    test('rejects invalid enabled', () => {
      const result = validateCacheConfig({ enabled: 'yes' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Enabled must be a boolean');
    });
    
    test('allows partial config', () => {
      const result = validateCacheConfig({ ttl: 5000 });
      expect(result.valid).toBe(true);
    });
    
    test('rejects null config', () => {
      const result = validateCacheConfig(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Config must be an object');
    });
    
    test('accumulates multiple errors', () => {
      const result = validateCacheConfig({ ttl: -1, maxSize: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });
});

// ============================================================================
// GIT CACHE CLASS TESTS
// ============================================================================

describe('git_cache - GitCache Class', () => {
  
  describe('constructor', () => {
    test('creates instance with default options', () => {
      const cache = new GitCache();
      expect(cache.enabled).toBe(true);
      expect(cache.maxSize).toBe(100);
      expect(cache.ttl.status).toBe(300000);
    });
    
    test('creates instance with custom TTL', () => {
      const cache = new GitCache({
        ttl: { status: 10000, diff: 5000 }
      });
      expect(cache.ttl.status).toBe(10000);
      expect(cache.ttl.diff).toBe(5000);
    });
    
    test('creates instance with custom maxSize', () => {
      const cache = new GitCache({ maxSize: 50 });
      expect(cache.maxSize).toBe(50);
    });
    
    test('creates instance with disabled cache', () => {
      const cache = new GitCache({ enabled: false });
      expect(cache.enabled).toBe(false);
    });
    
    test('initializes empty cache and metrics', () => {
      const cache = new GitCache();
      expect(cache.cache.size).toBe(0);
      expect(cache.metrics).toEqual({ hits: 0, misses: 0 });
    });
  });
  
  describe('get', () => {
    test('executes and caches on first call', async () => {
      const cache = new GitCache();
      let callCount = 0;
      const executor = async () => {
        callCount++;
        return { files: [] };
      };
      
      const result = await cache.get('status', [], executor);
      
      expect(result).toEqual({ files: [] });
      expect(callCount).toBe(1);
      expect(cache.metrics.misses).toBe(1);
      expect(cache.cache.size).toBe(1);
    });
    
    test('returns cached result on second call', async () => {
      const cache = new GitCache({ ttl: { default: 10000 } });
      let callCount = 0;
      const executor = async () => {
        callCount++;
        return { files: [] };
      };
      
      await cache.get('status', [], executor);
      const result = await cache.get('status', [], executor);
      
      expect(result).toEqual({ files: [] });
      expect(callCount).toBe(1); // Only called once
      expect(cache.metrics.hits).toBe(1);
    });
    
    test('bypasses cache when disabled', async () => {
      const cache = new GitCache({ enabled: false });
      let callCount = 0;
      const executor = async () => {
        callCount++;
        return { files: [] };
      };
      
      await cache.get('status', [], executor);
      await cache.get('status', [], executor);
      
      expect(callCount).toBe(2);
      expect(cache.metrics.hits).toBe(0);
    });
    
    test('generates different cache keys for different args', async () => {
      const cache = new GitCache();
      const executor1 = async () => ({ result: 1 });
      const executor2 = async () => ({ result: 2 });
      
      const result1 = await cache.get('status', ['--short'], executor1);
      const result2 = await cache.get('status', ['--long'], executor2);
      
      expect(result1).toEqual({ result: 1 });
      expect(result2).toEqual({ result: 2 });
      expect(cache.cache.size).toBe(2);
    });
  });
  
  describe('set', () => {
    test('stores result in cache', async () => {
      const cache = new GitCache();
      await cache.set('status', [], { files: [] });
      expect(cache.cache.size).toBe(1);
    });
    
    test('does not store when disabled', async () => {
      const cache = new GitCache({ enabled: false });
      await cache.set('status', [], { files: [] });
      expect(cache.cache.size).toBe(0);
    });
    
    test('evicts oldest entry when max size reached', async () => {
      const cache = new GitCache({ maxSize: 2 });
      
      await cache.set('op1', [], { data: 1 });
      await cache.set('op2', [], { data: 2 });
      await cache.set('op3', [], { data: 3 });
      
      expect(cache.cache.size).toBe(2);
      // First entry should be evicted
      const key1 = generateCacheKey('op1', []);
      expect(cache.cache.has(key1)).toBe(false);
    });
  });
  
  describe('invalidate', () => {
    test('invalidates entries matching string pattern', async () => {
      const cache = new GitCache();
      await cache.set('status', [], { data: 1 });
      await cache.set('diff', [], { data: 2 });
      
      const count = await cache.invalidate('status');
      expect(count).toBe(1);
      expect(cache.cache.size).toBe(1);
    });
    
    test('invalidates entries matching regex', async () => {
      const cache = new GitCache();
      await cache.set('status', [], { data: 1 });
      await cache.set('diff', [], { data: 2 });
      
      const count = await cache.invalidate(/^git_(status|diff)/);
      expect(count).toBe(2);
      expect(cache.cache.size).toBe(0);
    });
    
    test('returns 0 when no matches', async () => {
      const cache = new GitCache();
      await cache.set('status', [], { data: 1 });
      
      const count = await cache.invalidate('nonexistent');
      expect(count).toBe(0);
      expect(cache.cache.size).toBe(1);
    });
  });
  
  describe('invalidateAfterOperation', () => {
    test('invalidates after commit', async () => {
      const cache = new GitCache();
      await cache.set('status', [], { data: 1 });
      await cache.set('diff', [], { data: 2 });
      
      const count = await cache.invalidateAfterOperation('commit');
      expect(count).toBeGreaterThan(0);
    });
    
    test('does not invalidate after read-only operation', async () => {
      const cache = new GitCache();
      await cache.set('status', [], { data: 1 });
      
      const count = await cache.invalidateAfterOperation('log');
      expect(count).toBe(0);
    });
  });
  
  describe('clear', () => {
    test('clears all cache entries', async () => {
      const cache = new GitCache();
      await cache.set('status', [], { data: 1 });
      await cache.set('diff', [], { data: 2 });
      
      const count = await cache.clear();
      expect(count).toBe(2);
      expect(cache.cache.size).toBe(0);
    });
    
    test('returns 0 when cache empty', async () => {
      const cache = new GitCache();
      const count = await cache.clear();
      expect(count).toBe(0);
    });
  });
  
  describe('getMetrics', () => {
    test('returns cache metrics', async () => {
      const cache = new GitCache();
      const executor = async () => ({ files: [] });
      
      await cache.get('status', [], executor);
      await cache.get('status', [], executor);
      
      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBe(50);
      expect(metrics.size).toBe(1);
    });
  });
  
  describe('cleanup', () => {
    test('removes expired entries', async () => {
      const cache = new GitCache({ ttl: { default: 100 } });
      
      await cache.set('status', [], { data: 1 });
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const count = await cache.cleanup();
      expect(count).toBe(1);
      expect(cache.cache.size).toBe(0);
    });
    
    test('keeps valid entries', async () => {
      const cache = new GitCache({ ttl: { default: 10000 } });
      
      await cache.set('status', [], { data: 1 });
      
      const count = await cache.cleanup();
      expect(count).toBe(0);
      expect(cache.cache.size).toBe(1);
    });
  });
});

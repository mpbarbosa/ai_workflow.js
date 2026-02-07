/**
 * @fileoverview Tests for Analysis Cache Module
 * @module test/lib/analysis_cache
 */

import {
  INVALIDATION_REASONS,
  generateCacheKey,
  isCacheValid,
  shouldInvalidate,
  calculateCacheStats,
  selectEntriesForEviction,
  estimateCacheSize,
  createCacheEntry,
  updateCacheEntry,
  AnalysisCache,
} from '../../src/lib/analysis_cache.js';
import fs from 'fs/promises';
import path from 'path';

describe('Analysis Cache Module - Pure Functions', () => {
  describe('generateCacheKey', () => {
    test('generates deterministic keys', () => {
      const inputs = { files: ['test.js'], config: { strict: true } };
      const key1 = generateCacheKey('docs_validation', inputs);
      const key2 = generateCacheKey('docs_validation', inputs);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^docs_validation_[a-f0-9]{8}$/);
    });

    test('generates different keys for different inputs', () => {
      const key1 = generateCacheKey('docs_validation', { files: ['a.js'] });
      const key2 = generateCacheKey('docs_validation', { files: ['b.js'] });

      expect(key1).not.toBe(key2);
    });

    test('generates different keys for different analysis types', () => {
      const inputs = { files: ['test.js'] };
      const key1 = generateCacheKey('docs_validation', inputs);
      const key2 = generateCacheKey('tech_stack', inputs);

      expect(key1).not.toBe(key2);
    });

    test('handles invalid inputs', () => {
      expect(generateCacheKey(null, {})).toBe('invalid_cache_key');
      expect(generateCacheKey('', {})).toBe('invalid_cache_key');
    });
  });

  describe('isCacheValid', () => {
    test('validates valid entry', () => {
      const entry = { timestamp: 1000, data: 'test' };
      expect(isCacheValid(entry, 3600, 2000)).toBe(true);
    });

    test('invalidates expired entry', () => {
      const entry = { timestamp: 1000, data: 'test' };
      expect(isCacheValid(entry, 3600, 5000)).toBe(false);
    });

    test('handles edge case at TTL boundary', () => {
      const entry = { timestamp: 1000, data: 'test' };
      expect(isCacheValid(entry, 3600, 4599)).toBe(true); // 1 second before expiry
      expect(isCacheValid(entry, 3600, 4600)).toBe(false); // exactly at expiry
    });

    test('handles invalid entry', () => {
      expect(isCacheValid(null, 3600, 2000)).toBe(false);
      expect(isCacheValid({}, 3600, 2000)).toBe(false);
      expect(isCacheValid({ timestamp: 'invalid' }, 3600, 2000)).toBe(false);
    });

    test('handles invalid TTL', () => {
      const entry = { timestamp: 1000 };
      expect(isCacheValid(entry, 0, 2000)).toBe(false);
      expect(isCacheValid(entry, -100, 2000)).toBe(false);
      expect(isCacheValid(entry, 'invalid', 2000)).toBe(false);
    });

    test('handles invalid current time', () => {
      const entry = { timestamp: 1000 };
      expect(isCacheValid(entry, 3600, -1)).toBe(false);
      expect(isCacheValid(entry, 3600, 'invalid')).toBe(false);
    });
  });

  describe('shouldInvalidate', () => {
    test('invalidates on force reasons', () => {
      const forceReasons = ['file_changed', 'config_changed'];
      expect(shouldInvalidate('file_changed', forceReasons)).toBe(true);
      expect(shouldInvalidate('config_changed', forceReasons)).toBe(true);
    });

    test('does not invalidate on non-force reasons', () => {
      const forceReasons = ['file_changed', 'config_changed'];
      expect(shouldInvalidate('ttl_expired', forceReasons)).toBe(false);
      expect(shouldInvalidate('cache_full', forceReasons)).toBe(false);
    });

    test('handles empty force reasons', () => {
      expect(shouldInvalidate('file_changed', [])).toBe(false);
    });

    test('handles invalid inputs', () => {
      expect(shouldInvalidate(null, ['file_changed'])).toBe(false);
      expect(shouldInvalidate('', ['file_changed'])).toBe(false);
    });
  });

  describe('calculateCacheStats', () => {
    test('calculates stats for valid cache', () => {
      const entries = new Map([
        ['key1', { timestamp: 1000, size: 100, hits: 5, misses: 1 }],
        ['key2', { timestamp: 2000, size: 200, hits: 3, misses: 2 }],
        ['key3', { timestamp: 5000, size: 150, hits: 0, misses: 0 }], // expired
      ]);

      const stats = calculateCacheStats(entries, 3000, 3600);

      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(2);
      expect(stats.expired).toBe(1);
      expect(stats.hits).toBe(8);
      expect(stats.misses).toBe(3);
      expect(stats.hitRate).toBe(0.73); // 8/11 rounded to 2 decimals
      expect(stats.totalSize).toBe(450);
    });

    test('handles empty cache', () => {
      const stats = calculateCacheStats(new Map(), 1000, 3600);

      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    test('handles invalid input', () => {
      const stats = calculateCacheStats(null, 1000, 3600);
      expect(stats.total).toBe(0);
    });
  });

  describe('selectEntriesForEviction', () => {
    test('selects oldest entries for eviction', () => {
      const entries = new Map([
        ['key1', { timestamp: 1000, lastAccess: 1000 }],
        ['key2', { timestamp: 2000, lastAccess: 2000 }],
        ['key3', { timestamp: 3000, lastAccess: 3500 }],
      ]);

      const toEvict = selectEntriesForEviction(entries, 2);

      expect(toEvict).toHaveLength(1);
      expect(toEvict[0]).toBe('key1'); // oldest access
    });

    test('returns empty array when under target', () => {
      const entries = new Map([['key1', { timestamp: 1000 }]]);
      const toEvict = selectEntriesForEviction(entries, 5);

      expect(toEvict).toHaveLength(0);
    });

    test('sorts by lastAccess when available', () => {
      const entries = new Map([
        ['key1', { timestamp: 1000, lastAccess: 3000 }], // accessed recently
        ['key2', { timestamp: 2000, lastAccess: 1500 }], // accessed long ago
      ]);

      const toEvict = selectEntriesForEviction(entries, 1);
      expect(toEvict[0]).toBe('key2'); // least recently accessed
    });

    test('handles invalid input', () => {
      expect(selectEntriesForEviction(null, 5)).toEqual([]);
      expect(selectEntriesForEviction('invalid', 5)).toEqual([]);
    });
  });

  describe('estimateCacheSize', () => {
    test('estimates size of simple object', () => {
      const data = { result: 'test', count: 42 };
      const size = estimateCacheSize(data);

      expect(size).toBeGreaterThan(0);
      expect(size).toBe(Buffer.byteLength(JSON.stringify(data), 'utf8'));
    });

    test('estimates size of complex object', () => {
      const data = {
        files: ['a.js', 'b.js', 'c.js'],
        results: { errors: [], warnings: ['test'] },
      };
      const size = estimateCacheSize(data);

      expect(size).toBeGreaterThan(50);
    });

    test('handles null and undefined', () => {
      expect(estimateCacheSize(null)).toBe(0);
      expect(estimateCacheSize(undefined)).toBe(0);
    });
  });

  describe('createCacheEntry', () => {
    test('creates entry with metadata', () => {
      const data = { result: 'test' };
      const entry = createCacheEntry(data, 1000);

      expect(entry.data).toBe(data);
      expect(entry.timestamp).toBe(1000);
      expect(entry.lastAccess).toBe(1000);
      expect(entry.size).toBeGreaterThan(0);
      expect(entry.hits).toBe(0);
      expect(entry.misses).toBe(0);
    });
  });

  describe('updateCacheEntry', () => {
    test('updates on cache hit', () => {
      const entry = { timestamp: 1000, lastAccess: 1000, hits: 5, misses: 2 };
      const updated = updateCacheEntry(entry, 2000, true);

      expect(updated.lastAccess).toBe(2000);
      expect(updated.hits).toBe(6);
      expect(updated.misses).toBe(2);
    });

    test('updates on cache miss', () => {
      const entry = { timestamp: 1000, lastAccess: 1000, hits: 5, misses: 2 };
      const updated = updateCacheEntry(entry, 2000, false);

      expect(updated.lastAccess).toBe(2000);
      expect(updated.hits).toBe(5);
      expect(updated.misses).toBe(3);
    });
  });
});

describe('Analysis Cache Module - AnalysisCache Class', () => {
  let cache;

  beforeEach(() => {
    cache = new AnalysisCache();
  });

  afterEach(() => {
    cache.clear();
  });

  describe('constructor', () => {
    test('initializes with default config', () => {
      expect(cache.config.TTL_SECONDS).toBe(3600);
      expect(cache.config.MAX_ENTRIES).toBe(1000);
      expect(cache.enabled).toBe(true);
    });

    test('accepts custom config', () => {
      const customCache = new AnalysisCache({ TTL_SECONDS: 7200 });
      expect(customCache.config.TTL_SECONDS).toBe(7200);
      expect(customCache.config.MAX_ENTRIES).toBe(1000); // default
    });
  });

  describe('enable / disable', () => {
    test('enables cache', () => {
      cache.disable();
      cache.enable();

      cache.set('test', { file: 'test.js' }, { result: 'ok' });
      const result = cache.get('test', { file: 'test.js' });

      expect(result).toEqual({ result: 'ok' });
    });

    test('disables cache', () => {
      cache.set('test', { file: 'test.js' }, { result: 'ok' });
      cache.disable();

      const result = cache.get('test', { file: 'test.js' });
      expect(result).toBeNull();
    });
  });

  describe('get / set', () => {
    test('caches and retrieves result', () => {
      const inputs = { files: ['test.js'] };
      const data = { result: 'validated', errors: [] };

      cache.set('docs_validation', inputs, data);
      const cached = cache.get('docs_validation', inputs);

      expect(cached).toEqual(data);
    });

    test('returns null for cache miss', () => {
      const result = cache.get('unknown', { files: ['test.js'] });
      expect(result).toBeNull();
    });

    test('returns null for expired entry', async () => {
      const shortTtlCache = new AnalysisCache({ TTL_SECONDS: 1 });

      shortTtlCache.set('test', { file: 'test.js' }, { result: 'ok' });

      // Manually expire by manipulating the entry timestamp
      const key = generateCacheKey('test', { file: 'test.js' });
      const entry = shortTtlCache.cache.get(key);
      if (entry) {
        entry.timestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
        shortTtlCache.cache.set(key, entry);
      }

      const result = shortTtlCache.get('test', { file: 'test.js' });
      expect(result).toBeNull();
    });

    test('updates access stats on hit', () => {
      cache.set('test', { file: 'test.js' }, { result: 'ok' });

      cache.get('test', { file: 'test.js' });
      cache.get('test', { file: 'test.js' });

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });
  });

  describe('invalidate', () => {
    test('invalidates entry on file change', () => {
      const inputs = { files: ['test.js'] };
      cache.set('test', inputs, { result: 'ok' });

      const invalidated = cache.invalidate('test', inputs, INVALIDATION_REASONS.FILE_CHANGED);

      expect(invalidated).toBe(true);
      expect(cache.get('test', inputs)).toBeNull();
    });

    test('does not invalidate on non-force reason', () => {
      const inputs = { files: ['test.js'] };
      cache.set('test', inputs, { result: 'ok' });

      const invalidated = cache.invalidate('test', inputs, INVALIDATION_REASONS.TTL_EXPIRED);

      expect(invalidated).toBe(false);
      expect(cache.get('test', inputs)).toEqual({ result: 'ok' });
    });
  });

  describe('clear', () => {
    test('clears all entries', () => {
      cache.set('test1', { file: 'a.js' }, { result: 'ok' });
      cache.set('test2', { file: 'b.js' }, { result: 'ok' });

      cache.clear();

      expect(cache.getStats().total).toBe(0);
    });
  });

  describe('evictOldest', () => {
    test('evicts oldest entries when cache is full', () => {
      const smallCache = new AnalysisCache({ MAX_ENTRIES: 3 });

      // Add 4 entries (triggers eviction)
      smallCache.set('test1', { n: 1 }, { result: 'ok' });
      smallCache.set('test2', { n: 2 }, { result: 'ok' });
      smallCache.set('test3', { n: 3 }, { result: 'ok' });
      smallCache.set('test4', { n: 4 }, { result: 'ok' });

      const stats = smallCache.getStats();
      expect(stats.total).toBeLessThanOrEqual(3);
    });

    test('evicts specified number of entries', () => {
      cache.set('test1', { n: 1 }, { result: 'ok' });
      cache.set('test2', { n: 2 }, { result: 'ok' });
      cache.set('test3', { n: 3 }, { result: 'ok' });

      const evicted = cache.evictOldest(2);

      expect(evicted).toBe(1);
      expect(cache.getStats().total).toBe(2);
    });
  });

  describe('cleanExpired', () => {
    test('removes expired entries', () => {
      const shortTtlCache = new AnalysisCache({ TTL_SECONDS: 3600 });

      shortTtlCache.set('test1', { n: 1 }, { result: 'ok' });
      shortTtlCache.set('test2', { n: 2 }, { result: 'ok' });
      shortTtlCache.set('test3', { n: 3 }, { result: 'ok' });

      // Manually expire test1 and test2 by setting old timestamps
      const currentTime = Math.floor(Date.now() / 1000);
      for (const [key, entry] of shortTtlCache.cache) {
        if (key.includes('test1') || key.includes('test2')) {
          entry.timestamp = currentTime - 7200; // 2 hours ago
        }
      }

      const removed = shortTtlCache.cleanExpired();

      expect(removed).toBe(2); // test1 and test2 expired
      expect(shortTtlCache.getStats().total).toBe(1); // only test3 remains
    });
  });

  describe('getStats', () => {
    test('returns cache statistics', () => {
      cache.set('test1', { n: 1 }, { result: 'ok' });
      cache.set('test2', { n: 2 }, { result: 'ok' });

      cache.get('test1', { n: 1 });
      cache.get('test1', { n: 1 });
      cache.get('unknown', { n: 99 });

      const stats = cache.getStats();

      expect(stats.total).toBe(2);
      expect(stats.valid).toBe(2);
      expect(stats.expired).toBe(0);
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('exportToFile / importFromFile', () => {
    const testDir = path.join(process.cwd(), '.test-tmp');
    const testFile = path.join(testDir, 'analysis-cache-test.json');

    beforeAll(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    afterEach(async () => {
      try {
        await fs.unlink(testFile);
      } catch {
        // Ignore if file doesn't exist
      }
    });

    test('exports cache to file', async () => {
      cache.set('test', { file: 'test.js' }, { result: 'ok' });

      await cache.exportToFile(testFile);

      const content = await fs.readFile(testFile, 'utf8');
      const data = JSON.parse(content);

      expect(data.timestamp).toBeGreaterThan(0);
      expect(data.config).toBeDefined();
      expect(Object.keys(data.entries).length).toBeGreaterThan(0);
    });

    test('imports cache from file', async () => {
      cache.set('test', { file: 'test.js' }, { result: 'ok' });
      await cache.exportToFile(testFile);

      const newCache = new AnalysisCache();
      await newCache.importFromFile(testFile);

      expect(newCache.getStats().total).toBe(1);
    });

    test('handles invalid file path on export', async () => {
      await expect(cache.exportToFile('')).rejects.toThrow();
    });

    test('handles invalid file path on import', async () => {
      await expect(cache.importFromFile('/nonexistent/file.json')).rejects.toThrow();
    });

    test('handles invalid JSON on import', async () => {
      await fs.writeFile(testFile, 'invalid json');
      await expect(cache.importFromFile(testFile)).rejects.toThrow();
    });
  });
});

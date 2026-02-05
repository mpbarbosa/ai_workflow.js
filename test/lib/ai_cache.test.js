/**
 * Tests for AI Cache Module
 *
 * @jest-environment node
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  generateCacheKey,
  isCacheValid,
  shouldInvalidateCache,
  calculateCacheStats,
  filterEntriesByAge,
  createCacheEntry,
  mergeCacheMetrics,
  validateCacheConfig,
  AiCache,
} from '../../src/lib/ai_cache.js';

describe('AI Cache Module - Pure Functions', () => {
  describe('generateCacheKey', () => {
    test('generates consistent keys for same input', () => {
      const key1 = generateCacheKey('test prompt', 'context1');
      const key2 = generateCacheKey('test prompt', 'context1');

      expect(key1).toBe(key2);
    });

    test('generates different keys for different prompts', () => {
      const key1 = generateCacheKey('prompt1', 'context');
      const key2 = generateCacheKey('prompt2', 'context');

      expect(key1).not.toBe(key2);
    });

    test('generates different keys for different contexts', () => {
      const key1 = generateCacheKey('prompt', 'context1');
      const key2 = generateCacheKey('prompt', 'context2');

      expect(key1).not.toBe(key2);
    });

    test('handles empty context', () => {
      const key = generateCacheKey('test prompt');

      expect(key).toBeDefined();
      expect(key.length).toBe(64); // SHA256 hex length
    });

    test('returns 64-character hex string', () => {
      const key = generateCacheKey('test', 'context');

      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('isCacheValid', () => {
    test('returns true for cache within TTL', () => {
      const entry = { timestampEpoch: 1000 };
      const currentTime = 2000;
      const ttl = 2000;

      expect(isCacheValid(entry, ttl, currentTime)).toBe(true);
    });

    test('returns false for expired cache', () => {
      const entry = { timestampEpoch: 1000 };
      const currentTime = 4000;
      const ttl = 2000;

      expect(isCacheValid(entry, ttl, currentTime)).toBe(false);
    });

    test('returns false for entry without timestamp', () => {
      const entry = {};
      const currentTime = 2000;
      const ttl = 2000;

      expect(isCacheValid(entry, ttl, currentTime)).toBe(false);
    });

    test('returns false for null entry', () => {
      expect(isCacheValid(null, 2000, 2000)).toBe(false);
    });

    test('handles exact TTL boundary', () => {
      const entry = { timestampEpoch: 1000 };
      const currentTime = 3000;
      const ttl = 2000;

      expect(isCacheValid(entry, ttl, currentTime)).toBe(true);
    });

    test('returns false for negative age', () => {
      const entry = { timestampEpoch: 3000 };
      const currentTime = 2000;
      const ttl = 2000;

      expect(isCacheValid(entry, ttl, currentTime)).toBe(false);
    });
  });

  describe('shouldInvalidateCache', () => {
    test('returns true for config_changed', () => {
      expect(shouldInvalidateCache('config_changed')).toBe(true);
    });

    test('returns true for manual_clear', () => {
      expect(shouldInvalidateCache('manual_clear')).toBe(true);
    });

    test('returns true for version_bump', () => {
      expect(shouldInvalidateCache('version_bump')).toBe(true);
    });

    test('returns false for non-force reason', () => {
      expect(shouldInvalidateCache('routine_check')).toBe(false);
    });

    test('accepts custom force reasons', () => {
      const result = shouldInvalidateCache('custom_reason', {
        forceReasons: ['custom_reason'],
      });

      expect(result).toBe(true);
    });
  });

  describe('calculateCacheStats', () => {
    test('calculates stats for valid entries', () => {
      const entries = [
        { timestampEpoch: 1000, responseSize: 100 },
        { timestampEpoch: 1500, responseSize: 200 },
        { timestampEpoch: 2000, responseSize: 300 },
      ];
      const currentTime = 2500;
      const ttl = 1000;

      const stats = calculateCacheStats(entries, currentTime, ttl);

      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(2); // Last two within TTL (1500 and 2000)
      expect(stats.expired).toBe(1); // First one expired (1000)
      expect(stats.totalSize).toBe(600);
    });

    test('handles empty entries', () => {
      const stats = calculateCacheStats([], 2000, 1000);

      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.expired).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    test('handles entries without responseSize', () => {
      const entries = [{ timestampEpoch: 2000 }, { timestampEpoch: 2500 }];
      const stats = calculateCacheStats(entries, 3000, 1000);

      expect(stats.totalSize).toBe(0);
    });
  });

  describe('filterEntriesByAge', () => {
    test('filters entries older than maxAge', () => {
      const entries = [
        { timestampEpoch: 1000 },
        { timestampEpoch: 2000 },
        { timestampEpoch: 3000 },
      ];
      const currentTime = 4000;
      const maxAge = 1500;

      const old = filterEntriesByAge(entries, maxAge, currentTime);

      expect(old).toHaveLength(2); // First two are older than 1500s
    });

    test('returns empty for entries within maxAge', () => {
      const entries = [{ timestampEpoch: 3500 }, { timestampEpoch: 3800 }];
      const currentTime = 4000;
      const maxAge = 1000;

      const old = filterEntriesByAge(entries, maxAge, currentTime);

      expect(old).toHaveLength(0);
    });

    test('handles entries without timestamp', () => {
      const entries = [{ timestampEpoch: 1000 }, {}, { timestampEpoch: 2000 }];
      const currentTime = 4000;
      const maxAge = 1500;

      const old = filterEntriesByAge(entries, maxAge, currentTime);

      expect(old).toHaveLength(2); // Skips entry without timestamp
    });
  });

  describe('createCacheEntry', () => {
    test('creates cache entry with all fields', () => {
      const entry = createCacheEntry('abc123', 'test prompt', 'context', 1024, 1704067200);

      expect(entry.cacheKey).toBe('abc123');
      expect(entry.promptPreview).toBe('test prompt');
      expect(entry.context).toBe('context');
      expect(entry.responseSize).toBe(1024);
      expect(entry.timestampEpoch).toBe(1704067200);
      expect(entry.timestamp).toContain('2024-01-01');
    });

    test('truncates long prompts', () => {
      const longPrompt = 'a'.repeat(150);
      const entry = createCacheEntry('key', longPrompt, '', 100, 1000);

      expect(entry.promptPreview).toHaveLength(103); // 100 + '...'
      expect(entry.promptPreview.endsWith('...')).toBe(true);
    });

    test('includes additional metadata', () => {
      const entry = createCacheEntry('key', 'prompt', 'context', 100, 1000, {
        workflowId: 'wf123',
        version: '1.0',
      });

      expect(entry.workflowId).toBe('wf123');
      expect(entry.version).toBe('1.0');
    });
  });

  describe('mergeCacheMetrics', () => {
    test('merges metrics correctly', () => {
      const metrics1 = { hits: 5, misses: 2, tokensSaved: 1000 };
      const metrics2 = { hits: 3, misses: 1, tokensSaved: 500 };

      const merged = mergeCacheMetrics(metrics1, metrics2);

      expect(merged.hits).toBe(8);
      expect(merged.misses).toBe(3);
      expect(merged.total).toBe(11);
      expect(merged.hitRate).toBeCloseTo(72.7, 1);
      expect(merged.tokensSaved).toBe(1500);
    });

    test('handles missing fields', () => {
      const metrics1 = { hits: 5 };
      const metrics2 = { misses: 2 };

      const merged = mergeCacheMetrics(metrics1, metrics2);

      expect(merged.hits).toBe(5);
      expect(merged.misses).toBe(2);
    });

    test('calculates hitRate correctly', () => {
      const merged = mergeCacheMetrics({ hits: 7, misses: 3 }, { hits: 0, misses: 0 });

      expect(merged.hitRate).toBe(70.0);
    });

    test('handles zero total', () => {
      const merged = mergeCacheMetrics({}, {});

      expect(merged.hitRate).toBe(0);
    });
  });

  describe('validateCacheConfig', () => {
    test('validates valid configuration', () => {
      const config = {
        cacheDir: '/tmp/.cache',
        ttl: 86400,
        maxSizeMB: 100,
      };

      const result = validateCacheConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects invalid cacheDir', () => {
      const config = {
        cacheDir: '',
        ttl: 86400,
        maxSizeMB: 100,
      };

      const result = validateCacheConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cacheDir must be a non-empty string');
    });

    test('detects invalid ttl', () => {
      const config = {
        cacheDir: '/tmp/.cache',
        ttl: -1,
        maxSizeMB: 100,
      };

      const result = validateCacheConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ttl must be a positive number');
    });

    test('detects invalid maxSizeMB', () => {
      const config = {
        cacheDir: '/tmp/.cache',
        ttl: 86400,
        maxSizeMB: 0,
      };

      const result = validateCacheConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxSizeMB must be a positive number');
    });

    test('detects multiple errors', () => {
      const config = {
        cacheDir: null,
        ttl: -1,
        maxSizeMB: -1,
      };

      const result = validateCacheConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('AI Cache Module - Integration Tests', () => {
  let cacheDir;
  let cache;

  beforeEach(async () => {
    // Create temporary cache directory
    cacheDir = path.join(os.tmpdir(), `ai-cache-test-${Date.now()}`);
    cache = new AiCache({
      cacheDir,
      ttl: 10, // 10 seconds for testing
      maxSizeMB: 10,
    });
    await cache.init();
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(cacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('AiCache initialization', () => {
    test('creates cache directory', async () => {
      const stat = await fs.stat(cacheDir);
      expect(stat.isDirectory()).toBe(true);
    });

    test('creates index file', async () => {
      const indexFile = path.join(cacheDir, 'index.json');
      const stat = await fs.stat(indexFile);
      expect(stat.isFile()).toBe(true);
    });

    test('index file has valid JSON', async () => {
      const indexFile = path.join(cacheDir, 'index.json');
      const data = await fs.readFile(indexFile, 'utf8');
      const index = JSON.parse(data);

      expect(index.version).toBe('1.0.0');
      expect(index.entries).toEqual([]);
    });

    test('throws error for invalid configuration', async () => {
      const badCache = new AiCache({
        cacheDir: '',
        ttl: -1,
        maxSizeMB: -1,
      });

      await expect(badCache.init()).rejects.toThrow();
    });
  });

  describe('Cache operations', () => {
    test('has() returns false for non-existent key', async () => {
      const has = await cache.has('nonexistent');
      expect(has).toBe(false);
    });

    test('get() returns null for non-existent key', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    test('set() and get() round-trip', async () => {
      const key = 'testkey';
      const response = 'test response';

      await cache.set(key, response);
      const retrieved = await cache.get(key);

      expect(retrieved).toBe(response);
    });

    test('has() returns true after set()', async () => {
      const key = 'testkey2';
      await cache.set(key, 'content');

      const has = await cache.has(key);
      expect(has).toBe(true);
    });

    test('set() with metadata', async () => {
      const key = 'testkey3';
      await cache.set(key, 'response', {
        prompt: 'test prompt',
        context: 'test context',
      });

      const metaFile = path.join(cacheDir, `${key}.meta`);
      const metaData = await fs.readFile(metaFile, 'utf8');
      const meta = JSON.parse(metaData);

      expect(meta.cacheKey).toBe(key);
      expect(meta.promptPreview).toBe('test prompt');
      expect(meta.context).toBe('test context');
    });

    test('delete() removes cache entry', async () => {
      const key = 'testkey4';
      await cache.set(key, 'content');

      const deleted = await cache.delete(key);
      expect(deleted).toBe(true);

      const has = await cache.has(key);
      expect(has).toBe(false);
    });
  });

  describe('withCache wrapper', () => {
    test('calls function on cache miss', async () => {
      let called = false;
      const aiFunction = async () => {
        called = true;
        return 'AI response';
      };

      const result = await cache.withCache('prompt', 'context', aiFunction);

      expect(called).toBe(true);
      expect(result).toBe('AI response');
    });

    test('returns cached response on cache hit', async () => {
      let callCount = 0;
      const aiFunction = async () => {
        callCount++;
        return 'AI response';
      };

      // First call - cache miss
      await cache.withCache('prompt', 'context', aiFunction);

      // Second call - cache hit
      const result = await cache.withCache('prompt', 'context', aiFunction);

      expect(callCount).toBe(1); // Only called once
      expect(result).toBe('AI response');
    });

    test('caches response after function call', async () => {
      const aiFunction = async () => 'response';

      await cache.withCache('prompt', 'context', aiFunction);

      const key = generateCacheKey('prompt', 'context');
      const has = await cache.has(key);

      expect(has).toBe(true);
    });
  });

  describe('Cache expiration', () => {
    test('expired entries are not returned via get()', async () => {
      // Create cache with 1-second TTL
      const shortCache = new AiCache({
        cacheDir: path.join(os.tmpdir(), `ai-cache-short-${Date.now()}`),
        ttl: 1,
      });
      await shortCache.init();

      try {
        const key = 'expiring';
        await shortCache.set(key, 'content');

        // Wait for expiration (1.5 seconds to ensure >1 second has passed in epoch time)
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Use get() - should return null for expired cache
        const result = await shortCache.get(key);
        expect(result).toBeNull();
      } finally {
        await fs.rm(shortCache.cacheDir, { recursive: true, force: true });
      }
    }, 3000); // Increase timeout to 3 seconds

    test('cleanupExpired removes expired entries', async () => {
      // Create entry with manipulated timestamp
      const key = 'old';
      await cache.set(key, 'content');

      // Manually modify meta to be expired
      const metaFile = path.join(cacheDir, `${key}.meta`);
      const metaData = await fs.readFile(metaFile, 'utf8');
      const meta = JSON.parse(metaData);
      meta.timestampEpoch = Math.floor(Date.now() / 1000) - 20; // 20 seconds ago
      await fs.writeFile(metaFile, JSON.stringify(meta, null, 2));

      const deleted = await cache.cleanupExpired();

      expect(deleted).toBeGreaterThan(0);

      const has = await cache.has(key);
      expect(has).toBe(false);
    });
  });

  describe('Cache statistics', () => {
    test('getStats returns statistics', async () => {
      await cache.set('key1', 'response1');
      await cache.set('key2', 'response2');

      const stats = await cache.getStats();

      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.location).toBe(cacheDir);
    });

    test('tracks hits and misses', async () => {
      // Miss
      await cache.get('nonexistent');

      // Hit
      await cache.set('key', 'value');
      await cache.get('key');

      expect(cache.metrics.hits).toBe(1);
      expect(cache.metrics.misses).toBe(1);
    });

    test('calculates hit rate', async () => {
      await cache.set('key', 'value');
      await cache.get('key'); // Hit
      await cache.get('nonexistent'); // Miss

      const stats = await cache.getStats();

      expect(stats.runtimeMetrics.hitRate).toBeCloseTo(50.0, 1);
    });
  });

  describe('Cache clearing', () => {
    test('clear removes all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      const has1 = await cache.has('key1');
      const has2 = await cache.has('key2');

      expect(has1).toBe(false);
      expect(has2).toBe(false);
    });

    test('clear recreates index', async () => {
      await cache.clear();

      const indexFile = path.join(cacheDir, 'index.json');
      const data = await fs.readFile(indexFile, 'utf8');
      const index = JSON.parse(data);

      expect(index.entries).toEqual([]);
    });
  });

  describe('Disabled cache', () => {
    test('disabled cache does not store', async () => {
      const disabledCache = new AiCache({
        cacheDir: path.join(os.tmpdir(), `ai-cache-disabled-${Date.now()}`),
        enabled: false,
      });

      await disabledCache.init();
      await disabledCache.set('key', 'value');

      const has = await disabledCache.has('key');
      expect(has).toBe(false);
    });

    test('disabled cache always returns null', async () => {
      const disabledCache = new AiCache({ enabled: false });

      const result = await disabledCache.get('key');
      expect(result).toBeNull();
    });
  });
});

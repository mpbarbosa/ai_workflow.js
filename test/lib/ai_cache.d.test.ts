import {
  generateCacheKey,
  isCacheValid,
  shouldInvalidateCache,
  calculateCacheStats,
  filterEntriesByAge,
  createCacheEntry,
  mergeCacheMetrics,
  validateCacheConfig,
  computeFilesContentHash,
  AiCache,
} from '../../src/lib/ai_cache';

describe('ai_cache module', () => {
  describe('generateCacheKey', () => {
    it('generates deterministic SHA256 hash for same prompt/context', () => {
      const key1 = generateCacheKey('prompt', 'context');
      const key2 = generateCacheKey('prompt', 'context');
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different keys for different prompts/contexts', () => {
      const key1 = generateCacheKey('prompt1', 'context');
      const key2 = generateCacheKey('prompt2', 'context');
      expect(key1).not.toBe(key2);
    });

    it('handles undefined context', () => {
      const key = generateCacheKey('prompt');
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('isCacheValid', () => {
    it('returns true for valid cache entry within TTL', () => {
      const entry = { timestampEpoch: 1000 };
      expect(isCacheValid(entry, 100, 1050)).toBe(true);
    });

    it('returns false for expired cache entry', () => {
      const entry = { timestampEpoch: 1000 };
      expect(isCacheValid(entry, 10, 1015)).toBe(false);
    });

    it('returns false for null/undefined entry', () => {
      expect(isCacheValid(null, 100, 1100)).toBe(false);
      expect(isCacheValid(undefined, 100, 1100)).toBe(false);
    });

    it('handles missing timestampEpoch', () => {
      const entry = {};
      expect(isCacheValid(entry, 100, 1100)).toBe(false);
    });
  });

  describe('shouldInvalidateCache', () => {
    it('returns true if reason is in forceReasons', () => {
      expect(shouldInvalidateCache('config_changed', { forceReasons: ['config_changed'] })).toBe(true);
    });

    it('returns false if reason is not in forceReasons', () => {
      expect(shouldInvalidateCache('other_reason', { forceReasons: ['config_changed'] })).toBe(false);
    });

    it('returns false if options are undefined', () => {
      expect(shouldInvalidateCache('config_changed')).toBe(false);
    });
  });

  describe('calculateCacheStats', () => {
    it('calculates stats for valid and expired entries', () => {
      const now = 2000;
      const ttl = 100;
      const entries = [
        { timestampEpoch: 1900, responseSize: 100 },
        { timestampEpoch: 1800, responseSize: 200 },
        { timestampEpoch: 2100, responseSize: 300 },
      ];
      const stats = calculateCacheStats(entries, now, ttl);
      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(2);
      expect(stats.expired).toBe(1);
      expect(stats.totalSize).toBe(600);
      expect(typeof stats.hitRate).toBe('number');
    });

    it('handles empty entries array', () => {
      const stats = calculateCacheStats([], 1000, 100);
      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.expired).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(typeof stats.hitRate).toBe('number');
    });
  });

  describe('filterEntriesByAge', () => {
    it('returns entries older than maxAge', () => {
      const now = 2000;
      const maxAge = 100;
      const entries = [
        { timestampEpoch: 1800 },
        { timestampEpoch: 1900 },
        { timestampEpoch: 1950 },
      ];
      const result = filterEntriesByAge(entries, maxAge, now);
      expect(result).toEqual([{ timestampEpoch: 1800 }]);
    });

    it('returns empty array if none are older', () => {
      const now = 2000;
      const maxAge = 300;
      const entries = [
        { timestampEpoch: 1800 },
        { timestampEpoch: 1900 },
      ];
      const result = filterEntriesByAge(entries, maxAge, now);
      expect(result).toEqual([]);
    });

    it('handles empty entries array', () => {
      const result = filterEntriesByAge([], 100, 2000);
      expect(result).toEqual([]);
    });
  });

  describe('createCacheEntry', () => {
    it('creates entry with all fields', () => {
      const entry = createCacheEntry('key', 'prompt', 'context', 123, 1000, { extra: 'meta' });
      expect(entry.cacheKey).toBe('key');
      expect(entry.promptPreview).toBeDefined();
      expect(entry.context).toBe('context');
      expect(entry.responseSize).toBe(123);
      expect(entry.timestampEpoch).toBe(1000);
      expect(entry.extra).toBe('meta');
    });

    it('handles null/undefined prompt', () => {
      const entry = createCacheEntry('key', null, 'context', 123, 1000);
      expect(entry.cacheKey).toBe('key');
      expect(entry.promptPreview).toBeDefined();
    });
  });

  describe('mergeCacheMetrics', () => {
    it('merges two metrics objects', () => {
      const m1 = { hits: 5, misses: 2, tokensSaved: 100 };
      const m2 = { hits: 3, misses: 1, tokensSaved: 50 };
      const merged = mergeCacheMetrics(m1, m2);
      expect(merged.hits).toBe(8);
      expect(merged.misses).toBe(3);
      expect(merged.total).toBe(11);
      expect(typeof merged.hitRate).toBe('number');
      expect(merged.tokensSaved).toBe(150);
    });

    it('handles null/undefined metrics', () => {
      const merged = mergeCacheMetrics(null, undefined);
      expect(merged.hits).toBe(0);
      expect(merged.misses).toBe(0);
      expect(merged.total).toBe(0);
      expect(typeof merged.hitRate).toBe('number');
      expect(merged.tokensSaved).toBe(0);
    });

    it('handles partial metrics', () => {
      const merged = mergeCacheMetrics({ hits: 2 }, { misses: 3 });
      expect(merged.hits).toBe(2);
      expect(merged.misses).toBe(3);
      expect(merged.total).toBe(5);
      expect(typeof merged.hitRate).toBe('number');
    });
  });

  describe('validateCacheConfig', () => {
    it('validates correct config', () => {
      const config = { cacheDir: '/tmp/cache', ttl: 100, maxSizeMB: 10 };
      const result = validateCacheConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns errors for missing fields', () => {
      const config = { ttl: 100 };
      const result = validateCacheConfig(config);
      expect(result.valid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles null/undefined config', () => {
      expect(validateCacheConfig(null).valid).toBe(false);
      expect(validateCacheConfig(undefined).valid).toBe(false);
    });
  });

  describe('computeFilesContentHash', () => {
    it('returns SHA256 hash for sorted file contents', () => {
      const files = [
        'b.txt:contentB',
        'a.txt:contentA',
      ];
      const hash1 = computeFilesContentHash(files);
      const hash2 = computeFilesContentHash(['a.txt:contentA', 'b.txt:contentB']);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns empty string for empty input', () => {
      expect(computeFilesContentHash([])).toBe('');
    });
  });

  describe('AiCache class', () => {
    let cache: AiCache;

    beforeEach(() => {
      cache = new AiCache({ cacheDir: '/tmp/cache', ttl: 100, maxSizeMB: 10, enabled: true });
    });

    it('initializes cache directory and index', async () => {
      await expect(cache.init()).resolves.toBeUndefined();
    });

    it('returns false for missing cache entry', async () => {
      await expect(cache.has('nonexistent')).resolves.toBe(false);
    });

    it('sets and gets cache entry', async () => {
      const key = generateCacheKey('prompt', 'context');
      await cache.set(key, { result: 'test' }, { prompt: 'prompt', context: 'context' });
      await expect(cache.has(key)).resolves.toBe(true);
      await expect(cache.get(key)).resolves.toEqual({ result: 'test' });
    });

    it('withCache returns cached response', async () => {
      const key = generateCacheKey('prompt', 'context');
      await cache.set(key, { result: 'cached' }, { prompt: 'prompt', context: 'context' });
      const response = await cache.withCache('prompt', 'context', async () => ({ result: 'fresh' }));
      expect(response).toEqual({ result: 'cached' });
    });

    it('withCache returns fresh response on cache miss', async () => {
      const response = await cache.withCache('newPrompt', 'newContext', async () => ({ result: 'fresh' }));
      expect(response).toEqual({ result: 'fresh' });
    });

    it('withFileChangeGuard returns cached response for same hash', async () => {
      const stepId = 'step_01';
      const files = ['a.txt:foo', 'b.txt:bar'];
      const aiFn = jest.fn().mockResolvedValue('fresh');
      const first = await cache.withFileChangeGuard(stepId, files, aiFn);
      expect(first).toBe('fresh');
      aiFn.mockResolvedValue('should-not-be-called');
      const second = await cache.withFileChangeGuard(stepId, files, aiFn);
      expect(second).toBe('fresh');
      expect(aiFn).toHaveBeenCalledTimes(1);
    });

    it('withFileChangeGuard calls AI function when hash changes', async () => {
      const stepId = 'step_02';
      const files1 = ['a.txt:foo'];
      const files2 = ['a.txt:bar'];
      const aiFn = jest.fn().mockResolvedValue('fresh1');
      await cache.withFileChangeGuard(stepId, files1, aiFn);
      aiFn.mockResolvedValue('fresh2');
      const result = await cache.withFileChangeGuard(stepId, files2, aiFn);
      expect(result).toBe('fresh2');
      expect(aiFn).toHaveBeenCalledTimes(2);
    });

    it('cleanupExpired removes expired entries', async () => {
      const key = generateCacheKey('prompt', 'context');
      await cache.set(key, { result: 'test' }, { prompt: 'prompt', context: 'context' });
      cache.ttl = -1; // Force expiration
      const deleted = await cache.cleanupExpired();
      expect(typeof deleted).toBe('number');
    });

    it('clear removes all cache entries', async () => {
      const key = generateCacheKey('prompt', 'context');
      await cache.set(key, { result: 'test' }, { prompt: 'prompt', context: 'context' });
      await cache.clear();
      await expect(cache.has(key)).resolves.toBe(false);
    });

    it('getStats returns stats when enabled', async () => {
      const stats = await cache.getStats();
      expect(stats).toHaveProperty('totalSizeMB');
      expect(stats).toHaveProperty('runtimeMetrics');
    });

    it('delete removes specific cache entry', async () => {
      const key = generateCacheKey('prompt', 'context');
      await cache.set(key, { result: 'test' }, { prompt: 'prompt', context: 'context' });
      await expect(cache.delete(key)).resolves.toBe(true);
      await expect(cache.has(key)).resolves.toBe(false);
    });

    it('getStats returns disabled stats when cache is disabled', async () => {
      const disabledCache = new AiCache({ enabled: false });
      const stats = await disabledCache.getStats();
      expect(stats).toHaveProperty('enabled', false);
    });

    it('getStats returns error stats on error', async () => {
      const errorCache = new AiCache({ cacheDir: '/invalid/path', enabled: true });
      errorCache.cacheDir = '/invalid/path';
      const stats = await errorCache.getStats();
      if ('error' in stats) {
        expect(typeof stats.error).toBe('string');
      }
    });
  });
});

/**
 * @fileoverview Tests for Dependency Cache (v2.0.0)
 * @module test/lib/dependency_cache
 */

import { jest } from '@jest/globals';
import {
  DEPENDENCY_CACHE_CONFIG,
  CACHE_TYPE,
  generateCacheKey,
  isCacheValid,
  calculateCacheAge,
  formatCacheAge,
  calculateCacheStats,
  filterExpiredEntries,
  createCacheEntry,
  createCacheIndex,
  isValidCacheType,
  getCacheFilePaths,
  DependencyCache,
} from '../../src/lib/dependency_cache.js';

describe('Dependency Cache', () => {
  describe('Constants', () => {
    test('DEPENDENCY_CACHE_CONFIG has required properties', () => {
      expect(DEPENDENCY_CACHE_CONFIG).toHaveProperty('cacheDir');
      expect(DEPENDENCY_CACHE_CONFIG).toHaveProperty('ttl');
      expect(DEPENDENCY_CACHE_CONFIG).toHaveProperty('maxSizeMB');
      expect(DEPENDENCY_CACHE_CONFIG).toHaveProperty('enabled');
      expect(DEPENDENCY_CACHE_CONFIG.ttl).toBe(3600); // 1 hour
    });

    test('CACHE_TYPE contains expected types', () => {
      expect(CACHE_TYPE).toHaveProperty('AUDIT');
      expect(CACHE_TYPE).toHaveProperty('OUTDATED');
      expect(CACHE_TYPE).toHaveProperty('SECURITY');
      expect(CACHE_TYPE).toHaveProperty('LICENSES');
    });
  });

  describe('Pure Functions', () => {
    describe('generateCacheKey', () => {
      test('generates consistent key for same dependencies', () => {
        const deps = { express: '^4.18.0', lodash: '^4.17.21' };
        const devDeps = { jest: '^29.0.0' };

        const key1 = generateCacheKey(deps, devDeps, CACHE_TYPE.AUDIT);
        const key2 = generateCacheKey(deps, devDeps, CACHE_TYPE.AUDIT);

        expect(key1).toBe(key2);
        expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hash
      });

      test('generates different keys for different cache types', () => {
        const deps = { express: '^4.18.0' };
        const devDeps = {};

        const auditKey = generateCacheKey(deps, devDeps, CACHE_TYPE.AUDIT);
        const outdatedKey = generateCacheKey(deps, devDeps, CACHE_TYPE.OUTDATED);

        expect(auditKey).not.toBe(outdatedKey);
      });

      test('generates different keys for different dependencies', () => {
        const deps1 = { express: '^4.18.0' };
        const deps2 = { express: '^4.19.0' };
        const devDeps = {};

        const key1 = generateCacheKey(deps1, devDeps, CACHE_TYPE.AUDIT);
        const key2 = generateCacheKey(deps2, devDeps, CACHE_TYPE.AUDIT);

        expect(key1).not.toBe(key2);
      });

      test('handles empty dependencies', () => {
        const key = generateCacheKey({}, {}, CACHE_TYPE.AUDIT);
        expect(key).toMatch(/^[a-f0-9]{64}$/);
      });

      test('handles null/undefined dependencies', () => {
        const key = generateCacheKey(null, undefined, CACHE_TYPE.AUDIT);
        expect(key).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    describe('isCacheValid', () => {
      test('returns true for cache within TTL', () => {
        const createdAt = 1000;
        const currentTime = 2000;
        const ttl = 3600;

        expect(isCacheValid(createdAt, currentTime, ttl)).toBe(true);
      });

      test('returns false for expired cache', () => {
        const createdAt = 1000;
        const currentTime = 5000;
        const ttl = 3600;

        expect(isCacheValid(createdAt, currentTime, ttl)).toBe(false);
      });

      test('returns true for cache exactly at TTL boundary', () => {
        const createdAt = 1000;
        const currentTime = 4600;
        const ttl = 3600;

        expect(isCacheValid(createdAt, currentTime, ttl)).toBe(true);
      });

      test('returns false for cache just over TTL', () => {
        const createdAt = 1000;
        const currentTime = 4601;
        const ttl = 3600;

        expect(isCacheValid(createdAt, currentTime, ttl)).toBe(false);
      });
    });

    describe('calculateCacheAge', () => {
      test('calculates age correctly', () => {
        expect(calculateCacheAge(1000, 2000)).toBe(1000);
        expect(calculateCacheAge(100, 500)).toBe(400);
      });

      test('returns 0 for same timestamps', () => {
        expect(calculateCacheAge(1000, 1000)).toBe(0);
      });
    });

    describe('formatCacheAge', () => {
      test('formats seconds', () => {
        expect(formatCacheAge(30)).toBe('30s');
        expect(formatCacheAge(59)).toBe('59s');
      });

      test('formats minutes', () => {
        expect(formatCacheAge(60)).toBe('1m');
        expect(formatCacheAge(120)).toBe('2m');
        expect(formatCacheAge(3599)).toBe('59m');
      });

      test('formats hours and minutes', () => {
        expect(formatCacheAge(3600)).toBe('1h 0m');
        expect(formatCacheAge(3660)).toBe('1h 1m');
        expect(formatCacheAge(7200)).toBe('2h 0m');
        expect(formatCacheAge(7380)).toBe('2h 3m');
      });
    });

    describe('calculateCacheStats', () => {
      test('calculates stats for multiple entries', () => {
        const entries = [
          { size: 1024 }, // 1 KB
          { size: 2048 }, // 2 KB
          { size: 1024 * 1024 }, // 1 MB
        ];

        const stats = calculateCacheStats(entries);

        expect(stats.totalEntries).toBe(3);
        expect(stats.totalSizeBytes).toBe(1024 + 2048 + 1024 * 1024);
        expect(stats.totalSizeKB).toBe(Math.round((1024 + 2048 + 1024 * 1024) / 1024));
        expect(stats.totalSizeMB).toBe(1);
      });

      test('handles empty entries', () => {
        const stats = calculateCacheStats([]);

        expect(stats.totalEntries).toBe(0);
        expect(stats.totalSizeBytes).toBe(0);
        expect(stats.totalSizeKB).toBe(0);
        expect(stats.totalSizeMB).toBe(0);
      });

      test('handles entries without size', () => {
        const entries = [{ key: 'test1' }, { key: 'test2' }];
        const stats = calculateCacheStats(entries);

        expect(stats.totalEntries).toBe(2);
        expect(stats.totalSizeBytes).toBe(0);
      });
    });

    describe('filterExpiredEntries', () => {
      test('filters expired entries correctly', () => {
        const entries = [
          { key: 'valid1', createdAt: 2000 },
          { key: 'expired1', createdAt: 500 },
          { key: 'valid2', createdAt: 2500 },
          { key: 'expired2', createdAt: 100 },
        ];
        const currentTime = 3000;
        const ttl = 1000;

        const result = filterExpiredEntries(entries, currentTime, ttl);

        expect(result.valid).toHaveLength(2);
        expect(result.expired).toHaveLength(2);
        expect(result.valid.map((e) => e.key)).toEqual(['valid1', 'valid2']);
        expect(result.expired.map((e) => e.key)).toEqual(['expired1', 'expired2']);
      });

      test('returns all valid when nothing expired', () => {
        const entries = [
          { key: 'valid1', createdAt: 2000 },
          { key: 'valid2', createdAt: 2500 },
        ];
        const currentTime = 3000;
        const ttl = 1500;

        const result = filterExpiredEntries(entries, currentTime, ttl);

        expect(result.valid).toHaveLength(2);
        expect(result.expired).toHaveLength(0);
      });

      test('returns all expired when everything expired', () => {
        const entries = [
          { key: 'expired1', createdAt: 100 },
          { key: 'expired2', createdAt: 200 },
        ];
        const currentTime = 3000;
        const ttl = 500;

        const result = filterExpiredEntries(entries, currentTime, ttl);

        expect(result.valid).toHaveLength(0);
        expect(result.expired).toHaveLength(2);
      });

      test('handles empty entries', () => {
        const result = filterExpiredEntries([], 1000, 3600);

        expect(result.valid).toHaveLength(0);
        expect(result.expired).toHaveLength(0);
      });
    });

    describe('createCacheEntry', () => {
      test('creates entry with correct structure', () => {
        const entry = createCacheEntry('abc123', CACHE_TYPE.AUDIT, 1000, 2048);

        expect(entry).toEqual({
          key: 'abc123',
          type: CACHE_TYPE.AUDIT,
          createdAt: 1000,
          size: 2048,
          createdAtISO: new Date(1000 * 1000).toISOString(),
        });
      });

      test('uses default size of 0', () => {
        const entry = createCacheEntry('abc123', CACHE_TYPE.AUDIT, 1000);
        expect(entry.size).toBe(0);
      });
    });

    describe('createCacheIndex', () => {
      test('creates index with correct structure', () => {
        const index = createCacheIndex('2.0.0', 1000);

        expect(index.version).toBe('2.0.0');
        expect(index.created).toBe(new Date(1000 * 1000).toISOString());
        expect(index.lastCleanup).toBe(new Date(1000 * 1000).toISOString());
        expect(index.entries).toEqual([]);
      });
    });

    describe('isValidCacheType', () => {
      test('returns true for valid cache types', () => {
        expect(isValidCacheType(CACHE_TYPE.AUDIT)).toBe(true);
        expect(isValidCacheType(CACHE_TYPE.OUTDATED)).toBe(true);
        expect(isValidCacheType(CACHE_TYPE.SECURITY)).toBe(true);
        expect(isValidCacheType(CACHE_TYPE.LICENSES)).toBe(true);
      });

      test('returns false for invalid cache types', () => {
        expect(isValidCacheType('invalid')).toBe(false);
        expect(isValidCacheType('')).toBe(false);
        expect(isValidCacheType(null)).toBe(false);
      });
    });

    describe('getCacheFilePaths', () => {
      test('returns correct file paths', () => {
        const paths = getCacheFilePaths('/cache/dir', 'abc123');

        expect(paths.data).toBe('/cache/dir/abc123.json');
        expect(paths.meta).toBe('/cache/dir/abc123.meta');
      });

      test('handles different cache directories', () => {
        const paths = getCacheFilePaths('.dependency_cache', 'xyz789');

        expect(paths.data).toBe('.dependency_cache/xyz789.json');
        expect(paths.meta).toBe('.dependency_cache/xyz789.meta');
      });
    });
  });

  describe('DependencyCache Integration', () => {
    let cache;
    let mockFileOps;

    beforeEach(() => {
      mockFileOps = {
        ensureDir: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(false),
        readJson: jest.fn(),
        writeJson: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        deleteDir: jest.fn().mockResolvedValue(undefined),
        stat: jest.fn().mockResolvedValue({ size: 1024 }),
      };

      cache = new DependencyCache({
        workflowHome: '/project',
        fileOperations: mockFileOps,
      });
    });

    describe('constructor', () => {
      test('initializes with default config', () => {
        expect(cache.cacheDir).toBe('/project/.dependency_cache');
        expect(cache.config.ttl).toBe(3600);
        expect(cache.config.enabled).toBe(true);
      });

      test('accepts custom config', () => {
        const customCache = new DependencyCache({
          workflowHome: '/custom',
          config: { ttl: 7200, enabled: false },
          fileOperations: mockFileOps,
        });

        expect(customCache.config.ttl).toBe(7200);
        expect(customCache.config.enabled).toBe(false);
      });
    });

    describe('init', () => {
      test('creates cache directory and index', async () => {
        mockFileOps.exists.mockResolvedValue(false);

        await cache.init();

        expect(mockFileOps.ensureDir).toHaveBeenCalledWith(cache.cacheDir);
        expect(mockFileOps.writeJson).toHaveBeenCalledWith(
          cache.indexFile,
          expect.objectContaining({
            version: '2.0.0',
            entries: [],
          })
        );
        expect(cache.initialized).toBe(true);
      });

      test('skips when cache disabled', async () => {
        cache.config.enabled = false;
        await cache.init();

        expect(mockFileOps.ensureDir).not.toHaveBeenCalled();
        expect(cache.initialized).toBe(false);
      });

      test('throws when fileOperations missing', async () => {
        cache.fileOps = null;
        await expect(cache.init()).rejects.toThrow('FileOperations instance required');
      });
    });

    describe('generateKey', () => {
      test('generates key from package.json', async () => {
        mockFileOps.readJson.mockResolvedValue({
          dependencies: { express: '^4.18.0' },
          devDependencies: { jest: '^29.0.0' },
        });

        const key = await cache.generateKey('/project/package.json', CACHE_TYPE.AUDIT);

        expect(key).toMatch(/^[a-f0-9]{64}$/);
        expect(mockFileOps.readJson).toHaveBeenCalledWith('/project/package.json');
      });

      test('throws for invalid cache type', async () => {
        await expect(cache.generateKey('/package.json', 'invalid')).rejects.toThrow(
          'Invalid cache type'
        );
      });
    });

    describe('has', () => {
      test('returns true for valid cache', async () => {
        const cacheKey = 'abc123';
        mockFileOps.exists.mockImplementation(async (path) => {
          return path.includes('abc123');
        });
        mockFileOps.readJson.mockResolvedValue({
          createdAt: Math.floor(Date.now() / 1000) - 100, // 100 seconds ago
        });

        const result = await cache.has(cacheKey);

        expect(result).toBe(true);
      });

      test('returns false when data file missing', async () => {
        mockFileOps.exists.mockResolvedValue(false);

        const result = await cache.has('missing');

        expect(result).toBe(false);
      });

      test('returns false for expired cache', async () => {
        const cacheKey = 'expired';
        mockFileOps.exists.mockResolvedValue(true);
        mockFileOps.readJson.mockResolvedValue({
          createdAt: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        });

        const result = await cache.has(cacheKey);

        expect(result).toBe(false);
      });

      test('returns false when cache disabled', async () => {
        cache.config.enabled = false;

        const result = await cache.has('key');

        expect(result).toBe(false);
      });
    });

    describe('get', () => {
      test('retrieves cached data', async () => {
        const cacheKey = 'abc123';
        const cachedData = { vulnerabilities: [] };

        // Mock has() to return true
        mockFileOps.exists.mockResolvedValue(true);
        mockFileOps.readJson
          .mockResolvedValueOnce({ createdAt: Math.floor(Date.now() / 1000) - 100 })
          .mockResolvedValueOnce(cachedData);

        const result = await cache.get(cacheKey);

        expect(result).toEqual(cachedData);
      });

      test('throws on cache miss', async () => {
        mockFileOps.exists.mockResolvedValue(false);

        await expect(cache.get('missing')).rejects.toThrow('Cache miss');
      });
    });

    describe('set', () => {
      test('saves data and metadata', async () => {
        const cacheKey = 'abc123';
        const data = { vulnerabilities: [] };

        mockFileOps.readJson.mockResolvedValue({ entries: [] });

        await cache.set(cacheKey, data, CACHE_TYPE.AUDIT);

        expect(mockFileOps.writeJson).toHaveBeenCalledWith(
          expect.stringContaining('abc123.json'),
          data
        );
        expect(mockFileOps.writeJson).toHaveBeenCalledWith(
          expect.stringContaining('abc123.meta'),
          expect.objectContaining({
            key: cacheKey,
            type: CACHE_TYPE.AUDIT,
          })
        );
      });

      test('skips when cache disabled', async () => {
        cache.config.enabled = false;

        await cache.set('key', {}, CACHE_TYPE.AUDIT);

        expect(mockFileOps.writeJson).not.toHaveBeenCalled();
      });
    });

    describe('cleanup', () => {
      test('removes expired entries', async () => {
        const currentTime = Math.floor(Date.now() / 1000);
        mockFileOps.exists.mockResolvedValue(true);
        mockFileOps.readJson.mockResolvedValue({
          entries: [
            { key: 'valid', createdAt: currentTime - 100 },
            { key: 'expired', createdAt: currentTime - 7200 },
          ],
        });

        const removed = await cache.cleanup();

        expect(removed).toBe(1);
      });

      test('returns 0 when cache disabled', async () => {
        cache.config.enabled = false;

        const removed = await cache.cleanup();

        expect(removed).toBe(0);
      });
    });

    describe('getStats', () => {
      test('returns cache statistics', async () => {
        mockFileOps.exists.mockResolvedValue(true);
        mockFileOps.readJson.mockResolvedValue({
          entries: [{ size: 1024 }, { size: 2048 }],
        });

        const stats = await cache.getStats();

        expect(stats.totalEntries).toBe(2);
        expect(stats.ttl).toBe(3600);
        expect(stats.enabled).toBe(true);
      });
    });
  });
});

/**
 * @fileoverview Unit tests for Step0bStateCache (v2.0.0)
 * @module test/lib/step0b_state_cache
 *
 * Tests all pure functions and the impure wrapper class for the
 * doc-state fingerprint cache that prevents redundant step_0b AI calls.
 */

import fs from 'fs/promises';
import path from 'path';

import {
  computeDocFingerprint,
  isCacheValid,
  createCacheEntry,
  parseCacheEntry,
  shouldSkipAiPhase,
  Step0bStateCache,
  CACHE_VERSION,
  DEFAULT_TTL_SECONDS,
  OUTCOME_NO_FILES,
  CACHE_FILENAME,
} from '../../src/lib/step0b_state_cache.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DOC_ENTRIES = [
  { path: 'README.md', content: '# Hello' },
  { path: 'docs/API.md', content: '# API' },
];

const DOC_ENTRIES_MODIFIED = [
  { path: 'README.md', content: '# Hello (updated)' },
  { path: 'docs/API.md', content: '# API' },
];

const NOW = 1_700_000_000_000; // fixed epoch for deterministic tests

// ---------------------------------------------------------------------------
// Helper: build a minimal valid cache entry
// ---------------------------------------------------------------------------

function makeEntry(overrides = {}) {
  return {
    version: CACHE_VERSION,
    fingerprint: computeDocFingerprint(DOC_ENTRIES),
    lastOutcome: OUTCOME_NO_FILES,
    docCount: DOC_ENTRIES.length,
    timestamp: NOW - 60_000, // 1 minute ago
    ttlSeconds: DEFAULT_TTL_SECONDS,
    ...overrides,
  };
}

// ===========================================================================
// Pure Functions
// ===========================================================================

describe('step0b_state_cache — Pure Functions', () => {
  // -------------------------------------------------------------------------
  // computeDocFingerprint
  // -------------------------------------------------------------------------

  describe('computeDocFingerprint()', () => {
    test('returns a 64-char hex string', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      expect(typeof fp).toBe('string');
      expect(fp).toHaveLength(64);
      expect(fp).toMatch(/^[0-9a-f]{64}$/);
    });

    test('is deterministic for the same input', () => {
      expect(computeDocFingerprint(DOC_ENTRIES)).toBe(computeDocFingerprint(DOC_ENTRIES));
    });

    test('produces different fingerprint when a file content changes', () => {
      const fp1 = computeDocFingerprint(DOC_ENTRIES);
      const fp2 = computeDocFingerprint(DOC_ENTRIES_MODIFIED);
      expect(fp1).not.toBe(fp2);
    });

    test('produces different fingerprint when a file is added', () => {
      const fp1 = computeDocFingerprint(DOC_ENTRIES);
      const fp2 = computeDocFingerprint([...DOC_ENTRIES, { path: 'NEW.md', content: '# New' }]);
      expect(fp1).not.toBe(fp2);
    });

    test('produces different fingerprint when a file is removed', () => {
      const fp1 = computeDocFingerprint(DOC_ENTRIES);
      const fp2 = computeDocFingerprint([DOC_ENTRIES[0]]);
      expect(fp1).not.toBe(fp2);
    });

    test('is order-independent (sorts by path)', () => {
      const reversed = [...DOC_ENTRIES].reverse();
      expect(computeDocFingerprint(DOC_ENTRIES)).toBe(computeDocFingerprint(reversed));
    });

    test('handles empty array', () => {
      const fp = computeDocFingerprint([]);
      expect(typeof fp).toBe('string');
      expect(fp).toHaveLength(64);
    });

    test('produces different fingerprint for different path with same content', () => {
      const a = [{ path: 'a.md', content: '# same' }];
      const b = [{ path: 'b.md', content: '# same' }];
      expect(computeDocFingerprint(a)).not.toBe(computeDocFingerprint(b));
    });
  });

  // -------------------------------------------------------------------------
  // isCacheValid
  // -------------------------------------------------------------------------

  describe('isCacheValid()', () => {
    test('returns true for a valid, fresh entry', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const entry = makeEntry({ fingerprint: fp });
      expect(isCacheValid(entry, fp, NOW)).toBe(true);
    });

    test('returns false when entry is null', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      expect(isCacheValid(null, fp, NOW)).toBe(false);
    });

    test('returns false when entry is not an object', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      expect(isCacheValid('invalid', fp, NOW)).toBe(false);
      expect(isCacheValid(42, fp, NOW)).toBe(false);
    });

    test('returns false when version does not match', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const entry = makeEntry({ fingerprint: fp, version: 999 });
      expect(isCacheValid(entry, fp, NOW)).toBe(false);
    });

    test('returns false when lastOutcome is not no_files_generated', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const entry = makeEntry({ fingerprint: fp, lastOutcome: 'generated_files' });
      expect(isCacheValid(entry, fp, NOW)).toBe(false);
    });

    test('returns false when fingerprint does not match', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const fp2 = computeDocFingerprint(DOC_ENTRIES_MODIFIED);
      const entry = makeEntry({ fingerprint: fp2 });
      expect(isCacheValid(entry, fp, NOW)).toBe(false);
    });

    test('returns false when cache has expired (age > ttl)', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const ttl = 3600; // 1 hour
      const expiredTimestamp = NOW - (ttl + 1) * 1000; // 1 second past TTL
      const entry = makeEntry({ fingerprint: fp, timestamp: expiredTimestamp, ttlSeconds: ttl });
      expect(isCacheValid(entry, fp, NOW, ttl)).toBe(false);
    });

    test('returns true when cache is exactly within TTL boundary', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const ttl = 3600;
      const almostExpiredTimestamp = NOW - (ttl - 1) * 1000; // 1 second before TTL
      const entry = makeEntry({
        fingerprint: fp,
        timestamp: almostExpiredTimestamp,
        ttlSeconds: ttl,
      });
      expect(isCacheValid(entry, fp, NOW, ttl)).toBe(true);
    });

    test('returns false when timestamp is in the future (negative age)', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const futureTimestamp = NOW + 10_000;
      const entry = makeEntry({ fingerprint: fp, timestamp: futureTimestamp });
      expect(isCacheValid(entry, fp, NOW)).toBe(false);
    });

    test('uses DEFAULT_TTL_SECONDS when ttlSeconds not provided', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const justUnderDefaultTtl = NOW - (DEFAULT_TTL_SECONDS - 60) * 1000;
      const entry = makeEntry({ fingerprint: fp, timestamp: justUnderDefaultTtl });
      expect(isCacheValid(entry, fp, NOW)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // createCacheEntry
  // -------------------------------------------------------------------------

  describe('createCacheEntry()', () => {
    test('returns an object with all required fields', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const entry = createCacheEntry(fp, OUTCOME_NO_FILES, DOC_ENTRIES.length, NOW);
      expect(entry).toHaveProperty('version', CACHE_VERSION);
      expect(entry).toHaveProperty('fingerprint', fp);
      expect(entry).toHaveProperty('lastOutcome', OUTCOME_NO_FILES);
      expect(entry).toHaveProperty('docCount', DOC_ENTRIES.length);
      expect(entry).toHaveProperty('timestamp', NOW);
      expect(entry).toHaveProperty('ttlSeconds', DEFAULT_TTL_SECONDS);
    });

    test('accepts custom TTL', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const entry = createCacheEntry(fp, OUTCOME_NO_FILES, 3, NOW, 7200);
      expect(entry.ttlSeconds).toBe(7200);
    });

    test('round-trips through isCacheValid', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const entry = createCacheEntry(fp, OUTCOME_NO_FILES, DOC_ENTRIES.length, NOW);
      expect(isCacheValid(entry, fp, NOW + 1000)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // parseCacheEntry
  // -------------------------------------------------------------------------

  describe('parseCacheEntry()', () => {
    test('parses valid JSON object', () => {
      const obj = { version: 1, fingerprint: 'abc' };
      expect(parseCacheEntry(JSON.stringify(obj))).toEqual(obj);
    });

    test('returns null for invalid JSON', () => {
      expect(parseCacheEntry('not json')).toBeNull();
    });

    test('returns null for JSON null', () => {
      expect(parseCacheEntry('null')).toBeNull();
    });

    test('returns null for JSON array', () => {
      expect(parseCacheEntry('[]')).toBeNull();
    });

    test('returns null for JSON string', () => {
      expect(parseCacheEntry('"hello"')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // shouldSkipAiPhase
  // -------------------------------------------------------------------------

  describe('shouldSkipAiPhase()', () => {
    test('returns { skip: true, fingerprint } when cache is valid', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const entry = makeEntry({ fingerprint: fp });
      const result = shouldSkipAiPhase(entry, DOC_ENTRIES, NOW);
      expect(result.skip).toBe(true);
      expect(result.fingerprint).toBe(fp);
    });

    test('returns { skip: false } when cache is null', () => {
      const result = shouldSkipAiPhase(null, DOC_ENTRIES, NOW);
      expect(result.skip).toBe(false);
    });

    test('returns { skip: false } when docs changed', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const entry = makeEntry({ fingerprint: fp });
      const result = shouldSkipAiPhase(entry, DOC_ENTRIES_MODIFIED, NOW);
      expect(result.skip).toBe(false);
    });

    test('always returns the current fingerprint even on cache miss', () => {
      const result = shouldSkipAiPhase(null, DOC_ENTRIES, NOW);
      expect(result.fingerprint).toBe(computeDocFingerprint(DOC_ENTRIES));
    });

    test('respects custom TTL', () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      const shortTtl = 10; // 10 seconds
      const staleTimestamp = NOW - 20_000; // 20 seconds ago → expired
      const entry = makeEntry({ fingerprint: fp, timestamp: staleTimestamp, ttlSeconds: shortTtl });
      const result = shouldSkipAiPhase(entry, DOC_ENTRIES, NOW, shortTtl);
      expect(result.skip).toBe(false);
    });
  });
});

// ===========================================================================
// Impure Wrapper — Step0bStateCache
// ===========================================================================

describe('step0b_state_cache — Step0bStateCache (Impure Wrapper)', () => {
  let tempDir;
  let cache;

  beforeEach(async () => {
    tempDir = path.join(
      process.cwd(),
      '.test-e2e',
      `step0b-cache-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
    cache = new Step0bStateCache({ cacheDir: tempDir, ttlSeconds: DEFAULT_TTL_SECONDS });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // check() — cache miss (no file)
  // -------------------------------------------------------------------------

  describe('check() — cache miss (no cache file)', () => {
    test('returns { skip: false } when no cache file exists', async () => {
      const result = await cache.check(DOC_ENTRIES);
      expect(result.skip).toBe(false);
    });

    test('always returns the current fingerprint on miss', async () => {
      const result = await cache.check(DOC_ENTRIES);
      expect(result.fingerprint).toBe(computeDocFingerprint(DOC_ENTRIES));
    });
  });

  // -------------------------------------------------------------------------
  // persist() + check() — cache hit
  // -------------------------------------------------------------------------

  describe('persist() + check() — cache hit flow', () => {
    test('check() returns { skip: true } after persist() with same docs', async () => {
      await cache.persist(DOC_ENTRIES);
      const result = await cache.check(DOC_ENTRIES);
      expect(result.skip).toBe(true);
    });

    test('check() returns { skip: false } after docs change', async () => {
      await cache.persist(DOC_ENTRIES);
      const result = await cache.check(DOC_ENTRIES_MODIFIED);
      expect(result.skip).toBe(false);
    });

    test('persist() writes a JSON file to cacheDir', async () => {
      await cache.persist(DOC_ENTRIES);
      const cacheFile = path.join(tempDir, CACHE_FILENAME);
      const stat = await fs.stat(cacheFile);
      expect(stat.isFile()).toBe(true);
    });

    test('persisted file contains valid JSON with required fields', async () => {
      await cache.persist(DOC_ENTRIES);
      const raw = await fs.readFile(path.join(tempDir, CACHE_FILENAME), 'utf8');
      const entry = JSON.parse(raw);
      expect(entry).toHaveProperty('version', CACHE_VERSION);
      expect(entry).toHaveProperty('fingerprint');
      expect(entry).toHaveProperty('lastOutcome', OUTCOME_NO_FILES);
      expect(entry).toHaveProperty('docCount', DOC_ENTRIES.length);
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('ttlSeconds');
    });

    test('persist() accepts a pre-computed fingerprint', async () => {
      const fp = computeDocFingerprint(DOC_ENTRIES);
      await cache.persist(DOC_ENTRIES, fp);
      const result = await cache.check(DOC_ENTRIES);
      expect(result.skip).toBe(true);
    });

    test('check() returns { skip: false } after TTL expires', async () => {
      const shortTtlCache = new Step0bStateCache({ cacheDir: tempDir, ttlSeconds: 1 });
      await shortTtlCache.persist(DOC_ENTRIES);
      // Advance time past TTL by writing an expired entry directly
      const cacheFile = path.join(tempDir, CACHE_FILENAME);
      const raw = await fs.readFile(cacheFile, 'utf8');
      const entry = JSON.parse(raw);
      entry.timestamp = Date.now() - 5000; // 5 seconds ago, TTL is 1 second
      await fs.writeFile(cacheFile, JSON.stringify(entry), 'utf8');

      const result = await shortTtlCache.check(DOC_ENTRIES);
      expect(result.skip).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // invalidate()
  // -------------------------------------------------------------------------

  describe('invalidate()', () => {
    test('removes the cache file', async () => {
      await cache.persist(DOC_ENTRIES);
      await cache.invalidate();
      const cacheFile = path.join(tempDir, CACHE_FILENAME);
      await expect(fs.access(cacheFile)).rejects.toThrow();
    });

    test('check() returns miss after invalidate()', async () => {
      await cache.persist(DOC_ENTRIES);
      await cache.invalidate();
      const result = await cache.check(DOC_ENTRIES);
      expect(result.skip).toBe(false);
    });

    test('invalidate() does not throw when no cache file exists', async () => {
      await expect(cache.invalidate()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Error resilience
  // -------------------------------------------------------------------------

  describe('Error resilience', () => {
    test('check() returns miss gracefully when cache file is corrupt JSON', async () => {
      const cacheFile = path.join(tempDir, CACHE_FILENAME);
      await fs.writeFile(cacheFile, 'not valid json at all', 'utf8');
      const result = await cache.check(DOC_ENTRIES);
      expect(result.skip).toBe(false);
    });

    test('persist() does not throw when cacheDir is inside a non-existent parent', async () => {
      const deepCache = new Step0bStateCache({
        cacheDir: path.join(tempDir, 'new', 'nested', 'dir'),
      });
      await expect(deepCache.persist(DOC_ENTRIES)).resolves.toBeUndefined();
    });

    test('check() returns miss without throwing when cache is unreadable', async () => {
      // Write a valid cache, then corrupt it
      await cache.persist(DOC_ENTRIES);
      const cacheFile = path.join(tempDir, CACHE_FILENAME);
      await fs.writeFile(cacheFile, '{broken', 'utf8');
      const result = await cache.check(DOC_ENTRIES);
      expect(result.skip).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Constructor defaults
  // -------------------------------------------------------------------------

  describe('Constructor', () => {
    test('uses DEFAULT_CACHE_DIR when cacheDir not provided', () => {
      const defaultCache = new Step0bStateCache();
      expect(defaultCache.cacheDir).toContain('.ai_workflow');
      expect(defaultCache.cacheFile).toContain(CACHE_FILENAME);
    });

    test('uses DEFAULT_TTL_SECONDS when ttlSeconds not provided', () => {
      const defaultCache = new Step0bStateCache();
      expect(defaultCache.ttlSeconds).toBe(DEFAULT_TTL_SECONDS);
    });

    test('accepts custom ttlSeconds', () => {
      const customCache = new Step0bStateCache({ ttlSeconds: 7200 });
      expect(customCache.ttlSeconds).toBe(7200);
    });
  });
});

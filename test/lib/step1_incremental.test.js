/**
 * @fileoverview Tests for Step 1 Incremental Processing (v2.0.0)
 * @module test/lib/step1_incremental
 */

import fs from 'fs/promises';
import path from 'path';
import { jest } from '@jest/globals';
import {
  calculateContentHash,
  categorizeDocFile,
  getValidationPriority,
  detectDocumentationChanges,
  filterByPriority,
  groupByCategory,
  calculateIncrementalStats,
  sortByPriority,
  createCacheEntry,
  isValidCache,
  Step1IncrementalProcessor,
  DOC_CATEGORIES,
  VALIDATION_PRIORITY,
} from '../../src/lib/step1_incremental.js';

describe('Step 1 Incremental Processing', () => {
  // ==========================================================================
  // PURE FUNCTION TESTS
  // ==========================================================================

  describe('calculateContentHash', () => {
    test('generates consistent hash for same content', () => {
      const content = 'Hello, world!';
      const hash1 = calculateContentHash(content);
      const hash2 = calculateContentHash(content);
      expect(hash1).toBe(hash2);
    });

    test('generates different hash for different content', () => {
      const hash1 = calculateContentHash('content1');
      const hash2 = calculateContentHash('content2');
      expect(hash1).not.toBe(hash2);
    });

    test('supports different algorithms', () => {
      const content = 'test';
      const sha256 = calculateContentHash(content, 'sha256');
      const sha1 = calculateContentHash(content, 'sha1');
      expect(sha256).not.toBe(sha1);
      expect(sha256.length).toBeGreaterThan(sha1.length);
    });

    test('handles empty content', () => {
      const hash = calculateContentHash('');
      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('categorizeDocFile', () => {
    test('categorizes README correctly', () => {
      expect(categorizeDocFile('README.md')).toBe(DOC_CATEGORIES.README);
      expect(categorizeDocFile('docs/README.md')).toBe(DOC_CATEGORIES.README);
    });

    test('categorizes CHANGELOG correctly', () => {
      expect(categorizeDocFile('CHANGELOG.md')).toBe(DOC_CATEGORIES.CHANGELOG);
      expect(categorizeDocFile('docs/CHANGELOG.md')).toBe(DOC_CATEGORIES.CHANGELOG);
    });

    test('categorizes CONTRIBUTING correctly', () => {
      expect(categorizeDocFile('CONTRIBUTING.md')).toBe(DOC_CATEGORIES.CONTRIBUTING);
    });

    test('categorizes LICENSE correctly', () => {
      expect(categorizeDocFile('LICENSE')).toBe(DOC_CATEGORIES.LICENSE);
      expect(categorizeDocFile('LICENSE.md')).toBe(DOC_CATEGORIES.LICENSE);
    });

    test('categorizes API docs correctly', () => {
      expect(categorizeDocFile('docs/api/README.md')).toBe(DOC_CATEGORIES.API);
      expect(categorizeDocFile('docs/api-reference.md')).toBe(DOC_CATEGORIES.API);
    });

    test('categorizes guides correctly', () => {
      expect(categorizeDocFile('docs/guides/getting-started.md')).toBe(DOC_CATEGORIES.GUIDE);
      expect(categorizeDocFile('docs/user-guide.md')).toBe(DOC_CATEGORIES.GUIDE);
    });

    test('categorizes reference docs correctly', () => {
      expect(categorizeDocFile('docs/reference/cli.md')).toBe(DOC_CATEGORIES.REFERENCE);
    });

    test('categorizes other files correctly', () => {
      expect(categorizeDocFile('docs/notes.md')).toBe(DOC_CATEGORIES.OTHER);
      expect(categorizeDocFile('misc/todo.md')).toBe(DOC_CATEGORIES.OTHER);
    });
  });

  describe('getValidationPriority', () => {
    test('assigns CRITICAL priority to README', () => {
      expect(getValidationPriority(DOC_CATEGORIES.README)).toBe(VALIDATION_PRIORITY.CRITICAL);
    });

    test('assigns CRITICAL priority to API', () => {
      expect(getValidationPriority(DOC_CATEGORIES.API)).toBe(VALIDATION_PRIORITY.CRITICAL);
    });

    test('assigns HIGH priority to guides', () => {
      expect(getValidationPriority(DOC_CATEGORIES.GUIDE)).toBe(VALIDATION_PRIORITY.HIGH);
    });

    test('assigns HIGH priority to reference', () => {
      expect(getValidationPriority(DOC_CATEGORIES.REFERENCE)).toBe(VALIDATION_PRIORITY.HIGH);
    });

    test('assigns MEDIUM priority to changelog', () => {
      expect(getValidationPriority(DOC_CATEGORIES.CHANGELOG)).toBe(VALIDATION_PRIORITY.MEDIUM);
    });

    test('assigns MEDIUM priority to contributing', () => {
      expect(getValidationPriority(DOC_CATEGORIES.CONTRIBUTING)).toBe(VALIDATION_PRIORITY.MEDIUM);
    });

    test('assigns LOW priority to license', () => {
      expect(getValidationPriority(DOC_CATEGORIES.LICENSE)).toBe(VALIDATION_PRIORITY.LOW);
    });

    test('assigns LOW priority to other', () => {
      expect(getValidationPriority(DOC_CATEGORIES.OTHER)).toBe(VALIDATION_PRIORITY.LOW);
    });
  });

  describe('detectDocumentationChanges', () => {
    test('detects added files', () => {
      const previous = { 'file1.md': 'hash1' };
      const current = { 'file1.md': 'hash1', 'file2.md': 'hash2' };

      const changes = detectDocumentationChanges(previous, current);

      expect(changes.added).toEqual(['file2.md']);
      expect(changes.modified).toEqual([]);
      expect(changes.unchanged).toEqual(['file1.md']);
      expect(changes.removed).toEqual([]);
    });

    test('detects modified files', () => {
      const previous = { 'file1.md': 'hash1' };
      const current = { 'file1.md': 'hash2' };

      const changes = detectDocumentationChanges(previous, current);

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual(['file1.md']);
      expect(changes.unchanged).toEqual([]);
    });

    test('detects unchanged files', () => {
      const previous = { 'file1.md': 'hash1', 'file2.md': 'hash2' };
      const current = { 'file1.md': 'hash1', 'file2.md': 'hash2' };

      const changes = detectDocumentationChanges(previous, current);

      expect(changes.unchanged).toEqual(['file1.md', 'file2.md']);
      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
    });

    test('detects removed files', () => {
      const previous = { 'file1.md': 'hash1', 'file2.md': 'hash2' };
      const current = { 'file1.md': 'hash1' };

      const changes = detectDocumentationChanges(previous, current);

      expect(changes.removed).toEqual(['file2.md']);
    });

    test('calculates statistics correctly', () => {
      const previous = { 'file1.md': 'hash1' };
      const current = { 'file1.md': 'hash2', 'file2.md': 'hash3' };

      const changes = detectDocumentationChanges(previous, current);

      expect(changes.totalFiles).toBe(2);
      expect(changes.changedFiles).toBe(2); // 1 modified + 1 added
      expect(changes.unchangedFiles).toBe(0);
    });

    test('handles empty caches', () => {
      const changes = detectDocumentationChanges({}, {});

      expect(changes.added).toEqual([]);
      expect(changes.modified).toEqual([]);
      expect(changes.unchanged).toEqual([]);
      expect(changes.removed).toEqual([]);
    });
  });

  describe('filterByPriority', () => {
    test('filters by CRITICAL priority', () => {
      const files = ['README.md', 'docs/api/index.md', 'docs/guide.md', 'LICENSE'];

      const filtered = filterByPriority(files, VALIDATION_PRIORITY.CRITICAL);

      expect(filtered).toContain('README.md');
      expect(filtered).toContain('docs/api/index.md');
      expect(filtered).not.toContain('docs/guide.md');
      expect(filtered).not.toContain('LICENSE');
    });

    test('filters by HIGH priority', () => {
      const files = ['README.md', 'docs/guide.md', 'CHANGELOG.md'];

      const filtered = filterByPriority(files, VALIDATION_PRIORITY.HIGH);

      expect(filtered).toContain('README.md');
      expect(filtered).toContain('docs/guide.md');
      expect(filtered).not.toContain('CHANGELOG.md');
    });

    test('includes all files for LOW priority', () => {
      const files = ['README.md', 'LICENSE', 'docs/notes.md'];

      const filtered = filterByPriority(files, VALIDATION_PRIORITY.LOW);

      expect(filtered).toEqual(files);
    });

    test('handles empty array', () => {
      const filtered = filterByPriority([], VALIDATION_PRIORITY.CRITICAL);
      expect(filtered).toEqual([]);
    });
  });

  describe('groupByCategory', () => {
    test('groups files by category', () => {
      const files = ['README.md', 'docs/api/index.md', 'docs/guide.md', 'CHANGELOG.md'];

      const grouped = groupByCategory(files);

      expect(grouped[DOC_CATEGORIES.README]).toEqual(['README.md']);
      expect(grouped[DOC_CATEGORIES.API]).toEqual(['docs/api/index.md']);
      expect(grouped[DOC_CATEGORIES.GUIDE]).toEqual(['docs/guide.md']);
      expect(grouped[DOC_CATEGORIES.CHANGELOG]).toEqual(['CHANGELOG.md']);
    });

    test('creates all category keys', () => {
      const grouped = groupByCategory([]);

      for (const category of Object.values(DOC_CATEGORIES)) {
        expect(grouped).toHaveProperty(category);
        expect(grouped[category]).toEqual([]);
      }
    });
  });

  describe('calculateIncrementalStats', () => {
    test('calculates statistics correctly', () => {
      const changes = {
        totalFiles: 10,
        changedFiles: 3,
        unchangedFiles: 7,
      };
      const filesToValidate = ['file1.md', 'file2.md', 'file3.md'];

      const stats = calculateIncrementalStats(changes, filesToValidate);

      expect(stats.totalFiles).toBe(10);
      expect(stats.filesToValidate).toBe(3);
      expect(stats.skippedFiles).toBe(7);
      expect(stats.skipRate).toBe(70);
      expect(stats.speedup).toBeCloseTo(3.3, 1);
    });

    test('handles zero files', () => {
      const changes = { totalFiles: 0, changedFiles: 0, unchangedFiles: 0 };
      const stats = calculateIncrementalStats(changes, []);

      expect(stats.skipRate).toBe(0);
      expect(stats.speedup).toBe(1);
    });

    test('handles all files changed', () => {
      const changes = { totalFiles: 5, changedFiles: 5, unchangedFiles: 0 };
      const filesToValidate = ['f1', 'f2', 'f3', 'f4', 'f5'];

      const stats = calculateIncrementalStats(changes, filesToValidate);

      expect(stats.skipRate).toBe(0);
      expect(stats.speedup).toBe(1);
    });
  });

  describe('sortByPriority', () => {
    test('sorts files by priority (high to low)', () => {
      const files = ['LICENSE', 'README.md', 'docs/guide.md', 'docs/api/index.md'];

      const sorted = sortByPriority(files);

      // Should be: README (3), API (3), Guide (2), LICENSE (0)
      expect(sorted[0]).toBe('README.md');
      expect(sorted[sorted.length - 1]).toBe('LICENSE');
    });

    test('maintains relative order for same priority', () => {
      const files = ['docs/api/a.md', 'docs/api/b.md', 'docs/api/c.md'];

      const sorted = sortByPriority(files);

      // All have same priority, order may vary but all should be present
      expect(sorted).toHaveLength(3);
      expect(sorted).toContain('docs/api/a.md');
      expect(sorted).toContain('docs/api/b.md');
      expect(sorted).toContain('docs/api/c.md');
    });

    test('does not mutate original array', () => {
      const files = ['LICENSE', 'README.md'];
      const original = [...files];

      sortByPriority(files);

      expect(files).toEqual(original);
    });
  });

  describe('createCacheEntry', () => {
    test('creates cache entry with all fields', () => {
      const entry = createCacheEntry('README.md', 'hash123', 1234567890);

      expect(entry.path).toBe('README.md');
      expect(entry.hash).toBe('hash123');
      expect(entry.category).toBe(DOC_CATEGORIES.README);
      expect(entry.priority).toBe(VALIDATION_PRIORITY.CRITICAL);
      expect(entry.timestamp).toBe(1234567890);
    });

    test('categorizes file correctly', () => {
      const entry = createCacheEntry('docs/guide.md', 'hash456', 1234567890);

      expect(entry.category).toBe(DOC_CATEGORIES.GUIDE);
      expect(entry.priority).toBe(VALIDATION_PRIORITY.HIGH);
    });
  });

  describe('isValidCache', () => {
    test('validates correct cache structure', () => {
      const cache = {
        version: '1.0.0',
        files: { 'file.md': 'hash' },
        lastUpdate: 1234567890,
      };

      expect(isValidCache(cache)).toBe(true);
    });

    test('rejects null cache', () => {
      expect(isValidCache(null)).toBe(false);
    });

    test('rejects non-object cache', () => {
      expect(isValidCache('not an object')).toBe(false);
      expect(isValidCache(123)).toBe(false);
    });

    test('rejects cache without version', () => {
      const cache = { files: {}, lastUpdate: 123 };
      expect(isValidCache(cache)).toBe(false);
    });

    test('rejects cache without files', () => {
      const cache = { version: '1.0.0', lastUpdate: 123 };
      expect(isValidCache(cache)).toBe(false);
    });

    test('rejects cache without lastUpdate', () => {
      const cache = { version: '1.0.0', files: {} };
      expect(isValidCache(cache)).toBe(false);
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('Step1IncrementalProcessor', () => {
    let processor;
    let tempDir;
    let testFiles;

    beforeEach(async () => {
      tempDir = path.join(process.cwd(), '.test-cache', `step1-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      const cacheFile = path.join(tempDir, 'cache.json');
      processor = new Step1IncrementalProcessor({ cacheFile });

      // Create test files
      testFiles = {
        'README.md': 'README content',
        'docs/api/index.md': 'API docs',
        'docs/guide.md': 'Guide content',
      };

      for (const [file, content] of Object.entries(testFiles)) {
        const filePath = path.join(tempDir, file);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf8');
      }
    });

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('constructor', () => {
      test('initializes with default config', () => {
        const proc = new Step1IncrementalProcessor();
        expect(proc.config.hashAlgorithm).toBe('sha256');
      });

      test('accepts custom config', () => {
        const proc = new Step1IncrementalProcessor({ hashAlgorithm: 'sha1' });
        expect(proc.config.hashAlgorithm).toBe('sha1');
      });
    });

    describe('loadCache', () => {
      test('creates empty cache if none exists', async () => {
        const cache = await processor.loadCache();

        expect(cache.version).toBe('1.0.0');
        expect(cache.files).toEqual({});
        expect(cache.lastUpdate).toBeGreaterThan(0);
      });

      test('loads existing cache', async () => {
        const existingCache = {
          version: '1.0.0',
          files: { 'file.md': 'hash' },
          lastUpdate: 1234567890,
        };

        await fs.writeFile(processor.config.cacheFile, JSON.stringify(existingCache), 'utf8');

        const cache = await processor.loadCache();

        expect(cache.version).toBe('1.0.0');
        expect(cache.files).toEqual({ 'file.md': 'hash' });
      });

      test('handles invalid cache gracefully', async () => {
        await fs.writeFile(processor.config.cacheFile, 'invalid json', 'utf8');

        const cache = await processor.loadCache();

        expect(cache.version).toBe('1.0.0');
        expect(cache.files).toEqual({});
      });
    });

    describe('saveCache', () => {
      test('saves cache to disk', async () => {
        await processor.loadCache();
        processor.cache.files = { 'test.md': 'hash123' };

        await processor.saveCache();

        const content = await fs.readFile(processor.config.cacheFile, 'utf8');
        const saved = JSON.parse(content);

        expect(saved.files).toEqual({ 'test.md': 'hash123' });
      });

      test('creates cache directory if needed', async () => {
        const deepCache = path.join(tempDir, 'a', 'b', 'c', 'cache.json');
        const proc = new Step1IncrementalProcessor({ cacheFile: deepCache });

        await proc.loadCache();
        await proc.saveCache();

        const exists = await fs
          .access(deepCache)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      });
    });

    describe('calculateFileHash', () => {
      test('calculates hash for file', async () => {
        const filePath = path.join(tempDir, 'README.md');
        const hash = await processor.calculateFileHash(filePath);

        expect(hash).toBeTruthy();
        expect(typeof hash).toBe('string');
      });

      test('returns null for non-existent file', async () => {
        const hash = await processor.calculateFileHash('/non/existent/file.md');
        expect(hash).toBeNull();
      });

      // [BUG FIX 9a42860] ENOENT must log at debug level, not warn
      // Deleted files are a valid git state (e.g. after `git rm`) — not a warning condition
      test('[BUG FIX] ENOENT for missing file logs debug, not warn', async () => {
        const { logger } = await import('../../src/core/logger.js');
        const debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
        const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

        await processor.calculateFileHash('/definitely/does/not/exist/file.js');

        const enoentDebugCalls = debugSpy.mock.calls.filter((args) =>
          args[0]?.includes('no longer exists')
        );
        const enoentWarnCalls = warnSpy.mock.calls.filter(
          (args) => args[0]?.includes('no longer exists') || args[0]?.includes('Failed to read')
        );

        expect(enoentDebugCalls.length).toBeGreaterThan(0); // must log at debug
        expect(enoentWarnCalls).toHaveLength(0); // must NOT log at warn

        debugSpy.mockRestore();
        warnSpy.mockRestore();
      });
    });

    describe('calculateHashes', () => {
      test('calculates hashes for multiple files', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));
        const hashes = await processor.calculateHashes(files);

        expect(Object.keys(hashes)).toHaveLength(3);
        for (const file of files) {
          expect(hashes[file]).toBeTruthy();
        }
      });

      test('skips files that cannot be read', async () => {
        const files = [path.join(tempDir, 'README.md'), '/non/existent/file.md'];

        const hashes = await processor.calculateHashes(files);

        expect(Object.keys(hashes)).toHaveLength(1);
      });
    });

    describe('analyzeChanges', () => {
      test('detects all files as added on first run', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));
        const changes = await processor.analyzeChanges(files);

        expect(changes.added).toHaveLength(3);
        expect(changes.modified).toHaveLength(0);
        expect(changes.unchanged).toHaveLength(0);
      });

      test('detects unchanged files on second run', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        // First run
        await processor.analyzeChanges(files);
        await processor.updateCache(files);

        // Second run without changes
        const changes = await processor.analyzeChanges(files);

        expect(changes.unchanged).toHaveLength(3);
        expect(changes.modified).toHaveLength(0);
      });

      test('detects modified files', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        // First run
        await processor.analyzeChanges(files);
        await processor.updateCache(files);

        // Modify one file
        const readmePath = path.join(tempDir, 'README.md');
        await fs.writeFile(readmePath, 'Modified content', 'utf8');

        // Second run
        const changes = await processor.analyzeChanges(files);

        expect(changes.modified).toHaveLength(1);
        expect(changes.modified[0]).toContain('README.md');
        expect(changes.unchanged).toHaveLength(2);
      });
    });

    describe('getFilesToValidate', () => {
      test('returns all changed files by default', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        const result = await processor.getFilesToValidate(files);

        expect(result.files).toHaveLength(3);
        expect(result.stats.skipRate).toBe(0);
      });

      test('filters by priority', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        const result = await processor.getFilesToValidate(files, {
          minPriority: VALIDATION_PRIORITY.CRITICAL,
        });

        // Only README and API docs are CRITICAL
        expect(result.files.length).toBeLessThan(3);
      });

      test('sorts files by priority', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        const result = await processor.getFilesToValidate(files, { sortFiles: true });

        // README should be first (CRITICAL priority)
        expect(result.files[0]).toContain('README.md');
      });

      test('calculates speedup correctly', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        // First run
        await processor.getFilesToValidate(files);
        await processor.updateCache(files);

        // Second run (no changes)
        const result = await processor.getFilesToValidate(files);

        expect(result.files).toHaveLength(0); // Nothing changed
        expect(result.stats.speedup).toBeGreaterThan(1);
      });
    });

    describe('updateCache', () => {
      test('updates cache with validated files', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        await processor.analyzeChanges(files);
        await processor.updateCache(files);

        expect(Object.keys(processor.cache.files)).toHaveLength(3);
      });

      test('updates lastUpdate timestamp', async () => {
        await processor.loadCache();
        const oldTimestamp = processor.cache.lastUpdate;

        await new Promise((resolve) => setTimeout(resolve, 10));

        await processor.analyzeChanges([]);
        await processor.updateCache([]);

        expect(processor.cache.lastUpdate).toBeGreaterThan(oldTimestamp);
      });
    });

    describe('clearCache', () => {
      test('clears cache entries', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        await processor.analyzeChanges(files);
        await processor.updateCache(files);

        await processor.clearCache();

        expect(Object.keys(processor.cache.files)).toHaveLength(0);
      });

      test('saves empty cache to disk', async () => {
        await processor.clearCache();

        const content = await fs.readFile(processor.config.cacheFile, 'utf8');
        const cache = JSON.parse(content);

        expect(cache.files).toEqual({});
      });
    });

    describe('getCacheStats', () => {
      test('returns stats for populated cache', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        await processor.analyzeChanges(files);
        await processor.updateCache(files);

        const stats = processor.getCacheStats();

        expect(stats.entries).toBe(3);
        expect(stats.lastUpdate).toBeTruthy();
        expect(stats.categories).toHaveProperty(DOC_CATEGORIES.README);
      });

      test('returns empty stats for null cache', () => {
        const stats = processor.getCacheStats();

        expect(stats.entries).toBe(0);
        expect(stats.lastUpdate).toBeNull();
      });
    });

    describe('end-to-end workflow', () => {
      test('complete incremental validation workflow', async () => {
        const files = Object.keys(testFiles).map((f) => path.join(tempDir, f));

        // First run: All files need validation
        const firstRun = await processor.getFilesToValidate(files);
        expect(firstRun.files).toHaveLength(3);
        expect(firstRun.stats.skipRate).toBe(0);

        // Update cache after validation
        await processor.updateCache(firstRun.files);

        // Second run: No files changed
        const secondRun = await processor.getFilesToValidate(files);
        expect(secondRun.files).toHaveLength(0);
        expect(secondRun.stats.skipRate).toBe(100);
        expect(secondRun.stats.speedup).toBeGreaterThan(1);

        // Modify one file
        const readmePath = path.join(tempDir, 'README.md');
        await fs.writeFile(readmePath, 'New content', 'utf8');

        // Third run: Only modified file needs validation
        const thirdRun = await processor.getFilesToValidate(files);
        expect(thirdRun.files).toHaveLength(1);
        expect(thirdRun.files[0]).toContain('README.md');
        expect(thirdRun.stats.skipRate).toBeCloseTo(66.7, 0);
      });
    });
  });
});

/**
 * @fileoverview E2E tests for the detectChangedDocs fix.
 *
 * Regression scenario: Step1DocumentationAnalyzer called
 * `this.incrementalProcessor.detectChangedDocs()` but the method did not exist
 * on Step1IncrementalProcessor, causing:
 *   "this.incrementalProcessor.detectChangedDocs is not a function"
 *
 * These tests verify:
 *  1. detectChangedDocs exists and is callable on Step1IncrementalProcessor
 *  2. It returns the correct array of changed file paths
 *  3. Step1DocumentationAnalyzer.execute() completes without throwing when
 *     using the real Step1IncrementalProcessor (no mock)
 *  4. The full incremental mode flow works end-to-end with real file I/O
 *
 * @group e2e
 * @group regression
 */

import fs from 'fs/promises';
import path from 'path';
import { Step1IncrementalProcessor } from '../../src/lib/step1_incremental.js';
import { Step1DocumentationAnalyzer } from '../../src/steps/step_01_documentation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a temporary file, creating parent directories as needed.
 */
async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Build a fresh Step1IncrementalProcessor whose cache lives in tempDir.
 */
function makeProcessor(tempDir) {
  return new Step1IncrementalProcessor({
    cacheFile: path.join(tempDir, '.incremental_cache', 'step1.json'),
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('E2E: detectChangedDocs fix regression', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), '.test-e2e', `detect-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Unit: detectChangedDocs method existence & contract
  // =========================================================================

  describe('Step1IncrementalProcessor.detectChangedDocs', () => {
    test('method exists on the class prototype', () => {
      const processor = makeProcessor(tempDir);
      expect(typeof processor.detectChangedDocs).toBe('function');
    });

    test('returns an array (not an object or undefined)', async () => {
      const processor = makeProcessor(tempDir);
      const readme = path.join(tempDir, 'README.md');
      await writeFile(readme, '# Hello');

      const result = await processor.detectChangedDocs([readme]);
      expect(Array.isArray(result)).toBe(true);
    });

    test('returns all files as changed on first run (empty cache)', async () => {
      const processor = makeProcessor(tempDir);
      const files = ['README.md', 'docs/guide.md', 'docs/api/index.md'].map(
        (f) => path.join(tempDir, f)
      );
      for (const f of files) {
        await writeFile(f, `Content of ${path.basename(f)}`);
      }

      const changed = await processor.detectChangedDocs(files);

      expect(changed).toHaveLength(files.length);
      expect(changed).toEqual(expect.arrayContaining(files));
    });

    test('returns empty array when no files have changed since last run', async () => {
      const processor = makeProcessor(tempDir);
      const readme = path.join(tempDir, 'README.md');
      await writeFile(readme, '# Stable content');

      // First run — prime the cache
      await processor.detectChangedDocs([readme]);
      await processor.updateCache([readme]);

      // Second run — nothing changed
      const changed = await processor.detectChangedDocs([readme]);
      expect(changed).toHaveLength(0);
    });

    test('returns only modified files after content change', async () => {
      const processor = makeProcessor(tempDir);
      const readme = path.join(tempDir, 'README.md');
      const guide = path.join(tempDir, 'docs/guide.md');
      await writeFile(readme, '# Original README');
      await writeFile(guide, '# Original Guide');

      // Prime cache for both files
      await processor.detectChangedDocs([readme, guide]);
      await processor.updateCache([readme, guide]);

      // Modify only README
      await writeFile(readme, '# Modified README');

      const changed = await processor.detectChangedDocs([readme, guide]);
      expect(changed).toContain(readme);
      expect(changed).not.toContain(guide);
    });

    test('includes newly added files not present in previous cache', async () => {
      const processor = makeProcessor(tempDir);
      const existing = path.join(tempDir, 'README.md');
      await writeFile(existing, '# README');

      // Cache only the existing file
      await processor.detectChangedDocs([existing]);
      await processor.updateCache([existing]);

      // Add a new file
      const newFile = path.join(tempDir, 'docs/new.md');
      await writeFile(newFile, '# New doc');

      const changed = await processor.detectChangedDocs([existing, newFile]);
      expect(changed).toContain(newFile);
      expect(changed).not.toContain(existing);
    });

    test('returns string paths (not objects)', async () => {
      const processor = makeProcessor(tempDir);
      const readme = path.join(tempDir, 'README.md');
      await writeFile(readme, '# README');

      const changed = await processor.detectChangedDocs([readme]);

      for (const item of changed) {
        expect(typeof item).toBe('string');
      }
    });

    test('handles empty file list without throwing', async () => {
      const processor = makeProcessor(tempDir);
      await expect(processor.detectChangedDocs([])).resolves.toEqual([]);
    });
  });

  // =========================================================================
  // 2. Integration: Step1DocumentationAnalyzer with real incrementalProcessor
  // =========================================================================

  describe('Step1DocumentationAnalyzer with real Step1IncrementalProcessor', () => {
    let analyzer;

    /**
     * Build a minimal analyzer that uses the REAL incremental processor but
     * stubs out I/O dependencies that would require live git or AI services.
     */
    function buildAnalyzer(overrides = {}) {
      const processor = overrides.incrementalProcessor ?? makeProcessor(tempDir);

      return new Step1DocumentationAnalyzer({
        gitOps: {
          getModifiedFiles: () => Promise.resolve(['README.md']),
        },
        fileOps: {
          readFile: () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
        },
        backlog: {
          saveStepSummary: () => Promise.resolve(),
        },
        parallelProcessor: {
          processDocumentation: () =>
            Promise.resolve({ stats: { processed: 0, totalTime: 0 } }),
        },
        incrementalProcessor: processor,
        ...overrides,
      });
    }

    test('does not throw "detectChangedDocs is not a function"', async () => {
      analyzer = buildAnalyzer();
      await expect(analyzer.execute(tempDir)).resolves.not.toThrow();
    });

    test('execute() returns success when real processor detects changes', async () => {
      const readme = path.join(tempDir, 'README.md');
      await writeFile(readme, '# README');

      analyzer = buildAnalyzer({
        gitOps: { getModifiedFiles: () => Promise.resolve([readme]) },
      });

      const result = await analyzer.execute(tempDir, { enableParallel: false });

      expect(result.success).toBe(true);
    });

    test('execute() skips when real processor finds docs_unchanged', async () => {
      const readme = path.join(tempDir, 'README.md');
      await writeFile(readme, '# README');

      const processor = makeProcessor(tempDir);

      // Prime the cache so README is considered unchanged
      await processor.detectChangedDocs([readme]);
      await processor.updateCache([readme]);

      analyzer = buildAnalyzer({
        gitOps: { getModifiedFiles: () => Promise.resolve([readme]) },
        incrementalProcessor: processor,
      });

      const result = await analyzer.execute(tempDir, {
        enableIncremental: true,
        enableParallel: false,
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('docs_unchanged');
    });

    test('execute() processes only changed subset when some docs are cached', async () => {
      const readme = path.join(tempDir, 'README.md');
      const guide = path.join(tempDir, 'docs/guide.md');
      await writeFile(readme, '# README');
      await writeFile(guide, '# Guide');

      const processor = makeProcessor(tempDir);

      // Cache both files
      await processor.detectChangedDocs([readme, guide]);
      await processor.updateCache([readme, guide]);

      // Modify only the guide
      await writeFile(guide, '# Guide — updated');

      let savedSummary = '';
      analyzer = buildAnalyzer({
        gitOps: { getModifiedFiles: () => Promise.resolve([readme, guide]) },
        backlog: {
          saveStepSummary: (_step, _title, content) => {
            savedSummary = content;
            return Promise.resolve();
          },
        },
        incrementalProcessor: processor,
      });

      const result = await analyzer.execute(tempDir, {
        enableIncremental: true,
        enableParallel: false,
      });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(1); // only guide
      expect(savedSummary).toContain('Step 1');
    });
  });

  // =========================================================================
  // 3. Full round-trip: cache persists across processor instances
  // =========================================================================

  describe('Full round-trip: cache persistence across processor instances', () => {
    test('second processor instance reads cache written by first', async () => {
      const readme = path.join(tempDir, 'README.md');
      await writeFile(readme, '# Stable');

      const cacheFile = path.join(tempDir, '.cache', 'step1.json');

      // First instance: populate cache
      const proc1 = new Step1IncrementalProcessor({ cacheFile });
      await proc1.detectChangedDocs([readme]);
      await proc1.updateCache([readme]);

      // Second instance: should see no changes
      const proc2 = new Step1IncrementalProcessor({ cacheFile });
      const changed = await proc2.detectChangedDocs([readme]);

      expect(changed).toHaveLength(0);
    });

    test('file modification detected by new processor instance after cache write', async () => {
      const readme = path.join(tempDir, 'README.md');
      await writeFile(readme, '# Original');

      const cacheFile = path.join(tempDir, '.cache', 'step1.json');

      const proc1 = new Step1IncrementalProcessor({ cacheFile });
      await proc1.detectChangedDocs([readme]);
      await proc1.updateCache([readme]);

      // Modify the file after caching
      await writeFile(readme, '# Changed');

      const proc2 = new Step1IncrementalProcessor({ cacheFile });
      const changed = await proc2.detectChangedDocs([readme]);

      expect(changed).toContain(readme);
    });
  });
});

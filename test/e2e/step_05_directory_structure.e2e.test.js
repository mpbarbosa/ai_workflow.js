/**
 * @fileoverview E2E Test for Step 5 Directory Structure Validation
 * @module test/e2e/step_05_directory_structure
 *
 * Verifies that the directory structure validation step works correctly
 * with real FileOperations (no mocks). Tests the fix for:
 * "this.fileOps.glob is not a function"
 *
 * The issue was that Step5DirectoryAnalyzer called `this.fileOps.glob()`,
 * which does not exist on FileOperations. The fix replaces all glob calls
 * with `listDirectory()` (for root-level file listing) and
 * `listDirectoryRecursive({ includeDirectories: true })` (for recursive
 * directory enumeration).
 *
 * @version 1.0.0
 * @since 2026-02-20
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  Step5DirectoryAnalyzer,
  ROOT_ALLOWED_FILES,
  EXCLUDED_DIRS,
} from '../../src/steps/step_05_directory.js';
import { FileOperations } from '../../src/lib/file_operations.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeFile(dir, relPath, content = '') {
  const fullPath = path.join(dir, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content);
}

async function mkdir(dir, relPath) {
  await fs.mkdir(path.join(dir, relPath), { recursive: true });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('E2E: Step 5 Directory Structure Validation – glob fix', () => {
  let tempDir;
  let fileOps;
  let analyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai_workflow_step5_e2e_'));

    fileOps = new FileOperations();

    // Use a null backlog config so saveStepSummary is a no-op
    const nullBacklog = { saveStepSummary: () => Promise.resolve() };

    analyzer = new Step5DirectoryAnalyzer({
      fileOps,
      backlog: nullBacklog,
      config: { load: () => Promise.reject(new Error('no config')) },
    });
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Regression guard: verify the fixed API exists and the broken one is gone
  // -------------------------------------------------------------------------

  describe('Method API Regression Prevention', () => {
    test('FileOperations exposes listDirectory and glob', () => {
      expect(typeof fileOps.listDirectory).toBe('function');
      expect(typeof fileOps.glob).toBe('function');
    });

    test('FileOperations exposes listDirectoryRecursive', () => {
      expect(typeof fileOps.listDirectoryRecursive).toBe('function');
    });

    test('Step5DirectoryAnalyzer.execute does not throw "glob is not a function"', async () => {
      // An empty project directory is sufficient to trigger all three
      // code-paths that previously called this.fileOps.glob()
      await expect(analyzer.execute(tempDir)).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Empty project
  // -------------------------------------------------------------------------

  describe('Empty project directory', () => {
    test('returns success with zero counts', async () => {
      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.misplacedDocs).toBe(0);
      expect(result.totalDirs).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Root-level markdown files
  // -------------------------------------------------------------------------

  describe('Root-level markdown detection', () => {
    test('allowed files are not reported as misplaced', async () => {
      for (const allowed of ROOT_ALLOWED_FILES) {
        await writeFile(tempDir, allowed, `# ${allowed}`);
      }

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.misplacedDocs).toBe(0);
    });

    test('non-allowed markdown files are reported as misplaced', async () => {
      await writeFile(tempDir, 'README.md', '# Readme');
      await writeFile(tempDir, 'GUIDE.md', '# Guide'); // misplaced
      await writeFile(tempDir, 'ANALYSIS.md', '# Analysis'); // misplaced

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.misplacedDocs).toBe(2);
    });

    test('non-markdown files in root do not affect misplaced count', async () => {
      await writeFile(tempDir, 'package.json', '{}');
      await writeFile(tempDir, '.eslintrc.js', '');
      await writeFile(tempDir, 'README.md', '# Readme');

      const result = await analyzer.execute(tempDir);

      expect(result.misplacedDocs).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Directory counting
  // -------------------------------------------------------------------------

  describe('Directory counting', () => {
    test('counts regular project directories', async () => {
      await mkdir(tempDir, 'src');
      await mkdir(tempDir, 'test');
      await mkdir(tempDir, 'docs');

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.totalDirs).toBe(3);
    });

    test('counts nested directories', async () => {
      await mkdir(tempDir, 'src/lib');
      await mkdir(tempDir, 'src/utils');
      await mkdir(tempDir, 'docs');

      const result = await analyzer.execute(tempDir);

      // src, src/lib, src/utils, docs
      expect(result.totalDirs).toBe(4);
    });

    test('excludes node_modules from directory count', async () => {
      await mkdir(tempDir, 'src');
      await mkdir(tempDir, 'node_modules/some-pkg');

      const result = await analyzer.execute(tempDir);

      // Only src; node_modules and its child are excluded
      expect(result.totalDirs).toBe(1);
    });

    test('excludes all EXCLUDED_DIRS from directory count', async () => {
      await mkdir(tempDir, 'src');
      for (const excluded of EXCLUDED_DIRS) {
        await mkdir(tempDir, excluded);
      }

      const result = await analyzer.execute(tempDir);

      expect(result.totalDirs).toBe(1); // only src
    });
  });

  // -------------------------------------------------------------------------
  // Structure validation
  // -------------------------------------------------------------------------

  describe('Structure validation with real filesystem', () => {
    test('returns issues array even when config is absent', async () => {
      await mkdir(tempDir, 'src');
      await mkdir(tempDir, 'test');

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.issues)).toBe(true);
    });

    test('completes without error when project has deeply nested dirs', async () => {
      await mkdir(tempDir, 'src/lib/utils/helpers');
      await mkdir(tempDir, 'docs/api/reference');
      await mkdir(tempDir, 'test/unit/lib');

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.totalDirs).toBeGreaterThan(0);
    });

    test('result shape contains all expected fields', async () => {
      await mkdir(tempDir, 'src');

      const result = await analyzer.execute(tempDir);

      expect(result).toMatchObject({
        success: true,
        totalDirs: expect.any(Number),
        misplacedDocs: expect.any(Number),
        organizedDocs: expect.any(Number),
        issues: expect.any(Array),
        missingCritical: expect.any(Number),
      });
    });
  });

  // -------------------------------------------------------------------------
  // Combined scenario – realistic project layout
  // -------------------------------------------------------------------------

  describe('Realistic project layout', () => {
    test('handles a typical Node.js project structure', async () => {
      // Allowed root files
      await writeFile(tempDir, 'README.md', '# My Project\n\nSrc, test, docs directories.');
      await writeFile(tempDir, 'CHANGELOG.md', '# Changelog');
      await writeFile(tempDir, 'package.json', '{}');

      // Misplaced docs
      await writeFile(tempDir, 'IMPLEMENTATION_SUMMARY.md', '# Impl');
      await writeFile(tempDir, 'BUGFIX_2026.md', '# Fix');

      // Standard directories
      await mkdir(tempDir, 'src');
      await mkdir(tempDir, 'test');
      await mkdir(tempDir, 'docs');
      await mkdir(tempDir, 'node_modules/lodash');

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.misplacedDocs).toBe(2);
      expect(result.totalDirs).toBe(3); // src, test, docs (node_modules excluded)
    });
  });
});

/**
 * @fileoverview Integration tests for Step 2: venv exclusion and directory link detection
 *
 * Regression tests validating three bugs fixed during guia_turistico
 * workflow_20260302_203120 log validation:
 *
 *  Bug A — venv/ files were included in documentation discovery and file index.
 *    Both discoverDocumentationFiles() and buildFileIndex() had a hardcoded exclude
 *    list missing 'venv', '.venv', and 'env'.
 *
 *  Bug B — Directory link targets (e.g. ".github/scripts/") were always reported
 *    as broken because buildFileIndex() only returned a Set of file paths; directory
 *    paths were never added. Fixed by deriving parent directories from each file path.
 *
 * These tests use a real temporary filesystem so that glob, path resolution, and
 * directory derivation behave exactly as they do in production.
 *
 * @group integration
 * @group regression
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Step2ConsistencyAnalyzer } from '../../src/steps/step_02_consistency.js';
import { FileOperations } from '../../src/lib/file_operations.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeFile(dir, relPath, content = 'placeholder') {
  const full = path.join(dir, relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf8');
}

function buildBacklogStub() {
  const calls = [];
  return {
    stub: {
      saveStepSummary: (_s, _t, content) => {
        calls.push({ content });
        return Promise.resolve();
      },
    },
    calls,
  };
}

function buildAnalyzer(_rootDir, backlogStub) {
  return new Step2ConsistencyAnalyzer({
    fileOps: new FileOperations(),
    backlog: backlogStub,
    aiHelper: { initialize: () => Promise.resolve(false) },
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Integration: Step2ConsistencyAnalyzer – venv exclusion and directory link detection', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai_wf_step02_int_'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // Bug A — venv exclusion: discoverDocumentationFiles
  // =========================================================================

  describe('Bug A fix: discoverDocumentationFiles excludes venv directories', () => {
    test('venv/ markdown files are not included in discovered docs', async () => {
      // Project docs (must be included)
      await writeFile(tempDir, 'README.md', '# Project\n');
      await writeFile(tempDir, 'docs/GUIDE.md', '# Guide\n');

      // Python virtualenv docs (must be excluded – third-party, not project docs)
      await writeFile(tempDir, 'venv/lib/python3.13/site-packages/pip/METADATA.md', '# pip\n');
      await writeFile(
        tempDir,
        'venv/lib/python3.13/site-packages/setuptools/README.md',
        '# setuptools\n'
      );

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const discovered = await analyzer.discoverDocumentationFiles(tempDir);

      const relPaths = discovered.map((f) => path.relative(tempDir, f));

      expect(relPaths).toContain('README.md');
      expect(relPaths).toContain('docs/GUIDE.md');
      // venv files must not appear
      expect(relPaths.some((p) => p.startsWith('venv/'))).toBe(false);
    });

    test('.venv/ markdown files are not included in discovered docs', async () => {
      await writeFile(tempDir, 'README.md', '# Project\n');
      await writeFile(tempDir, '.venv/lib/python3.13/site-packages/behave/README.md', '# behave\n');

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const discovered = await analyzer.discoverDocumentationFiles(tempDir);

      const relPaths = discovered.map((f) => path.relative(tempDir, f));
      expect(relPaths).toContain('README.md');
      expect(relPaths.some((p) => p.startsWith('.venv/'))).toBe(false);
    });

    test('env/ markdown files are not included in discovered docs', async () => {
      await writeFile(tempDir, 'README.md', '# Project\n');
      await writeFile(
        tempDir,
        'env/lib/python3.11/site-packages/requests/README.md',
        '# requests\n'
      );

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const discovered = await analyzer.discoverDocumentationFiles(tempDir);

      const relPaths = discovered.map((f) => path.relative(tempDir, f));
      expect(relPaths).toContain('README.md');
      expect(relPaths.some((p) => p.startsWith('env/'))).toBe(false);
    });
  });

  // =========================================================================
  // Bug A — venv exclusion: buildFileIndex
  // =========================================================================

  describe('Bug A fix: buildFileIndex excludes venv directories', () => {
    test('venv/ files are not in the file index Set', async () => {
      await writeFile(tempDir, 'src/index.js', 'export {};\n');
      await writeFile(
        tempDir,
        'venv/lib/python3.13/site-packages/setuptools/config/distutils.schema.json',
        '{}'
      );

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const fileIndex = await analyzer.buildFileIndex(tempDir);

      // Convert set to relative paths for readable assertions
      const relPaths = [...fileIndex]
        .filter((p) => path.isAbsolute(p))
        .map((p) => path.relative(tempDir, p));

      expect(relPaths.some((p) => p.startsWith('venv/'))).toBe(false);
      // src/index.js must still be indexed
      expect(relPaths.some((p) => p === 'src/index.js')).toBe(true);
    });

    test('.venv/ files are not in the file index Set', async () => {
      await writeFile(tempDir, 'package.json', '{"name":"test"}');
      await writeFile(
        tempDir,
        '.venv/lib/python3.13/site-packages/markdown_it/port.yaml',
        'name: port\n'
      );

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const fileIndex = await analyzer.buildFileIndex(tempDir);

      const relPaths = [...fileIndex]
        .filter((p) => path.isAbsolute(p))
        .map((p) => path.relative(tempDir, p));

      expect(relPaths.some((p) => p.startsWith('.venv/'))).toBe(false);
    });
  });

  // =========================================================================
  // Bug B — directory link detection: buildFileIndex derives parent dirs
  // =========================================================================

  describe('Bug B fix: buildFileIndex includes parent directory paths in Set', () => {
    test('directory path of a nested file appears in the file index', async () => {
      await writeFile(tempDir, '.github/scripts/deploy.sh', '#!/bin/bash\n');
      await writeFile(tempDir, 'src/index.js', '');

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const fileIndex = await analyzer.buildFileIndex(tempDir);

      const githubScriptsDir = path.join(tempDir, '.github', 'scripts');
      const githubDir = path.join(tempDir, '.github');
      const srcDir = path.join(tempDir, 'src');

      // All ancestor directories up to (but not including) projectRoot are added
      expect(fileIndex.has(githubScriptsDir)).toBe(true);
      expect(fileIndex.has(githubDir)).toBe(true);
      expect(fileIndex.has(srcDir)).toBe(true);

      // The projectRoot itself is NOT added (loop stops before it)
      expect(fileIndex.has(tempDir)).toBe(false);
    });

    test('deeply nested file adds all intermediate directories', async () => {
      await writeFile(tempDir, 'a/b/c/d/file.md', '# Deep\n');

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const fileIndex = await analyzer.buildFileIndex(tempDir);

      expect(fileIndex.has(path.join(tempDir, 'a', 'b', 'c', 'd'))).toBe(true);
      expect(fileIndex.has(path.join(tempDir, 'a', 'b', 'c'))).toBe(true);
      expect(fileIndex.has(path.join(tempDir, 'a', 'b'))).toBe(true);
      expect(fileIndex.has(path.join(tempDir, 'a'))).toBe(true);
      expect(fileIndex.has(tempDir)).toBe(false);
    });
  });

  // =========================================================================
  // Bug B — directory link detection: validateFileReferences integration
  // =========================================================================

  describe('Bug B fix: directory link targets are not flagged as broken', () => {
    test('link to .github/scripts/ is not reported broken when directory exists', async () => {
      await writeFile(tempDir, '.github/scripts/check-references.sh', '#!/bin/bash\n');
      await writeFile(
        tempDir,
        'README.md',
        ['# Project', '', 'See the [CI scripts](.github/scripts/) for automation.'].join('\n')
      );

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const docFiles = await analyzer.discoverDocumentationFiles(tempDir);
      const fileIndex = await analyzer.buildFileIndex(tempDir);
      const brokenLinks = await analyzer.checkLinks(docFiles, fileIndex, tempDir);

      const dirLinks = brokenLinks.filter((l) => l.link === '.github/scripts/');
      expect(dirLinks).toHaveLength(0);
    });

    test('link to a docs/ directory is not reported broken when directory exists', async () => {
      await writeFile(tempDir, 'docs/API.md', '# API\n');
      await writeFile(tempDir, 'README.md', 'Browse the [documentation](docs/).');

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const docFiles = await analyzer.discoverDocumentationFiles(tempDir);
      const fileIndex = await analyzer.buildFileIndex(tempDir);
      const brokenLinks = await analyzer.checkLinks(docFiles, fileIndex, tempDir);

      const dirLinks = brokenLinks.filter((l) => l.link === 'docs/');
      expect(dirLinks).toHaveLength(0);
    });

    test('link to a non-existent directory IS reported broken', async () => {
      await writeFile(tempDir, 'README.md', 'See [missing](nonexistent-dir/).');

      const analyzer = buildAnalyzer(tempDir, buildBacklogStub().stub);
      const docFiles = await analyzer.discoverDocumentationFiles(tempDir);
      const fileIndex = await analyzer.buildFileIndex(tempDir);
      const brokenLinks = await analyzer.checkLinks(docFiles, fileIndex, tempDir);

      // nonexistent-dir does not exist → must be flagged as broken
      const broken = brokenLinks.filter((l) => l.link === 'nonexistent-dir/');
      expect(broken).toHaveLength(1);
    });
  });

  // =========================================================================
  // End-to-end: execute() — combined regression scenario
  // =========================================================================

  describe('End-to-end execute(): combined venv + directory link regression', () => {
    test('execute() does not flag existing .github/scripts/ as a broken link', async () => {
      // Mirrors the exact structure that triggered the false-positive in guia_turistico
      await writeFile(tempDir, '.github/scripts/check-references.sh', '#!/bin/bash\n');
      await writeFile(
        tempDir,
        'README.md',
        [
          '# Guia Turístico',
          '',
          'CI automation lives in [.github/scripts/](.github/scripts/).',
        ].join('\n')
      );

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      const githubScriptsBroken = result.brokenLinks.filter(
        (l) => l.link && l.link.includes('.github/scripts')
      );
      expect(githubScriptsBroken).toHaveLength(0);
    });

    test('execute() does not include venv/ files in doc file count', async () => {
      await writeFile(tempDir, 'README.md', '# Project\n');
      await writeFile(tempDir, 'docs/GUIDE.md', '# Guide\n');
      // Simulate Python virtualenv present in project root
      await writeFile(
        tempDir,
        'venv/lib/python3.13/site-packages/pip/METADATA.md',
        '# pip METADATA\n'
      );
      await writeFile(
        tempDir,
        'venv/lib/python3.13/site-packages/setuptools/README.md',
        '# setuptools\n'
      );

      const { stub, calls } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      // Only the 2 project docs should be counted; venv METADATA.md + README.md must not inflate the count
      expect(result.filesChecked).toBe(2);
      expect(result.success).toBe(true);

      // Report must not mention venv paths
      if (calls.length > 0) {
        expect(calls[0].content).not.toContain('venv/');
      }
    });

    test('execute() still detects genuinely broken links', async () => {
      await writeFile(
        tempDir,
        'README.md',
        ['# Project', '[broken link](really-missing-file.md)'].join('\n')
      );

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.brokenLinks.length).toBeGreaterThanOrEqual(1);
      expect(result.brokenLinks.some((l) => l.link === 'really-missing-file.md')).toBe(true);
    });
  });
});

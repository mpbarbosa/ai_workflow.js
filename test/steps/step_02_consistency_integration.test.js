/**
 * @fileoverview Integration (E2E) tests for Step 2: Documentation Consistency Analysis
 *
 * These tests exercise Step2ConsistencyAnalyzer.execute() against a real
 * temporary filesystem to verify:
 *  1. Full execute() flow with real file discovery, version checking, and link validation
 *  2. Version inconsistency detection across multiple real doc files
 *  3. Broken internal link detection with real file index
 *  4. Clean pass when all links resolve and versions match
 *  5. Graceful handling when no documentation exists on disk
 *  6. Orchestrator-style instantiation (execute() method contract)
 *  7. Report persistence via backlog.saveStepSummary
 *
 * @group integration
 * @group e2e
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { Step2ConsistencyAnalyzer } from '../../src/steps/step_02_consistency.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a file, creating all parent directories as needed.
 */
async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Build a real fileOps adapter backed by the actual filesystem rooted at
 * `rootDir`. The `glob` implementation mirrors how Step2ConsistencyAnalyzer
 * calls it: `fileOps.glob(pattern, { cwd, ignore })`.
 *
 * glob() returns relative paths (matching the cwd contract).
 * readFile() resolves relative paths against rootDir so that files created
 * in tempDir are read instead of files at process.cwd().
 */
function buildRealFileOps(rootDir) {
  return {
    async glob(pattern, { cwd = rootDir, ignore = [] } = {}) {
      return glob(pattern, { cwd, ignore, nodir: true });
    },
    async readFile(filePath) {
      const resolved = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
      return fs.readFile(resolved, 'utf8');
    },
  };
}

/**
 * Build a captured backlog stub that records saveStepSummary calls.
 */
function buildBacklogStub() {
  const calls = [];
  return {
    stub: {
      saveStepSummary: (step, title, content) => {
        calls.push({ step, title, content });
        return Promise.resolve();
      },
    },
    calls,
  };
}

/**
 * Create a Step2ConsistencyAnalyzer wired to the real filesystem at rootDir.
 */
function buildAnalyzer(rootDir, backlogStub) {
  return new Step2ConsistencyAnalyzer({
    fileOps: buildRealFileOps(rootDir),
    backlog: backlogStub,
    aiHelper: { initialize: () => Promise.resolve(false) },
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Integration: Step2ConsistencyAnalyzer', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(
      process.cwd(),
      '.test-e2e',
      `step-02-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Method contract
  // =========================================================================

  describe('Step2ConsistencyAnalyzer.execute() — method contract', () => {
    test('execute() exists on the prototype', () => {
      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);
      expect(typeof analyzer.execute).toBe('function');
    });

    test('execute() returns a Promise', () => {
      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);
      const result = analyzer.execute(tempDir);
      expect(result).toBeInstanceOf(Promise);
      return result;
    });

    test('execute() result always has a success property', async () => {
      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);
      const result = await analyzer.execute(tempDir);
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  // =========================================================================
  // 2. No documentation present
  // =========================================================================

  describe('Empty project — no documentation files', () => {
    test('skips gracefully when no markdown files exist', async () => {
      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_docs');
    });

    test('does not write a backlog report when skipped', async () => {
      const { stub, calls } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      await analyzer.execute(tempDir);

      expect(calls).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. Clean project — all links valid, versions consistent
  // =========================================================================

  describe('Clean project — no issues', () => {
    beforeEach(async () => {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'my-project', version: '1.2.3' })
      );
      await writeFile(
        path.join(tempDir, 'README.md'),
        '# My Project\n\nVersion 1.2.3\n\nSee [guide](docs/guide.md) for details.\n'
      );
      await writeFile(
        path.join(tempDir, 'docs', 'guide.md'),
        '# Guide\n\nVersion 1.2.3\n\nSee [advanced](advanced.md) for more.\n'
      );
      await writeFile(path.join(tempDir, 'docs', 'advanced.md'), '# Advanced\n\nVersion 1.2.3\n');
    });

    test('reports zero total issues', async () => {
      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.totalIssues).toBe(0);
    });

    test('reports zero broken links', async () => {
      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.brokenLinks).toHaveLength(0);
    });

    test('reports zero version issues', async () => {
      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.versionIssues).toHaveLength(0);
    });

    test('reports the correct number of files checked', async () => {
      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      // README.md and docs/guide.md (package.json is not a doc)
      expect(result.filesChecked).toBeGreaterThanOrEqual(2);
    });

    test('saves a report to the backlog', async () => {
      const { stub, calls } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      await analyzer.execute(tempDir);

      expect(calls).toHaveLength(1);
      expect(calls[0].step).toBe(2);
      expect(calls[0].content).toContain('Step 2');
      expect(calls[0].content).toContain('✅');
    });
  });

  // =========================================================================
  // 4. Version inconsistency detection
  // =========================================================================

  describe('Version inconsistency detection', () => {
    test('detects stale version in a doc file', async () => {
      await writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ version: '2.0.0' }));
      await writeFile(
        path.join(tempDir, 'README.md'),
        '# Project\n\nVersion 1.0.0\n' // stale version
      );

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.versionIssues.length).toBeGreaterThan(0);
      const issue = result.versionIssues[0];
      expect(issue.found).toBe('1.0.0');
      expect(issue.expected).toBe('2.0.0');
    });

    test('detects version mismatches across multiple files', async () => {
      await writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ version: '3.0.0' }));
      await writeFile(path.join(tempDir, 'README.md'), '# Project v1.0.0\n');
      await writeFile(path.join(tempDir, 'CHANGELOG.md'), '## Release 2.0.0\n');

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.versionIssues.length).toBeGreaterThanOrEqual(2);
    });

    test('accepts v-prefixed version matching package.json', async () => {
      await writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ version: '1.5.0' }));
      await writeFile(path.join(tempDir, 'README.md'), '# Project v1.5.0\n');

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.versionIssues).toHaveLength(0);
    });

    test('skips version check when package.json is absent', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n\nVersion 1.0.0\n');

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.versionIssues).toHaveLength(0);
    });
  });

  // =========================================================================
  // 5. Broken link detection
  // =========================================================================

  describe('Broken link detection', () => {
    test('detects a link to a non-existent file', async () => {
      await writeFile(
        path.join(tempDir, 'README.md'),
        '# Project\n\nSee [missing guide](docs/missing.md) for details.\n'
      );

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.brokenLinks.length).toBeGreaterThan(0);
      expect(result.brokenLinks[0].link).toBe('docs/missing.md');
    });

    test('resolves valid relative links correctly', async () => {
      await writeFile(
        path.join(tempDir, 'README.md'),
        '# Project\n\nSee [guide](docs/guide.md).\n'
      );
      await writeFile(path.join(tempDir, 'docs', 'guide.md'), '# Guide\n');

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.brokenLinks).toHaveLength(0);
    });

    test('ignores external https links', async () => {
      await writeFile(
        path.join(tempDir, 'README.md'),
        '# Project\n\nVisit [our site](https://example.com) for details.\n'
      );

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.brokenLinks).toHaveLength(0);
    });

    test('ignores anchor-only links', async () => {
      await writeFile(
        path.join(tempDir, 'README.md'),
        '# Project\n\nSee [section](#installation) below.\n'
      );

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.brokenLinks).toHaveLength(0);
    });

    test('detects multiple broken links across files', async () => {
      await writeFile(
        path.join(tempDir, 'README.md'),
        '[broken1](nowhere/a.md)\n[broken2](nowhere/b.md)\n'
      );
      await writeFile(path.join(tempDir, 'CONTRIBUTING.md'), '[broken3](nowhere/c.md)\n');

      const { stub } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      const result = await analyzer.execute(tempDir);

      expect(result.brokenLinks.length).toBeGreaterThanOrEqual(3);
    });
  });

  // =========================================================================
  // 6. Report content
  // =========================================================================

  describe('Report content', () => {
    test('report contains issue summary counts', async () => {
      await writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      await writeFile(path.join(tempDir, 'README.md'), '[broken](missing.md)\n\nVersion 2.0.0\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      await analyzer.execute(tempDir);

      const report = calls[0].content;
      expect(report).toContain('Files checked');
      expect(report).toContain('Total issues');
      expect(report).toContain('⚠️');
    });

    test('report shows ✅ when no issues found', async () => {
      await writeFile(
        path.join(tempDir, 'README.md'),
        '# Clean project with no links or versions.\n'
      );

      const { stub, calls } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, stub);

      await analyzer.execute(tempDir);

      expect(calls[0].content).toContain('✅');
    });
  });

  // =========================================================================
  // 7. Orchestrator-style integration
  // =========================================================================

  describe('Orchestrator-style instantiation', () => {
    /**
     * Simulate what WorkflowEngine._createStepHandler() does:
     * instantiate the step class with commonDeps and call execute(projectRoot).
     */
    async function simulateOrchestrator(StepClass, commonDeps, projectRoot) {
      const executor = new StepClass(commonDeps);
      if (typeof executor.execute !== 'function') {
        throw new Error(`${StepClass.name} does not have an execute() method`);
      }
      return executor.execute(projectRoot);
    }

    test('does not throw "does not have an execute method"', async () => {
      await expect(
        simulateOrchestrator(Step2ConsistencyAnalyzer, {}, tempDir)
      ).resolves.toBeDefined();
    });

    test('orchestrator-style result has success property', async () => {
      const result = await simulateOrchestrator(Step2ConsistencyAnalyzer, {}, tempDir);
      expect(result).toHaveProperty('success');
    });

    test('execute() with undefined projectRoot does not throw', async () => {
      const analyzer = new Step2ConsistencyAnalyzer({
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
      await expect(analyzer.execute(undefined)).resolves.toHaveProperty('success');
    });
  });
});
